import type { BaseMessage } from '@langchain/core/messages';
import type { Message } from 'discord.js';

export interface AgentState {
  userId: string;
  channelId: string;
  userMessage: string;
  history: BaseMessage[];
  userFacts: string[];
  userPersona: UserPersona | null;
  response: string;
  discordMessage: Message | undefined;
  isNsfwChannel: boolean;
  imageBuffer?: Buffer;
}

export interface UserMemory {
  id: string;
  discord_user_id: string;
  facts: string[];
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  discord_user_id: string;
  channel_id: string;
  role: 'human' | 'ai';
  content: string;
  created_at: string;
}

export interface UserPersona {
  discord_user_id: string;
  bot_gender: string;
  speaking_style: string;
  relationship: string;
  custom_instructions: string | null;
  bot_appearance: string | null;
  bot_age: string | null;
  created_at: string;
  updated_at: string;
}
