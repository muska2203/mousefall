# UI Layer

## Responsibility

React components for all user-facing interface elements. The UI layer **displays state** and **routes input** — it contains no game logic.

The UI handles:
- Main menu, game over screen, victory screen
- In-game HUD (hero panel, equipment, inventory, skills, log)
- Character creation screen
- Keyboard and mouse input routing
- Combat log

The UI does **NOT** handle:
- Game rules or logic (that's `simulation/`)
- World rendering (temporary ASCII in `GameField`)
- State management (that's `presentation/`)

---

## Module Structure

```
ui/
├── App.tsx                    # Root component: routing between screens
│
├── screens/                   # Full-screen views
│   ├── MainMenuScreen.tsx     # New game button
│   ├── CharacterCreationScreen.tsx  # Portrait, stats, equipment, seed
│   ├── GameScreen.tsx         # Main gameplay screen with 3-column HUD
│   └── EndingScreen.tsx       # Victory / defeat summary
│
├── components/                # Reusable UI components
│   ├── ThreeColumnLayout.tsx  # Universal 3-column layout
│   ├── Panel.tsx              # Wooden panel with bronze frame
│   ├── HeroPanel.tsx          # Portrait + bars + stats
│   ├── Portrait.tsx           # Circular portrait with level badge
│   ├── ResourceBar.tsx        # HP / Mana / XP bar
│   ├── StatRow.tsx            # Stat allocation / readonly row
│   ├── GameField.tsx          # Phase button + ASCII map + hotbar
│   ├── EffectsPanel.tsx       # Active buffs list
│   ├── LogPanel.tsx           # Combat log with live region
│   ├── LogEntry.tsx           # Single log line
│   ├── EquipmentPanel.tsx     # Weapon / armor / amulet slots
│   ├── EquipSlot.tsx          # Single equipment slot
│   ├── InventoryPanel.tsx     # Inventory grid
│   ├── ConsumablesPanel.tsx   # Consumable items
│   ├── SkillsPanel.tsx        # Skill list with icons
│   ├── SkillRow.tsx           # Single skill row
│   ├── HotSlot.tsx            # Hotbar slot
│   ├── PortraitGallery.tsx    # Portrait selection grid
│   ├── StarterEquipmentPanel.tsx  # Starter gear selection
│   ├── ItemButton.tsx         # Item button with rarity frame
│   ├── EndingMetricsPanel.tsx # Run metrics
│   ├── BossListPanel.tsx      # Defeated bosses list
│   ├── EndingActionsPanel.tsx # Post-run actions
│   └── MetaFooter.tsx         # Footer with version
│
└── styles/                    # Global CSS
    ├── game-screen.css        # Base theme, panels, bars, grids
    ├── welcome.css            # Character creation specific
    ├── runtime.css            # Modals, tooltips, rarity glows (future)
    └── ending.css             # Ending screen specific
```

---

## Screen Routing

Routing is driven by `GameSession` mode via `App.tsx`:

```typescript
// App.tsx
function App() {
  const [mode, setMode] = useState(session.getMode());

  switch (mode) {
    case 'mainMenu':         return <MainMenuScreen />;
    case 'characterCreation': return <CharacterCreationScreen />;
    case 'playing':          return <GameScreen />;
    case 'gameOver':         return <EndingScreen result="defeat" />;
    case 'victory':          return <EndingScreen result="victory" />;
  }
}
```

No React Router needed — mode-based routing is sufficient for a roguelike.

---

## Input Handling

Keyboard input is handled in `GameScreen` via global `keydown` listener:
- WASD / Arrows / Russian layout (ц, ы, ф, в) for movement
- `.` or `5` for wait (via phase button)
- Input is suppressed when focus is in `INPUT`, `TEXTAREA`, or `SELECT`
- `e.repeat` is ignored to prevent spam on key hold

---

## Component Rules

1. **Read state from GameSession** — use `useSyncExternalStore` with `session.subscribe()`
2. **Call actions via GameSession** — never call simulation directly
3. **No game logic** — no if/else based on game rules
4. **No direct state mutation** — only call session methods
5. **All static assets from `/assets/`** — served by Vite from `public/assets/`

---

## Allowed Dependencies

```
ui/ → presentation/      (GameSession, callbacks)
ui/ → ui/components/     (shared UI components)
ui/ → ui/styles/         (global CSS)
```

## Forbidden Dependencies

```
ui/ ✗→ simulation/       (no direct simulation calls)
ui/ ✗→ content/          (no direct content access)
ui/ ✗→ store/            (store layer removed)
```
