# Renderer Layer

## Responsibility

Renders the game world to screen using PixiJS. This layer is **read-only** — it reads game state and draws it. It never mutates game state.

The renderer handles:
- Tile sprites (floor, wall, stairs)
- Entity sprites (player, enemies, items)
- Fog of war overlay (visible / explored / hidden)
- Camera/viewport (centering on player)
- Tile animations (attack flash, death, pickup)

The renderer does **NOT** handle:
- HUD, menus, dialogs (that's `ui/`)
- Input handling (that's `ui/input/`)
- Game logic (that's `simulation/`)

---

## Module Structure

```
renderer/
├── README.md
├── PixiApp.ts        # PixiJS Application setup, canvas mount/unmount
├── WorldRenderer.ts  # Main renderer: orchestrates all sub-renderers
├── TileRenderer.ts   # Renders map tiles layer
├── EntityRenderer.ts # Renders entity sprites layer
├── FogRenderer.ts    # Renders fog of war overlay
├── Camera.ts         # Viewport management, scroll, zoom
├── SpriteSheet.ts    # Sprite sheet loading and lookup by spriteId
└── animations/
    ├── AttackAnimation.ts   # Flash effect on hit
    ├── DeathAnimation.ts    # Fade-out on death
    └── PickupAnimation.ts   # Float-up on item pickup
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
      case 'ENTITY_ATTACKED':
        AttackAnimation.play(event.targetId);
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
renderer/ → utils/constants.ts  (TILE_SIZE, etc.)
renderer/ → simulation/types.ts (GameState, GameEvent types — read only)
```

## Forbidden Dependencies

```
renderer/ ✗→ simulation/systems/  (no game logic)
renderer/ ✗→ store/               (reads state passed as argument, not from store)
renderer/ ✗→ ui/                  (no UI concerns)
renderer/ ✗→ content/             (sprite IDs come from entity data in state)
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
