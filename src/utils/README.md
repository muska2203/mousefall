# Utils

## Responsibility

Shared utility functions and constants used across the codebase. No game logic, no state, no side effects — pure functions only.

---

## Module Structure

```
utils/
├── README.md
├── math.ts        # Grid math, distance, direction helpers
├── rng.ts         # Seeded PRNG implementation (used by simulation)
└── constants.ts   # Game-wide constants (tile size, grid limits, etc.)
```

---

## `math.ts`

Pure math functions for grid-based calculations.

```typescript
// Manhattan distance between two grid positions
function manhattanDistance(a: Position, b: Position): number

// Chebyshev distance (for 8-directional movement)
function chebyshevDistance(a: Position, b: Position): number

// Check if position is within grid bounds
function inBounds(pos: Position, width: number, height: number): boolean

// Get all 4 cardinal neighbors of a position
function cardinalNeighbors(pos: Position): Position[]

// Get all 8 neighbors (cardinal + diagonal)
function allNeighbors(pos: Position): Position[]

// Convert direction enum to dx/dy
function directionToDelta(dir: Direction): { dx: number; dy: number }

// Simple A* pathfinding for AI movement
function findPath(
  from: Position,
  to: Position,
  isWalkable: (pos: Position) => boolean
): Position[]
```

---

## `rng.ts`

Seeded pseudo-random number generator. **This is the only source of randomness in the simulation.**

Uses a simple, fast, well-tested algorithm (Mulberry32 or xoshiro128**).

```typescript
type RNGState = {
  seed: number;    // Original seed (for display/sharing)
  state: number;   // Current internal state (advances each call)
};

// Create a new RNG with a given seed
function createRNG(seed: number): RNGState

// Generate a random integer in [min, max] inclusive
// Mutates rng.state
function rngInt(rng: RNGState, min: number, max: number): number

// Generate a random float in [0, 1)
// Mutates rng.state
function rngFloat(rng: RNGState): number

// Pick a random element from an array
// Mutates rng.state
function rngPick<T>(rng: RNGState, array: T[]): T

// Shuffle an array in place (Fisher-Yates)
// Mutates rng.state and the array
function rngShuffle<T>(rng: RNGState, array: T[]): T[]

// Roll a percentage chance (0-100)
// Returns true if roll succeeds
function rngChance(rng: RNGState, percent: number): boolean
```

**Critical:** `rng.state` is mutated on every call. The RNG state is part of `GameState` and is serialized with saves. This ensures determinism across sessions.

---

## `constants.ts`

Game-wide constants. No magic numbers in game code.

```typescript
// Rendering
export const TILE_SIZE = 32;           // Pixels per tile
export const VIEWPORT_WIDTH = 25;      // Tiles visible horizontally
export const VIEWPORT_HEIGHT = 20;     // Tiles visible vertically

// Gameplay
export const PLAYER_SIGHT_RANGE = 8;   // Default FOV radius
export const MAX_INVENTORY_SIZE = 20;  // Max items player can carry
export const MAX_FLOOR = 10;           // Dungeon depth

// Save system
export const SAVE_SLOTS = 3;           // Number of manual save slots
export const SAVE_VERSION = 1;         // Current save format version
export const AUTOSAVE_SLOT = 0;        // Slot 0 is reserved for autosave

// Map generation
export const MIN_MAP_WIDTH = 30;
export const MAX_MAP_WIDTH = 80;
export const MIN_MAP_HEIGHT = 30;
export const MAX_MAP_HEIGHT = 80;
```

---

## Dependency Rules

```
utils/ → (nothing)
```

Utils have **zero dependencies** on any other module. They are the foundation layer.

---

## Rules

- No game state in utils
- No side effects
- No async functions
- All functions must be pure (same input → same output)
- `rng.ts` is the only exception: it mutates `rng.state` (by design)
