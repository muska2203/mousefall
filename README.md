# Mousefall

**2D Turn-Based Roguelike** — TypeScript · React · PixiJS · Zustand · Zod · Vitest

---

## Architecture Documents

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layer responsibilities, dependency rules, key decisions |
| [DATA_FLOW.md](./DATA_FLOW.md) | How data moves from input to screen |
| [EVENT_FLOW.md](./EVENT_FLOW.md) | Domain events: production, consumption, lifecycle |
| [SAVE_SYSTEM.md](./SAVE_SYSTEM.md) | Snapshot saves, serialization, version migration |
| [CONTENT_PIPELINE.md](./CONTENT_PIPELINE.md) | JSON content, Zod schemas, modding |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | What to test, how to test, test fixtures |

---

## Project Structure

```
Mousefall/
│
├── src/
│   ├── simulation/          # Core game engine (headless, deterministic)
│   │   ├── types.ts         # All core types: GameState, Entity, GameEvent
│   │   ├── state.ts         # Initial state factory, state helpers
│   │   ├── turn.ts          # Turn orchestration
│   │   ├── rng.ts           # Seeded PRNG (re-exported from utils)
│   │   ├── serialization.ts # Save/load: GameState ↔ JSON
│   │   ├── schemas.ts       # Zod schemas for save validation
│   │   ├── systems/         # Game systems (movement, combat, fov, mapgen)
│   │   ├── ai/              # Enemy AI behaviors
│   │   └── content/         # Content registry (loads JSON, exposes templates)
│   │
│   ├── store/               # Zustand store: bridges simulation ↔ UI
│   │   ├── gameStore.ts     # Game state + player actions
│   │   └── saveStore.ts     # Save slot management
│   │
│   ├── renderer/            # PixiJS world renderer (read-only)
│   │   ├── PixiApp.ts
│   │   ├── WorldRenderer.ts
│   │   ├── TileRenderer.ts
│   │   ├── EntityRenderer.ts
│   │   ├── FogRenderer.ts
│   │   ├── Camera.ts
│   │   ├── SpriteSheet.ts
│   │   └── animations/
│   │
│   ├── ui/                  # React components (display + input only)
│   │   ├── App.tsx
│   │   ├── screens/         # MainMenu, Game, GameOver, Victory
│   │   ├── components/      # HUD, Inventory, CombatLog, GameCanvas
│   │   └── input/           # useKeyboardInput hook
│   │
│   └── utils/               # Pure utilities (no game logic, no state)
│       ├── math.ts          # Grid math, pathfinding, distance
│       ├── rng.ts           # Seeded PRNG implementation
│       └── constants.ts     # TILE_SIZE, SAVE_VERSION, etc.
│
├── public/
│   └── content/             # Game content as JSON (moddable)
│       ├── entities/        # Enemy and player templates
│       ├── items/           # Weapon, armor, consumable templates
│       ├── abilities/       # Ability templates
│       └── maps/            # Map generation parameters
│
└── tests/
    ├── unit/                # Unit tests for simulation systems
    ├── integration/         # Integration tests for turn sequences
    └── fixtures/            # Pre-built states, maps, entities for tests
```

---

## Dependency Rules (Summary)

```
ui/         → store/, renderer/, simulation/types.ts
store/      → simulation/systems/, simulation/turn.ts, simulation/serialization.ts
simulation/ → content/, utils/
renderer/   → simulation/types.ts, utils/constants.ts
content/    → (nothing)
utils/      → (nothing)
```

**No circular dependencies. No upward dependencies from simulation.**

---

## Core Principles

1. **Simulation is headless** — no browser APIs, no React, no PixiJS
2. **Simulation is deterministic** — same state + same actions = same result
3. **All randomness is seeded** — `state.rng` is the only source of randomness
4. **UI never mutates state** — only calls store actions
5. **Renderer is read-only** — reads state, never writes
6. **Content is data** — JSON files, no logic, fully moddable
7. **Events are explicit** — returned from simulation functions, not emitted globally

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build
```

---

## Adding Content

See [CONTENT_PIPELINE.md](./CONTENT_PIPELINE.md) for full details.

**Quick start:** Add a JSON file to `public/content/entities/enemies/` following the existing format. No code changes required.

---

## Adding Game Systems

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

**Quick start:**
1. Add system file to `src/simulation/systems/`
2. Export functions with signature `(state: GameState, ...args): GameEvent[]`
3. Call from `src/simulation/turn.ts`
4. Add tests in `tests/unit/simulation/`
