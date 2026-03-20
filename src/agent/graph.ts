import { StateGraph, Annotation, END } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { Message } from 'discord.js';
import { loadMemoryNode, callLLMNode, saveMemoryNode } from './nodes';
import type { UserPersona } from '../memory/types';

const AgentAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  channelId: Annotation<string>(),
  userMessage: Annotation<string>(),
  history: Annotation<BaseMessage[]>({
    reducer: (_a, b) => b ?? [],
    default: () => [],
  }),
  userFacts: Annotation<string[]>({
    reducer: (_a, b) => b ?? [],
    default: () => [],
  }),
  userPersona: Annotation<UserPersona | null>({
    reducer: (_a, b) => b ?? null,
    default: () => null,
  }),
  response: Annotation<string>({
    reducer: (_a, b) => b ?? '',
    default: () => '',
  }),
  discordMessage: Annotation<Message | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  isNsfwChannel: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  imageBuffer: Annotation<Buffer | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
});

const graph = new StateGraph(AgentAnnotation)
  .addNode('loadMemory', loadMemoryNode)
  .addNode('callLLM', callLLMNode)
  .addNode('saveMemory', saveMemoryNode)
  .addEdge('__start__', 'loadMemory')
  .addEdge('loadMemory', 'callLLM')
  .addEdge('callLLM', 'saveMemory')
  .addEdge('saveMemory', END);

export const agent = graph.compile();
