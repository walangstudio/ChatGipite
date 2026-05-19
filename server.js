#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as memory from './lib/memory.js';
import { handlers } from './lib/handlers.js';
import { validate } from './lib/schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools/index.json'), 'utf-8'));
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

const DB_PATH = path.join(__dirname, 'db/chatgipite.sqlite');
const LOG_FILE = path.join(__dirname, 'chatgipite.log');

const debug = !!process.env.CHATGIPITE_DEBUG;
const log = debug
  ? (msg) => {
      const line = `${new Date().toISOString()} ${msg}\n`;
      process.stderr.write(line);
      fs.appendFileSync(LOG_FILE, line);
    }
  : () => {};

log(`server starting`);
log(`cwd: ${process.cwd()}`);
log(`CHATGIPITE_CONFIG: ${process.env.CHATGIPITE_CONFIG || '(not set)'}`);

memory.init(DB_PATH);

function errStructured(code, message, meta = {}) {
  return {
    content: [{ type: 'text', text: `❌ [${code}] ${message}` }],
    isError: true,
    _meta: { code, ...meta },
  };
}

const server = new Server(
  { name: PKG.name, version: PKG.version },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS.tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs = {} } = request.params;

  const handler = handlers[name];
  if (!handler) {
    return errStructured('UNKNOWN_TOOL', `Unknown tool: ${name}`);
  }

  const v = validate(name, rawArgs);
  if (!v.ok) {
    return errStructured(v.code, v.message, { issues: v.issues });
  }

  try {
    return await handler(v.value);
  } catch (e) {
    log(`${name} error: ${e.stack || e.message}`);
    return errStructured('INTERNAL', `${name} failed: ${e.message}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
