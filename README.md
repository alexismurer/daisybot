# 🤖 Discord LangChain Bot

A smart, agentic AI assistant for Discord — powered by LangChain + LangGraph with persistent memory. It remembers who you are across conversations, learns facts about you over time, and responds naturally to @mentions.

---

## ✨ Features

- 🧠 **Two-layer memory** — short-term conversation context + long-term user facts stored in Supabase
- 🔄 **Provider-agnostic** — swap between Google Gemini, OpenAI, Anthropic, or Groq with one env var
- 💬 **Natural conversation** — @mention the bot to chat, it responds in context
- 🛠️ **Slash commands** — `/memory`, `/forget`, `/clear`, `/persona` for memory and persona management
- ⚡ **Smart fact extraction** — automatically learns and remembers things you tell it
- 🎭 **Persona system** — configure the bot's gender, speaking style, relationship, custom instructions, appearance, and age via a 6-step wizard (`/persona setup`)
- 🖼️ **Image generation** — generates images from user requests in NSFW channels via Pollinations AI (Flux model), with persona-aware prompt building
- 🛡️ **Resilient** — gracefully degrades to in-memory mode if the database is unavailable
- 🆓 **Free-tier friendly** — defaults to Google Gemini 2.0 Flash (generous free tier)

---

## 🏗️ Architecture

```
@mention → messageCreate event
                ↓
         LangGraph Agent
    ┌─────────────────────────────────────┐
    │  loadMemoryNode   ← history + facts + persona from Supabase
    │  callLLMNode      ← builds prompt, calls LLM
    │                     if NSFW + image intent → generateImage
    │                     if self-image request  → extractAndSaveAppearance
    │  saveMemoryNode   ← saves history, extracts new facts
    └─────────────────────────────────────┘
                ↓
         Discord reply (+ optional image attachment)

/command → direct Supabase ops (no agent)
/persona → 6-step interactive wizard (NSFW-gated)
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 20+
- A [Discord bot](https://discord.com/developers/applications) with **Message Content Intent** enabled
- A [Supabase](https://supabase.com) project (free tier)
- A [Groq Cloud](https://console.groq.com/) API key (free)

### 2. Install

```bash
git clone https://github.com/your-username/discord-langchain
cd discord-langchain
npm install
```

### 3. Configure

```bash
cp .env.example .env
# Fill in your credentials (see .env.example for all vars)
```

### 4. Set up the database

Run the contents of `src/db/schema.sql` in your Supabase SQL editor. This creates three tables: `user_memory`, `conversation_history`, and `user_persona`.

### 5. Run locally

```bash
npm run dev
```

---

## 💬 Usage

### Talking to the bot

Just @mention it in any channel:

```
@BotName What's the weather like on Mars?
@BotName My name is Alex and I'm a TypeScript developer
@BotName What do you know about me?
```

The bot remembers facts across conversations — next time you chat, it'll already know who you are.

### Slash Commands

| Command | Description |
|---------|-------------|
| `/memory` | See what the bot remembers about you |
| `/forget` | Wipe everything the bot knows about you |
| `/clear` | Clear conversation history for this channel |
| `/persona setup` | Configure the bot's personality via a 6-step wizard (NSFW channel or DM only) |
| `/persona view` | See your current persona settings |
| `/persona edit` | Change a specific persona field |
| `/persona reset` | Reset persona to defaults |

All slash command responses are **ephemeral** (only you can see them). Persona commands require an age-restricted (NSFW) channel or DM.

---

## 🔧 Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | ✅ | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | ✅ | Application ID from Discord Developer Portal |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Your Supabase anon/public key |
| `MODEL_PROVIDER` | ✅ | `google` \| `openai` \| `anthropic` \| `groq` |
| `MODEL_NAME` | ✅ | e.g. `gemini-2.0-flash`, `gpt-4o`, `claude-3-5-haiku-latest` |
| `GOOGLE_API_KEY` | ⚠️ | Required if `MODEL_PROVIDER=google` |
| `OPENAI_API_KEY` | ⚠️ | Required if `MODEL_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | ⚠️ | Required if `MODEL_PROVIDER=anthropic` |
| `GROQ_API_KEY` | ⚠️ | Required if `MODEL_PROVIDER=groq` |
| `POLLINATIONS_API_KEY` | ➕ | Optional; enables NSFW image generation via Pollinations AI |

---

## 🧪 Testing

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

Tests use Vitest with mocked Supabase and LLM — no real API calls needed.

---

## 🐳 Deployment (Railway)

1. Push to GitHub
2. Create a new project on [Railway](https://railway.app) and connect your repo
3. Set all environment variables in the Railway dashboard
4. Railway auto-deploys on every push to `main` 🎉

Make sure your Discord bot is invited to your server with scopes: `bot` + `applications.commands` and permissions: `Send Messages`, `Read Message History`, `Use Slash Commands`.

---

## 🗂️ Project Structure

```
src/
├── index.ts              # Bot entry point
├── config.ts             # Env validation + LLM factory
├── db/
│   ├── client.ts         # Supabase singleton
│   └── schema.sql        # DB schema (run in Supabase SQL editor)
├── memory/
│   ├── types.ts          # Shared TypeScript interfaces
│   ├── shortTerm.ts      # In-process memory (per user+channel)
│   ├── longTerm.ts       # Supabase memory helpers
│   └── persona.ts        # Persona load/save/appearance helpers
├── agent/
│   ├── prompts.ts        # System prompt builder (persona + NSFW-aware)
│   ├── nodes.ts          # LangGraph nodes
│   ├── graph.ts          # Compiled agent graph
│   ├── tools/
│   │   └── generateImage.ts   # Pollinations AI image fetch (Flux)
│   └── utils/
│       └── imageIntent.ts     # Keyword-based image intent detection
├── bot/
│   ├── register.ts       # Slash command registration
│   ├── commands/         # /forget, /memory, /clear, /persona
│   ├── events/           # messageCreate, interactionCreate
│   └── utils/
│       └── isNsfwChannel.ts   # NSFW/DM channel detection
└── scripts/
    └── testAgent.ts      # CLI smoke test (no Discord needed)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Discord | discord.js v14 |
| AI Agent | LangChain + LangGraph |
| Default LLM | Llama 3.3 70B |
| Database | Supabase (PostgreSQL) |
| Testing | Vitest |
| Hosting | Railway |

---

## 📄 License

MIT
