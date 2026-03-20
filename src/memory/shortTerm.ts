import type { BaseMessage } from '@langchain/core/messages';

export class ShortTermMemory {
  private store = new Map<string, BaseMessage[]>();
  private windowSize: number;

  constructor(windowSize = 20) {
    this.windowSize = windowSize;
  }

  get(key: string): BaseMessage[] {
    return this.store.get(key) ?? [];
  }

  set(key: string, messages: BaseMessage[]): void {
    this.store.set(key, messages.slice(-this.windowSize));
  }

  clear(key: string): void {
    this.store.delete(key);
  }

  clearAll(): void {
    this.store.clear();
  }
}

export const shortTermMemory = new ShortTermMemory(20);
