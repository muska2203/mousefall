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
│  step() → SimulationResult               │
│  preview(action) → ActionPreview         │
│  getState() → Readonly<GameState>        │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ actions  │ │ intents  │ │ content  │ │ world    │ │
│  │ (MOVE,   │ │ (MOVE,   │ │ rules    │ │reactions │ │
│  │  ATTACK) │ │  DAMAGE, │ │(modifiers│ │ (system) │ │
│  │          │ │  DIE)    │ │+reactions│ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└──────┬───────────────────────────────────┘
       │  возвращает
       ▼
┌──────────────────────────────────────────┐
│           SimulationResult               │
│  {                                       │
│    success: boolean;                     │
│    stateChanged: boolean;                │
│    phases: TurnPhase[];                  │
│    hasMoreSteps: boolean;                │
│  }                                       │
│                                          │
│  TurnPhase = {                           │
│    side: TurnSide;                       │
│    actions: ExecutionNode[];             │
│  }                                       │
└──────┬───────────────────────────────────┘
       │  читает
       ▼
┌──────────────────────────────────────────┐
│           Presentation Layer             │
│                                          │
│  - Разбирает дерево ExecutionNode        │
│  - Формирует анимационные фазы          │
│  - Формирует строки combat log           │
│  - Обновляет сессионное состояние        │
│    (автопуть, выделение и т.д.)          │
│  - Готовит ViewModel для UI              │
└──────┬───────────────────────────────────┘
       │  ViewModel + AnimationPhase[]
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
         → для каждого Intent:
             1. buildRuleContext(state, intent)
             2. applyIntentModifiersIfEnabled(state, intent, context)
                → модифицирует DAMAGE-интенты (damage/tags) через контентные правила
             3. IntentExecutor мутирует state и создаёт узел события
             4. runContentRuleReactionsIfEnabled(state, event, builder, node)
                → контентные правила из слоёв source/target/world/radius
                → могут породить новые Intents (damage, heal, status, AP, counter-attack)
             5. runWorldReactions(state, builder, node)
                → системные реакции (death, loot, displacement, floor, AI perception)
         → новые Intents от реакций рекурсивно исполняются как дочерние узлы
       - После каждого intent: рекурсивное выполнение порождённых реакций
  5. Списывает AP у актёра
  6. Если у игрока закончились AP или вызван END_TURN:
       - Следующий вызов step() переведёт ход к фракционному планировщику
       - Пока hasMoreSteps === true, Presentation вызывает step() рекурсивно
  7. Возвращает SimulationResult
         │
         ▼
Presentation:
  1. Получает SimulationResult с массивом TurnPhase; каждая фаза содержит деревья ExecutionNode
  2. Обходит дерево событий:
       - ENTITY_MOVED → команда анимации перемещения
       - ENTITY_DAMAGED → команда анимации урона
       - ENTITY_DIED → команда анимации смерти
  3. Формирует строки combat log
  4. Обновляет ViewModel (новые позиции сущностей)
  5. Отдаёт в UI: ViewModel + AnimationPhase[]
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
Presentation вызвал simulation.dispatch(...) или simulation.step()
    │
    ▼
Если у текущего актора закончились AP или он вызвал END_TURN,
Simulation переводит ход к следующей фазе фракционного планировщика:
    │
    ▼
faction-setup 'allies' → actor-turn ally_1 → actor-turn ally_2
    │
    ▼
faction-setup 'enemies' → actor-turn enemy_A → actor-turn enemy_B
  Для каждого AI-актора step() вызывает runAiAction один раз:
    - strategy.decideAction(actor, state) → GameAction
    - executeAction(actor, action, builder, root)
    │
    ▼
faction-setup 'neutrals' → actor-turn neutral_1
    │
    ▼
round-recovery:
  - CLEANUP_DEAD_ENTITIES
  - сброс actorsDoneThisRound
    │
    ▼
faction-setup 'player' (следующий раунд):
  - BEGIN_TURN увеличивает round
  - восстановление AP, тик статусов и кулдаунов
    │
    ▼
actor-turn 'player' — ожидание ввода

Каждый вызов step() возвращает SimulationResult с одной или несколькими
 TurnPhase. Presentation вызывает step() рекурсивно, пока hasMoreSteps === true.
```

Реализация хода: `src/simulation/simulation.ts` (`GameSimulation.dispatch` / `GameSimulation.step`).

---

## State Shape

Единственный источник истины — `GameState`. Все поля JSON-serializable (нет функций, нет `undefined`).

Структура определена в `src/simulation/types.ts`.

**Ключевые поля:**
- `map` — карта (размеры, 2D массив тайлов, метаданные комнат)
- `entities` — `Map<EntityId, Entity>`; все сущности (враги, предметы, игрок)
- `player` — отдельная ссылка на PlayerEntity для удобства
- `map` — карта (размеры, 2D массив тайлов, метаданные комнат)
- `mapParams` — параметры генерации текущего этажа
- `entities` — `Map<EntityId, Entity>`; все сущности (враги, предметы, игрок, двери, лестницы)
- `player` — отдельная ссылка на PlayerEntity для удобства
- `visible` / `explored` — туман войны
- `turn` — активная сторона (`TurnSide`) и номер раунда
- `phase` — `playing` | `dead` | `victory`
- `rng` — seeded PRNG state (seed + current state)
- `floorSnapshots` — снапшоты посещённых этажей для возврата
- `runStats` — статистика текущего забега
- `nextEntityCounter` — счётчик для генерации уникальных ID сущностей

---

## Content Data Flow (Load Time)

```
Игровой клиент инициализируется
    │
    ▼
UI entry (`src/main.tsx`) вызывает loadAllContent(browserFetchJson)
    │
    ├── fetch JSON-файлов из public/content/
    │   ├── Zod-валидация каждого файла
    │   ├── throw on validation error (fail fast)
    │   └── populate ContentRegistry
    │
    ├── загрузка контентных правил (content-rules)
    │   ├── статические TypeScript-объекты из `src/simulation/content-rules/rules.ts`
    │   ├── глобальные мировые правила (`WORLD_CONTENT_RULES`)
    │   └── активные правила (`activeRules`) сущностей формируются из шаблонов
    │       предметов, способностей и статусов, ссылающихся на правила по `ruleIds`
    │
    ▼
Контент доступен Simulation и Presentation через registry (read-only)
```

Контентные правила используются Simulation Layer на этапе исполнения интентов:
- модификаторы (`modifyDamage`) изменяют DAMAGE-интенты до исполнения;
- реакции (`dealDamage`, `heal`, `applyStatus`, `restoreAp`, `consumeAp`, `counterAttack`)
  порождают дочерние интенты после исполнения исходного интента.

Content-rules включены по умолчанию (`contentRulesEnabled`).

Реализация загрузки: `src/content/loader.ts`.
Реализация реестра: `src/content/registry.ts`.

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

Реализация сериализации: **не реализована** (модуль `src/simulation/serialization.ts` удалён).

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
    │     state,                // Readonly<GameState>
    │     highlightedPath,              // подсветка автопути
    │     highlightedPathCommitted,     // зафиксирован ли автопуть
    │     highlightedPathTargetKind,    // вид цели автопути
    │     highlightedPathTurnEndIndices, // индексы концов хода
    │     animations,           // AnimationPhase[] | null
    │     animationBatchId,     // идентификатор партии анимаций
    │     phase,                // 'idle' | 'animating' | 'gameOver'
    │     zoom,                 // масштаб камеры
    │     playerStats,          // рассчитанные характеристики игрока
    │     equipment,            // снапшот экипировки
    │     targetingOverlay,     // оверлеи таргетинга способностей
    │     playerSkills,         // скиллы игрока
    │     heroStats,            // характеристики для HeroPanel
    │     equipSlots,           // слоты экипировки
    │     itemsOnFloor,         // предметы на полу
    │     doorSprites,          // entityId → spritePath
    │     inventory,            // инвентарь игрока
    │     hotbar,               // 10 слотов хотбара
    │     activeEffects,        // активные статус-эффекты игрока
    │     statusEffectsByEntity, // статусы всех видимых сущностей
    │     aiModeByEntity,       // AI-режим для иконок
    │     runStats,             // статистика забега
    │     fieldObjectPopover,   // popover объекта под курсором
    │     interactionHint,      // подсказка взаимодействия (F)
    │     aiPreparedIntents,    // телеграфы подготовленных AI-скиллов
    │     currentTurnSide,      // текущая сторона хода
    │     debugEnabled,         // флаг debug-режима
    │     mapgenDebugEnabled,   // флаг debug-визуализации карты
    │   }
    │
    ▼
UI Layer
    │
    ├── PixiJS Renderer:
    │   ├── Читает map.tiles → спрайты тайлов
    │   ├── Читает visible/explored → туман войны
    │   ├── Читает entities → спрайты сущностей
    │   └── Исполняет AnimationPhase[] → движение спрайтов
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
6. **RNG:**
   - Генерация мира использует только `state.rng` (seeded PRNG).
   - Игровые runtime-события используют `utils/random.ts` (`Math.random()`) и не мутируют `state.rng`.

---

## Anti-Patterns (Запрещено)

```
// ❌ FORBIDDEN: UI мутирует состояние напрямую
// UI никогда не трогает gameState

// ❌ FORBIDDEN: UI вызывает Simulation напрямую
// UI только отправляет события в Presentation

// ❌ FORBIDDEN: Simulation вызывает UI
// Simulation не использует browser API и не вызывает рендеринг

// ❌ FORBIDDEN: Прямой Math.random() в Simulation
// Используй utils/rng.ts для mapgen и utils/random.ts для игровой логики

// ❌ FORBIDDEN: Presentation импортирует UI
// Presentation не зависит от способа отрисовки

// ✅ CORRECT: UI отправляет событие в Presentation
// UI → Presentation: "пользователь кликнул (x, y)"

// ✅ CORRECT: Presentation вызывает Simulation
// Presentation → simulation.dispatch(action)

// ✅ CORRECT: Генерация мира использует seeded RNG
// rngInt(state.rng, 1, 10)

// ✅ CORRECT: Игровые события используют runtime random
// randomChance(50)
```
