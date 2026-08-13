# Nexus — Enterprise AI Assistant

A live AI assistant with voice input, camera vision, and persistent memory —
built on NVIDIA's free Nemotron API, Supabase, and Next.js. Deploys to
Vercel with a live public link.

## What it actually does (read this first)

- **Chat** — talks to you using NVIDIA's Nemotron model, with a system
  prompt tuned for confident, concise, demo-friendly replies.
- **Voice input** — click the mic, speak, it transcribes and sends
  automatically. Uses the browser's built-in Speech Recognition — works
  well in Chrome and Edge, is **not supported in Firefox**, and needs
  HTTPS (which Vercel gives you automatically).
- **Camera vision** — click the camera icon, it opens a live preview.
  Click "Capture & describe" to grab a single frame and have Nemotron's
  vision model describe or answer a question about it. It does **not**
  continuously watch and narrate — that would be laggy and expensive.
  It looks at one frame when you ask it to.
- **Persistent memory** — every message is saved to a Supabase table.
  Reload the page, or come back tomorrow, and the conversation is still
  there. If Supabase isn't configured, the app still works — it just
  won't remember between page loads.
- **Board intro trigger** — say or type "introduce yourself to the
  board" and it returns a scripted, guaranteed-correct introduction
  instead of calling the model. **Edit this text before your demo** —
  it's in `app/api/chat/route.js` near the top, marked clearly.
- **Spoken replies** — every reply is also read aloud using the
  browser's built-in text-to-speech, toggleable with the speaker icon.

## 1. Install Node.js (skip if you already have it)

Download and install from [nodejs.org](https://nodejs.org) — get the LTS
version. This gives you `node` and `npm` on your computer.

## 2. Set up Supabase (your database)

1. Go to [supabase.com](https://supabase.com) → sign up → **New Project**.
2. Pick a name, set a database password (save it somewhere), pick the
   closest region, click **Create**. Wait ~2 minutes.
3. Once ready, click **SQL Editor** in the left sidebar → **New query**.
4. Paste this in and click **Run**:

   ```sql
   create table messages (
     id bigint generated always as identity primary key,
     role text not null,
     content text not null,
     created_at timestamptz not null default now()
   );
   ```

5. Go to **Project Settings → API**. Copy two values — you'll need them
   in step 4 below:
   - **Project URL**
   - **anon public** key

   > Note: this table has no access restrictions (no Row Level Security),
   > so anyone with your URL and anon key could read or write to it.
   > That's fine for a demo. Before using this for anything real, look up
   > "Supabase Row Level Security" and lock it down.

## 3. Get your NVIDIA API key (if you don't have one already)

1. Go to [build.nvidia.com](https://build.nvidia.com) → sign up (free,
   no card needed) → **API Keys** → **Generate API Key**.
2. Copy the key — it starts with `nvapi-`. It's shown once.

## 4. Configure your local copy

1. Open this folder in a terminal.
2. Copy the example env file:
   ```
   cp .env.local.example .env.local
   ```
3. Open `.env.local` in any text editor and fill in your three real
   values (NVIDIA key, Supabase URL, Supabase anon key).
4. Install dependencies:
   ```
   npm install
   ```
5. Run it locally to test:
   ```
   npm run dev
   ```
6. Open **http://localhost:3000** — test chat, voice (Chrome/Edge),
   and camera before you deploy anywhere.

## 5. Push to GitHub

```
git init
git add .
git commit -m "Nexus AI assistant"
```

Then create a new empty repo on [github.com](https://github.com) (don't
initialize it with a README), and follow the "push an existing
repository" instructions GitHub shows you — it'll be two `git remote`
and `git push` commands.

`.env.local` is already in `.gitignore`, so your real keys will **not**
be pushed to GitHub. Don't remove it from `.gitignore`, and don't paste
real keys into any other file.

## 6. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub.
2. **Add New Project** → import your repo.
3. Before clicking Deploy, open **Environment Variables** and add all
   three: `NVIDIA_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same values as your `.env.local`.
4. Click **Deploy**. You'll get a live link like
   `nexus-assistant.vercel.app` in about a minute.

## Before you demo tomorrow

- [ ] Rewrite `BOARD_INTRO` in `app/api/chat/route.js` in your own words
- [ ] Test on the actual laptop/browser you'll present with — Chrome or
      Edge, for voice support
- [ ] Test camera + mic permissions ahead of time (the browser will ask
      once, then remember)
- [ ] Say the trigger phrase once to confirm it fires correctly
- [ ] Have a backup: if venue wifi is bad, NVIDIA's API and Supabase
      both need internet — know your fallback (phone hotspot, etc.)
- [ ] The free NVIDIA tier is rate-limited and best-effort, not
      guaranteed uptime — don't hammer it with rapid-fire requests right
      before you go on

## Project structure

```
app/
  page.js              — the whole UI (chat, voice, camera, sidebar)
  layout.js            — fonts + page metadata
  globals.css          — all styling
  api/chat/route.js    — talks to Nemotron for text replies
  api/vision/route.js  — talks to Nemotron for image descriptions
lib/
  supabase.js          — database connection + save/load helpers
```
