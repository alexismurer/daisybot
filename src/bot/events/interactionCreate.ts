import { Client, ChatInputCommandInteraction, Interaction, MessageFlags } from 'discord.js';
import { execute as forgetExecute } from '../commands/forget';
import { execute as memoryExecute } from '../commands/memory';
import { execute as clearExecute } from '../commands/clear';
import { execute as personaExecute, handlePersonaComponent } from '../commands/persona';

const commandMap: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
  forget: forgetExecute,
  memory: memoryExecute,
  clear: clearExecute,
  persona: personaExecute,
};

export function registerInteractionCreate(client: Client): void {
  client.on('interactionCreate', async (interaction: Interaction) => {
    // Route persona wizard component interactions before anything else
    if (
      (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
      'customId' in interaction &&
      (interaction.customId as string).startsWith('persona:')
    ) {
      try {
        await handlePersonaComponent(interaction);
      } catch (err) {
        console.error('[interactionCreate] persona component error:', err);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const handler = commandMap[interaction.commandName];
    if (!handler) return;

    try {
      await handler(interaction);
    } catch (err) {
      console.error('[interactionCreate]', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply('Something went wrong.');
      } else {
        await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral });
      }
    }
  });
}
