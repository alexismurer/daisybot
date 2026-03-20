import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { deleteUser } from '../../memory/longTerm';
import { deletePersona } from '../../memory/persona';
import { shortTermMemory } from '../../memory/shortTerm';

export const data = new SlashCommandBuilder()
  .setName('forget')
  .setDescription('Wipe everything I remember about you');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await Promise.all([deleteUser(interaction.user.id), deletePersona(interaction.user.id)]);
    shortTermMemory.clearAll();
    await interaction.editReply('Done — I have forgotten everything about you.');
  } catch (err) {
    console.error('[/forget]', err);
    await interaction.editReply('Something went wrong. Please try again.');
  }
}
