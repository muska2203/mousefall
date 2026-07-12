# Фаза 1.2. Карта потока Intent → Event → World Reaction

> Описание текущего потока обработки намерений, событий и мировых реакций.
> Новая система правил пока не подключена — это базовая линия для миграции.

---

## Общая схема

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
        │             → Intent[] от мировых реакций
        │             → каждый Intent рекурсивно возвращается в executeIntent
        │
        └── Возвращает управление
```

---

## Точки входа в поток

### 1. Action handlers

Каждый обработчик действия реализует `ActionHandler<T>` (`src/simulation/systems/actions/types.ts`):

- `validate(state, action): ValidationResult`
- `resolve(state, action): Intent[]`
- `execute(state, action, intents, builder, parentNode): void`

Оркестратор: `runActionHandler` в `src/simulation/systems/actions/action-utils.ts`.

Обработчики сами вызывают `executeIntent` для каждого порождённого интента:

- `attackEntity` → `src/simulation/systems/actions/attack-action.ts`
- `useAbilityAction` → `src/simulation/systems/actions/use-ability-action.ts`
- `moveEntity` → `src/simulation/systems/actions/movement-action.ts`
- `equipEntity`, `unequipEntity`, `useItemAction`, `interactAction` и др.

### 2. Фазы хода в `GameSimulation`

`src/simulation/simulation.ts` напрямую вызывает `executeIntent` во время:

- `runFactionSetup` — `BEGIN_TURN`, тики статусов (`TICK_STATUS_EFFECTS`), `RESTORE_AP`, `TICK_COOLDOWN`;
- `runEnvironmentTurn` — тики статусов у не-акторов;
- `runRoundRecovery` — `CLEANUP_DEAD_ENTITIES`;
- `buildEndTurnPhase` — `SKIP_STUNNED_TURN` для оглушённых акторов;
- `executeActionInContext` — расход AP (`CONSUME_AP`) после успешного действия.

### 3. Центральная функция `executeIntent`

`src/simulation/systems/intents/execute-intent.ts`:

```typescript
export function executeIntent(
  state: GameState,
  intent: Intent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): ExecutionNode | null {
    const executor = intentExecutors[intent.type] as IntentExecutor<any>;
    const resultNode = executor(state, intent, builder, parent);
    if (resultNode !== null) {
        const reactionIntents = runWorldReactions(state, builder, resultNode);
        for (const reactionIntent of reactionIntents) {
            executeIntent(state, reactionIntent, builder, resultNode);
        }
    }
    return resultNode;
}
```

Ключевые свойства:

- Один `IntentExecutor` отвечает ровно за один семантический интент и порождает ровно одно семантическое событие.
- После исполнения вызываются мировые реакции на полученное событие.
- Новые интенты от реакций выполняются рекурсивно через тот же `executeIntent`.
- Родитель новых узлов — событие, которое породило реакцию.

---

## Intent → Event для ключевых боевых операций

| Intent | Исполнитель | Главное событие | Дополнительные события |
|---|---|---|---|
| `DAMAGE` | `executeDamageIntent` | `ENTITY_DAMAGED` | — |
| `PUSH` | `executePushIntent` | `ENTITY_DISPLACED` или `ENTITY_COLLIDED` | — |
| `MOVE` | `executeMoveIntent` | `ENTITY_MOVED` | — |
| `APPLY_STATUS` | `executeApplyStatusIntent` | `STATUS_APPLIED` | `ABILITY_PREPARED_CANCELLED` (при стане/немоте AI) |
| `HEAL` | `executeHealIntent` | `ENTITY_HEALED` | — |
| `DIE` | `executeDieIntent` | `ENTITY_DIED` / `PLAYER_DIED` | — |
| `EQUIP_ITEM` | `executeEquipItemIntent` | `ITEM_EQUIPPED` | `ABILITY_GRANTED` |
| `GRANT_ABILITY` | `executeGrantAbilityIntent` | `ABILITY_GRANTED` | — |
| `STATUS_APPLIED` | — | — | Это событие, не интент (см. ниже) |

---

## Путь рекурсии новых интентов

```
ATTACK (Action)
└── DAMAGE (Intent)
    └── ENTITY_DAMAGED (Event)
        ├── deathReaction → DIE (Intent)
        │   └── executeDieIntent
        │       └── ENTITY_DIED (Event)
        │           └── postDeathLootReaction → SPAWN_ITEM (Intent)
        │               └── executeSpawnItemIntent
        │                   └── ITEM_DROPPED (Event)
        └── fireDamageReaction → APPLY_STATUS burning (Intent)
            └── executeApplyStatusIntent
                └── STATUS_APPLIED (Event)
```

```
PUSH (Intent)
└── executePushIntent
    ├── ENTITY_DISPLACED (Event)
    │   └── displacementMoveReaction → MOVE (Intent)
    │       └── executeMoveIntent
    │           └── ENTITY_MOVED (Event)
    │               └── aiPerceptionReaction → NOTIFY_AI (Intent)
    │                   └── executeNotifyAIIntent
    │                       └── AI_NOTIFIED (Event)
    └── ENTITY_COLLIDED (Event)
        ├── collisionDamageReaction → DAMAGE (Intent)
        │   └── executeDamageIntent → ENTITY_DAMAGED → ...
        └── collisionStunReaction → APPLY_STATUS stunned (Intent)
            └── executeApplyStatusIntent → STATUS_APPLIED
```

---

## Правило «один executor — одно событие»

`docs/agents/ACTION_SYSTEM.md` требует:

> IntentExecutor должен выполнять ровно одно семантическое действие и порождать ровно одно семантическое событие. Он НЕ ДОЛЖЕН напрямую создавать или исполнять другие интенты.

### Проверка текущих исполнителей

- `executeDamageIntent` — только урон и `ENTITY_DAMAGED` ✅
- `executePushIntent` — только определяет результат толчка и создаёт `ENTITY_DISPLACED`/`ENTITY_COLLIDED` ✅
- `executeMoveIntent` — только перемещение и `ENTITY_MOVED` ✅
- `executeApplyStatusIntent` — только наложение статуса и `STATUS_APPLIED` ✅
- `executeDieIntent` — только смерть и `ENTITY_DIED`/`PLAYER_DIED` ✅
- `executeHealIntent` — только лечение и `ENTITY_HEALED` ✅

### Исключение: `floorTransitionReaction`

`floorTransitionReaction` — мировая реакция, а не `IntentExecutor`. Она атомарно применяет план перехода между этажами, порождая несколько системных интентов (`SET_MAP`, `SET_ENTITIES`, `TELEPORT_ENTITY`, `BEGIN_TURN`, `RESTORE_AP`, `APPLY_FOG_EVENTS`). Это допустимо, потому что:

- это системная инфраструктурная реакция;
- она не мутирует состояние напрямую, а возвращает интенты для канонического `executeIntent`;
- сама по себе не нарушает правило «один executor — одно событие», поскольку не является executor.

---

## Покрытие требуемых типов

Согласно `01-podgotovka.md`, схема должна покрывать:

| Тип | Покрытие |
|---|---|
| `DAMAGE` | ✅ `executeDamageIntent` → `ENTITY_DAMAGED` |
| `PUSH` | ✅ `executePushIntent` → `ENTITY_DISPLACED` / `ENTITY_COLLIDED` |
| `APPLY_STATUS` | ✅ `executeApplyStatusIntent` → `STATUS_APPLIED` |
| `MOVE` | ✅ `executeMoveIntent` → `ENTITY_MOVED` |
| `HEAL` | ✅ `executeHealIntent` → `ENTITY_HEALED` |
| `EQUIP_ITEM` | ✅ `executeEquipItemIntent` → `ITEM_EQUIPPED` + `ABILITY_GRANTED` |
| `STATUS_APPLIED` | ✅ событие, на которое срабатывают будущие правила |
| `GRANT_ABILITY` | ✅ `executeGrantAbilityIntent` → `ABILITY_GRANTED` |
| Рекурсия новых интентов | ✅ `executeIntent` рекурсивно выполняет интенты от `runWorldReactions` |

---

## Где будет врезаться новый слой правил

По решению из `decision-log.md` (Вопрос 1):

> Использовать Вариант А: центральная точка применения модификаторов внутри общей функции `executeIntent` перед вызовом конкретного `IntentExecutor`.

То есть поток станет:

```
Intent
  ↓
[Модификаторы на интенте] ← новый слой (feature-flag)
  ↓
IntentExecutor → Event
  ↓
[Контентные реакции на событии] ← ContentRuleReaction (feature-flag)
  ↓
[Системные мировые реакции] ← существующий runWorldReactions
  ↓
Рекурсия
```

Это сохраняет текущую архитектуру и добавляет два новых слоя под флагами.
