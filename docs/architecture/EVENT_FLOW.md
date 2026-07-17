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
│     → перед каждым intent:              │
│       applyIntentModifiersIfEnabled     │
│       (модификаторы контентных правил)  │
│     → каждый executor мутирует state    │
│     → каждый executor создаёт узел      │
│       через builder.addChild()          │
│  5. runContentRuleReactionsIfEnabled    │
│     → контентные правила на событие     │
│     → могут породить новые Intents      │
│  6. runWorldReactions                   │
│     → системные реакции мира            │
│     → могут породить новые Intents      │
│     → новые Intents → новые Events      │
│  7. SimulationResult                    │
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
│  - RULE_TRIGGERED  → запись combat log  │
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
        │       ├── buildRuleContext(state, intent)
        │       ├── applyIntentModifiersIfEnabled(state, intent, context)
        │       │     → только для DAMAGE: модифицирует damage/tags
        │       ├── IntentExecutor мутирует state
        │       ├── Создаёт узел события через builder.addChild()
        │       ├── runContentRuleReactionsIfEnabled(state, event, builder, node)
        │       │     → контентные правила из слоёв source/target/world/radius
        │       │     → могут породить новые Intents
        │       └── runWorldReactions(state, builder, node)
        │             → только системные реакции
        │             → может породить новые Intents
        │
        └── Возвращает управление
```

Реализация оркестратора: `src/simulation/systems/actions/action-utils.ts`.

Реализация IntentExecutor'ов: `src/simulation/systems/intents/`.

Реализация WorldReactions: `src/simulation/systems/world-reactions/reactions.ts`.

Реализация контентных модификаторов: `src/simulation/content-rules/modifiers/apply-intent-modifiers.ts`.

Реализация контентных реакций: `src/simulation/content-rules/reaction/content-rule-reaction.ts`.

Точки врезки в исполнитель интентов: `src/simulation/content-rules/intent-modifiers.ts`, `src/simulation/content-rules/event-reactions.ts`.

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
4. **Модификаторы:** `applyIntentModifiersIfEnabled` может изменить урон и теги DAMAGE-интента через контентные правила (например, `weapon_fire_damage_boost`)
5. **Execution:** `executeDamageIntent` уменьшает HP цели и создаёт событие `ENTITY_DAMAGED`
6. **Контентные реакции:** `runContentRuleReactionsIfEnabled` проверяет правила из слоёв `source`, `target`, `world`, `radius`. Например, `weapon_poison_on_hit` может породить `APPLY_STATUS`, а `armor_spiked_thorns` — контурный урон в ответ.
7. **World Reactions:** `deathReaction` видит `ENTITY_DAMAGED`, проверяет `hp <= 0`, порождает Intent `DIE`
8. **Execution DIE:** `executeDieIntent` удаляет сущность и создаёт `ENTITY_DIED` (или `PLAYER_DIED`)

Возможное итоговое дерево (с контентными реакциями):
```
ACTION_APPLIED (ATTACK)
└── ENTITY_DAMAGED (target, damage: 10)  ← урон мог быть модифицирован правилом weapon_fire_damage_boost
    ├── RULE_TRIGGERED (weapon_poison_on_hit)
    ├── APPLY_STATUS (poisoned)
    ├── RULE_TRIGGERED (armor_spiked_thorns)
    ├── ENTITY_DAMAGED (attacker, thorns: 2)
    └── ENTITY_DIED (target)
```

Без контентных правил дерево сводится к минимальной цепочке:
```
ACTION_APPLIED (ATTACK)
└── ENTITY_DAMAGED (target, damage)
    └── ENTITY_DIED (target)
```

---

## Модификаторы на интенте

Модификаторы применяются **перед** исполнением интента. Они собирают активные правила с эффектом `modifyDamage` из слоёв `source`, `target`, `world`, `radius` и изменяют только `DAMAGE`-интенты.

**Что может изменить модификатор:**
- `damage` — умножение или сложение (`op: 'multiply' | 'add'`);
- `tags` — добавление игровых тегов урона (`addTags`).

**Порядок применения:**
1. Слои в порядке `source → target → world → radius`.
2. Внутри слоя: сначала `multiply`, затем `add`.
3. При равенстве — по `priority`, затем по `id` правила.

Модификаторы не мутируют `state` и не порождают событий; они возвращают новый интент, который затем исполняет стандартный `IntentExecutor`.

Реализация: `src/simulation/content-rules/modifiers/apply-intent-modifiers.ts`.

---

## Контентные реакции (ContentRuleReaction)

Контентные реакции запускаются **после** исполнения интента и создания узла события. Они собирают активные правила из всех слоёв, фильтруют по триггеру (`event.type` и теги), оценивают условия и превращают подходящие эффекты в интенты.

**Слои источников правил:**
| Слой | Описание |
|------|----------|
| `source` | `activeRules` сущности-источника события. |
| `target` | `activeRules` сущности-цели события (если отличается от `source`). |
| `world` | Глобальные мировые правила (`WORLD_CONTENT_RULES`). |
| `radius` | `activeRules` живых акторов в радиусе 1 от позиции события (кроме `source`/`target`). |

**Порядок обработки:**
1. Слои: `source → target → world → radius`.
2. Внутри слоя `world`: `global → tileEffect → tileIntrinsic`.
3. При равенстве — по `priority`, затем по `id` правила.

**Поддерживаемые эффекты реакций:**
- `applyStatus` — наложить статус-эффект (`APPLY_STATUS`);
- `dealDamage` — нанести урон (`DAMAGE`);
- `heal` — лечение (`HEAL`);
- `restoreAp` / `consumeAp` — изменить AP (`RESTORE_AP` / `CONSUME_AP`);
- `counterAttack` — контратака (`COUNTER_ATTACK`).

Каждое сработавшее правило записывается в дерево как событие `RULE_TRIGGERED`, которое содержит `ruleId`, слой, владельца, тип триггера и порождённые интенты. Порождённые интенты проходят через `resolveStatusBatch` и затем рекурсивно исполняются как дочерние узлы текущего события.

Content-rules включены по умолчанию (`contentRulesEnabled`). Если флаг выключен, `applyIntentModifiersIfEnabled` и `runContentRuleReactionsIfEnabled` возвращают исходный интент / пустой массив, сохраняя старое поведение.

Реализация: `src/simulation/content-rules/reaction/content-rule-reaction.ts`.

---

## WorldReactions: системные реакции мира

`WorldReactions` — это жёстко зарегистрированные в коде реакции на события, которые обеспечивают базовые системные механики. Они выполняются **после** контентных реакций и не заменяются контентными правилами.

**Список системных реакций:**
- `death` — на `ENTITY_DAMAGED` проверяет `hp <= 0` и порождает `DIE`;
- `postDeathLoot` — на `ENTITY_DIED` генерирует лут;
- `displacementMove` — на `ENTITY_DISPLACED` завершает толчок;
- `floorTransition` — на `FLOOR_CHANGED` обрабатывает переход между этажами;
- `aiPerception` — на `ENTITY_MOVED`, `DOOR_OPENED`, `DOOR_CLOSED` обновляет восприятие AI.

Все остальные механики (огненный урон, яд, шипы, контратаки, модификация урона и т.д.) вынесены в контентные правила и больше не являются частью `WorldReactions`.

Реализация: `src/simulation/systems/world-reactions/reactions.ts`.

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
