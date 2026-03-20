import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('../../src/db/client', () => ({
  supabase: { from: mockFrom },
}));

const { loadPersona, savePersona, deletePersona } = await import('../../src/memory/persona');

// Reuse the proxy chain helper from longTerm tests
function makeChain(finalValue: unknown, terminator = 'single') {
  const handler: ProxyHandler<object> = {
    get: (_: object, prop: string) => {
      if (prop === 'then') return undefined;
      return (..._args: unknown[]) => {
        if (prop === terminator) return Promise.resolve(finalValue);
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

beforeEach(() => vi.clearAllMocks());

describe('loadPersona', () => {
  it('returns persona when row exists', async () => {
    const row = {
      discord_user_id: 'u1',
      bot_gender: 'female',
      speaking_style: 'flirty',
      relationship: 'romantic_partner',
      custom_instructions: 'call me Alex',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    mockFrom.mockReturnValue(makeChain({ data: row, error: null }));
    const result = await loadPersona('u1');
    expect(result).toEqual(row);
  });

  it('returns null when no row exists (PGRST116)', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { code: 'PGRST116' } }));
    const result = await loadPersona('u1');
    expect(result).toBeNull();
  });

  it('returns null on generic DB error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: new Error('db down') }));
    const result = await loadPersona('u1');
    expect(result).toBeNull();
  });
});

describe('savePersona', () => {
  it('calls upsert with correct payload and onConflict option', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: upsertMock });

    await savePersona('u1', {
      bot_gender: 'male',
      speaking_style: 'sarcastic',
      relationship: 'best_friend',
      custom_instructions: null,
    });

    expect(mockFrom).toHaveBeenCalledWith('user_persona');
    expect(upsertMock).toHaveBeenCalledOnce();
    const [payload, options] = upsertMock.mock.calls[0];
    expect(payload.discord_user_id).toBe('u1');
    expect(payload.bot_gender).toBe('male');
    expect(payload.speaking_style).toBe('sarcastic');
    expect(payload.custom_instructions).toBeNull();
    expect(options).toEqual({ onConflict: 'discord_user_id' });
  });

  it('always sets updated_at to a fresh ISO timestamp', async () => {
    const timestamps: string[] = [];
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockImplementation((data: { updated_at: string }) => {
        timestamps.push(data.updated_at);
        return Promise.resolve({ error: null });
      }),
    });

    await savePersona('u1', { bot_gender: 'neutral', speaking_style: 'friendly', relationship: 'assistant', custom_instructions: null });
    await savePersona('u1', { bot_gender: 'female', speaking_style: 'flirty', relationship: 'romantic_partner', custom_instructions: null });

    expect(timestamps).toHaveLength(2);
    expect(timestamps[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(timestamps[1]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('deletePersona', () => {
  it('calls delete on user_persona table with the user id', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ delete: deleteMock });

    await deletePersona('u1');

    expect(mockFrom).toHaveBeenCalledWith('user_persona');
    expect(deleteMock).toHaveBeenCalledOnce();
    expect(eqMock).toHaveBeenCalledWith('discord_user_id', 'u1');
  });

  it('does not throw on DB error', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockRejectedValue(new Error('db error')) }),
    });
    await expect(deletePersona('u1')).resolves.toBeUndefined();
  });
});
