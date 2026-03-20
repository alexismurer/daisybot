import { supabase } from '../db/client';
import type { UserPersona } from './types';

type PersonaInput = Pick<
  UserPersona,
  'bot_gender' | 'speaking_style' | 'relationship' | 'custom_instructions' | 'bot_appearance' | 'bot_age'
>;

export async function loadPersona(userId: string): Promise<UserPersona | null> {
  try {
    const { data, error } = await supabase
      .from('user_persona')
      .select('*')
      .eq('discord_user_id', userId)
      .single();

    if (error || !data) return null;
    return data as UserPersona;
  } catch (err) {
    console.error('[persona] loadPersona error:', err);
    return null;
  }
}

export async function savePersona(userId: string, persona: PersonaInput): Promise<void> {
  try {
    await supabase.from('user_persona').upsert(
      {
        discord_user_id: userId,
        ...persona,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'discord_user_id' }
    );
    console.log(`[DB] user_persona UPSERT | user=${userId} | ${JSON.stringify(persona)}`);
  } catch (err) {
    console.error('[persona] savePersona error:', err);
  }
}

export async function updateBotAppearance(
  userId: string,
  appearance: string | null,
  age: string | null
): Promise<void> {
  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (appearance !== null) updates.bot_appearance = appearance;
    if (age !== null) updates.bot_age = age;
    await supabase.from('user_persona').update(updates).eq('discord_user_id', userId);
    console.log(`[DB] user_persona UPDATE (appearance) | user=${userId} | appearance="${appearance}" age="${age}"`);
  } catch (err) {
    console.error('[persona] updateBotAppearance error:', err);
  }
}

export async function deletePersona(userId: string): Promise<void> {
  try {
    await supabase.from('user_persona').delete().eq('discord_user_id', userId);
    console.log(`[DB] user_persona DELETE | user=${userId}`);
  } catch (err) {
    console.error('[persona] deletePersona error:', err);
  }
}
