# Data Flow

## Game: Mousefall — 2D Turn-Based Roguelike

---

## Overview

Поток данных однонаправленный и проходит строго через Presentation:

**Input → Presentation → Simulation → State → Presentation → UI**

Нет двунаправленного биндинга, нет глобального event bus, нет pub/sub. Каждое изменение состояния инициируется явным вызовом `simulation.dispatch()` из Presentation.

UI не имеет прямого доступа к Simulation. UI отправляет события ввода в Presentation и получает от него ViewModel + анимационные команды.

---

## Primary Data Flow

```
┌──────────────┐
│  User Input  │  (keyboard, mouse)
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Input Handler   │  src/ui/input/
│  (browser events)│
│  Захват сырых    │
│  событий ввода   │
└──────┬───────────┘
       │  "пользователь кликнул (x, y)"
       ▼
┌──────────────────────────────────────────┐
│           Presentation Layer             │
│  src/presentation/                       │
│                                          │
│  - Хранит сессионное состояние UI        │
│  - Принимает события ввода от UI         │
│  - Решает, какое действие вызвать        │
│  - Вызывает simulation.dispatch()        │
│  - Переводит результат в ViewModel       │
│    и анимационные команды                │
└──────┬───────────────────────────────────┘
       │  вызов API
       ▼
┌──────────────────────────────────────────┐
│           Simulation Layer               │
│  src/simulation/                         │
│                                          │
│  dispatch(action) → SimulationResult     │
│  preview(action) → ActionPreview         │
│  getState() → Readonly<GameState>        │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ actions  │ │ intents  │ │ world    │ │
│  │ (MOVE,   │ │ (MOVE,   │ │reactions │ │
│  │  ATTACK) │ │  DAMAGE, │ │          │ │
│  │          │ │  DIE)    │ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ │
└──────┬───────────────────────────────────┘
       │  возвращает
       ▼
┌──────────────────────────────────────────┐
│           SimulationResult               │
│  {                                       │
│    success: boolean;                     │
│    rootEvent: ExecutionNode | null;      │
│    stateChanged: boolean;                │
│  }                                       │
└──────┬───────────────────────────────────┘
       │  читает
       ▼
┌──────────────────────────────────────────┐
│           Presentation Layer             │
│                                          │
│  - Разбирает дерево ExecutionNode        │
│  - Формирует анимационный план           │
│  - Формирует строки combat log           │
│  - Обновляет сессионное состояние        │
│    (автопуть, выделение и т.д.)          │
│  - Готовит ViewModel для UI              │
└──────┬───────────────────────────────────┘
       │  ViewModel + AnimationPlan
       ▼
┌──────────────────┐
│   UI Layer       │
│   src/ui/        │
│                  │
│  ┌────────────┐  │
│  │  React     │  │  HUD, меню, панели
│  │ components │  │
│  └────────────┘  │
│  ┌────────────┐  │
│  │  PixiJS    │  │  Отрисовка мира,
│  │  renderer  │  │  спрайты, анимации
│  └────────────┘  │
└──────────────────┘
```

---

## Turn Data Flow

### Player Turn

```
UI: "пользователь нажал клавишу → двигаться вправо"
    │
    ▼
Presentation:
  1. Определяет, что в текущей фазе это команда MOVE
  2. Может вызвать simulation.preview(MOVE) для подсветки пути
  3. Вызывает simulation.dispatch(MOVE)
         │
         ▼
Simulation:
  1. Создаёт ExecutionBuilder с ACTION_APPLIED
  2. Определяет актёра (resolveActionActor)
  3. Проверяет AP (canActorAct, apCostResolver)
  4. Запускает ActionHandler:
       - validate(state, action)
       - resolve(state, action) → Intent[]
       - execute(state, action, intents, builder, parentNode)
         → порождает дочерние события (ENTITY_MOVED и т.д.)
       - После каждого intent: runWorldReactions
  5. Списывает AP у актёра
  6. Если у игрока закончились AP (isPlayerExhausted):
       - Запускает runEnvironmentTurn
       - Запускает beginNextPlayerTurn
  7. Возвращает SimulationResult
         │
         ▼
Presentation:
  1. Получает SimulationResult с rootEvent (ExecutionNode)
  2. Обходит дерево событий:
       - ENTITY_MOVED → команда анимации перемещения
       - ENTITY_DAMAGED → команда анимации урона
       - ENTITY_DIED → команда анимации смерти
  3. Формирует строки combat log
  4. Обновляет ViewModel (новые позиции сущностей)
  5. Отдаёт в UI: ViewModel + AnimationPlan
         │
         ▼
UI:
  1. Обновляет спрайты по ViewModel
  2. Исполняет анимационный план через PixiJS
  3. Отображает combat log
  4. По завершении анимаций → сигнал в Presentation
```

### Environment Turn (AI)

```
Presentation вызвал simulation.dispatch(...)
    │
    ▼
Simulation обнаружила, что у игрока ap <= 0
    │
    ▼
runEnvironmentTurn:
  Для каждого живого AI-актёра (findAllAliveAiActors):
    1. Восстанавливает AP: ap = maxAp
    2. Пока ap > 0:
         - aiStrategy.decideAction(actor, state) → GameAction
         - executeAction(actor, action, builder, root)
         - Если действие невозможно → прерывает цикл
    │
    ▼
beginNextPlayerTurn:
  - turn.activeSide = 'PLAYER'
  - turn.round += 1
  - player.ap = player.maxAp
    │
    ▼
Возвращается SimulationResult с полным деревом событий
(ходы игрока + ходы всех AI)
```

Реализация хода: `src/simulation/simulation.ts` (`DefaultTestSimulation.dispatch`).

---

## State Shape

Единственный источник истины — `GameState`. Все поля JSON-serializable (нет функций, нет `undefined`).

Структура определена в `src/simulation/types.ts`.

**Ключевые поля:**
- `map` — карта (размеры, 2D массив тайлов, метаданные комнат)
- `entities` — `Map<EntityId, Entity>`; все сущности (враги, предметы, игрок)
- `player` — отдельная ссылка на PlayerEntity для удобства
- `visible` / `explored` — туман войны
- `turn` — активная сторона (`PLAYER` / `ENVIRONMENT`) и номер раунда
- `phase` — `playing` | `dead` | `victory`
- `rng` — seeded PRNG state (seed + current state)

---

## Content Data Flow (Load Time)

```
Игровой клиент инициализируется
    │
    ▼
Presentation Layer вызывает loadContent()
    │
    ├── fetch JSON-файлов из public/content/
    ├── Zod-валидация каждого файла
    ├── throw on validation error (fail fast)
    └── populate ContentRegistry
    │
    ▼
Контент доступен Simulation через registry
```

Реализация загрузки: `src/simulation/content/loader.ts`.
Реализация реестра: `src/simulation/content/registry.ts`.

**Fail fast:** Если любой JSON-файл невалиден — игра не стартует. Это предотвращает скрытые баги контента.

---

## Save/Load Data Flow

### Save

```
Пользователь выбирает "Сохранить"
    │
    ▼
Presentation запрашивает текущее состояние:
  simulation.getState() → Readonly<GameState>
    │
    ▼
Presentation (или специализированный SaveManager)
  вызывает serialize(gameState) → JSON string
    │
    ▼
UI Layer (только он имеет доступ к browser API):
  localStorage.setItem('mousefall:save:slot', json)
  OR
  download as file
```

### Load

```
Пользователь выбирает "Загрузить"
    │
    ▼
UI Layer читает из localStorage:
  localStorage.getItem('mousefall:save:slot') → JSON string
    │
    ▼
Presentation:
  deserialize(json) → GameState
    │
    ├── Zod validation (throws on corrupt save)
    └── Version check (warns on version mismatch)
    │
    ▼
Presentation создаёт новый экземпляр Simulation
с загруженным состоянием
    │
    ▼
Presentation обновляет ViewModel → UI перерисовывается
```

Реализация сериализации: `src/simulation/serialization.ts` (сейчас закомментирован).

**Что НЕ сохраняется:**
- Сессионное состояние UI (выделенный тайл, открытые панели)
- Анимационные планы (эфемерны)
- Presentation state (автопуть, анимации)
- Content registry (перезагружается при старте)

---

## Rendering Data Flow

```
Presentation Layer
    │
    ├── Читает simulation.getState()
    ├── Добавляет сессионные данные (hover, selection)
    └── Формирует ViewModel:
    │
    │   {
    │     map,                  // тайлы, размеры
    │     entities,             // позиции, типы, spriteId
    │     player,               // HP, AP, позиция
    │     visible, explored,    // туман войны
    │     highlightedPath,              // подсветка автопути
    │     highlightedPathCommitted,     // зафиксирован ли автопуть
    │     highlightedPathTargetKind,    // вид цели автопути
    │     highlightedPathTurnEndIndices, // индексы концов хода
    │     animations,           // AnimationPlan[]
    │     combatLog,            // строки лога
    │     phase, floor, round,  // мета-информация
    │   }
    │
    ▼
UI Layer
    │
    ├── PixiJS Renderer:
    │   ├── Читает map.tiles → спрайты тайлов
    │   ├── Читает visible/explored → туман войны
    │   ├── Читает entities → спрайты сущностей
    │   └── Исполняет AnimationPlan → движение спрайтов
    │
    └── React Components:
        ├── player.hp / maxHp → HUD health bar
        ├── combatLog → панель лога
        └── phase, floor, round → информационные панели
```

**Renderer (PixiJS) никогда не мутирует игровое состояние.**
**Renderer читает только ViewModel от Presentation, не GameState напрямую.**

---

## Data Flow Rules

1. **Одно направление:** Input → Presentation → Simulation → State → Presentation → UI
2. **UI не мутирует State:** Все мутации только через `simulation.dispatch()`
3. **Simulation не вызывает UI:** Simulation только мутирует state и возвращает `SimulationResult`
4. **Renderer read-only:** Renderer никогда не пишет в game state
5. **Content — только на load time:** Нет runtime-модификации контента
6. **RNG — только через state:** Вся случайность из `state.rng`

---

## Anti-Patterns (Запрещено)

```
// ❌ FORBIDDEN: UI мутирует состояние напрямую
// UI никогда не трогает gameState

// ❌ FORBIDDEN: UI вызывает Simulation напрямую
// UI только отправляет события в Presentation

// ❌ FORBIDDEN: Simulation вызывает UI
// Simulation не использует browser API и не вызывает рендеринг

// ❌ FORBIDDEN: Math.random() в Simulation
// Только seeded RNG из state.rng

// ❌ FORBIDDEN: Presentation импортирует UI
// Presentation не зависит от способа отрисовки

// ✅ CORRECT: UI отправляет событие в Presentation
// UI → Presentation: "пользователь кликнул (x, y)"

// ✅ CORRECT: Presentation вызывает Simulation
// Presentation → simulation.dispatch(action)

// ✅ CORRECT: Simulation использует seeded RNG
// rngInt(state.rng, 1, 10)
```
