# Tests

## Responsibility

All automated tests for the simulation layer. Tests run in Node.js — no browser required.

See `TESTING_STRATEGY.md` in the project root for the full testing philosophy and examples.

---

## Directory Structure

```
tests/
├── README.md
│
├── unit/
│   ├── simulation/
│   │   ├── movement.test.ts      # moveEntity: valid moves, walls, combat trigger
│   │   ├── combat.test.ts        # attackEntity: damage, death, loot drop
│   │   ├── ai.test.ts            # AI behaviors: aggressive, passive, patrol
│   │   ├── fov.test.ts           # FOV calculation, fog of war updates
│   │   ├── mapgen.test.ts        # Map generation: valid maps, room connectivity
│   │   ├── inventory.test.ts     # Pickup, drop, use, stack limits
│   │   └── serialization.test.ts # Save/load round-trip, version migration
│   └── utils/
│       ├── math.test.ts          # Distance, pathfinding, bounds checking
│       └── rng.test.ts           # Determinism, bounds, distribution
│
├── integration/
│   ├── playerTurn.test.ts        # Full turn: player moves → AI responds
│   ├── combatSequence.test.ts    # Attack → damage → death → loot
│   ├── saveLoad.test.ts          # Save state → load → state identical
│   └── floorTransition.test.ts   # Descend → new map → player placed
│
└── fixtures/
    ├── states.ts     # Pre-built GameState objects for testing
    ├── maps.ts       # Pre-built map grids (open, walled, maze)
    └── entities.ts   # Pre-built entity objects (player, cat_small, etc.)
```

---

## Running Tests

```bash
# Run all tests once
npm test

# Run in watch mode (re-runs on file change)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run a specific test file
npm test movement

# Run a specific test by name
npm test -- -t "moves player to valid adjacent tile"
```

---

## Test Environment

- **Runtime:** Node.js (not browser)
- **Framework:** Vitest
- **No mocking required** — simulation has no external dependencies
- **No async** — all simulation functions are synchronous

---

## Fixture Usage

Always use fixtures instead of building state inline:

```typescript
// ✅ Good — readable, reusable
const state = createMovementTestState();

// ❌ Bad — verbose, fragile
const state: GameState = {
  map: { width: 10, height: 10, tiles: [...], rooms: [] },
  player: { id: 'player', x: 5, y: 5, hp: 100, ... },
  // ... 20 more lines
};
```

---

## Test Rules

1. **Each test is independent** — no shared mutable state between tests
2. **Fixed RNG seeds** — always use `createRNG(12345)` or similar fixed seed
3. **Test one thing** — each `it()` tests exactly one behavior
4. **Descriptive names** — test name describes the expected behavior
5. **No timeouts** — all tests complete synchronously and instantly
6. **No browser APIs** — if a test needs `window` or `document`, it's in the wrong layer

---

## Coverage Targets

| Path | Target |
|------|--------|
| `src/simulation/systems/` | 90%+ |
| `src/utils/rng.ts` | 100% |
| `src/simulation/serialization.ts` | 90%+ |
| `src/simulation/systems/mapgen.ts` | 80%+ |
| `src/ui/` | Not measured |
| `src/renderer/` | Not measured |
