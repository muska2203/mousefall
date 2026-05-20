# Simulation Layer

## Responsibility

This is the **core game engine**. All game rules, state transitions, and logic live here.

The simulation layer is:
- **Headless** — no browser APIs, no DOM, no React
- **Deterministic** — same inputs always produce same outputs
- **Testable** — runs in Node.js without a browser
- **Self-contained** — no dependencies on UI or renderer

---

## Module Structure

```
simulation/
├── types.ts          # All core type definitions (GameState, Entity, Event, etc.)
├── state.ts          # Initial state factory, state helpers
├── turn.ts           # Turn orchestration (player turn → AI turn → next player turn)
├── rng.ts            # Seeded PRNG — all randomness goes through here
├── serialization.ts  # Save/load: serialize GameState to/from JSON
├── schemas.ts        # Zod schemas for GameState validation (used in save/load)
│
├── systems/          # Game systems — each handles one domain
│   ├── movement.ts   # Entity movement, collision detection
│   ├── combat.ts     # Attack resolution, damage, death
│   ├── inventory.ts  # Item pickup, drop, use
│   ├── fov.ts        # Field of view, fog of war
│   └── mapgen.ts     # Procedural map generation
│
├── ai/               # Enemy AI behaviors
│   ├── index.ts      # processAllEnemies() — entry point for AI turn
│   ├── aggressive.ts # Move toward player, attack when adjacent
│   ├── passive.ts    # Wander randomly, flee when attacked
│   └── patrol.ts     # Follow patrol path, alert nearby enemies
│
└── content/          # Content registry — loads and provides entity/item templates
    ├── registry.ts   # ContentRegistry: load, validate, and expose content
    └── loader.ts     # Fetch JSON files, validate with Zod schemas
```

---

## Allowed Dependencies

```
simulation/ → content/   (read entity/item templates)
simulation/ → utils/     (math helpers, constants)
```

## Forbidden Dependencies

```
simulation/ ✗→ ui/
simulation/ ✗→ renderer/
simulation/ ✗→ store/
simulation/ ✗→ React
simulation/ ✗→ PixiJS
simulation/ ✗→ DOM APIs
simulation/ ✗→ Math.random()  (use rng.ts instead)
simulation/ ✗→ Date.now()     (not deterministic)
```

---

## Key Contracts

### System Function Signature

Every system function follows this pattern:

```typescript
function doSomething(state: GameState, ...args): GameEvent[] {
  // 1. Validate inputs
  // 2. Mutate state
  // 3. Return events describing what happened
}
```

- **Mutates state directly** (no immutable copies)
- **Returns events** (for UI feedback — animations, sounds, log)
- **Never calls UI** (no callbacks, no event bus)

### Determinism Rules

- All randomness via `rng.ts` functions only
- Entity processing order: always sort by `id` before iterating
- No `Date.now()`, `Math.random()`, or async operations

---

## Adding a New System

1. Create `systems/mySystem.ts`
2. Export functions with signature `(state: GameState, ...args): GameEvent[]`
3. Add new event types to `types.ts` if needed
4. Call from `turn.ts` at the appropriate point in the turn
5. Add tests in `tests/unit/simulation/mySystem.test.ts`
