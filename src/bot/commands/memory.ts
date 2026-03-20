import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { loadFacts } from '../../memory/longTerm';

export const data = new SlashCommandBuilder()
  .setName('memory')
  .setDescription('Show what I remember about you');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const facts = await loadFacts(interaction.user.id);

    if (facts.length === 0) {
      await interaction.editReply("I don't have anything saved about you yet.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Here's what I remember about you")
      .setDescription(facts.map((f) => `• ${f}`).join('\n'))
      .setColor(0x5865f2);

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[/memory]', err);
    await interaction.editReply('Something went wrong. Please try again.');
  }
}
