// tests/agent/utils/imageIntent.test.ts
import { describe, it, expect } from 'vitest';
import { hasImageIntent, extractImagePrompt } from '../../../src/agent/utils/imageIntent';

describe('hasImageIntent', () => {
  it('detects "picture"', () => expect(hasImageIntent('send me a picture of a cat')).toBe(true));
  it('detects "photo"', () => expect(hasImageIntent('can you show me a photo')).toBe(true));
  it('detects "image"', () => expect(hasImageIntent('generate an image of mountains')).toBe(true));
  it('detects "pic"', () => expect(hasImageIntent('send a pic')).toBe(true));
  it('detects "draw"', () => expect(hasImageIntent('draw me a rabbit')).toBe(true));
  it('detects "illustration"', () => expect(hasImageIntent('make an illustration')).toBe(true));
  it('detects "portrait"', () => expect(hasImageIntent('paint my portrait')).toBe(true));
  it('detects "artwork"', () => expect(hasImageIntent('create some artwork')).toBe(true));
  it('detects "drawing"', () => expect(hasImageIntent('show me a drawing')).toBe(true));
  it('detects "painting"', () => expect(hasImageIntent('I want a painting')).toBe(true));
  it('detects "sketch"', () => expect(hasImageIntent('make a sketch of a dog')).toBe(true));
  it('detects "render"', () => expect(hasImageIntent('render a 3d scene')).toBe(true));
  it('detects "visual"', () => expect(hasImageIntent('show me a visual')).toBe(true));
  it('is case-insensitive', () => expect(hasImageIntent('SEND ME A PHOTO')).toBe(true));

  it('ignores standalone "generate" (no image noun)', () =>
    expect(hasImageIntent('generate a list of ideas')).toBe(false));
  it('ignores standalone "create" (no image noun)', () =>
    expect(hasImageIntent('create a recipe for me')).toBe(false));
  it('ignores "show me how to code" (no image noun)', () =>
    expect(hasImageIntent('show me how to code')).toBe(false));
  it('ignores normal chat', () => expect(hasImageIntent('how are you doing?')).toBe(false));
});

describe('extractImagePrompt', () => {
  it('strips "can you draw me a picture of"', () =>
    expect(extractImagePrompt('can you draw me a picture of a pink rabbit')).toBe('a pink rabbit'));
  it('strips "generate an image of"', () =>
    expect(extractImagePrompt('generate an image of mountains at sunset')).toBe('mountains at sunset'));
  it('strips "send me a picture of"', () =>
    expect(extractImagePrompt('send me a picture of a dog')).toBe('a dog'));
  it('strips "draw me"', () =>
    expect(extractImagePrompt('draw me a cat')).toBe('a cat'));
  it('strips "paint me"', () =>
    expect(extractImagePrompt('paint me a sunset')).toBe('a sunset'));
  it('returns original when nothing meaningful can be stripped', () =>
    expect(extractImagePrompt('draw me')).toBe('draw me'));
  it('returns original when no strip pattern matches', () =>
    expect(extractImagePrompt('send a pic')).toBe('send a pic'));
  it('falls back when strip produces empty string', () =>
    expect(extractImagePrompt('send me a pic')).toBe('send me a pic'));
});
