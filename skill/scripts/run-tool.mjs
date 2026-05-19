#!/usr/bin/env node
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveHome() {
  if (process.env.CHATGIPITE_HOME && fs.existsSync(path.join(process.env.CHATGIPITE_HOME, 'package.json'))) {
    return path.resolve(process.env.CHATGIPITE_HOME);
  }
  // skill/scripts/run-tool.mjs → ../../ is the repo root when installed via symlink/junction
  const repoCandidate = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(repoCandidate, 'lib', 'handlers.js'))) {
    return repoCandidate;
  }
  return null;
}

function fail(code, message, meta) {
  process.stderr.write(JSON.stringify({ code, message, ...(meta || {}) }) + '\n');
  process.exit(2);
}

const [, , toolName, jsonArgs = '{}'] = process.argv;
if (!toolName) fail('USAGE', 'usage: run-tool.mjs <tool_name> \'<json_args>\'');

let args;
try { args = JSON.parse(jsonArgs); }
catch (e) { fail('BAD_JSON', `Could not parse args JSON: ${e.message}`); }

const home = resolveHome();
if (!home) fail('NO_HOME', 'Could not locate ChatGipite. Set CHATGIPITE_HOME to the absolute path of the repo.');

const handlersUrl = pathToFileURL(path.join(home, 'lib', 'handlers.js')).href;
const schemasUrl = pathToFileURL(path.join(home, 'lib', 'schemas.js')).href;
const memoryUrl = pathToFileURL(path.join(home, 'lib', 'memory.js')).href;

const memory = await import(memoryUrl);
const { handlers } = await import(handlersUrl);
const { validate } = await import(schemasUrl);

memory.init(path.join(home, 'db', 'chatgipite.sqlite'));

const handler = handlers[toolName];
if (!handler) fail('UNKNOWN_TOOL', `Unknown tool: ${toolName}`);

const v = validate(toolName, args);
if (!v.ok) fail(v.code, v.message, { issues: v.issues });

try {
  const result = await handler(v.value);
  const text = result.content?.find?.((c) => c.type === 'text')?.text ?? '';
  process.stdout.write(text + '\n');
  if (result.isError) process.exit(1);
} catch (e) {
  fail('INTERNAL', `${toolName} failed: ${e.message}`);
}
