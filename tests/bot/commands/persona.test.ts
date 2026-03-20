import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPersona, savePersona } from '../../../src/memory/persona';

vi.mock('../../../src/memory/persona', () => ({
  loadPersona: vi.fn(),
  savePersona: vi.fn(),
  deletePersona: vi.fn(),
}));

vi.mock('../../../src/db/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../../../src/config', () => ({
  config: {
    DISCORD_TOKEN: 'tok',
    DISCORD_CLIENT_ID: 'cid',
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'key',
    MODEL_PROVIDER: 'google',
    MODEL_NAME: 'gemini-2.0-flash',
  },
  createChatModel: vi.fn(),
}));

const { WizardState, handlePersonaComponent, wizardState } = await import('../../../src/bot/commands/persona');
const { execute } = await import('../../../src/bot/commands/persona');

describe('WizardState', () => {
  let ws: InstanceType<typeof WizardState>;

  beforeEach(() => {
    ws = new WizardState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for unknown user', () => {
    expect(ws.get('u1')).toBeNull();
  });

  it('stores and retrieves a wizard entry', () => {
    const mockInteraction = {} as never;
    ws.set('u1', { data: { bot_gender: 'female' }, originalInteraction: mockInteraction });
    expect(ws.get('u1')?.data.bot_gender).toBe('female');
  });

  it('returns null and prunes entry after TTL (15 min)', () => {
    ws.set('u1', { data: {}, originalInteraction: {} as never });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(ws.get('u1')).toBeNull();
  });

  it('update merges data and preserves originalInteraction', () => {
    const mockInteraction = { id: 'orig' } as never;
    ws.set('u1', { data: { bot_gender: 'male' }, originalInteraction: mockInteraction });
    ws.update('u1', { speaking_style: 'sarcastic' });
    const entry = ws.get('u1');
    expect(entry?.data.bot_gender).toBe('male');
    expect(entry?.data.speaking_style).toBe('sarcastic');
    expect(entry?.originalInteraction).toBe(mockInteraction);
  });

  it('update is a no-op on expired or missing entry', () => {
    ws.update('unknown', { bot_gender: 'male' });
    expect(ws.get('unknown')).toBeNull();
  });

  it('delete removes the entry', () => {
    ws.set('u1', { data: {}, originalInteraction: {} as never });
    ws.delete('u1');
    expect(ws.get('u1')).toBeNull();
  });

  it('last-write-wins when set is called twice', () => {
    ws.set('u1', { data: { bot_gender: 'male' }, originalInteraction: {} as never });
    ws.set('u1', { data: { bot_gender: 'female' }, originalInteraction: {} as never });
    expect(ws.get('u1')?.data.bot_gender).toBe('female');
  });
});

function makeInteraction(
  subcommand: string,
  channelOverride: object = { isDMBased: () => false, nsfw: true }
) {
  return {
    user: { id: 'u1' },
    channel: channelOverride,
    options: { getSubcommand: () => subcommand },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as never;
}

describe('/persona NSFW guard', () => {
  it('blocks non-NSFW guild channel', async () => {
    const i = makeInteraction('view', { isDMBased: () => false, nsfw: false });
    await execute(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('age-restricted') })
    );
  });

  it('allows DM channel', async () => {
    vi.mocked(loadPersona).mockResolvedValue(null);
    const i = makeInteraction('view', { isDMBased: () => true });
    await execute(i);
    expect(i.reply).not.toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('age-restricted') })
    );
  });
});

describe('/persona view', () => {
  it('replies with setup prompt when no persona exists', async () => {
    vi.mocked(loadPersona).mockResolvedValue(null);
    const i = makeInteraction('view');
    await execute(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('/persona setup') })
    );
  });

  it('replies with an embed when persona exists', async () => {
    vi.mocked(loadPersona).mockResolvedValue({
      discord_user_id: 'u1',
      bot_gender: 'female',
      speaking_style: 'flirty',
      relationship: 'romantic_partner',
      custom_instructions: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });
    const i = makeInteraction('view');
    await execute(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) })
    );
  });
});

describe('/persona reset', () => {
  it('replies with confirmation message and components', async () => {
    const i = makeInteraction('reset');
    await execute(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Are you sure'),
        components: expect.any(Array),
      })
    );
  });
});

describe('/persona edit', () => {
  it('replies with a field selector and components', async () => {
    vi.mocked(loadPersona).mockResolvedValue(null);
    const i = makeInteraction('edit');
    await execute(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({ components: expect.any(Array) })
    );
  });
});

function makeComponentInteraction(customId: string, extra: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1' },
    customId,
    update: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined),
    values: [],
    ...extra,
  } as never;
}

describe('/persona setup', () => {
  beforeEach(() => wizardState.delete('u1'));

  it('seeds wizard state and replies with step 1 components', async () => {
    const i = makeInteraction('setup');
    await execute(i);
    expect(i.reply).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
    expect(wizardState.get('u1')).not.toBeNull();
  });
});

describe('handlePersonaComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wizardState.delete('u1');
  });

  it('responds with session-expired error when wizard state is missing', async () => {
    const i = makeComponentInteraction('persona:gender:female');
    await handlePersonaComponent(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('expired') })
    );
  });

  it('persona:gender:<value> stores gender and updates to step 2', async () => {
    wizardState.set('u1', { data: {}, originalInteraction: {} as never });
    const i = makeComponentInteraction('persona:gender:female');
    await handlePersonaComponent(i);
    expect(wizardState.get('u1')?.data.bot_gender).toBe('female');
    expect(i.update).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
  });

  it('persona:style:select (preset) stores style and updates to step 3', async () => {
    wizardState.set('u1', { data: { bot_gender: 'female' }, originalInteraction: {} as never });
    const i = makeComponentInteraction('persona:style:select', { values: ['flirty'] });
    await handlePersonaComponent(i);
    expect(wizardState.get('u1')?.data.speaking_style).toBe('flirty');
    expect(i.update).toHaveBeenCalled();
  });

  it('persona:style:select (custom) opens a modal', async () => {
    wizardState.set('u1', { data: { bot_gender: 'female' }, originalInteraction: {} as never });
    const i = makeComponentInteraction('persona:style:select', { values: ['persona:style:custom'] });
    await handlePersonaComponent(i);
    expect(i.showModal).toHaveBeenCalled();
  });

  it('persona:confirm_save saves persona and clears wizard state', async () => {
    vi.mocked(savePersona).mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    wizardState.set('u1', {
      data: {
        bot_gender: 'male',
        speaking_style: 'sarcastic',
        relationship: 'best_friend',
        custom_instructions: null,
      },
      originalInteraction: { editReply } as never,
    });
    const i = makeComponentInteraction('persona:confirm_save');
    await handlePersonaComponent(i);
    expect(savePersona).toHaveBeenCalledWith('u1', expect.objectContaining({ bot_gender: 'male' }));
    expect(wizardState.get('u1')).toBeNull();
    expect(i.update).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
  });

  it('persona:restart resets wizard data and updates to step 1', async () => {
    const editReply = vi.fn().mockResolvedValue(undefined);
    wizardState.set('u1', {
      data: { bot_gender: 'female', speaking_style: 'flirty' },
      originalInteraction: { editReply } as never,
    });
    const i = makeComponentInteraction('persona:restart');
    await handlePersonaComponent(i);
    expect(wizardState.get('u1')?.data.bot_gender).toBeUndefined();
    expect(i.update).toHaveBeenCalled();
  });

  it('persona:confirm_reset saves defaults', async () => {
    vi.mocked(savePersona).mockResolvedValue(undefined);
    const i = makeComponentInteraction('persona:confirm_reset');
    await handlePersonaComponent(i);
    expect(savePersona).toHaveBeenCalledWith('u1', {
      bot_gender: 'neutral',
      speaking_style: 'friendly',
      relationship: 'assistant',
      custom_instructions: null,
      bot_appearance: null,
      bot_age: null,
    });
  });

  it('persona:cancel_reset dismisses without saving', async () => {
    const i = makeComponentInteraction('persona:cancel_reset');
    await handlePersonaComponent(i);
    expect(savePersona).not.toHaveBeenCalled();
    expect(i.update).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
  });

  it('persona:style:modal stores custom style and edits original interaction', async () => {
    const editReply = vi.fn().mockResolvedValue(undefined);
    wizardState.set('u1', { data: { bot_gender: 'female' }, originalInteraction: { editReply } as never });
    const i = makeComponentInteraction('persona:style:modal', {
      fields: { getTextInputValue: () => 'very formal' },
    });
    await handlePersonaComponent(i);
    expect(wizardState.get('u1')?.data.speaking_style).toBe('very formal');
    expect(i.deferReply).toHaveBeenCalled();
    expect(i.deleteReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
  });

  it('persona:relationship:modal stores custom relationship and edits original interaction', async () => {
    const editReply = vi.fn().mockResolvedValue(undefined);
    wizardState.set('u1', { data: { bot_gender: 'female', speaking_style: 'friendly' }, originalInteraction: { editReply } as never });
    const i = makeComponentInteraction('persona:relationship:modal', {
      fields: { getTextInputValue: () => 'work colleague' },
    });
    await handlePersonaComponent(i);
    expect(wizardState.get('u1')?.data.relationship).toBe('work colleague');
    expect(editReply).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
  });

  it('persona:instructions:modal stores custom instructions and edits original interaction', async () => {
    const editReply = vi.fn().mockResolvedValue(undefined);
    wizardState.set('u1', { data: { bot_gender: 'male', speaking_style: 'polite', relationship: 'mentor' }, originalInteraction: { editReply } as never });
    const i = makeComponentInteraction('persona:instructions:modal', {
      fields: { getTextInputValue: () => 'always use my first name' },
    });
    await handlePersonaComponent(i);
    expect(wizardState.get('u1')?.data.custom_instructions).toBe('always use my first name');
    expect(editReply).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
  });
});
