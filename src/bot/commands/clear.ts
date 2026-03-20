import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { clearChannel } from '../../memory/longTerm';
import { shortTermMemory } from '../../memory/shortTerm';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear our conversation history in this channel');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const channelId = interaction.channelId;
    await clearChannel(interaction.user.id, channelId);
    shortTermMemory.clear(`${interaction.user.id}:${channelId}`);
    await interaction.editReply('Conversation history for this channel has been cleared.');
  } catch (err) {
    console.error('[/clear]', err);
    await interaction.editReply('Something went wrong. Please try again.');
  }
}
