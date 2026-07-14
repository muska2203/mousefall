# Фаза 1.3. Контракты `RuleContext`, `ActiveRule`, `OwnerContext`

> Согласованные контракты новой боевой системы правил.
> Это черновик для фазы 2; изменения в production-код в фазе 1 не вносятся.

---

## `RuleContext`

`RuleContext` — единый контекст, который строится из события или интента и передаётся в правила. Правила не работают с сырым событием напрямую.

### Структура

```typescript
type RuleContext = {
  state: GameState;
  event: GameEvent | Intent;

  sourceEntityId: EntityId | null;
  targetEntityId: EntityId | null;

  collisionTargetId: EntityId | null;        // только для ENTITY_COLLIDED
  abilityTargetPosition: Position | null;     // только для ABILITY_USED
  abilityTargets: EntityId[] | null;          // для таргетных способностей

  eventPosition: Position | null;
  eventTags: GameplayTag[];

  eventDamage: number | null;                 // для ENTITY_DAMAGED
  eventAmount: number | null;                 // для ENTITY_HEALED, AP_RESTORED, RESOURCE_CONSUMED и т.д.
  eventDuration: number | null;               // для STATUS_APPLIED
  eventStacks: number | null;                 // для STATUS_STACKS_ADJUSTED
  eventMaxHp: number | null;                  // для STATUS_TICKED
};
```

### Построение `eventPosition`

Если событие не содержит собственной позиции, используется fallback:

```
eventPosition =
  собственная позиция события
  ?? позиция targetEntityId
  ?? позиция sourceEntityId
  ?? позиция collisionTargetId
  ?? null
```

### Разрешение контекста по типам событий

| Событие / Интент | `sourceEntityId` | `targetEntityId` | `eventPosition` | Особые поля |
|---|---|---|---|---|
| `ENTITY_DAMAGED` | `sourceEntityId` события | `targetId` события | `position` события | `eventDamage` |
| `ENTITY_HEALED` | — | `entityId` события | `position` события | `eventAmount` |
| `ENTITY_COLLIDED` | `sourceEntityId` события | `entityId` события | `position` события | `collisionTargetId` = `targetId` |
| `ENTITY_DISPLACED` | `sourceEntityId` события | `entityId` события | `to` события | — |
| `ENTITY_MOVED` | `entityId` события | — | `to` события | — |
| `STATUS_APPLIED` | `sourceEntityId` события | `entityId` события | позиция `entityId` | `eventDuration` |
| `STATUS_REMOVED` | — | `entityId` события | позиция `entityId` | — |
| `STATUS_TICKED` | — | `entityId` события | позиция `entityId` | `eventMaxHp` |
| `STATUS_STACKS_ADJUSTED` | — | `entityId` события | позиция `entityId` | `eventStacks` |
| `RESOURCE_CONSUMED` | `entityId` события | — | позиция `entityId` | `eventAmount` |
| `COUNTER_ATTACK_APPLIED` | `attackerId` события | `targetId` события | позиция `targetId` | — |
| `ABILITY_USED` | `entityId` события | первая цель из `targets` или null | позиция первой цели / точки | `abilityTargetPosition`, `abilityTargets` |
| `TURN_BEGAN` | `actorId` события | — | позиция `actorId` | — |
| `AP_RESTORED` | `entityId` события | — | позиция `entityId` | `eventAmount` |
| `DAMAGE` | `sourceEntityId` интента | `entityId` интента | позиция `entityId` | `eventDamage` = `damage` |
| `PUSH` | `sourceEntityId` интента | `entityId` интента | позиция `entityId` | — |
| `APPLY_STATUS` | `sourceEntityId` интента | `entityId` интента | позиция `entityId` | — |
| `MOVE` | — | `entityId` интента | позиция `entityId` | — |
| `HEAL` | — | `entityId` интента | позиция `entityId` | `eventAmount` |

### Правила построения

- Если у интента/события нет `sourceEntityId`, поле `sourceEntityId` в `RuleContext` равно `null`.
- Если у интента/события нет явной цели, `targetEntityId` равно `null`.
- `eventTags` берутся из поля `tags` события/интента; если тегов нет — пустой массив.
- Builder должен быть расширяемым: новые события добавляются через switch-case без нарушения существующих правил.

---

## `OwnerContext`

`OwnerContext` описывает источник правила в рантайме. Он заполняется при добавлении правила в `activeRules` и используется для:

- корректного удаления правила при снятии предмета/статуса/таланта;
- разрешения `self` внутри условий и эффектов правила.

### Структура

```typescript
type OwnerContext =
  | {
      type: 'entity';
      entityId: EntityId;          // ID экземпляра предмета / статуса / таланта
      statusInstanceId?: EntityId; // только для статусов
    }
  | {
      type: 'tileEffect';
      position: Position;
      tileEffectType: 'water' | 'oil' | 'fog' | string;
    };
```

### `self` по слоям источника

| Слой источника | `self` разрешается в |
|---|---|
| `source` | Атакующий (обычно совпадает с `eventSource`). |
| `target` | Цель действия (обычно совпадает с `eventTarget`). |
| `radius` | Сторонний наблюдатель / источник ауры. |
| `world` | Правило не имеет `self` как entity; используются `eventSource`, `eventTarget`, `eventPosition`. |

> **Важно:** для мировых и тайловых правил `self` не используется. Они работают с позицией события и участниками события.

---

## `ActiveRule`

`ActiveRule` — экземпляр `ContentRule`, добавленный в кэш `activeRules` актора или собранный из мира.

### Структура

```typescript
type ActiveRule = {
  id: string;                       // ID правила (ruleId)
  ownerContext: OwnerContext;       // источник правила в рантайме

  trigger: {
    event: string;                  // тип события или интента
    tags?: GameplayTag[];           // обязательные теги
  };

  conditions?: Condition[];         // глобальные проверки (один раз)
  targetConditions?: Condition[];   // проверки per-candidate

  effect: Effect;
  target: TargetSelector;

  priority: number;
};
```

### `ContentRule` vs `ActiveRule`

- `ContentRule` — статический декларативный объект в `src/simulation/content-rules/`.
- `ActiveRule` — `ContentRule` + заполненный `ownerContext`.
- Шаблоны предметов/статусов/талантов ссылаются на `ContentRule` по `ruleIds`.

---

## Источники правил и порядок слоёв

Правила собираются из четырёх источников в фиксированном порядке:

1. `source` — экипировка, статусы, таланты атакующего.
2. `target` — экипировка, статусы, таланты цели.
3. `world` — мировые контентные правила, тайловые эффекты, статические свойства тайла.
4. `radius` — активные правила сущностей в радиусе события (ауры, наблюдатели).

### Порядок внутри слоя `world`

Внутри слоя `world` порядок фиксирован:

1. Глобальные мировые правила.
2. Тайловые эффекты в `eventPosition`.
3. Статические свойства тайла в `eventPosition`.

### Сортировка внутри подгруппы

- Сначала по `priority` (меньше — раньше).
- При равных `priority` — по `ruleId` (детерминированный tie-break).

---

## Порядок модификаторов

Модификаторы применяются в `executeIntent` перед `IntentExecutor`.

### Порядок сортировки

1. По слою источника: `source` → `target` → `world` → `radius`.
2. Внутри слоя `world`: глобальные → тайловые эффекты → статические свойства тайла.
3. Внутри слоя по типу операции: сначала все `multiply`, затем все `add`.
4. По `priority`.
5. При равных `priority` — по `ruleId`.

> **Важно:** группировка `multiply` → `add` происходит внутри каждого слоя, а не глобально по всем слоям.

---

## Порядок реакций на событии

После исполнения интента:

1. Сначала запускаются **контентные реакции** (`ContentRuleReaction`), включая мировые контентные правила.
2. Интенты, порождённые контентными реакциями, выполняются **рекурсивно** до запуска системных реакций на исходное событие.
3. Затем запускаются **системные мировые реакции** (`runWorldReactions`).

### Порядок разрешения статусов внутри фазы реакций

1. Сначала выполняются все `REMOVE_STATUS` (включая снятия через `mutuallyExclusiveWith`).
2. Затем проверяются `blockedBy` → событие `STATUS_BLOCKED`.
3. Оставшиеся `APPLY_STATUS` сортируются по `categoryPriority`.
4. Внутри одной `statusCategory` остаётся только один статус; более приоритетный заменяет менее приоритетный.

---

## Self-эффекты

Если `sourceEntityId === targetEntityId` (например, самолечение или самобаф), правила этой сущности учитываются только один раз. Слои `source` и `target` для неё не дублируются.

---

## Снимок правил внутри фазы

Изменения `activeRules` применяются немедленно: статус, наложенный реакцией, сразу добавляет свои правила в кэш. Но текущая фаза `ContentRuleReaction` работает со **снимком** правил, собранным в начале фазы. Новые правила в текущую цепочку не попадают.

---

## Защита от циклов

- Глобальный лимит: **1000 реакций за одну цепочку**.
- При исчерпании лимита цепочка прерывается.
- Информация об исчерпании лимита пишется в консоль.

---

## Пример разрешения контекста

Правило кольца «при рубящем уроне → кровотечение» на игроке:

- `ownerContext.entityId` = ID экземпляра кольца.
- `self` разрешается в игрока (владельца правила).
- `RuleContext.sourceEntityId` = игрок (атакующий).
- `RuleContext.targetEntityId` = враг (цель).
- `RuleContext.eventPosition` = позиция врага.
- `RuleContext.eventTags` = `['damage.physical.slashing', ...]`.

Если это же правило было бы на враге в слое `target`:

- `self` разрешался бы во врага.
- `eventSource` всё ещё был бы игроком.
- `eventTarget` всё ещё был бы врагом.
