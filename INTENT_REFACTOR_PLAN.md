# План рефакторинга системы интентов и мировых реакций

> **Как использовать этот файл:** по мере разбора каждой проблемы отмечаем галочками этапы «Продумано» и «Реализовано». Комментарии и уточнения добавляем прямо в разделы.

---

## Общий контекст

Канонический поток в проекте:

```
Action (GameAction)
  → validate → resolve → Intent[]
  → executeIntent(intent)
      → IntentExecutor мутирует state и создаёт ExecutionNode
      → runWorldReactions(node) → дополнительные Intent[]
      → рекурсивно executeIntent для каждой реакции
```

Ключевой инвариант: **любое игровое действие, которое должно вызывать мировые реакции, должно исполняться через `executeIntent`**. Прямой вызов `IntentExecutor` или мутация состояния вне интентов ломает цепочку реакций и приводит к тихим багам.

### ⚠️ Важное правило: IntentExecutor не исполняет другие интенты

> **IntentExecutor должен выполнять ровно одно семантическое действие и порождать ровно одно семантическое событие. Он НЕ ДОЛЖЕН напрямую создавать или исполнять другие интенты.**

Если результат действия логически должен привести к другим эффектам (урону, статусам, смерти), исполнитель должен:
1. Выполнить своё прямое действие.
2. Породить семантическое событие (`ExecutionNode`).
3. Позволить мировой реакции на это событие породить следующие интенты.

Пример: `PUSH` при столкновении не вызывает `DAMAGE`/`APPLY_STATUS` напрямую, а порождает `ENTITY_COLLIDED`, на которое реакция порождает `DAMAGE` и `APPLY_STATUS`.

---

## Критические проблемы (реальные баги)

### 1. `executeDamage()` — мутатор в обход системы интентов

**Где:** `src/simulation/systems/damage/damage-processor.ts:31`

**Что происходит:**
- `executeDamage()` напрямую меняет `target.hp` и добавляет `ENTITY_DAMAGED` в дерево.
- Она не является `IntentExecutor`, но вызывается из:
  - `push-intent-executer.ts` — урон при столкновении от толчка.
  - `tick-status-effects-intent-executer.ts` — урон от горения.
- Эти вызовы нарушают правило: `IntentExecutor` не должен исполнять другие интенты.

**Последствия:**
- Урон от толчка и от горения **не запускает** `runWorldReactions`.
- `deathReaction` не видит смерть → не порождает `DIE`.
- `fireDamageReaction` не видит огненный урон → не наложит/не продлит горение.
- `postDeathLootReaction` не получит `ENTITY_DIED` → лут не выпадает.

**Что нужно сделать:**

1. **В `push-intent-executer.ts`:**
   - Убрать вызовы `executeDamage(...)` и `executeApplyStatusIntent(...)`.
   - При столкновении порождать семантическое событие `ENTITY_COLLIDED` (или расширить `ENTITY_BUMPED`).
   - Добавить мировые реакции на `ENTITY_COLLIDED`, которые порождают `DAMAGE` и `APPLY_STATUS(stunned)`.

2. **В `tick-status-effects-intent-executer.ts`:**
   - Убрать вызов `executeDamage(...)` для горения.
   - В событие `STATUS_TICKED` добавить список эффектов, которые тикнули (`effectTypes: StatusEffectType[]`).
   - Добавить мировую реакцию `burningTickReaction` на `STATUS_TICKED`, которая порождает `DAMAGE`-интент, если в списке есть `burning`.

3. **В `damage-processor.ts`:**
   - Оставить `executeDamage()` внутренним хелпером только для `executeDamageIntent`.
   - В идеале — сделать функцию неэкспортируемой или переместить логику прямо в `executeDamageIntent`.

- [x] Продумано
- [x] Реализовано

**Заметки / решения по реализации:**

1. ✅ Создаём новый тип события `ENTITY_COLLIDED` (не расширяем `ENTITY_BUMPED`, так как последнее — визуальное событие отскока).
2. ✅ Реакции на `ENTITY_COLLIDED`:
   - `collisionDamageReaction` → `DAMAGE`
   - `collisionStunReaction` → `APPLY_STATUS(stunned)`
3. ✅ Для горения добавляем `effectTypes` в `STATUS_TICKED` и реакцию `burningTickReaction` → `DAMAGE`.
4. ✅ Перемещение при толчке: `PUSH`-исполнитель не двигает сущность напрямую. При свободной клетке порождает `ENTITY_DISPLACED`, реакция `displacementMoveReaction` на которое порождает `MOVE`-интент. Таким образом перемещение проходит через канонический `MOVE` и `ENTITY_MOVED`.
5. ✅ `executeDamage()` встроен в `executeDamageIntent`, файл `damage-processor.ts` удалён.
6. ✅ Добавлены тесты для collision-реакций и `burningTickReaction`.

---

### 2. `push-intent-executer.ts` вызывает другие исполнители напрямую

**Где:** `src/simulation/systems/intents/push-intent-executer.ts`

**Что происходит:**
- Импортирует и вызывает `executeDamage(...)` и `executeApplyStatusIntent(...)` напрямую.
- При столкновении добавляет `ENTITY_BUMPED` как дочерний узел к узлу урона.
- При свободной клетке движение делается прямой мутацией `entity.x = targetX`.

**Последствия:**
- Урон и оглушение от толчка не проходят через мировые реакции.
- Толкание на лестницу **не вызывает** `stairsTransitionReaction`.

**Что нужно сделать:**
- Переписать `PUSH`-исполнитель согласно правилу: он не исполняет другие интенты.
- При столкновении порождать `ENTITY_COLLIDED`.
- При свободной клетке порождать `ENTITY_DISPLACED`.
- Добавить мировые реакции:
  - `collisionDamageReaction` на `ENTITY_COLLIDED` → `DAMAGE`
  - `collisionStunReaction` на `ENTITY_COLLIDED` → `APPLY_STATUS(stunned)`
  - `displacementMoveReaction` на `ENTITY_DISPLACED` → `MOVE`

- [x] Продумано
- [x] Реализовано

**Заметки / решения по реализации:**
- `PUSH`-исполнитель полностью переписан: теперь он только эмитит `ENTITY_COLLIDED` или `ENTITY_DISPLACED`.
- Все последствия (урон, оглушение, перемещение) обрабатываются мировыми реакциями.

---

### 3. `dash-intent-executor.ts` вызывает другие исполнители напрямую

**Где:** `src/simulation/systems/intents/dash-intent-executor.ts:86, 98, 123, 133, 142, 153`

**Что происходит:**
- Прямые вызовы: `executeBumpIntent(...)`, `executeOpenDoorIntent(...)`, `executeDamageIntent(...)`, `executePushIntent(...)`.

**Последствия:**
- Рывок может открыть дверь, нанести урон, оттолкнуть цель, но ни одна из этих операций не запускает мировые реакции.
- Смерть от урона рывка не вызывает `deathReaction`.

**Что нужно сделать:**
- `DASH`-исполнитель не должен исполнять другие интенты напрямую.
- Вариант A: разбить `DASH` на цепочку интентов уже на этапе `resolve` способности (`MOVE`, `OPEN_DOOR`, `DAMAGE`, `PUSH`, `BUMP`).
- Вариант B: оставить `DASH`-исполнителем, но каждая операция внутри него должна порождать семантическое событие, а последствия обрабатывать через `WorldReaction`.
- Предпочтительнее вариант A, если логика рывка позволяет разрешить путь заранее.

- [x] Продумано
- [x] Реализовано

**Заметки / решения по реализации:**
- Выбран вариант A: `dashSkill.resolve` возвращает атомарные интенты (`MOVE`, `OPEN_DOOR`, `DAMAGE`, `PUSH`, `BUMP`).
- Каждый интент проходит через `executeIntent`, поэтому срабатывают все мировые реакции.
- `DashIntent`, `executeDashIntent` и presentation-тип `DASH` удалены как мёртвый код.
- Анимация рывка продолжает работать через `dashComposer`, который компонует дочерние анимационные узлы.

---

### 4. Урон от горения обходит `DAMAGE`-интент

**Где:** `src/simulation/systems/intents/tick-status-effects-intent-executer.ts:27`

**Что происходит:**
- Для эффекта `burning` вызывается `executeDamage(...)` напрямую.

**Последствия:**
- Смерть от горения не вызывает `deathReaction`.

**Что нужно сделать:**
- Убрать вызов `executeDamage(...)`.
- В `STATUS_TICKED` добавить `effectTypes: StatusEffectType[]` — список эффектов, которые тикнули.
- Добавить `burningTickReaction` на `STATUS_TICKED`, которая порождает `DAMAGE`-интент при наличии `burning`.

- [x] Продумано
- [x] Реализовано

**Заметки / решения по реализации:**
- `executeTickStatusEffectsIntent` больше не вызывает `executeDamage`.
- В `STATUS_TICKED` добавлено поле `effectTypes`.
- `burningTickReaction` порождает `DAMAGE` при наличии `burning` в `effectTypes`.
- `sourceEntityId` для урона от горения — `null` (нет конкретного источника).

---

---

### 5. `stairsTransitionReaction` нарушает контракт `WorldReaction`

**Где:** `src/simulation/systems/world-reactions/stairs-reaction.ts:40-43`

**Что происходит:**
- Реакция мутирует дерево событий напрямую через `builder.addChild(parent, { type: 'STAIR_EXIT_TRIGGERED', ... })`.
- Возвращает пустой массив `[]`.

**Последствия:**
- Контракт `WorldReaction` требует возвращать `Intent[]`, которые исполняет оркестратор.
- Прямая мутация дерева в реакции может привести к непредсказуемому поведению, если реакция будет вызвана вне `executeIntent`.

**Что нужно сделать:**
- Ввести новый интент, например `TRIGGER_STAIR_EXIT`, или возвращать интент, который `IntentExecutor` превратит в событие `STAIR_EXIT_TRIGGERED`.

- [x] Продумано
- [x] Реализовано

**Заметки / решения по реализации:**
1. Выбран специализированный интент `TRIGGER_STAIR_EXIT` с полем `direction`.
2. Создан исполнитель `executeTriggerStairExitIntent`, который порождает событие `STAIR_EXIT_TRIGGERED` в дереве выполнения.
3. `stairsTransitionReaction` больше не мутирует дерево через `builder.addChild`; она возвращает `[{ type: 'TRIGGER_STAIR_EXIT', direction }]`.
4. Исполнитель зарегистрирован в `execute-intent.ts`, тип `TriggerStairExitIntent` добавлен в `core-types.ts`.
5. Presentation продолжает искать `STAIR_EXIT_TRIGGERED` в дереве — структура события не изменилась.
6. Обновлён `tests/unit/simulation/floor-transition.test.ts`, добавлены `tests/unit/simulation/world-reactions/stairs-reaction.test.ts` и `tests/unit/simulation/intents/trigger-stair-exit-intent-executor.test.ts`.

---

## Средние проблемы (архитектурный долг)

### 6. `skipStunnedActorTurn` — действие вне интентов

**Где:** `src/simulation/systems/stun-helper.ts:52, 60, 68`

**Что происходит:**
- `skipStunnedActorTurn` напрямую изменяет `effect.duration`, `holder.statusEffects`, `holder.ap`.
- Вызывается из `simulation.ts`, а не через `executeIntent`.

**Последствия:**
- Пропуск хода оглушённым актором не проходит через канонический поток интентов.
- Сложнее тестировать и воспроизводить.

**Что нужно сделать:**
- Ввести интент `SKIP_STUNNED_TURN` или разложить действие на `TICK_STATUS_EFFECTS` + `CLEAR_AP`.

- [x] Продумано
- [x] Реализовано

**Заметки / решения по реализации:**
1. Введён специализированный интент `SKIP_STUNNED_TURN` с полем `entityId`.
2. Создан исполнитель `executeSkipStunnedTurnIntent`, который:
   - уменьшает длительность `stunned` на 1;
   - удаляет эффект при истечении;
   - обнуляет AP актора;
   - порождает события `STATUS_TICKED`, `STATUS_REMOVED` (при истечении) и `RESOURCE_CONSUMED`.
3. `executeIntent` теперь возвращает `ExecutionNode | null`, что позволяет `runEnvironmentTurn` добавлять `ABILITY_PREPARED_CANCELLED` как дочерний узел к результату `SKIP_STUNNED_TURN`.
4. Функция `skipStunnedActorTurn` удалена из `stun-helper.ts`; осталась только `isStunned`.
5. `GameSimulation` больше не мутирует состояние оглушённого актора напрямую — вместо этого вызывается `executeIntent(... SKIP_STUNNED_TURN ...)`.
6. `stunned` по-прежнему исключён из общего `TICK_STATUS_EFFECTS`, чтобы сохранить гарантию ровно одного пропущенного хода.
7. Добавлены тесты на дерево событий и на отмену подготовленной способности при оглушении.

---

### 7. `GameSimulation` напрямую управляет ресурсами и ходами

**Где:** `src/simulation/simulation.ts:444, 451, 465, 561, 564, 577, 582, 587`

**Что происходит:**
- Прямые мутации:
  - `enemy.ap = enemy.maxAp`
  - `ability.currentCooldown -= 1`
  - `enemyEntity.activeCast.remainingTurns--`
  - `this.state.turn.round += 1`
  - `this.state.player.ap = this.state.player.maxAp`

**Последствия:**
- Логические игровые действия не порождают событий и не проходят через интенты.
- Усложняется тестирование, воспроизводимость и combat log.

**Что нужно сделать:**
- Ввести интенты:
  - `RESTORE_AP`
  - `TICK_COOLDOWN`
  - `TICK_CAST`
  - `END_TURN` / `BEGIN_TURN`
- Запускать их через `executeIntent` в начале/конце хода.

- [x] Продумано
- [x] Реализовано

**Заметки / решения по реализации:**
1. Введены атомарные интенты:
   - `BEGIN_TURN { side }` → событие `TURN_BEGAN`.
   - `RESTORE_AP { entityId }` → событие `AP_RESTORED`.
   - `TICK_COOLDOWN { entityId, abilityId }` → событие `COOLDOWN_TICKED`.
   - `TICK_CAST { entityId }` → событие `CAST_TICKED`.
2. `runEnvironmentTurn` больше не мутирует `ap`, `currentCooldown`, `activeCast.remainingTurns` напрямую.
   - В начале фазы `ENVIRONMENT` выполняется `BEGIN_TURN { side: 'ENVIRONMENT' }`.
   - Для каждого врага создаётся узел `TURN_BEGAN` с дочерними `RESTORE_AP`, `TICK_COOLDOWN`, `TICK_CAST`.
3. `beginNextPlayerTurn` больше не мутирует `turn.round`, `player.ap`, кулдауны и каст напрямую.
   - Создаётся узел `TURN_BEGAN { side: 'PLAYER' }` с дочерними `BEGIN_TURN`, `TICK_CAST`, `RESTORE_AP`, `TICK_COOLDOWN`.
4. `cleanupDeadEntities` оставлен без изменений, так как это отдельная задача 8.
5. Обновлена документация `docs/agents/TURN_FLOW.md`.
6. Добавлены unit-тесты для новых исполнителей и обновлены `ap-system.test.ts`, `casting-mechanics.test.ts`, `stun.test.ts`.

<!-- Как объединить эти интенты в один «ход окружения» / «ход игрока»? Нужен ли отдельный оркестратор хода? -->

---

### 8. `cleanupDeadEntities` удаляет сущности вне `DIE`-интента

**Где:** `src/simulation/state.ts:162-169`, вызов в `simulation.ts:559`

**Что происходит:**
- Мёртвые сущности физически удаляются из `state.entities` в `beginNextPlayerTurn`.
- Это происходит вне интентной системы.

**Последствия:**
- Разрыв причинно-следственной связи: `ENTITY_DIED` есть, но удаления как события нет.
- Любая реакция, которая должна сработать на физическое исчезновение сущности, не получит шанса.

**Что нужно сделать:**
- Перенести удаление внутрь `executeDieIntent` или ввести интент `REMOVE_ENTITY`, порождаемый реакцией на `ENTITY_DIED`.

- [x] Продумано
- [x] Реализовано

**Заметки / решения по реализации:**
1. Введён специализированный интент `CLEANUP_DEAD_ENTITIES` без параметров.
2. Создан исполнитель `executeCleanupDeadEntitiesIntent`, который:
   - сканирует `state.entities` и удаляет мёртвых не-игроковых сущностей;
   - сохраняет детерминированный порядок удаления (сортировка по `entityId`);
   - порождает событие `DEAD_ENTITIES_CLEANED` с массивом удалённых сущностей `{ entityId, position }[]`;
   - возвращает `null`, если мёртвых сущностей нет.
3. `cleanupDeadEntities` удалена из `src/simulation/state.ts`; физическое удаление больше не происходит вне интентной системы.
4. `beginNextPlayerTurn` в `src/simulation/simulation.ts` теперь вызывает `executeIntent(... CLEANUP_DEAD_ENTITIES ...)` в начале хода игрока (дочерний узел к `TURN_BEGAN`).
5. Сохранено текущее поведение: сущность остаётся в `state.entities` до начала следующего хода игрока, чтобы Presentation успел отработать анимацию смерти и другие визуальные эффекты.
6. Добавлен `tests/unit/simulation/intents/cleanup-dead-entities-intent.test.ts`, обновлён `tests/unit/simulation/deferred-deletion.test.ts`.

---

### 9. `performFloorTransition` — полный обход системы интентов

**Где:** `src/simulation/systems/actions/floor-transition-logic.ts`

**Что происходит:**
- Функция мутирует `state.map`, `state.entities`, `state.player.x/y`, `state.floor`, `state.turn`, `state.player.ap`, `state.visible`, `state.explored` напрямую.
- Сама признаёт в комментарии, что «не зависит от системы интентов».

**Последствия:**
- Смена этажа — сложное игровое действие, которое невозможно разбить на атомарные события.
- Ломается воспроизводимость и тестирование.

**Что нужно сделать:**

Выбран **Вариант 1: оркестрация в Action Handler** (подробный сравнительный анализ см. в обсуждении задачи).

Разложить переход на атомарные интенты:
```
ACTION_APPLIED (DESCEND / ASCEND)
└── FLOOR_CHANGED (from, to)                 ← событие от экшена
    ├── MAP_CHANGED { map }                  ← SET_MAP
    ├── ENTITIES_REPLACED { entityIds }      ← SET_ENTITIES
    ├── ENTITY_MOVED (player, teleport)      ← TELEPORT_ENTITY
    ├── TURN_BEGAN { side: 'PLAYER', round } ← BEGIN_TURN
    ├── AP_RESTORED { player, amount }       ← RESTORE_AP
    └── FOG_UPDATED { newlyVisible }         ← UPDATE_FOG
```

- [x] Продумано
- [ ] Реализовано

**Заметки / решения по реализации:**

### Почему именно оркестрация в Action Handler

1. `resolve()` должен быть чистым, но генерация нового этажа мутирует `state.rng` и `state.nextEntityCounter`. Значит, генерацию нельзя делать в `resolve()`.
2. `IntentExecutor` не должен напрямую исполнять другие интенты. Поэтому декомпозиция внутри `executeChangeFloorIntent` через прямые вызовы других исполнителей запрещена.
3. Action Handler — канонический оркестратор: он уже в `useAbilityAction.execute()` добавляет событие способности и вызывает `executeIntent` для дочерних интентов.
4. WorldReaction-вариант отброшен, потому что событие `FLOOR_CHANGED` превратилось бы в тяжёлый data carrier (`map`, `entities`, позиция игрока, ход, FOV), что нарушает идею события как лёгкой записи о факте.

### Архитектура

#### 1. Планировщик перехода

Создать `src/simulation/systems/floor-transition-planner.ts`.

```ts
export type FloorTransitionPlan = {
  /** Направление перехода. */
  direction: 'down' | 'up';
  /** Этаж, с которого уходим. */
  from: number;
  /** Этаж, на который приходим. */
  to: number;
  /** Карта целевого этажа. */
  map: GameMap;
  /** Сущности целевого этажа (включая игрока). */
  entities: Map<EntityId, Entity>;
  /** Позиция игрока после перехода. */
  playerPosition: Position;
  /** Состояние хода после перехода. */
  turn: TurnState;
  /** События FOV, полученные после пересчёта. */
  fovEvents: GameEvent[];
};

export function computeFloorTransition(
  state: GameState,
  direction: 'down' | 'up',
): FloorTransitionPlan { ... }
```

Ответственность планировщика:
- Сохранить текущий этаж в `state.floorSnapshots`.
- Определить целевой этаж.
- Восстановить из снапшота или сгенерировать новый этаж через `generateMap`.
- Найти целевую лестницу и позицию игрока.
- Пересоздать сетки `visible`/`explored` и вызвать `updateFOV` на временном/целевом состоянии.
- Вернуть **данные**, не мутируя `state` напрямую (кроме `state.rng`, `state.nextEntityCounter` и `state.floorSnapshots`, которые являются сервисными побочными эффектами генерации).

> **Важно:** `computeFloorTransition` не заменяет `state.map`/`state.entities`. Он только возвращает план. Фактическую мутацию выполняют интент-исполнители.

#### 2. Новые интенты и события

Добавить в `src/simulation/core-types.ts`:

```ts
export type Intent =
  | ...
  | SetMapIntent
  | SetEntitiesIntent
  | TeleportEntityIntent
  | UpdateFogIntent;

export type SetMapIntent = {
  type: 'SET_MAP';
  map: GameMap;
};

export type SetEntitiesIntent = {
  type: 'SET_ENTITIES';
  entities: Map<EntityId, Entity>;
};

export type TeleportEntityIntent = {
  type: 'TELEPORT_ENTITY';
  entityId: EntityId;
  x: number;
  y: number;
};

export type UpdateFogIntent = {
  type: 'UPDATE_FOG';
};
```

Добавить события:

```ts
export type GameEvent =
  | ...
  | MapChangedEvent
  | EntitiesReplacedEvent;

export type MapChangedEvent = {
  type: 'MAP_CHANGED';
  width: number;
  height: number;
};

export type EntitiesReplacedEvent = {
  type: 'ENTITIES_REPLACED';
  entityIds: EntityId[];
};
```

#### 3. Новые исполнители

Создать файлы в `src/simulation/systems/intents/`:

- `set-map-intent-executor.ts`
  - Устанавливает `state.map = intent.map`.
  - Пересоздаёт `state.visible` и `state.explored` под размер новой карты (`createBoolGrid`).
  - Эмитит `MAP_CHANGED`.

- `set-entities-intent-executor.ts`
  - Заменяет `state.entities = intent.entities`.
  - Гарантирует, что игрок присутствует в `entities`.
  - Эмитит `ENTITIES_REPLACED` с отсортированным списком ID.

- `teleport-entity-intent-executor.ts`
  - Находит сущность по `entityId`.
  - Устанавливает `entity.x = intent.x`, `entity.y = intent.y` без проверок блокировки.
  - Эмитит `ENTITY_MOVED` с `movementType: 'teleport'`.

- `update-fog-intent-executor.ts`
  - Вызывает `updateFOV(state)`.
  - Добавляет возвращённые `FOG_UPDATED` как дочерние узлы.
  - Если новых видимых клеток нет, возвращает `null`.

Зарегистрировать все исполнители в `src/simulation/systems/intents/execute-intent.ts`.

#### 4. Переписать `floor-transition-action.ts`

```ts
execute(
  state: GameState,
  action: DescendAction | AscendAction,
  intents: [{ type: 'CHANGE_FLOOR'; direction: 'down' | 'up' }],
  executionBuilder: ExecutionBuilder,
  parentNode: ExecutionNode,
): void {
  const [intent] = intents;
  const plan = computeFloorTransition(state, intent.direction);

  const floorNode = executionBuilder.addChild(parentNode, {
    type: 'FLOOR_CHANGED',
    from: plan.from,
    to: plan.to,
  });

  const subIntents: Intent[] = [
    { type: 'SET_MAP', map: plan.map },
    { type: 'SET_ENTITIES', entities: plan.entities },
    { type: 'TELEPORT_ENTITY', entityId: 'player', x: plan.playerPosition.x, y: plan.playerPosition.y },
    { type: 'BEGIN_TURN', side: 'PLAYER' },
    { type: 'RESTORE_AP', entityId: 'player' },
    { type: 'UPDATE_FOG' },
  ];

  for (const subIntent of subIntents) {
    executeIntent(state, subIntent, executionBuilder, floorNode);
  }
}
```

#### 5. Удалить устаревшие файлы

- `src/simulation/systems/intents/change-floor-intent-executer.ts`
- `src/simulation/systems/actions/floor-transition-logic.ts` (логика переезжает в `floor-transition-planner.ts`)

Удалить `ChangeFloorIntent` из `Intent`-union в `core-types.ts`.
Удалить `CHANGE_FLOOR` из `intentExecutors` в `execute-intent.ts`.

> **Вопрос для реализации:** нужно ли оставить `CHANGE_FLOOR` как presentation-интент? В `src/presentation/types.ts` он используется. Скорее всего, он больше не нужен, если смена этажа отображается через `FLOOR_CHANGED`. Решение — удалить из `PresentationIntent` и `toPresentationIntent`.

#### 6. Обновить Presentation

- `src/presentation/types.ts`: удалить `CHANGE_FLOOR` из `PresentationIntent`.
- `src/presentation/types.ts`: удалить ветку `case 'CHANGE_FLOOR'` из `toPresentationIntent`.
- Проверить `src/presentation/fogFilter.ts`: события `FLOOR_CHANGED`, `MAP_CHANGED`, `ENTITIES_REPLACED`, `ENTITY_MOVED` должны оставаться видимыми.
- Проверить composer/анимацию: если `CHANGE_FLOOR` использовался как триггер анимации смены этажа, заменить на `FLOOR_CHANGED`.

#### 7. Тесты

Обновить `tests/unit/simulation/floor-transition.test.ts`:
- Проверять, что после `descendAction.execute()`:
  - `state.floor` изменился.
  - дерево содержит `FLOOR_CHANGED` с детьми `MAP_CHANGED`, `ENTITIES_REPLACED`, `ENTITY_MOVED`, `TURN_BEGAN`, `AP_RESTORED`, `FOG_UPDATED`.
  - `state.map` и `state.entities` корректны.
  - игрок позиционирован у лестницы.

Добавить unit-тесты:
- `tests/unit/simulation/intents/set-map-intent-executor.test.ts`
- `tests/unit/simulation/intents/set-entities-intent-executor.test.ts`
- `tests/unit/simulation/intents/teleport-entity-intent-executor.test.ts`
- `tests/unit/simulation/intents/update-fog-intent-executor.test.ts`
- `tests/unit/simulation/floor-transition-planner.test.ts`

### Что остаётся вне интентов (и почему это допустимо)

| Операция | Где | Почему допустимо |
|----------|-----|------------------|
| Сохранение `floorSnapshots` | `floor-transition-planner.ts` | Мета-состояние для перемещения между этажами, не игровое событие |
| Генерация карты | `floor-transition-planner.ts` через `generateMap` | Производит данные, не мутирует игровое состояние напрямую |
| Пересчёт FOV в планировщике | `floor-transition-planner.ts` через `updateFOV` | Нужен для подготовки `fovEvents`; финальный FOV всё равно применяется интентом `UPDATE_FOG` |

### Риски

1. **Пересчёт FOV дважды.** Планировщик вызывает `updateFOV`, чтобы получить `fovEvents`. Затем интент `UPDATE_FOG` вызывает его снова на уже изменённом состоянии. Это корректно, но можно оптимизировать: `UPDATE_FOG` мог бы использовать готовые `fovEvents` из плана. Однако это нарушит атомарность интента.
   - **Решение:** оставить двойной пересчёт. Он происходит только при смене этажа, то есть редко.

2. **События FOV как дети `FLOOR_CHANGED`, а не `UPDATE_FOG`.** В текущем коде `fovEvents` добавляются как дети `parent`, то есть соседи `FLOOR_CHANGED`. В новой схеме они станут детьми `UPDATE_FOG`, который является ребёнком `FLOOR_CHANGED`. Это более правильно.
   - **Решение:** обновить ожидания в тестах и Presentation.

3. **`SET_ENTITIES` заменяет всю Map целиком.** Это большая операция, но она точно отражает семантику «загрузить этаж».
   - **Альтернатива:** `CLEAR_ENTITIES` + множество `SPAWN_ENTITY`. Отклонено как избыточное.

### Порядок шагов реализации

1. Создать `floor-transition-planner.ts` и перенести туда логику из `floor-transition-logic.ts`.
2. Добавить новые типы интентов и событий в `core-types.ts`.
3. Создать четыре новых исполнителя и зарегистрировать их.
4. Переписать `floor-transition-action.ts` на оркестрацию под-интентами.
5. Удалить `change-floor-intent-executer.ts` и `floor-transition-logic.ts`.
6. Обновить Presentation (удалить `CHANGE_FLOOR` из `PresentationIntent`).
7. Обновить и дополнить тесты.
8. Запустить `npm test` и `npm run build`, исправить ошибки.
9. Отметить `[x] Реализовано` в этом файле.

---

### 10. Debug-действия мутируют состояние в `execute()`

**Где:**
- `src/simulation/systems/actions/debug-add-item-action.ts:56`
- `src/simulation/systems/actions/debug-spawn-entity-action.ts:111`

**Что происходит:**
- `execute()` напрямую изменяет `state.player.inventory` и `state.entities`.

**Последствия:**
- Нарушение трёхфазной схемы: `execute()` должен только исполнять зарезолвленные интенты.

**Что нужно сделать:**
- В `resolve()` возвращать интенты `ADD_ITEM` / `SPAWN_ITEM` (или `GRANT_ITEM` / `SPAWN_ENEMY` / `SPAWN_DOOR` / `SPAWN_STAIRS`).
- В `execute()` вызывать `executeIntent` для каждого интента.

- [ ] Продумано
- [ ] Реализовано

**Заметки / решения по реализации:**
<!-- Какие именно интенты добавить в core-types? Нужны ли новые типы сущностей? -->

---

## Сомнительные решения внутри исполнителей

### 11. `DIE`-интент делает слишком много

**Где:** `src/simulation/systems/intents/die-intent-executer.ts:15-33`

**Что происходит:**
- В одном интенте смешаны:
  - изменение флагов жизни (`isAlive = false`)
  - изменение физики (`blocksMovement = false`)
  - отмена каста (`activeCast = null`)
  - отмена AI-намерения (`aiState.preparedIntent = null`)
  - обновление статистики (`runStats.enemiesKilled++`)
  - смена фазы игры (`state.phase = 'dead'`)

**Что нужно сделать:**
- Разделить `DIE` на более атомарные интенты или реакции:
  - `SET_ALIVE(false)`
  - `SET_BLOCKS_MOVEMENT(false)`
  - `CLEAR_CAST`
  - `CANCEL_PREPARED_ABILITY`
  - `SET_PHASE('dead')`
  - `INCREMENT_RUN_STAT('enemiesKilled')`
- `runStats.enemiesKilled++` логичнее вынести в реакцию на `ENTITY_DIED`.

- [ ] Продумано
- [ ] Реализовано

**Заметки / решения по реализации:**
<!-- Не перегрузим ли мы систему слишком мелкими интентами? Какой баланс между атомарностью и удобством? -->

---

### 12. `APPLY_STATUS` прерывает каст и подготовку

**Где:** `src/simulation/systems/intents/apply-status-intent-executer.ts:36-57`

**Что происходит:**
- Один интент отвечает за три эффекта: наложение статуса, отмена каста, отмена AI-подготовки.

**Что нужно сделать:**
- Ввести реакцию на `STATUS_APPLIED` для `stunned`, которая порождает `CANCEL_CAST` и `CANCEL_PREPARED_ABILITY` интенты.

- [ ] Продумано
- [ ] Реализовано

**Заметки / решения по реализации:**
<!-- Какой подход выбрать: реакция или порождение интентов внутри executor? -->

---

### 13. `PICK_UP` смешивает подбор, удаление сущности и статистику

**Где:** `src/simulation/systems/intents/pick-up-intent-executor.ts:34-35`

**Что происходит:**
- Удаление предмета из мира (`state.entities.delete`) и обновление `runStats.itemsPickedUp` делаются в одном интенте.

**Что нужно сделать:**
- Разделить на `REMOVE_ENTITY` + `INCREMENT_RUN_STAT` (или реакцию на `ITEM_PICKED_UP`).

- [ ] Продумано
- [ ] Реализовано

**Заметки / решения по реализации:**
<!-- Нужен ли отдельный интент REMOVE_ENTITY? Или можно использовать существующие механизмы? -->

---

## Приемлемые исключения (не требуют рефакторинга)

| Место | Почему допустимо |
|-------|------------------|
| `characterCreation.ts`, `starting-equipment.ts`, `map-generation/shared.ts` | Инициализация сущностей до старта симуляции |
| `state.ts` — создание `GameState` | Фабричная инициализация |
| `src/simulation/systems/fov.ts` | FOV — derived-данные от позиции игрока |
| AI `updateState` | Мутирует только `aiState`, что является частью `GameState` и допустимо по контракту стратегий |

---

## Рекомендуемый порядок работы

1. Начать с **критических проблем 1–5**, так как они приводят к реальным багам (потеря смертей, лута, реакций).
2. Затем взять **средние проблемы 6–10**, чтобы убрать прямые мутации из `GameSimulation` и вспомогательных модулей.
3. В последнюю очередь — **сомнительные решения 11–13**, чтобы повысить атомарность интентов без спешки.

---

## Связанные файлы для быстрого доступа

- `src/simulation/systems/intents/execute-intent.ts` — центральный диспетчер интентов.
- `src/simulation/systems/world-reactions/reactions.ts` — реестр мировых реакций.
- `src/simulation/systems/world-reactions/types.ts` — контракт `WorldReaction`.
- `src/simulation/core-types.ts` — типы `Intent`, `GameEvent`, `GameAction`.
- `docs/agents/ACTION_SYSTEM.md` — документация по архитектуре.
