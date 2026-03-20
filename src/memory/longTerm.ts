import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { supabase } from '../db/client';

export async function loadHistory(userId: string, channelId: string): Promise<BaseMessage[]> {
  try {
    const { data, error } = await supabase
      .from('conversation_history')
      .select('role, content')
      .eq('discord_user_id', userId)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) return [];

    return data.reverse().map((row: { role: string; content: string }) =>
      row.role === 'human' ? new HumanMessage(row.content) : new AIMessage(row.content)
    );
  } catch (err) {
    console.error('[longTerm] loadHistory error:', err);
    return [];
  }
}

export async function saveMessages(
  userId: string,
  channelId: string,
  human: string,
  ai: string
): Promise<void> {
  try {
    await supabase.from('conversation_history').insert([
      { discord_user_id: userId, channel_id: channelId, role: 'human', content: human },
      { discord_user_id: userId, channel_id: channelId, role: 'ai', content: ai },
    ]);
    console.log(`[DB] conversation_history INSERT | user=${userId} channel=${channelId} | human="${human.slice(0, 80)}${human.length > 80 ? '…' : ''}" | ai="${ai.slice(0, 80)}${ai.length > 80 ? '…' : ''}"`);
  } catch (err) {
    console.error('[longTerm] saveMessages error:', err);
  }
}

export async function loadFacts(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_memory')
      .select('facts')
      .eq('discord_user_id', userId)
      .single();

    if (error || !data) return [];
    return (data.facts as string[]) ?? [];
  } catch (err) {
    console.error('[longTerm] loadFacts error:', err);
    return [];
  }
}

export async function upsertFacts(userId: string, facts: string[]): Promise<void> {
  try {
    await supabase.from('user_memory').upsert(
      { discord_user_id: userId, facts, updated_at: new Date().toISOString() },
      { onConflict: 'discord_user_id' }
    );
    console.log(`[DB] user_memory UPSERT | user=${userId} | facts(${facts.length}): ${JSON.stringify(facts)}`);
  } catch (err) {
    console.error('[longTerm] upsertFacts error:', err);
  }
}

export async function deleteUser(userId: string): Promise<void> {
  try {
    await supabase.from('user_memory').delete().eq('discord_user_id', userId);
    await supabase.from('conversation_history').delete().eq('discord_user_id', userId);
    console.log(`[DB] user_memory + conversation_history DELETE | user=${userId}`);
  } catch (err) {
    console.error('[longTerm] deleteUser error:', err);
  }
}

export async function clearChannel(userId: string, channelId: string): Promise<void> {
  try {
    await supabase
      .from('conversation_history')
      .delete()
      .eq('discord_user_id', userId)
      .eq('channel_id', channelId);
    console.log(`[DB] conversation_history DELETE | user=${userId} channel=${channelId}`);
  } catch (err) {
    console.error('[longTerm] clearChannel error:', err);
  }
}
