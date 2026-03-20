// tests/agent/nodes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import type { Message } from 'discord.js';

const { mockChatModelInvoke, mockGenerateAndSendImage, mockHasImageIntent, mockExtractImagePrompt } =
  vi.hoisted(() => {
    return {
      mockChatModelInvoke: vi.fn(),
      mockGenerateAndSendImage: vi.fn().mockResolvedValue(undefined),
      mockHasImageIntent: vi.fn().mockReturnValue(false),
      mockExtractImagePrompt: vi.fn().mockReturnValue('a cat'),
    };
  });

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
  createChatModel: () => ({ invoke: mockChatModelInvoke }),
}));

vi.mock('../../src/memory/longTerm', () => ({
  loadHistory: vi.fn().mockResolvedValue([]),
  loadFacts: vi.fn().mockResolvedValue([]),
  saveMessages: vi.fn().mockResolvedValue(undefined),
  upsertFacts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/memory/persona', () => ({
  loadPersona: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/agent/tools/generateImage', () => ({
  generateAndSendImage: mockGenerateAndSendImage,
}));

vi.mock('../../src/agent/utils/imageIntent', () => ({
  hasImageIntent: mockHasImageIntent,
  extractImagePrompt: mockExtractImagePrompt,
}));

const { callLLMNode } = await import('../../src/agent/nodes');

const mockDiscordMessage = { reply: vi.fn() } as unknown as Message;

function baseState(overrides = {}) {
  return {
    userId: 'u1',
    channelId: 'c1',
    userMessage: 'hello',
    history: [],
    userFacts: [],
    userPersona: null,
    response: '',
    discordMessage: undefined as Message | undefined,
    isNsfwChannel: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHasImageIntent.mockReturnValue(false);
  mockExtractImagePrompt.mockReturnValue('a cat');
  mockGenerateAndSendImage.mockResolvedValue(undefined);
});

describe('callLLMNode', () => {
  it('calls chatModel.invoke and returns response', async () => {
    mockChatModelInvoke.mockResolvedValue(new AIMessage('Hello!'));

    const result = await callLLMNode(baseState());

    expect(mockChatModelInvoke).toHaveBeenCalledOnce();
    expect(result.response).toBe('Hello!');
  });

  it('does NOT call generateAndSendImage when isNsfwChannel is false', async () => {
    mockChatModelInvoke.mockResolvedValue(new AIMessage('Hi'));
    mockHasImageIntent.mockReturnValue(true);

    await callLLMNode(baseState({ isNsfwChannel: false, discordMessage: mockDiscordMessage }));

    expect(mockGenerateAndSendImage).not.toHaveBeenCalled();
  });

  it('does NOT call generateAndSendImage when hasImageIntent returns false', async () => {
    mockChatModelInvoke.mockResolvedValue(new AIMessage('Hi'));
    mockHasImageIntent.mockReturnValue(false);

    await callLLMNode(
      baseState({ isNsfwChannel: true, discordMessage: mockDiscordMessage, userMessage: 'hello' })
    );

    expect(mockGenerateAndSendImage).not.toHaveBeenCalled();
  });

  it('does NOT call generateAndSendImage when discordMessage is undefined', async () => {
    mockChatModelInvoke.mockResolvedValue(new AIMessage('Hi'));
    mockHasImageIntent.mockReturnValue(true);

    await callLLMNode(baseState({ isNsfwChannel: true, discordMessage: undefined }));

    expect(mockGenerateAndSendImage).not.toHaveBeenCalled();
  });

  it('calls generateAndSendImage when isNsfwChannel=true, discordMessage set, and hasImageIntent=true', async () => {
    mockChatModelInvoke.mockResolvedValue(new AIMessage('Generating!'));
    mockHasImageIntent.mockReturnValue(true);
    mockExtractImagePrompt.mockReturnValue('a pink rabbit');

    const state = baseState({
      isNsfwChannel: true,
      discordMessage: mockDiscordMessage,
      userMessage: 'draw me a pink rabbit',
    });

    const result = await callLLMNode(state);

    expect(mockGenerateAndSendImage).toHaveBeenCalledWith(
      'a pink rabbit', 1024, 1024, mockDiscordMessage
    );
    expect(result.response).toBe('Generating!');
  });

  it('still returns response even when generateAndSendImage rejects', async () => {
    mockChatModelInvoke.mockResolvedValue(new AIMessage('Generating!'));
    mockHasImageIntent.mockReturnValue(true);
    mockGenerateAndSendImage.mockRejectedValue(new Error('API down'));

    const result = await callLLMNode(
      baseState({ isNsfwChannel: true, discordMessage: mockDiscordMessage, userMessage: 'draw me something' })
    );

    // Drain the microtask queue so the fire-and-forget .catch() settles
    // before the next test runs — prevents unhandled-rejection bleed
    await Promise.resolve();

    expect(result.response).toBe('Generating!');
  });
});
