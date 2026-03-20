import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/db/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

const mockInvoke = vi.fn().mockResolvedValue({ content: 'Hello there!' });
const mockWithStructuredOutput = vi.fn().mockReturnValue({
  invoke: vi.fn().mockResolvedValue({ newFacts: [] }),
});

vi.mock('../../src/memory/persona', () => ({
  loadPersona: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/config', () => ({
  config: {
    DISCORD_TOKEN: 'tok',
    DISCORD_CLIENT_ID: 'cid',
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'key',
    MODEL_PROVIDER: 'google',
    MODEL_NAME: 'gemini-2.0-flash',
    GOOGLE_API_KEY: 'fake',
  },
  createChatModel: () => ({
    invoke: mockInvoke,
    withStructuredOutput: mockWithStructuredOutput,
  }),
}));

const { agent } = await import('../../src/agent/graph');

describe('agent graph', () => {
  it('flows through all nodes and returns a response', async () => {
    const result = await agent.invoke({
      userId: 'user123',
      channelId: 'chan456',
      userMessage: 'Hello!',
      history: [],
      userFacts: [],
      userPersona: null,
      response: '',
      discordMessage: undefined,
      isNsfwChannel: false,
    });

    expect(typeof result.response).toBe('string');
    expect(result.response).toBe('Hello there!');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('loads persona into state (null when no row)', async () => {
    const { loadPersona } = await import('../../src/memory/persona');
    vi.mocked(loadPersona).mockResolvedValue(null);

    const result = await agent.invoke({
      userId: 'user123',
      channelId: 'chan456',
      userMessage: 'hi',
      history: [],
      userFacts: [],
      userPersona: null,
      response: '',
      discordMessage: undefined,
      isNsfwChannel: false,
    });

    expect(result.userPersona).toBeNull();
  });

  it('calls saveMessages after getting a response', async () => {
    const { supabase } = await import('../../src/db/client');
    await agent.invoke({
      userId: 'user123',
      channelId: 'chan456',
      userMessage: 'test',
      history: [],
      userFacts: [],
      userPersona: null,
      response: '',
      discordMessage: undefined,
      isNsfwChannel: false,
    });
    expect(supabase.from).toHaveBeenCalledWith('conversation_history');
  });
});
