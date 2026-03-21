import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from '../config';
import { shortTermMemory } from '../memory/shortTerm';
import { loadHistory, loadFacts, saveMessages, upsertFacts } from '../memory/longTerm';
import { buildSystemPrompt } from './prompts';
import { loadPersona, updateBotAppearance } from '../memory/persona';
import { fetchImageBuffer } from './tools/generateImage';
import { hasImageIntent } from './utils/imageIntent';
import type { AgentState } from '../memory/types';

function isSelfImageRequest(message: string): boolean {
  return /\b(of you|of yourself|yourself|send me (a |one )?(pic|picture|photo|image)|picture of you)\b/i.test(message);
}

function isSelfDescriptiveQuestion(message: string): boolean {
  return /\b(how old|your age|old are you|describe yourself|what do you look|what are you like|tell me about yourself|your appearance|your looks|what.*look like)\b/i.test(message);
}

const chatModel = createChatModel();

async function extractAndSaveAppearance(state: AgentState, botResponse: string): Promise<void> {
  try {
    const result = await chatModel.invoke([
      new SystemMessage(
        'Extract the bot\'s physical appearance from the response. Return only valid JSON with no markdown: {"appearance": "concise description of hair, eyes, body, clothing etc.", "age": "age or age range if mentioned, otherwise null"}. If no appearance is described, return {"appearance": null, "age": null}.'
      ),
      new HumanMessage(`Bot response: ${botResponse}`),
    ]);

    const raw = typeof result.content === 'string' ? result.content : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    const newAge: string | null = parsed.age ?? null;
    const newAppearance: string | null = parsed.appearance ?? null;

    if (!newAppearance && !newAge) return;

    // Merge appearance (accumulate details), take new age if provided
    const mergedAppearance = newAppearance
      ? (state.userPersona?.bot_appearance
          ? `${state.userPersona.bot_appearance}; ${newAppearance}`
          : newAppearance)
      : (state.userPersona?.bot_appearance ?? null);

    const mergedAge = newAge ?? state.userPersona?.bot_age ?? null;

    await updateBotAppearance(state.userId, mergedAppearance, mergedAge);

    if (state.userPersona) {
      if (mergedAppearance) state.userPersona.bot_appearance = mergedAppearance;
      if (mergedAge) state.userPersona.bot_age = mergedAge;
    }
  } catch (err) {
    console.error('[extractAndSaveAppearance] error:', err);
  }
}

async function generateImagePrompt(state: AgentState, botResponse: string): Promise<string> {
  const personaDesc = state.userPersona
    ? `You present as: ${state.userPersona.bot_gender}. Speaking style: ${state.userPersona.speaking_style}. Relationship: ${state.userPersona.relationship}.${state.userPersona.custom_instructions ? ` Additional: ${state.userPersona.custom_instructions}` : ''}`
    : 'A helpful AI assistant.';

  const result = await chatModel.invoke([
    new SystemMessage(
      'You are an expert Flux image generation prompt writer. Given a persona, a user request, and what the bot described it will create, write a single vivid, detailed image generation prompt. Output ONLY the prompt text — no explanation, no quotes, no markdown.'
    ),
    new HumanMessage(
      `Persona: ${personaDesc}\n\nUser request: ${state.userMessage}\n\nBot described: ${botResponse}\n\nWrite the image generation prompt:`
    ),
  ]);

  return typeof result.content === 'string' ? result.content.trim() : state.userMessage;
}

export async function loadMemoryNode(state: AgentState): Promise<Partial<AgentState>> {
  const history = await loadHistory(state.userId, state.channelId);
  shortTermMemory.set(`${state.userId}:${state.channelId}`, history);
  const userFacts = await loadFacts(state.userId);
  const userPersona = await loadPersona(state.userId);
  return { history, userFacts, userPersona };
}

export async function callLLMNode(state: AgentState): Promise<Partial<AgentState>> {
  const messages = [
    new SystemMessage(buildSystemPrompt(state.userFacts, state.userPersona, state.isNsfwChannel)),
    ...state.history,
    new HumanMessage(state.userMessage),
  ];

  const result = await chatModel.invoke(messages);
  const response =
    typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

  if (state.userPersona && (isSelfImageRequest(state.userMessage) || isSelfDescriptiveQuestion(state.userMessage))) {
    await extractAndSaveAppearance(state, response);
  }

  let imageBuffer: Buffer | undefined;
  if (state.isNsfwChannel && hasImageIntent(state.userMessage)) {
    const prompt = await generateImagePrompt(state, response);
    const result = await fetchImageBuffer(prompt, 1024, 1024, true);
    if (result === 'rate_limited') {
      const rateLimitResult = await chatModel.invoke([
        new SystemMessage(buildSystemPrompt(state.userFacts, state.userPersona, state.isNsfwChannel)),
        ...state.history,
        new HumanMessage(state.userMessage),
        new SystemMessage('You tried to send an image but hit your hourly generation limit (resets in about an hour). Respond naturally — apologise briefly in your own style and let the user know to try again in an hour. Keep it short.'),
      ]);
      const rateLimitResponse = typeof rateLimitResult.content === 'string' ? rateLimitResult.content : response;
      return { response: rateLimitResponse, imageBuffer: undefined };
    }
    imageBuffer = result ?? undefined;
  }

  // When an image was successfully generated, replace the description with a short natural phrase.
  const imagePhrases = [
    'here you go 😊',
    'there you go~',
    'here it is!',
    'just for you 💕',
    'ta-da!',
    'here~',
  ];
  const finalResponse = imageBuffer
    ? imagePhrases[Math.floor(Math.random() * imagePhrases.length)]
    : response;

  return { response: finalResponse, imageBuffer };
}

export async function saveMemoryNode(state: AgentState): Promise<Partial<AgentState>> {
  await saveMessages(state.userId, state.channelId, state.userMessage, state.response);

  const key = `${state.userId}:${state.channelId}`;
  shortTermMemory.set(key, [
    ...state.history,
    new HumanMessage(state.userMessage),
    new AIMessage(state.response),
  ]);

  try {
    const conversationSummary = [
      ...state.history.slice(-6),
      new HumanMessage(state.userMessage),
    ]
      .map((m) => `${m._getType()}: ${m.content}`)
      .join('\n');

    const extractionResult = await chatModel.invoke([
      new SystemMessage(
        'Extract any NEW persistent facts about the user from this conversation that are not already in the existing facts list. Return only genuinely new facts. Respond with valid JSON only, no markdown: {"newFacts": ["fact1", "fact2"]}. If nothing new, return {"newFacts": []}.'
      ),
      new HumanMessage(
        `Existing facts: ${JSON.stringify(state.userFacts)}\n\nConversation:\n${conversationSummary}`
      ),
    ]);

    const raw = typeof extractionResult.content === 'string' ? extractionResult.content : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const newFacts: string[] = Array.isArray(parsed.newFacts) ? parsed.newFacts : [];
      if (newFacts.length > 0) {
        await upsertFacts(state.userId, [...state.userFacts, ...newFacts]);
      }
    }
  } catch (err) {
    console.error('[saveMemoryNode] fact extraction error:', err);
  }

  return {};
}
