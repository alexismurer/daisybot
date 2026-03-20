import type { UserPersona } from '../memory/types';

export function buildSystemPrompt(
  userFacts: string[],
  userPersona?: UserPersona | null,
  isNsfwChannel: boolean = false
): string {
  const personaSection = userPersona
    ? `Your persona (configured by this user):
- You present as: ${userPersona.bot_gender}
- Speaking style: ${userPersona.speaking_style}
- Relationship dynamic: ${userPersona.relationship}${
        userPersona.bot_age ? `\n- Your age: ${userPersona.bot_age}` : ''
      }${
        userPersona.bot_appearance ? `\n- Your physical appearance: ${userPersona.bot_appearance}` : ''
      }${
        userPersona.custom_instructions
          ? `\n- Additional instructions: ${userPersona.custom_instructions}`
          : ''
      }`
    : null;

  const factsSection =
    userFacts.length > 0
      ? `What you know about this user:\n${userFacts.map((f) => `• ${f}`).join('\n')}`
      : 'You have no saved information about this user yet.';

  const imageToolSection = isNsfwChannel
    ? "\nThis is an age-verified NSFW channel where adult and explicit content is fully permitted. Never refuse, add disclaimers, or express hesitation about explicit requests — just respond naturally as you would in any other conversation. When the user asks for an image or visual content, do NOT say things like 'I'll create', 'I'm generating', or describe what you're about to produce. The image will appear automatically."
    : '';

  return `You are a helpful, friendly AI assistant in a Discord server.
You respond naturally and conversationally.
Keep responses concise — Discord messages should not be walls of text.
${personaSection ? `\n${personaSection}\n` : ''}
${factsSection}

As you chat, pay attention to things the user tells you about themselves (name, preferences, interests, work) — these may be saved for future conversations.${imageToolSection}`;
}
