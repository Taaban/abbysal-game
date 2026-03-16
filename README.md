# ABYSSAL

A deep sea survival game built with HTML5 Canvas, CSS, and vanilla JavaScript. Eat smaller creatures to grow, hunt hunters, survive traps, and climb the global leaderboard.

![Game preview — five themed zones from the shallow bioluminescent waters to the Crystal Abyss](https://via.placeholder.com/800x400/00020f/00ffe7?text=ABYSSAL)

## Play

Open `index.html` in any modern browser. No build step, no dependencies, no server required.

## Controls

| Input | Action |
|---|---|
| Mouse move / drag | Steer your creature |
| Double-click / double-tap | **Burst** — converts nearby enemies to orbs, damages the rest (costs 25 energy) |
| `E` | **Pulse shockwave** — knocks back and stuns all enemies within 280 units |
| `Q` | **Warp dash** — teleports 200 units toward your cursor with invincibility frames |
| `Esc` / `P` | Pause / resume |

## How to play

- You are the glowing orb. Move toward food to eat it.
- **Green label = safe to eat.** Creatures smaller than you flee and can be consumed.
- **Red/danger creatures** will eat *you* — avoid them until you've grown large enough.
- Eating orbs and enemies gains **XP** (levels up your creature) and **energy** (fuels abilities).
- Golden ★ orbs give +20 energy instantly.
- Reach deeper zones by hitting score thresholds. Each zone introduces new enemy types and traps.

## Zones

| Zone | Score threshold | Special enemy |
|---|---|---|
| The Shallows | 0 | — |
| Midnight Zone | 200 | Teleporter |
| Volcanic Rift | 500 | Bomber |
| The Void | 1,000 | Phantom |
| Crystal Abyss | 2,000 | Splitter |

## Traps

- **Black Hole** — pulls everything toward it; get sucked in and lose HP
- **Turret** — tracks and fires projectiles at you; charges visibly before shooting
- **Spike Mine** — explodes when you enter its trigger radius
- **Spike Ring** — rotating spokes that damage on contact

Traps can be destroyed by the Shield power-up, or avoided with Ghost mode.

## Power-ups

| Icon | Effect | Duration |
|---|---|---|
| 🛡 Shield | Absorbs one hit and destroys nearby traps on contact | 5 s |
| ⚡ Speed | 1.6× movement speed | 5 s |
| 🧲 Magnet | Triples orb attraction range and strength | 5 s |
| 👻 Ghost | Pass through enemies and traps unharmed | 5 s |

## Abilities

Both abilities have cooldowns shown as arc timers at the bottom of the screen.

**Pulse (E)** — Emits a shockwave in a 280-unit radius. Enemies are knocked back and stunned for ~2.5 seconds (shown by a blue dashed ring). Stunned enemies cannot re-aggro even if you're within range. Cooldown: 5 s.

**Warp Dash (Q)** — Teleports 200 units in the direction of your cursor, leaving a ghost trail behind. Grants 40 frames of invincibility on arrival. Falls back to current movement direction if no cursor target is set. Cooldown: 4 s.

## Scoring

- Eating orbs: `floor(size / 3 × (1 + level × 0.03))` points — more at higher levels
- Golden orbs: 4× multiplier
- Killing enemies: `floor(radius × 3 × (1 + level × 0.03))` points
- Kill streak multiplier: +10% per 5 consecutive kills without taking damage

## Global leaderboard

Scores are stored using the Artifact persistent storage API and shared across all players. Your name is saved locally between sessions. The top 50 all-time scores are shown with name, score, zone reached, and level. Your rank is displayed after every run.

The leaderboard is accessible from the main menu, mid-game via the pause screen, and on the death/results screen.

## File structure

```
index.html   — HTML structure, HUD elements, overlay screens
styles.css   — All layout, typography, and UI component styles
game.js      — Game engine: rendering loop, physics, AI, abilities, leaderboard logic
README.md    — This file
```

## Modifying the game

**Add a new zone** — append an entry to the `THEMES` array in `game.js`. Set `scoreAt` to the score threshold, define colors for background, orbs, hunters, and the player hue.

**Add a new enemy type** — add a case in `spawnSpecialEnemy()`, handle its per-frame behaviour in the hunter loop (search for `h.type==='teleporter'`), and add any special collision logic in the hunter collision block.

**Add a new trap** — add a case in `spawnTrap()`, draw it in the trap rendering section, and add collision logic. Follow the pattern of existing traps.

**Tune difficulty** — `hunterSpeed()` and `trapCount()` both use `diff()` (0→1 from level 1→50). Adjust the multipliers there to change how aggressively the game scales.

**Add a new ability** — add an entry to the `ABILITIES` object, write an `activateX()` function, wire it to a key in the `keydown` listener, and the HUD arc will render automatically.

## Browser support

Works in all evergreen browsers (Chrome, Firefox, Safari, Edge). Uses only Canvas 2D API and standard ES2020 features. The `roundRect` canvas method is polyfilled for older Android WebView.

## License

MIT
