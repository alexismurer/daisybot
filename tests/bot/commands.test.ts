import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageFlags } from 'discord.js';

vi.mock('../../src/db/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { facts: ['likes cats', 'works in TS'] },
        error: null,
      }),
    })),
  },
}));

vi.mock('../../src/memory/shortTerm', () => ({
  shortTermMemory: {
    clear: vi.fn(),
    clearAll: vi.fn(),
  },
}));

vi.mock('../../src/memory/persona', () => ({
  deletePersona: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/config', () => ({
  config: {
    DISCORD_TOKEN: 'tok',
    DISCORD_CLIENT_ID: 'cid',
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'key',
    MODEL_PROVIDER: 'google',
    MODEL_NAME: 'gemini-2.0-flash',
  },
  createChatModel: vi.fn(),
}));

function makeInteraction(commandName: string, channelId = 'chan1') {
  return {
    commandName,
    user: { id: 'user1' },
    channelId,
    replied: false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

describe('/forget', () => {
  it('calls deleteUser and replies with confirmation', async () => {
    const { execute } = await import('../../src/bot/commands/forget');
    const interaction = makeInteraction('forget');
    await execute(interaction as any);
    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('forgotten')
    );
  });

  it('calls deletePersona for the user', async () => {
    const { deletePersona } = await import('../../src/memory/persona');
    const { execute } = await import('../../src/bot/commands/forget');
    const interaction = makeInteraction('forget');
    await execute(interaction as any);
    expect(vi.mocked(deletePersona)).toHaveBeenCalledWith('user1');
  });
});

describe('/memory', () => {
  it('replies with facts in an embed when facts exist', async () => {
    const { execute } = await import('../../src/bot/commands/memory');
    const interaction = makeInteraction('memory');
    await execute(interaction as any);
    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) })
    );
  });
});

describe('/clear', () => {
  it('calls clearChannel and replies with confirmation', async () => {
    const { execute } = await import('../../src/bot/commands/clear');
    const interaction = makeInteraction('clear', 'chan99');
    await execute(interaction as any);
    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('cleared')
    );
  });
});
