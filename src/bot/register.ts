import { REST, Routes } from 'discord.js';
import { config } from '../config';
import { data as forgetData } from './commands/forget';
import { data as memoryData } from './commands/memory';
import { data as clearData } from './commands/clear';
import { data as personaData } from './commands/persona';

export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(config.DISCORD_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
      body: [forgetData, memoryData, clearData, personaData].map((c) => c.toJSON()),
    });
    console.log('Slash commands registered.');
  } catch (err) {
    console.error('[register] Failed to register commands:', err);
  }
}

if (require.main === module) {
  registerCommands();
}
