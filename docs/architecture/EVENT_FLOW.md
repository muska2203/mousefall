# Event Flow

## Game: Mousefall — 2D Turn-Based Roguelike

---

## Overview

Игра **не использует** глобальный event bus или pub/sub.

События — это **доменные события** (`GameEvent`), организованные в **дерево `ExecutionNode`**. Они описывают, что произошло во время выполнения действия в Simulation. Presentation потребляет это дерево и превращает его в анимационные планы и строки combat log. UI никогда не видит сырые события напрямую.

Полный список событий: `src/simulation/core-types.ts` (union `GameEvent`), реэкспорт в `src/simulation/types.ts`.

---

## Why No Event Bus

Глобальный event bus создаёт скрытое связывание:
- Любой модуль может эмитить или слушать любое событие
- Сложно отследить, что вызвало что
- Сложно тестировать (нужно мокать bus)
- Сложно отлаживать (порядок событий непредсказуем)

Вместо этого:
- События — это **явный возврат** из функций Simulation (`SimulationResult`)
- Они организованы в **дерево**, сохраняющее причинно-следственные связи
- Presentation получает готовое дерево и решает, как его отобразить

---

## Event Flow Architecture

```
┌─────────────────────────────────────────┐
│  Simulation: dispatch(action)           │
│                                         │
│  1. ExecutionBuilder(root=ACTION_APPLIED)│
│  2. ActionHandler.validate(state,action)│
│  3. ActionHandler.resolve(state,action) │
│     → Intent[]                          │
│  4. ActionHandler.execute(...)          │
│     → вызывает IntentExecutor'ы         │
│     → каждый executor мутирует state    │
│     → каждый executor создаёт узел      │
│       через builder.addChild()          │
│  5. runWorldReactions                   │
│     → проверяет реакции на событие      │
│     → может породить новые Intents      │
│     → новые Intents → новые Events      │
│  6. SimulationResult                    │
  │     { success, stateChanged,            │
  │       phases: TurnPhase[],              │
  │       hasMoreSteps }                    │
  │     TurnPhase = { side, actions[] }     │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│  Presentation Layer                     │
│                                         │
│  Обходит дерево ExecutionNode:          │
│  - ENTITY_MOVED    → анимация ходьбы    │
│  - ACTION_APPLIED (ATTACK) → анимация атаки │
│  - ENTITY_DAMAGED  → всплывающий урон   │
│  - ENTITY_DIED     → анимация смерти    │
│  - ITEM_PICKED_UP  → звук + строка лога │
│                                         │
│  Формирует:                             │
│  - AnimationPhase[]                     │
│  - combatLog: string[]                  │
│  - ViewModel для UI                     │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│  UI Layer                               │
│                                         │
│  Исполняет AnimationPhase[] через PixiJS │
│  Отображает combatLog через React       │
│  Не знает о GameEvent / ExecutionNode   │
└─────────────────────────────────────────┘
```

---

## Event Production (Simulation Layer)

### Трёхфазная система

```
Action (GameAction)
  │
  ├── validate(state, action) → ValidationResult
  │
  ├── resolve(state, action) → Intent[]
  │
  └── execute(state, action, intents, builder, parentNode)
        │
        ├── Для каждого Intent:
        │     executeIntent(state, intent, builder, parent)
        │       │
        │       ├── IntentExecutor мутирует state
        │       ├── Создаёт узел события через builder.addChild()
        │       └── runWorldReactions(state, builder, node)
        │             → может породить новые Intents
        │
        └── Возвращает управление
```

Реализация оркестратора: `src/simulation/systems/actions/action-utils.ts`.

Реализация IntentExecutor'ов: `src/simulation/systems/intents/`.

Реализация WorldReactions: `src/simulation/systems/world-reactions/reactions.ts`.

### Пример: MOVE Action

1. **Action:** `MOVE` с параметрами (entityId, dx, dy)
2. **Validation:** проверка границ, стен, других сущностей
3. **Resolution:** порождает Intent `MOVE`
4. **Execution:** `executeMoveIntent` обновляет координаты сущности и создаёт событие `ENTITY_MOVED`
5. **World Reactions:** на `ENTITY_MOVED` сейчас нет зарегистрированных реакций

### Пример: ATTACK Action с Death Reaction

1. **Action:** `ATTACK` с параметрами (entityId, dx, dy)
2. **Validation:** проверка, что цель в зоне поражения
3. **Resolution:** порождает Intent `DAMAGE`
4. **Execution:** `executeDamageIntent` уменьшает HP цели и создаёт событие `ENTITY_DAMAGED`
5. **World Reactions:** `deathReaction` видит `ENTITY_DAMAGED`, проверяет `hp <= 0`, порождает Intent `DIE`
6. **Execution DIE:** `executeDieIntent` удаляет сущность и создаёт `ENTITY_DIED` (или `PLAYER_DIED`)

Итоговое дерево:
```
ACTION_APPLIED (ATTACK)
└── ENTITY_DAMAGED (target, damage)
    └── ENTITY_DIED (target)
```

---

## Event Consumption (Presentation Layer)

UI **не получает** сырые `GameEvent`. Presentation полностью подготавливает все данные для UI.

Presentation обходит дерево `ExecutionNode` рекурсивно (от корня к листьям) и переводит каждое событие в:
- **Анимационную команду** — что, как и где анимировать
- **Строку combat log** — если событие значимо для лога
- **Изменение ViewModel** — новые позиции, HP и т.д.

Реализация этого перевода: `src/presentation/logBuilder.ts`, `src/presentation/animation/`.

---

## Event Lifecycle

```
1. Пользователь взаимодействует с UI
2. UI отправляет событие в Presentation
3. Presentation вызывает simulation.dispatch(action)
4. Simulation мутирует state и строит дерево ExecutionNode
5. Simulation возвращает SimulationResult
6. Presentation обходит дерево:
   - Формирует AnimationPhase[]
   - Формирует combatLog[]
   - Обновляет ViewModel
7. Presentation отдаёт UI: ViewModel + AnimationPhase[] + combatLog
8. UI исполняет анимации и отображает лог
9. По завершении анимаций UI сигнализирует Presentation
10. Presentation решает, нужно ли продолжить (например, следующий шаг автопути)
```

---

## Turn Event Sequence

### Полный пример хода игрока (атака с убийством)

```
Пользователь нажал клавишу атаки
    │
    ▼
UI → Presentation: "атака в направлении (dx, dy)"
    │
    ▼
Presentation → simulation.dispatch(ATTACK)
    │
    ▼
Simulation:
  ┌─ ACTION_APPLIED (ATTACK)
  │  └─ ENTITY_DAMAGED (cat_small, damage: 8)
  │     └─ ENTITY_DIED (cat_small)  ← deathReaction
    │
    ▼
Если player.ap <= 0 или вызван END_TURN:
    │
    ▼
Simulation → faction-setup 'allies' → actor-turn allies
  ┌─ Для каждого живого ally:
  │  └─ END_TURN (или другое действие)
    │
    ▼
Simulation → faction-setup 'enemies' → actor-turn enemies
  ┌─ Для каждого живого AI step() вызывает runAiAction один раз:
  │  └─ AI решает действие (например, MOVE)
  │     └─ ENTITY_MOVED (cat_mid_1, (3,3) → (4,4))
    │
    ▼
Simulation → faction-setup 'neutrals' → actor-turn neutrals
    │
    ▼
Simulation → round-recovery
  └─ CLEANUP_DEAD_ENTITIES
  └─ сброс actorsDoneThisRound
    │
    ▼
Simulation → faction-setup 'player' (следующий раунд)
  └─ BEGIN_TURN увеличивает round
  └─ восстановление AP, тик статусов и кулдаунов
    │
    ▼
SimulationResult возвращается в Presentation:
  phases: TurnPhase[] (каждая фаза содержит свои деревья ExecutionNode)
    │
    ▼
Presentation:
  - Обходит дерево
  - Формирует AnimationPhase[]:
      [ATTACK_ANIMATION, DAMAGE_NUMBER, DEATH_ANIMATION, MOVE_SPRITE]
  - Формирует combatLog:
      ["Вы ударили гоблина на 8 урона.", "Гоблин погиб.", "Орк двигается."]
  - Обновляет ViewModel
    │
    ▼
UI:
  - PixiJS исполняет анимации
  - React отображает обновлённый HUD и combat log
```

---

## Event Rules

1. **События — это данные, не callbacks** — нет функций внутри объектов событий
2. **События порождаются только Simulation** — UI и Presentation не создают `GameEvent`
3. **Simulation не читает события** — события только описывают, что произошло
4. **События эфемерны** — не сохраняются, не передаются между сессиями
5. **UI может игнорировать любое событие** — через Presentation, которая решает, что отображать
6. **События не мутируют state** — они read-only описания произошедших мутаций
7. **Порядок событий в дереве отражает причинность** — родитель породил дочернее событие

---

## Combat Log

Presentation формирует строки combat log на основе дерева событий. Каждый тип события может давать строку или нет (не все события значимы для лога).

UI получает готовый массив строк и только отображает его.

Реализация: `src/presentation/logBuilder.ts`.

---

## What Events Are NOT Used For

- ❌ **Триггер игровой логики** — логика триггерится прямыми вызовами функций
- ❌ **Межсистемная коммуникация** — системы общаются через shared state
- ❌ **Undo/redo** — не реализовано (используйте save/load)
- ❌ **Networking** — вне скоупа
- ❌ **Persistence** — события эфемерны, не сохраняются

---

## Adding New Events

1. Добавить новый тип в union `GameEvent` в `src/simulation/core-types.ts` (реэкспорт в `src/simulation/types.ts`)
2. Добавить эмиссию события в соответствующем `IntentExecutor` (`src/simulation/systems/intents/`)
3. Добавить обработку в `Presentation`:
   - Перевод в анимационную команду
   - Перевод в строку combat log (если применимо)
4. Добавить визуализацию в `UI` (если требуется новый тип анимации)

**Других изменений не требуется.** Исчерпывающий union тип в TypeScript гарантирует, что новый тип события не останется необработанным.
