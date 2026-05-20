# Simulation Systems

## Responsibility

Each file in this directory handles **one domain of game logic**. Systems are plain TypeScript modules — no classes, no singletons, just exported functions.

---

## System Contract

Every exported function in a system follows this signature:

```typescript
function doAction(state: GameState, ...args): GameEvent[]
```

- Takes `GameState` as first argument (always)
- Mutates `state` directly
- Returns `GameEvent[]` describing what happened
- Never returns `void` (always return events, even if empty array)
- Never throws for expected game conditions (invalid move = return `[]`)

---

## Files

### `movement.ts`
Handles entity movement on the grid.

**Exports:**
- `moveEntity(state, entityId, dx, dy): GameEvent[]`
  - Validates bounds and tile walkability
  - Checks for enemy at target (triggers combat via `combat.ts`)
  - Checks for item at target (triggers pickup via `inventory.ts`)
  - Updates FOV after player moves (via `fov.ts`)

**Does NOT handle:**
- Combat resolution (delegates to `combat.ts`)
- Item pickup (delegates to `inventory.ts`)

---

### `combat.ts`
Handles attack resolution and damage.

**Exports:**
- `attackEntity(state, attackerId, targetId): GameEvent[]`
  - Calculates damage (attacker damage - target armor)
  - Applies damage to target HP
  - Handles death (removes entity, triggers loot drop)
  - Uses `state.rng` for any random damage variance

**Does NOT handle:**
- Movement (attacker stays in place)
- Ability effects (separate system)

---

### `inventory.ts`
Handles item pickup, drop, and use.

**Exports:**
- `pickupItem(state, entityId, itemId): GameEvent[]`
- `dropItem(state, entityId, itemId, position): GameEvent[]`
- `useItem(state, entityId, itemId): GameEvent[]`

**Does NOT handle:**
- Item effects that affect combat stats (those are read by combat.ts from entity stats)

---

### `fov.ts`
Handles field of view and fog of war calculation.

**Exports:**
- `updateFOV(state, entityId): GameEvent[]`
  - Recalculates `state.visible` from entity position
  - Updates `state.explored` (tiles seen at least once)
  - Uses shadowcasting algorithm

**Called by:**
- `movement.ts` after player moves
- `mapgen.ts` after map generation (initial FOV)

---

### `mapgen.ts`
Handles procedural map generation.

**Exports:**
- `generateMap(params: MapParams, rng: RNGState): MapData`
  - Generates rooms and corridors
  - Places stairs, enemies, items
  - Returns complete map data (does NOT mutate state directly)
  - Called by `state.ts` when creating a new floor

**Algorithm:** BSP (Binary Space Partitioning) or simple room placement.
Uses `state.rng` for all random decisions.

---

## Dependency Rules

Systems may call other systems:
- `movement.ts` → `combat.ts` (bump attack)
- `movement.ts` → `inventory.ts` (auto-pickup)
- `movement.ts` → `fov.ts` (update visibility after move)

Systems must NOT:
- Import from `ui/`, `renderer/`, `store/`
- Use `Math.random()` (use `state.rng`)
- Make async calls
- Access DOM
