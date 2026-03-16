# ABYSSAL

A deep sea survival game built with HTML5 Canvas, CSS, and vanilla JavaScript. Eat smaller creatures to grow, hunt hunters, survive traps, and climb the global leaderboard.

## Play

Open `index.html` in any modern browser. No build step, no dependencies, no server required.

---

## Leaderboard setup (~3 minutes)

The game uses [Supabase](https://supabase.com) for its global leaderboard — free tier, no credit card needed.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up / log in
2. Click **New project**, give it a name (e.g. `abyssal`), choose a region, set a database password
3. Wait ~1 minute for provisioning

### 2. Create the scores table

In your project, open the **SQL Editor** and run this:

```sql
create table scores (
  name       text primary key,
  score      integer not null,
  level      integer not null default 1,
  zone       text,
  updated_at timestamptz default now()
);

alter table scores enable row level security;

create policy "public read"   on scores for select using (true);
create policy "public insert" on scores for insert with check (true);
create policy "public update" on scores for update using (true);
```

### 3. Get your project credentials

Go to **Project Settings → API** and copy:
- **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
- **anon / public key** — the long `eyJ...` string (safe to commit)

### 4. Add them to game.js

Near the top of `game.js`, replace the two placeholders:

```js
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
```

Save, commit, push. Done.

> **Note:** The anon key is intentionally public — RLS policies only permit reading all scores and upserting your own row. Never put your `service_role` key in client code.

---

## Controls

| Input | Action |
|---|---|
| Mouse move / drag | Steer |
| Double-click / double-tap | **Burst** — converts nearby enemies to orbs (costs 25 energy) |
| `E` | **Pulse** — shockwave knocks back and stuns nearby enemies |
| `Q` | **Dash** — smooth glide 220 units toward cursor |
| `Esc` / `P` | Pause / resume |

**Mobile:** virtual joystick bottom-left, Pulse / Dash / Burst buttons bottom-right.

---

## Zones

| Zone | Score | Special enemy |
|---|---|---|
| The Shallows | 0 | — |
| Midnight Zone | 200 | Teleporter |
| Volcanic Rift | 500 | Bomber |
| The Void | 1,000 | Phantom |
| Crystal Abyss | 2,000 | Splitter |

## Traps

| Trap | Behaviour |
|---|---|
| Black Hole | Rotating spiral; pulls everything toward the singularity |
| Turret | Hexagonal body; tracks and fires projectiles |
| Mine | Dark sphere with 8 horn detonators; LED blinks red when you're close |
| Spike Ring | Rotating bladed arms; damages on contact |

## Power-ups

| Icon | Effect |
|---|---|
| 🛡 Shield | Absorbs one hit; destroys nearby traps |
| ⚡ Speed | 1.6× movement |
| 🧲 Magnet | 3× orb attraction |
| 👻 Ghost | Pass through everything |

---

## File structure

```
index.html   — HTML, HUD, overlays, mobile controls
styles.css   — All styles including mobile joystick
game.js      — Game engine, sound (Web Audio), leaderboard (Supabase), joystick
README.md    — This file
```

## License

MIT
