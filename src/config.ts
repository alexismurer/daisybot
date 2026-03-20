import 'dotenv/config';
import { z } from 'zod';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  MODEL_PROVIDER: z.enum(['google', 'openai', 'anthropic', 'groq']).default('google'),
  MODEL_NAME: z.string().default('gemini-2.0-flash'),
  GOOGLE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  POLLINATIONS_API_KEY: z.string().optional(),
});

export const config = envSchema.parse(process.env);

export function createChatModel(): BaseChatModel {
  const { MODEL_PROVIDER, MODEL_NAME } = config;

  switch (MODEL_PROVIDER) {
    case 'google':
      return new ChatGoogleGenerativeAI({ model: MODEL_NAME, apiKey: config.GOOGLE_API_KEY });
    case 'openai':
      return new ChatOpenAI({ model: MODEL_NAME, apiKey: config.OPENAI_API_KEY });
    case 'anthropic':
      return new ChatAnthropic({ model: MODEL_NAME, apiKey: config.ANTHROPIC_API_KEY });
    case 'groq':
      return new ChatGroq({ model: MODEL_NAME, apiKey: config.GROQ_API_KEY });
  }
}
