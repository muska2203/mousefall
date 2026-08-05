# UI Layer

## Responsibility

React components for all user-facing interface elements. The UI layer **displays state** and **routes input** — it contains no game logic.

The UI handles:
- Main menu, game over screen, victory screen
- In-game HUD (hero panel, equipment, inventory, skills, log)
- Character creation screen
- Keyboard and mouse input routing
- Combat log
- Toasts and popovers

The UI does **NOT** handle:
- Game rules or logic (that's `simulation/`)
- World rendering (PixiJS renderer in `renderer/`)
- Core state management (that's `presentation/`)

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
│   ├── Portrait.tsx           # Circular portrait
│   ├── ResourceBar.tsx        # HP / AP bar
│   ├── StatRow.tsx            # Stat allocation / readonly row
│   ├── GameField.tsx          # Phase button + PixiJS world + Hotbar
│   ├── PhaseButton.tsx        # Current turn phase / skip turn button
│   ├── EffectsPanel.tsx       # Active buffs list
│   ├── LogPanel.tsx           # Combat log with live region
│   ├── LogEntry.tsx           # Single log line
│   ├── EquipmentPanel.tsx     # Weapon / armor / amulet slots
│   ├── EquipSlot.tsx          # Single equipment slot
│   ├── InventoryPanel.tsx     # Inventory grid
│   ├── SkillsPanel.tsx        # Skill list with icons
│   ├── SkillRow.tsx           # Single skill row
│   ├── Hotbar.tsx             # Quick access toolbar
│   ├── HotbarSlot.tsx         # Single quick-access slot
│   ├── SkillDetailPopover.tsx # Skill tooltip for hotbar slots
│   ├── PortraitGallery.tsx    # Portrait selection grid
│   ├── StarterEquipmentPanel.tsx  # Starter gear selection
│   ├── ItemButton.tsx         # Item button with rarity frame
│   ├── ItemDetailCard.tsx     # Detailed item card
│   ├── ItemDetailPopover.tsx  # Item detail popover
│   ├── TagList.tsx            # Localized gameplay tag list
│   ├── FieldObjectPopover.tsx # Popover for field objects
│   ├── DetailPopover.tsx      # Generic detail popover
│   ├── EndingMetricsPanel.tsx # Run metrics
│   ├── BossListPanel.tsx      # Defeated bosses list
│   ├── EndingActionsPanel.tsx # Post-run actions
│   ├── InteractionHint.tsx    # Current interaction hint
│   ├── DebugPanel.tsx         # Debug spawn panel (dev only)
│   ├── Toast.tsx              # Toast notification
│   ├── ToastContainer.tsx     # Toast container portal
│   └── MetaFooter.tsx         # Footer with version
│
├── store/                     # UI-local state
│   └── settings.ts            # Language and UI settings
│
├── input/                     # Input mapping
│   └── keyboardMap.ts         # Keyboard layout and key map
│
├── animation/                 # Animation sequencing and executors
│   └── sequencer.ts           # Animation sequencer
│
├── renderer/                  # PixiJS world renderer
│   ├── PixiApp.ts
│   └── WorldRenderer.ts
│
└── styles/                    # Global CSS
    ├── game-screen.css        # Base theme, panels, bars, grids
    ├── welcome.css            # Character creation specific
    ├── runtime.css            # Modals, tooltips, rarity glows
    ├── ending.css             # Ending screen specific
    └── toasts.css             # Toast notifications
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
ui/ → presentation/      (GameSession, callbacks, types)
ui/ → ui/components/     (shared UI components)
ui/ → ui/styles/         (global CSS)
ui/ → ui/store/          (UI-local settings store only)
ui/ → ui/input/          (input mapping)
ui/ → ui/animation/      (animation sequencing)
ui/ → ui/renderer/       (PixiJS world renderer)
```

## Forbidden Dependencies

```
ui/ ✗→ simulation/       (no direct simulation calls)
ui/ ✗→ content/          (no direct content access)
```
