import { Message, Client } from 'discord.js';
import { agent } from '../../agent/graph';
import { isNsfwChannel } from '../utils/isNsfwChannel';

// ~55 WPM average chat typing speed + 1.5s base thinking time, capped at 9s
function naturalTypingDelay(text: string): number {
  const CHARS_PER_MS = 5 / 1000; // 5 chars/sec
  const THINKING_MS = 1500;
  const typingMs = text.length / CHARS_PER_MS;
  return Math.min(9000, Math.max(1200, THINKING_MS + typingMs));
}

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 5000;
const processingMessages = new Set<string>();

export function resetCooldowns(): void {
  cooldowns.clear();
  processingMessages.clear();
}

export function registerMessageCreate(client: Client): void {
  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;
    if (!client.user) return;
    const isDM = !message.guild;
    if (!isDM && !message.mentions.has(client.user)) return;

    if (processingMessages.has(message.id)) return;
    processingMessages.add(message.id);

    const userId = message.author.id;
    const now = Date.now();

    if (now - (cooldowns.get(userId) ?? 0) < COOLDOWN_MS) {
      await message.reply({
        content: 'Please wait a moment before sending another message.',
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    cooldowns.set(userId, now);

    const userMessage = message.content
      .replace(`<@${client.user.id}>`, '')
      .replace(`<@!${client.user.id}>`, '')
      .trim();

    if (!userMessage) {
      await message.reply({ content: 'Hi! How can I help you?', allowedMentions: { repliedUser: false } });
      return;
    }

    let typingInterval: ReturnType<typeof setInterval> | undefined;
    try {
      if ('sendTyping' in message.channel) {
        await (message.channel as { sendTyping: () => Promise<void> }).sendTyping();
        typingInterval = setInterval(() => {
          ('sendTyping' in message.channel) &&
            (message.channel as { sendTyping: () => Promise<void> }).sendTyping().catch(() => {});
        }, 8000);
      }

      const startTime = Date.now();
      const nsfw = isNsfwChannel(message);
      const result = await agent.invoke({
        userId,
        channelId: message.channelId,
        userMessage,
        history: [],
        userFacts: [],
        userPersona: null,
        response: '',
        discordMessage: message,
        isNsfwChannel: nsfw,
      });

      const elapsed = Date.now() - startTime;
      const delay = naturalTypingDelay(result.response);
      const remaining = delay - elapsed;
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));

      await message.reply({
        content: result.response || undefined,
        files: result.imageBuffer
          ? [{ attachment: result.imageBuffer, name: 'image.png' }]
          : undefined,
        allowedMentions: { repliedUser: false },
      });
    } catch (err) {
      console.error('[messageCreate]', err);
      await message.reply({
        content: 'Sorry, something went wrong. Please try again.',
        allowedMentions: { repliedUser: false },
      });
    } finally {
      clearInterval(typingInterval);
      processingMessages.delete(message.id);
    }
  });
}
