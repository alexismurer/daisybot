/**
 * CLI smoke test — runs the agent without Discord.
 * Usage: ts-node src/scripts/testAgent.ts
 * Requires .env to be populated with real credentials.
 */
import { agent } from '../agent/graph';

async function main() {
  console.log('Running agent smoke test...\n');

  const turns = [
    'Hi! My name is Alex and I work with TypeScript.',
    'What do you know about me so far?',
    'I prefer concise answers. What is 2 + 2?',
  ];

  let history: any[] = [];
  for (const message of turns) {
    console.log(`Human: ${message}`);
    const result = await agent.invoke({
      userId: 'smoke-test-user',
      channelId: 'smoke-test-channel',
      userMessage: message,
      history,
      userFacts: [],
      response: '',
    });
    console.log(`AI: ${result.response}\n`);
    history = result.history;
  }

  console.log('Smoke test complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
