import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAgentInvoke = vi.hoisted(() => vi.fn().mockResolvedValue({ response: 'Hi there!' }));
const mockIsNsfwChannel = vi.hoisted(() => vi.fn().mockReturnValue(false));

vi.mock('../../src/agent/graph', () => ({
  agent: { invoke: mockAgentInvoke },
}));

vi.mock('../../src/bot/utils/isNsfwChannel', () => ({
  isNsfwChannel: mockIsNsfwChannel,
}));

vi.mock('../../src/config', () => ({
  config: {
    DISCORD_TOKEN: 'tok', DISCORD_CLIENT_ID: 'cid',
    SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'key',
    MODEL_PROVIDER: 'google', MODEL_NAME: 'gemini-2.0-flash',
  },
  createChatModel: vi.fn(),
}));

import { registerMessageCreate, resetCooldowns } from '../../src/bot/events/messageCreate';

function makeClient(botId = 'bot1') {
  const handlers: Record<string, Function> = {};
  return {
    user: { id: botId },
    on: (event: string, handler: Function) => { handlers[event] = handler; },
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
}

function makeMessage(content: string, authorBot = false) {
  return {
    content,
    author: { id: 'user1', bot: authorBot },
    channelId: 'chan1',
    mentions: { has: vi.fn().mockReturnValue(true) },
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  resetCooldowns();
});

describe('messageCreate handler', () => {
  it('ignores messages from bots', async () => {
    const client = makeClient();
    registerMessageCreate(client as any);
    const msg = makeMessage('<@bot1> hello', true);
    await client.emit('messageCreate', msg);
    expect(mockAgentInvoke).not.toHaveBeenCalled();
  });

  it('invokes agent when bot is mentioned', async () => {
    const client = makeClient();
    registerMessageCreate(client as any);
    const msg = makeMessage('<@bot1> what is the weather?');
    await client.emit('messageCreate', msg);
    expect(mockAgentInvoke).toHaveBeenCalledOnce();
    expect(msg.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Hi there!' })
    );
  });

  it('enforces 5s cooldown between messages from same user', async () => {
    const client = makeClient();
    registerMessageCreate(client as any);
    const msg1 = makeMessage('<@bot1> first');
    const msg2 = makeMessage('<@bot1> second');

    await client.emit('messageCreate', msg1);
    await client.emit('messageCreate', msg2);

    expect(mockAgentInvoke).toHaveBeenCalledOnce();
    expect(msg2.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Please wait a moment before sending another message.' })
    );
  });

  it('allows message after cooldown expires', async () => {
    const client = makeClient();
    registerMessageCreate(client as any);
    const msg1 = makeMessage('<@bot1> first');
    const msg2 = makeMessage('<@bot1> second');

    await client.emit('messageCreate', msg1);
    vi.advanceTimersByTime(6000);
    await client.emit('messageCreate', msg2);

    expect(mockAgentInvoke).toHaveBeenCalledTimes(2);
  });

  it('passes isNsfwChannel and discordMessage to agent.invoke', async () => {
    mockIsNsfwChannel.mockReturnValue(true);
    const client = makeClient();
    registerMessageCreate(client as any);
    const msg = makeMessage('<@bot1> generate an image');
    await client.emit('messageCreate', msg);
    expect(mockAgentInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        isNsfwChannel: true,
        discordMessage: msg,
        userPersona: null,
      })
    );
  });
});
