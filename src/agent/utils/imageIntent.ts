// src/agent/utils/imageIntent.ts

const IMAGE_NOUNS = [
  'image', 'picture', 'photo', 'pic', 'illustration', 'portrait',
  'artwork', 'drawing', 'painting', 'sketch', 'render', 'visual', 'draw',
] as const;

const IMAGE_NOUN_PATTERN = new RegExp(`\\b(${IMAGE_NOUNS.join('|')})\\b`, 'i');

// Prefix phrases to strip before extracting the subject
const STRIP_PREFIXES = [
  /^(can you |please )?(generate|create|make|draw|paint|send|show)\s+(me\s+)?(a|an)\s+(picture|image|photo|illustration|drawing|painting|sketch|portrait|artwork|visual|render)\s+(of\s+)?/i,
  /^(draw|paint|sketch)\s+me\s+/i,
  /^(show|send)\s+me\s+(a\s+)?(pic|photo|image|picture|visual)\s+(of\s+)?/i,
];

export function hasImageIntent(userMessage: string): boolean {
  return IMAGE_NOUN_PATTERN.test(userMessage);
}

export function extractImagePrompt(userMessage: string): string {
  let result = userMessage.trim();

  for (const pattern of STRIP_PREFIXES) {
    const before = result;
    result = result.replace(pattern, '').trim();
    if (result !== before) break; // stop on first match
  }

  // Fallback: if stripping left too little or only punctuation/pronouns remain, use original
  if (result.length < 10 || /^(you|me|us|it|them|him|her)[?!.,\s]*$/i.test(result)) {
    return userMessage.trim();
  }
  return result;
}
