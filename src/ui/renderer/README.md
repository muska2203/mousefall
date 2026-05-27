# Renderer Subsystem

## Responsibility

Renders the game world to screen using PixiJS. This subsystem is **read-only** — it receives render data from Presentation and draws it. It never mutates game state.

The renderer handles:
- Tile sprites (floor, wall, stairs)
- Entity sprites (player, enemies, items)
- Fog of war overlay (visible / explored / hidden)
- Camera/viewport (centering on player)
- Tile animations (attack flash, death, pickup)

The renderer does **NOT** handle:
- HUD, menus, dialogs (other `ui/` components)
- Input handling
- Game logic (that's `simulation/`)

> **Note:** Renderer is not a separate architectural layer. It is a technical subsystem inside UI Layer, as per `docs/architecture/OVERVIEW.md`.

---

## Module Structure

```
src/ui/renderer/
├── README.md
├── PixiApp.ts        # PixiJS Application setup, canvas mount/unmount
├── WorldRenderer.ts  # Main renderer: orchestrates all sub-renderers
├── TileRenderer.ts   # Renders map tiles layer
├── EntityRenderer.ts # Renders entity sprites layer
├── FogRenderer.ts    # Renders fog of war overlay
└── animations/       # Animation executors (planned)
```

---

## Rendering Pipeline

```
GameState (readonly snapshot)
    │
    ▼
WorldRenderer.render(state)
    │
    ├── TileRenderer.update(state.map, state.visible, state.explored)
    ├── EntityRenderer.update(state.enemies, state.items, state.player)
    ├── FogRenderer.update(state.visible, state.explored)
    └── Camera.centerOn(state.player.position)
    │
    ▼
PixiJS renders to canvas
```

---

## Event-Driven Animations

Animations are triggered by game events (from `store.pendingEvents`), not by state polling:

```typescript
// WorldRenderer.ts
function playEvents(events: GameEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'ACTION_APPLIED':
        if (event.action.type === 'ATTACK') {
          AttackAnimation.play(event.action.entityId);
        }
        break;
      case 'ENTITY_DIED':
        DeathAnimation.play(event.entityId, event.position);
        break;
    }
  }
}
```

Animations run independently of game state — they are purely visual.

---

## Coordinate System

```
Grid coordinates:  (x, y) where x = column, y = row
Screen coordinates: (x * TILE_SIZE, y * TILE_SIZE) + camera offset

TILE_SIZE = 32px (configurable in constants.ts)
```

---

## Fog of War Rendering

Three visual states per tile:
- **Hidden** (`explored[y][x] === false`): not rendered
- **Explored** (`explored[y][x] === true`, `visible[y][x] === false`): dark overlay (50% opacity)
- **Visible** (`visible[y][x] === true`): full brightness

---

## Allowed Dependencies

```
renderer/ → presentation/   (RenderInput, AnimationPlan)
renderer/ → utils/constants.ts  (TILE_SIZE, etc.)
```

## Forbidden Dependencies

```
renderer/ ✗→ simulation/      (no direct Simulation access)
renderer/ ✗→ simulation/systems/  (no game logic)
renderer/ ✗→ content/         (sprite IDs come from RenderInput)
```

---

## Integration with React

The renderer is mounted inside a React component via a ref:

```typescript
// ui/components/GameCanvas.tsx
function GameCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);

  useEffect(() => {
    rendererRef.current = new WorldRenderer(canvasRef.current!);
    return () => rendererRef.current?.destroy();
  }, []);

  // Re-render when game state changes
  const gameState = useGameStore(s => s.gameState);
  const pendingEvents = useGameStore(s => s.pendingEvents);

  useEffect(() => {
    rendererRef.current?.render(gameState);
    rendererRef.current?.playEvents(pendingEvents);
  }, [gameState, pendingEvents]);

  return <div ref={canvasRef} />;
}
```

**Key point:** React owns the lifecycle. PixiJS owns the rendering. They don't interfere.
