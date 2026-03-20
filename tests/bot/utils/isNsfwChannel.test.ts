import { describe, it, expect } from 'vitest';
import { ChannelType } from 'discord.js';
import { isNsfwChannel } from '../../../src/bot/utils/isNsfwChannel.js';
import type { Message } from 'discord.js';

function msg(guild: object | null, channel: object): Message {
  return { guild, channel } as unknown as Message;
}

describe('isNsfwChannel', () => {
  it('returns true for DMs (no guild)', () => {
    expect(isNsfwChannel(msg(null, { type: ChannelType.DM }))).toBe(true);
  });

  it('returns true for GuildText channel with nsfw: true', () => {
    expect(
      isNsfwChannel(msg({ id: '1' }, { type: ChannelType.GuildText, nsfw: true }))
    ).toBe(true);
  });

  it('returns false for GuildText channel with nsfw: false', () => {
    expect(
      isNsfwChannel(msg({ id: '1' }, { type: ChannelType.GuildText, nsfw: false }))
    ).toBe(false);
  });

  it('returns false for GuildPublicThread (non-GuildText)', () => {
    expect(
      isNsfwChannel(msg({ id: '1' }, { type: ChannelType.PublicThread }))
    ).toBe(false);
  });

  it('returns false for GuildVoice channel', () => {
    expect(
      isNsfwChannel(msg({ id: '1' }, { type: ChannelType.GuildVoice }))
    ).toBe(false);
  });
});
