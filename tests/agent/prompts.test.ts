import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/agent/prompts';
import type { UserPersona } from '../../src/memory/types';

const fullPersona: UserPersona = {
  discord_user_id: 'u1',
  bot_gender: 'female',
  speaking_style: 'flirty',
  relationship: 'romantic_partner',
  custom_instructions: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('buildSystemPrompt', () => {
  it('omits persona block when userPersona is null', () => {
    const result = buildSystemPrompt(['likes cats'], null);
    expect(result).not.toContain('Your persona');
    expect(result).toContain('likes cats');
  });

  it('omits persona block when called with no second argument (backward compat)', () => {
    const result = buildSystemPrompt(['a fact']);
    expect(result).not.toContain('Your persona');
    expect(result).toContain('a fact');
  });

  it('includes persona header and all fields when persona is set', () => {
    const result = buildSystemPrompt([], fullPersona);
    expect(result).toContain('Your persona (configured by this user)');
    expect(result).toContain('You present as: female');
    expect(result).toContain('Speaking style: flirty');
    expect(result).toContain('Relationship dynamic: romantic_partner');
  });

  it('omits Additional instructions line when custom_instructions is null', () => {
    const result = buildSystemPrompt([], fullPersona);
    expect(result).not.toContain('Additional instructions');
  });

  it('includes Additional instructions when custom_instructions is set', () => {
    const persona: UserPersona = { ...fullPersona, custom_instructions: 'call me Alex' };
    const result = buildSystemPrompt([], persona);
    expect(result).toContain('Additional instructions: call me Alex');
  });

  it('persona block appears before the facts section', () => {
    const persona: UserPersona = { ...fullPersona };
    const result = buildSystemPrompt(['likes cats'], persona);
    const personaIdx = result.indexOf('Your persona');
    const factsIdx = result.indexOf('likes cats');
    expect(personaIdx).toBeLessThan(factsIdx);
  });

  it('omits image tool hint when isNsfwChannel is false (default)', () => {
    const result = buildSystemPrompt(['a fact'], null, false);
    expect(result).not.toContain('generate_image');
  });

  it('includes image tool hint when isNsfwChannel is true', () => {
    const result = buildSystemPrompt(['a fact'], null, true);
    expect(result).toContain('image generation is handled independently');
    expect(result).toContain('visual content');
  });
});
