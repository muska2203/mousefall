# Store Layer

## Responsibility

The store is the **bridge between simulation and UI**. It holds the current game state, exposes actions that the UI can call, and notifies React when state changes.

The store is thin — it contains **no game logic**. It only:
1. Calls simulation functions
2. Collects returned events
3. Notifies React subscribers

---

## Module Structure

```
store/
├── README.md
├── gameStore.ts    # Main Zustand store: game state + actions
└── saveStore.ts    # Save slot management (localStorage)
```

---

## `gameStore.ts`

The single Zustand store for all runtime state.

```typescript
type GameStore = {
  // ── Game state ──────────────────────────────────────────
  gameState: GameState | null;       // null = not in game (main menu)
  pendingEvents: GameEvent[];        // Events from last simulation step

  // ── UI state ─────────────────────────────────────────────
  phase: 'menu' | 'playing' | 'paused' | 'dead' | 'victory';
  isInventoryOpen: boolean;
  selectedEntityId: string | null;

  // ── Player actions (called by UI input handler) ──────────
  startNewGame(seed?: number): void;
  playerMove(dx: number, dy: number): void;
  playerWait(): void;
  playerUseItem(itemId: string): void;
  playerDropItem(itemId: string): void;

  // ── UI actions ───────────────────────────────────────────
  openInventory(): void;
  closeInventory(): void;
  selectEntity(id: string | null): void;

  // ── Save/load ────────────────────────────────────────────
  saveGame(slot: number): void;
  loadGame(slot: number): void;

  // ── Internal ─────────────────────────────────────────────
  clearPendingEvents(): void;
};
```

---

## Action Flow

Every player action follows this pattern:

```typescript
playerMove(dx: number, dy: number): void {
  const state = get().gameState;
  if (!state || state.turn !== 'player') return;

  // 1. Call simulation — mutates state, returns events
  const events = moveEntity(state, 'player', dx, dy);

  // 2. If player turn ended, process AI turn
  if (state.turn === 'ai') {
    const aiEvents = processAllEnemies(state);
    events.push(...aiEvents);
  }

  // 3. Notify React with new state reference + events
  set({
    gameState: { ...state },   // Shallow copy to trigger React re-render
    pendingEvents: events,
  });
}
```

**Why shallow copy:** Zustand uses reference equality to detect changes. Since we mutate state directly, we need to create a new object reference to trigger re-renders.

---

## `saveStore.ts`

Handles save slot management. Separate from `gameStore.ts` to keep concerns isolated.

```typescript
type SaveStore = {
  slots: SaveSlotInfo[];           // Metadata for all 4 save slots
  loadSlots(): void;               // Read slot metadata from localStorage
  saveToSlot(gameState: GameState, slot: number): void;
  loadFromSlot(slot: number): GameState | null;
  deleteSlot(slot: number): void;
};
```

---

## Allowed Dependencies

```
store/ → simulation/systems/   (call game actions)
store/ → simulation/turn.ts    (orchestrate turns)
store/ → simulation/serialization.ts  (save/load)
store/ → utils/
```

## Forbidden Dependencies

```
store/ ✗→ ui/          (store does not know about React components)
store/ ✗→ renderer/    (store does not know about PixiJS)
store/ ✗→ content/     (content is loaded by simulation layer)
```

---

## Why Zustand (Not useState)

- Game state needs to be accessible from multiple components (HUD, inventory, game canvas)
- Zustand avoids prop drilling without the complexity of Context + useReducer
- Zustand's selector system prevents unnecessary re-renders

**Tradeoff:** Adds a dependency. If the game had only one component, useState would be simpler.

---

## Pending Events Lifecycle

```
1. playerMove() called
2. Simulation runs, returns events[]
3. store.pendingEvents = events
4. React re-renders
5. useGameEvents() hook processes events (animations, sounds, log)
6. store.clearPendingEvents() called
7. store.pendingEvents = []
```

Events are cleared **after** the UI has processed them. Never cleared before.
