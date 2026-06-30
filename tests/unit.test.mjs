// Deterministic tests for ChatGipite — no LLM calls, no network.
// Covers: tool registration, Zod validation, SQLite persistence, MCP smoke.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { validate } from '../lib/schemas.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// ---------------------------------------------------------------------------
// 1. Tool registration
// ---------------------------------------------------------------------------
describe('tool registration', () => {
  const toolsIndex = JSON.parse(readFileSync(join(ROOT, 'tools/index.json'), 'utf-8'));

  it('tools/index.json loads without throwing', () => {
    assert.ok(Array.isArray(toolsIndex.tools), 'tools must be an array');
  });

  it('registers exactly 40 tools', () => {
    assert.strictEqual(toolsIndex.tools.length, 40);
  });

  it('every tool has a name string and inputSchema.type=object', () => {
    for (const tool of toolsIndex.tools) {
      assert.ok(
        typeof tool.name === 'string' && tool.name.length > 0,
        `tool missing name: ${JSON.stringify(tool)}`,
      );
      assert.ok(
        tool.inputSchema && tool.inputSchema.type === 'object',
        `tool ${tool.name}: inputSchema must have type "object"`,
      );
    }
  });

  it('handlers map keys match tool names exactly', async () => {
    const { handlers } = await import('../lib/handlers.js');
    const toolNames = new Set(toolsIndex.tools.map((t) => t.name));
    const handlerKeys = new Set(Object.keys(handlers));
    for (const n of toolNames) {
      assert.ok(handlerKeys.has(n), `no handler registered for tool "${n}"`);
    }
    for (const n of handlerKeys) {
      assert.ok(toolNames.has(n), `handler "${n}" not listed in tools/index.json`);
    }
    assert.strictEqual(handlerKeys.size, toolNames.size);
  });
});

// ---------------------------------------------------------------------------
// 2. Zod input validation
// ---------------------------------------------------------------------------
describe('input validation (Zod schemas)', () => {
  // biz_generate
  it('biz_generate: empty input passes with default count=1', () => {
    const r = validate('biz_generate', {});
    assert.ok(r.ok, r.message);
    assert.strictEqual(r.value.count, 1);
  });

  it('biz_generate: count above max (11) rejects', () => {
    assert.strictEqual(validate('biz_generate', { count: 11 }).ok, false);
  });

  it('biz_generate: count below min (0) rejects', () => {
    assert.strictEqual(validate('biz_generate', { count: 0 }).ok, false);
  });

  // biz_validate
  it('biz_validate: valid idea passes', () => {
    const r = validate('biz_validate', { idea: 'AI-powered meal planner for diabetics' });
    assert.ok(r.ok);
  });

  it('biz_validate: idea shorter than min(3) rejects', () => {
    assert.strictEqual(validate('biz_validate', { idea: 'ab' }).ok, false);
  });

  it('biz_validate: missing required idea rejects', () => {
    assert.strictEqual(validate('biz_validate', {}).ok, false);
  });

  // biz_canvas
  it('biz_canvas: valid slug and canvas_type passes', () => {
    const r = validate('biz_canvas', { idea_slug: 'my-saas-idea', canvas_type: 'lean' });
    assert.ok(r.ok);
  });

  it('biz_canvas: default canvas_type is bmc', () => {
    const r = validate('biz_canvas', { idea_slug: 'my-idea' });
    assert.ok(r.ok);
    assert.strictEqual(r.value.canvas_type, 'bmc');
  });

  it('biz_canvas: invalid canvas_type rejects', () => {
    assert.strictEqual(
      validate('biz_canvas', { idea_slug: 'my-idea', canvas_type: 'invalid' }).ok,
      false,
    );
  });

  it('biz_canvas: slug with uppercase rejects (path traversal boundary)', () => {
    assert.strictEqual(validate('biz_canvas', { idea_slug: 'MyIdea' }).ok, false);
  });

  it('biz_canvas: slug with path separators rejects', () => {
    assert.strictEqual(validate('biz_canvas', { idea_slug: '../etc/passwd' }).ok, false);
  });

  // biz_trends
  it('biz_trends: valid horizon enum passes', () => {
    const r = validate('biz_trends', { idea_slug: 'my-idea', horizon: '5yr' });
    assert.ok(r.ok);
    assert.strictEqual(r.value.horizon, '5yr');
  });

  it('biz_trends: default horizon is 3yr', () => {
    const r = validate('biz_trends', { idea_slug: 'my-idea' });
    assert.ok(r.ok);
    assert.strictEqual(r.value.horizon, '3yr');
  });

  it('biz_trends: invalid horizon rejects', () => {
    assert.strictEqual(validate('biz_trends', { idea_slug: 'my-idea', horizon: '10yr' }).ok, false);
  });

  // biz_perspectives (union discriminator)
  it('biz_perspectives: must provide idea_slug or product — neither rejects', () => {
    assert.strictEqual(validate('biz_perspectives', {}).ok, false);
  });

  it('biz_perspectives: idea_slug alone passes', () => {
    assert.ok(validate('biz_perspectives', { idea_slug: 'my-idea' }).ok);
  });

  it('biz_perspectives: product alone passes', () => {
    assert.ok(
      validate('biz_perspectives', { product: 'an app that helps you track your sleep' }).ok,
    );
  });

  // biz_recall
  it('biz_recall: valid query passes with default limit=10', () => {
    const r = validate('biz_recall', { query: 'meal planning' });
    assert.ok(r.ok);
    assert.strictEqual(r.value.limit, 10);
  });

  it('biz_recall: empty query rejects (min 1)', () => {
    assert.strictEqual(validate('biz_recall', { query: '' }).ok, false);
  });

  // Error format
  it('unknown tool returns UNKNOWN_TOOL code', () => {
    const r = validate('not_a_real_tool', {});
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'UNKNOWN_TOOL');
  });

  it('invalid input returns INVALID_INPUT code with issues array', () => {
    const r = validate('biz_validate', { idea: 'x' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'INVALID_INPUT');
    assert.ok(Array.isArray(r.issues));
    assert.ok(r.issues.length > 0);
  });
});

// ---------------------------------------------------------------------------
// 3. SQLite persistence
// ---------------------------------------------------------------------------
describe('SQLite persistence (memory module)', () => {
  let tmpDir;
  let memory;

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'chatgipite-test-'));
    memory = await import('../lib/memory.js');
    memory.init(join(tmpDir, 'test.sqlite'));
  });

  after(() => {
    memory.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('store() then recall() returns the written row', () => {
    memory.store('test_ideas', 'hello world content for recall', { extra: 1 });
    const rows = memory.recall('hello world', 10);
    assert.ok(rows.length >= 1, 'recall must return at least one row');
    const row = rows.find((r) => r.type === 'test_ideas');
    assert.ok(row, 'row with type test_ideas must exist');
    assert.ok(row.content.includes('hello world'));
    assert.ok(typeof row.created_at === 'string');
  });

  it('type filter restricts results to the given type', () => {
    memory.store('alpha_type', 'apple juice concept', {});
    memory.store('beta_type', 'apple cider idea', {});
    const alphas = memory.recall('apple', 10, 'alpha_type');
    assert.ok(alphas.length >= 1, 'at least one alpha row');
    assert.ok(
      alphas.every((r) => r.type === 'alpha_type'),
      'type filter must exclude other types',
    );
  });

  it('recall returns empty array when no rows match', () => {
    const rows = memory.recall('zzz_xyzzy_no_match_ever', 5);
    assert.strictEqual(rows.length, 0);
  });

  it('summary() returns a string (may be empty)', () => {
    const s = memory.summary(30);
    assert.ok(typeof s === 'string');
  });
});

// ---------------------------------------------------------------------------
// 4. MCP protocol smoke
// ---------------------------------------------------------------------------
describe('MCP protocol smoke', () => {
  it('server responds to tools/list with all 40 tools', { timeout: 10000 }, () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(ROOT, 'server.js')], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CHATGIPITE_DEBUG: '' },
      });

      let buf = '';
      let toolsResp = null;
      let done = false;

      const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');

      const finish = (err) => {
        if (done) return;
        done = true;
        clearTimeout(killer);
        try { child.stdin.destroy(); } catch {}
        child.kill('SIGKILL'); // never let the spawned server outlive the test
        err ? reject(err) : resolve();
      };

      const killer = setTimeout(
        () => finish(new Error('server did not respond to tools/list in time')),
        8000,
      );

      child.on('error', finish);
      child.on('close', () =>
        finish(toolsResp ? undefined : new Error('server closed before tools/list response')),
      );

      child.stdout.on('data', (chunk) => {
        buf += chunk.toString();
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let msg;
          try { msg = JSON.parse(line); } catch { continue; }
          if (msg.id === 1) {
            // initialize acked — drive the rest of the handshake off the response, not a timer
            send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
            send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
          } else if (msg.id === 2 && msg.result?.tools) {
            toolsResp = msg;
            try {
              assert.strictEqual(msg.result.tools.length, 40, 'tools/list must return exactly 40 tools');
              finish();
            } catch (e) {
              finish(e);
            }
          }
        }
      });

      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'chatgipite-test', version: '0.0.0' },
        },
      });
    }),
  );
});
