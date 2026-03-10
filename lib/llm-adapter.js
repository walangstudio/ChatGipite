import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const LOG_FILE = path.join(__dirname, '../chatgipite.log');
const log = process.env.CHATGIPITE_DEBUG
  ? (msg) => {
      const line = `${new Date().toISOString()} [adapter] ${msg}\n`;
      process.stderr.write(line);
      fs.appendFileSync(LOG_FILE, line);
    }
  : () => {};

let config = null;

function loadConfig() {
  if (config) return config;
  try {
    const yaml = require('js-yaml');
    const defaultPath = path.join(__dirname, '../config/providers.yaml');
    const envPath = process.env.CHATGIPITE_CONFIG;
    const localYaml = path.join(process.cwd(), 'providers.yaml');
    const localJson = path.join(process.cwd(), 'providers.json');
    const resolved = envPath && fs.existsSync(envPath) ? envPath
      : fs.existsSync(localYaml) ? localYaml
      : fs.existsSync(localJson) ? localJson
      : defaultPath;
    const raw = fs.readFileSync(resolved, 'utf-8');
    config = yaml.load(raw);
    log(`config loaded from: ${resolved}`);
  } catch {
    config = { default_provider: 'anthropic', providers: {} };
  }
  return config;
}

function getApiKey(provider) {
  const cfg = loadConfig();
  return (
    process.env[`${provider.toUpperCase()}_API_KEY`] ||
    cfg.providers?.[provider]?.api_key ||
    null
  );
}

const defaultModels = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  google: 'gemini-1.5-pro',
  ollama: 'llama3',
};

function getModel(provider, agentId) {
  const cfg = loadConfig();
  return (
    cfg.model_per_agent?.[agentId] ||
    cfg.providers?.[provider]?.default_model ||
    defaultModels[provider] ||
    null
  );
}

function dispatchPassthrough(systemPrompt, task, context) {
  const body = context ? `${context}\n\n---\n\nTask: ${task}` : task;
  return `> **[ChatGipite passthrough]** No LLM API key is configured. You (the host model) are acting as the agent. Complete the task below according to the agent spec.\n\n---\n\n${systemPrompt}\n\n${body}`;
}

async function dispatchAnthropic(model, systemPrompt, task, context) {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) return dispatchPassthrough(systemPrompt, task, context);

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey });

    const response = await client.messages.create({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      messages: [{ role: 'user', content: context ? `${context}\n\n---\n\nTask: ${task}` : task }],
    });

    return response.content[0].text;
  } catch {
    return dispatchPassthrough(systemPrompt, task, context);
  }
}

async function dispatchOpenAICompat(model, systemPrompt, task, context, baseUrl, apiKey) {

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({
        model,
        max_tokens: 8096,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context ? `${context}\n\n---\n\nTask: ${task}` : task },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error?.message || res.statusText);
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`empty response: ${JSON.stringify(data)}`);
    return content;
  } catch (e) {
    log(`openai-compat error: ${e.message}`);
    return dispatchPassthrough(systemPrompt, task, context);
  }
}

async function dispatchOllama(model, systemPrompt, task, context) {
  const cfg = loadConfig();
  const baseUrl = cfg.providers?.ollama?.base_url || 'http://localhost:11434';

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        prompt: context ? `${context}\n\n---\n\nTask: ${task}` : task,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = await res.json();
    return data.response;
  } catch {
    return dispatchPassthrough(systemPrompt, task, context);
  }
}

export async function dispatch(agentId, agentSpec, task, context = '') {
  const cfg = loadConfig();
  const provider = cfg.agent_providers?.[agentId] || cfg.default_provider || 'anthropic';
  const model = getModel(provider, agentId);

  const providerCfg = cfg.providers?.[provider] || {};
  const type = providerCfg.type;

  log(`dispatch agent=${agentId} provider=${provider} model=${model}`);

  if (provider === 'anthropic') return dispatchAnthropic(model, agentSpec, task, context);
  if (provider === 'ollama')    return dispatchOllama(model, agentSpec, task, context);
  if (provider === 'openai' || type === 'openai_compatible') {
    const baseUrl = providerCfg.base_url || 'https://api.openai.com/v1';
    const apiKey  = getApiKey(provider);
    return dispatchOpenAICompat(model, agentSpec, task, context, baseUrl, apiKey);
  }
  return dispatchPassthrough(agentSpec, task, context);
}
