import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let config = null;

function loadConfig() {
  if (config) return config;
  try {
    const yaml = require('js-yaml');
    const raw = fs.readFileSync(path.join(__dirname, '../config/providers.yaml'), 'utf-8');
    config = yaml.load(raw);
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
  return `${systemPrompt}\n\n${body}`;
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

  switch (provider) {
    case 'anthropic': return dispatchAnthropic(model, agentSpec, task, context);
    case 'ollama':    return dispatchOllama(model, agentSpec, task, context);
    default:
      return dispatchPassthrough(agentSpec, task, context);
  }
}
