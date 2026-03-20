import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

const mockFrom = vi.fn();

vi.mock('../../src/db/client', () => ({
  supabase: { from: mockFrom },
}));

const { loadHistory, loadFacts } = await import('../../src/memory/longTerm');

function makeChain(finalValue: unknown) {
  const handler: ProxyHandler<object> = {
    get: (_: object, prop: string) => {
      if (prop === 'then') return undefined;
      return (..._args: unknown[]) => {
        if (prop === 'limit' || prop === 'single') return Promise.resolve(finalValue);
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadHistory', () => {
  it('returns messages in chronological order', async () => {
    mockFrom.mockReturnValue(makeChain({
      data: [
        { role: 'ai', content: 'hello' },
        { role: 'human', content: 'hi' },
      ],
      error: null,
    }));

    const result = await loadHistory('user1', 'chan1');
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(HumanMessage);
    expect(result[1]).toBeInstanceOf(AIMessage);
  });

  it('returns empty array on DB error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: new Error('db down') }));
    const result = await loadHistory('user1', 'chan1');
    expect(result).toEqual([]);
  });
});

describe('loadFacts', () => {
  it('returns facts array for known user', async () => {
    mockFrom.mockReturnValue(makeChain({
      data: { facts: ['likes cats'] },
      error: null,
    }));
    const result = await loadFacts('user1');
    expect(result).toEqual(['likes cats']);
  });

  it('returns empty array when no row found', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { code: 'PGRST116' } }));
    const result = await loadFacts('user1');
    expect(result).toEqual([]);
  });
});
