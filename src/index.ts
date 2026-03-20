import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { registerCommands } from './bot/register';
import { registerMessageCreate } from './bot/events/messageCreate';
import { registerInteractionCreate } from './bot/events/interactionCreate';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  await registerCommands();
});

registerMessageCreate(client);
registerInteractionCreate(client);

client.login(config.DISCORD_TOKEN);
