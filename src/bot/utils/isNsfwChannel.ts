import { ChannelType } from 'discord.js';
import type { Message, TextChannel } from 'discord.js';

export function isNsfwChannel(message: Message): boolean {
  if (!message.guild) return true; // DMs are always allowed
  return (
    message.channel.type === ChannelType.GuildText &&
    (message.channel as TextChannel).nsfw
  );
}
