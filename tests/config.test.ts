import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function setEnv(overrides: Record<string, string> = {}) {
  const base: Record<string, string> = {
    DISCORD_TOKEN: 'tok',
    DISCORD_CLIENT_ID: 'cid',
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'key',
    MODEL_PROVIDER: 'google',
    MODEL_NAME: 'gemini-2.0-flash',
    GOOGLE_API_KEY: 'fake-google-key',
  };
  Object.assign(process.env, base, overrides);
}

function clearEnv() {
  for (const k of [
    'DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
    'MODEL_PROVIDER', 'MODEL_NAME', 'GOOGLE_API_KEY', 'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY', 'GROQ_API_KEY',
  ]) {
    delete process.env[k];
  }
}

beforeEach(() => {
  vi.resetModules();
  clearEnv();
});

afterEach(() => {
  clearEnv();
});

describe('getConfig — validation', () => {
  it('throws if DISCORD_TOKEN is missing', async () => {
    setEnv({ DISCORD_TOKEN: '' });
    await expect(import('../src/config')).rejects.toThrow();
  });

  it('throws if SUPABASE_URL is not a valid URL', async () => {
    setEnv({ SUPABASE_URL: 'not-a-url' });
    await expect(import('../src/config')).rejects.toThrow();
  });

  it('parses successfully with all required vars', async () => {
    setEnv();
    const { config } = await import('../src/config');
    expect(config.DISCORD_TOKEN).toBe('tok');
    expect(config.MODEL_PROVIDER).toBe('google');
  });
});

describe('createChatModel — provider switching', () => {
  it('returns a model for google provider', async () => {
    setEnv({ MODEL_PROVIDER: 'google', GOOGLE_API_KEY: 'key' });
    const { createChatModel } = await import('../src/config');
    expect(() => createChatModel()).not.toThrow();
  });

  it('returns a model for openai provider', async () => {
    setEnv({ MODEL_PROVIDER: 'openai', MODEL_NAME: 'gpt-4o', OPENAI_API_KEY: 'key' });
    const { createChatModel } = await import('../src/config');
    expect(() => createChatModel()).not.toThrow();
  });

  it('returns a model for anthropic provider', async () => {
    setEnv({ MODEL_PROVIDER: 'anthropic', MODEL_NAME: 'claude-3-5-haiku-latest', ANTHROPIC_API_KEY: 'key' });
    const { createChatModel } = await import('../src/config');
    expect(() => createChatModel()).not.toThrow();
  });

  it('defaults to Groq with qwen/qwen3.8-27b', async () => {
    setEnv();
    delete process.env.MODEL_PROVIDER;
    delete process.env.MODEL_NAME;
    const { config } = await import('../src/config');
    expect(config.MODEL_PROVIDER).toBe('groq');
    expect(config.MODEL_NAME).toBe('qwen/qwen3.8-27b');
  });

  it('keeps Groq reasoning out of replies', async () => {
    setEnv({ MODEL_PROVIDER: 'groq', MODEL_NAME: 'qwen/qwen3.8-27b', GROQ_API_KEY: 'key' });
    const { createChatModel } = await import('../src/config');
    const model = createChatModel() as unknown as { reasoningEffort: string; reasoningFormat: string };
    expect(model.reasoningEffort).toBe('none');
    expect(model.reasoningFormat).toBe('hidden');
  });

  it('returns a model for groq provider', async () => {
    setEnv({ MODEL_PROVIDER: 'groq', MODEL_NAME: 'llama3-8b-8192', GROQ_API_KEY: 'key' });
    const { createChatModel } = await import('../src/config');
    expect(() => createChatModel()).not.toThrow();
  });
});
