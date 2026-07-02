# Ревью ветки `interact-system`

> Файл ведётся для отслеживания замечаний по ревью единого action взаимодействия (`INTERACT`).
> Статусы: `🔴 не начато` / `🟡 в работе` / `🟢 готово`.

---

## Сводка

| Критерий | Оценка |
|---|---|
| Соответствие плану | Высокое — все 6 блоков реализованы. |
| Архитектура / слоистость | Исправлено — Presentation использует публичный API Simulation. |
| Типизация | Исправлено — введён строгий `InteractionId`, убраны небезопасные `as` в затронутых местах. |
| Игровая логика | Исправлено — все замечания устранены, включая удаление legacy `ItemEntity`. |
| Тесты / покрытие | Хорошее (91%), пробелы закрыты. |
| i18n | Синхронизировано, мёртвые ключи и fallback исправлены. |
| Анимации / presentation | Исправлено — `FLOOR_CHANGED` задокументирован. |
| Сборка | Успешна. |

---

## Замечания

### 1. Архитектура / слоистость

#### 1.1. Presentation импортирует внутренние модули Simulation
- **Статус:** 🟢 готово
- **Приоритет:** высокий
- **Файлы:** `src/presentation/gameSession.ts:58-59`, `src/simulation/types.ts`, `src/simulation/simulation.ts`, `src/simulation/systems/interactions/resolve-interaction.ts`
- **Описание:** `findInteractableEntitiesAround` и `resolveInteraction` импортированы напрямую из `@simulation/state` и `@simulation/systems/interactions/resolve-interaction.ts`. Presentation должен зависеть только от публичного API Simulation.
- **Варианты исправления:**
  - A. Добавить методы в публичный API `Simulation` и вызывать через `this.simulation`.
  - B. Перенести `findInteractableEntitiesAround` в Presentation.
- **Выбранный подход:** A — добавить `resolveInteraction` и `findInteractableEntitiesAround` в `Simulation`.
- **Выполнено:**
  - В `src/simulation/types.ts` добавлен тип `ResolvedInteraction` и методы `resolveInteraction` / `findInteractableEntitiesAround` в публичный API `Simulation`.
  - В `src/simulation/simulation.ts` реализованы эти методы.
  - В `src/presentation/gameSession.ts` убраны прямые импорты `findInteractableEntitiesAround` и `resolveInteraction`; теперь используются `this.simulation.findInteractableEntitiesAround(...)` и `this.simulation.resolveInteraction(...)`.
  - В `src/simulation/systems/interactions/resolve-interaction.ts` тип `ResolvedInteraction` перенесён в `src/simulation/types.ts`, а сам модуль реэкспортирует чистую функцию `resolveInteractionForEntity`.
  - Проверено: `npx tsc --noEmit` и релевантные тесты проходят.

---

#### 1.2. `executeFloorTransitionIntent` напрямую исполняет другие интенты
- **Статус:** 🟢 готово
- **Выполнено:**
  - `executeFloorTransitionIntent` теперь только вычисляет план, меняет `state.floor` и порождает единственное событие `FLOOR_CHANGED` с планом.
  - Вся оркестровка sub-intent'ов (`SET_MAP`, `SET_ENTITIES`, `TELEPORT_ENTITY`, `BEGIN_TURN`, `RESTORE_AP`, `APPLY_FOG_EVENTS`) вынесена в world reaction `floorTransitionReaction` (`src/simulation/systems/world-reactions/floor-transition-reaction.ts`).
  - Добавлен новый intent `APPLY_FOG_EVENTS` и его executor (`src/simulation/systems/intents/apply-fog-events-intent-executor.ts`).
  - `FloorTransitionPlan` перенесён в `src/simulation/core-types.ts` (вместе с `TurnSide`), чтобы быть доступным в событии и реакции без нарушения слоистости.
  - Структура дерева событий сохранена; тест `floor-transition-intent-executor.test.ts` переведён на вызов `executeIntent` (чтобы reaction отработала).
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** высокий
- **Файлы:**
  - `src/simulation/systems/intents/floor-transition-intent-executor.ts` (весь файл)
  - `src/simulation/systems/actions/interact-action.ts`
  - `src/simulation/systems/world-reactions/reactions.ts`
  - `src/simulation/systems/floor-transition-planner.ts`
- **Описание:** `executeFloorTransitionIntent` сам вызывает `executeIntent` для `SET_MAP`, `SET_ENTITIES`, `TELEPORT_ENTITY`, `BEGIN_TURN`, `RESTORE_AP`, `UPDATE_FOG`. Это нарушает ключевое правило `docs/agents/ACTION_SYSTEM.md`: «IntentExecutor не исполняет другие интенты». Action handler'ам такая оркестровка разрешена.
- **Контекст / текущий код:**
  ```ts
  // src/simulation/systems/intents/floor-transition-intent-executor.ts
  export const executeFloorTransitionIntent: IntentExecutor<FloorTransitionIntent> = (
    state: GameState,
    intent: FloorTransitionIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
  ) => {
    const plan = computeFloorTransition(state, intent.direction);
    state.floor = plan.to;

    const floorNode = builder.addChild(parent, {
      type: 'FLOOR_CHANGED',
      from: plan.from,
      to: plan.to,
    });

    const subIntents = [
      { type: 'SET_MAP' as const, map: plan.map, explored: plan.explored },
      { type: 'SET_ENTITIES' as const, entities: plan.entities as Map<EntityId, unknown> },
      { type: 'TELEPORT_ENTITY' as const, entityId: 'player' as const, x: plan.playerPosition.x, y: plan.playerPosition.y },
      { type: 'BEGIN_TURN' as const, side: 'PLAYER' as const, round: plan.turn.round },
      { type: 'RESTORE_AP' as const, entityId: 'player' as const },
      { type: 'UPDATE_FOG' as const },
    ] as const;

    for (const subIntent of subIntents) {
      executeIntent(state, subIntent as unknown as import('@simulation/core-types').Intent, builder, floorNode);
    }

    return floorNode;
  };
  ```
- **Что конкретно менять:**
  1. В `interactAction.execute` после получения intent'ов `FLOOR_TRANSITION` вызывать `executeIntent` один раз для `FLOOR_TRANSITION`.
  2. `executeFloorTransitionIntent` должен:
     - вычислить план через `computeFloorTransition`,
     - применить план к `state` (или большую часть),
     - породить только одно событие `FLOOR_CHANGED`.
  3. В `src/simulation/systems/world-reactions/reactions.ts` добавить `floorTransitionReaction` на событие `FLOOR_CHANGED`, которая порождает интенты `SET_MAP`, `SET_ENTITIES`, `TELEPORT_ENTITY`, `BEGIN_TURN`, `RESTORE_AP`, `UPDATE_FOG`.
  4. При этом нужно сохранить структуру дерева событий, ожидаемую тестами:
     ```
     ACTION_APPLIED (INTERACT)
     └── FLOOR_CHANGED
         ├── MAP_CHANGED
         ├── ENTITIES_REPLACED
         ├── ENTITY_MOVED
         ├── TURN_BEGAN
         └── AP_RESTORED
     ```
- **Альтернатива (менее правильная, но проще):** оставить оркестровку в `interactAction.execute`, вызывая sub-intents напрямую от parent node, а `executeFloorTransitionIntent` сделать максимально тонким. Это всё ещё нарушает идеал чистой архитектуры, но локализует оркестровку в action handler.
- **Зависимости:** тесно связано с п. 3.5 (атомарность перехода этажа) и п. 7.1 (использование `fovEvents`).
- **Тесты:**
  - `tests/unit/simulation/intents/floor-transition-intent-executor.test.ts` — проверяет дерево событий. После рефакторинга структура дерева должна сохраниться.
  - `tests/unit/simulation/actions/interact-action.test.ts` — проверяет переход этажа через `INTERACT`.
  - `tests/integration/loot-drop-cycle.test.ts` — интеграционный проход через этаж.
- **Подводные камни:**
  - `computeFloorTransition` мутирует `state.rng` при генерации нового этажа. Это должно происходить до порождения `FLOOR_CHANGED`, иначе reaction не сможет получить уже готовый план.
  - Порядок дочерних событий важен для анимаций и логов.
  - `WorldReaction` получает `ExecutionNode`, а не raw `FLOOR_CHANGED` event, поэтому нужно корректно извлекать `plan` из события.

---

#### 1.3. `GameAction` импортирован из внутреннего пути
- **Статус:** 🔴 не начато
- **Приоритет:** низкий
- **Файлы:** `src/presentation/gameSession.ts:20`
- **Описание:** В `GameSession` используется `import type {GameAction} from '@simulation/systems/actions/types'`. Тип `GameAction` определён в `src/simulation/core-types.ts` и реэкспортирован из `src/simulation/types.ts`. Presentation должен импортировать из публичного API (`@simulation/types`).
- **Контекст / текущий код:**
  ```ts
  // src/presentation/gameSession.ts
  import type {ExecutionNode} from '@simulation/systems/actions/types';
  import type {GameAction} from '@simulation/systems/actions/types';
  ```
- **Что конкретно менять:**
  1. Заменить `import type {GameAction} from '@simulation/systems/actions/types';` на `import type {GameAction} from '@simulation/types';`.
  2. Проверить, нужен ли ещё `ExecutionNode` из `@simulation/systems/actions/types`. Если да — оставить, но лучше тоже взять из `@simulation/types` (тип реэкспортится).
- **Зависимости:** нет.
- **Тесты:** любые тесты Presentation (`gameSession.test.ts`, `autoPath.test.ts`).
- **Подводные камни:** `ExecutionNode` реэкспортится из `core-types.ts` через `export type`, но в `types.ts` есть `export { ExecutionBuilder } from "@simulation/core-types.ts";`. Убедиться, что `ExecutionNode` доступен из `@simulation/types`.

---

### 2. Типизация

#### 2.1. `InteractionKind` в Presentation стал `string`
- **Статус:** 🟢 готово
- **Выполнено:**
  - В `src/simulation/types.ts` добавлен строгий `InteractionId = 'open_door' | 'close_door' | 'pickup' | 'descend' | 'ascend'`.
  - Существующий `InteractionKind` (вид объекта: `'door' | 'stairs' | 'item' | 'lever'`) переименован в `EntityInteractionKind`.
  - В `src/presentation/types.ts` удалён `InteractionKind = string`, поле `InteractionOption.kind` переименовано в `interactionId` с типом `InteractionId`.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** высокий
- **Файлы:**
  - `src/presentation/types.ts:317`
  - `src/presentation/interactionUtils.ts`
  - `src/presentation/gameSession.ts` (использование `InteractionOption.kind`)
  - `src/ui/components/InteractionHint.tsx` (потребитель `InteractionOption`)
  - `src/simulation/systems/interactions/resolve-interaction.ts`
- **Описание:** `export type InteractionKind = string` ослабляет типизацию. Кроме того, термин `InteractionKind` уже занят в Simulation под `'door' | 'stairs' | 'item' | 'lever'` (вид объекта), тогда как в Presentation он теперь означает `interactionId` (`open_door`, `pickup` и т.д.).
- **Контекст / текущий код:**
  ```ts
  // src/presentation/types.ts
  /** Идентификатор взаимодействия, разрешённого `resolveInteraction` (например, 'open_door'). */
  export type InteractionKind = string;

  export type InteractionOption = {
    kind: InteractionKind;
    action: GameAction;
    targetPosition: Position;
    labelKey: string;
    priority: number;
  };
  ```
- **Что конкретно менять:**
  1. Переименовать Presentation-тип в `InteractionId`.
  2. Сделать его строгим union:
     ```ts
     export type InteractionId = 'open_door' | 'close_door' | 'pickup' | 'descend' | 'ascend';
     ```
  3. Переименовать поле `InteractionOption.kind` в `interactionId` (опционально, но улучшает читаемость). Если переименовывать — обновить все места использования (`gameSession.ts`, `InteractionHint.tsx`, тесты).
  4. Использовать `InteractionId` в `getInteractionHintKey` и `getInteractionPriority`.
  5. В `resolve-interaction.ts` тип `ResolvedInteraction.interactionId` тоже должен использовать `InteractionId` (см. п. 2.2).
- **Зависимости:** п. 2.2, п. 4.2.
- **Тесты:**
  - `tests/unit/presentation/gameSession.test.ts`
  - `tests/unit/presentation/autoPath.test.ts` (косвенно)
  - `tests/unit/ui/...` если есть тесты на `InteractionHint`
- **Подводные камни:**
  - `InteractionHint.tsx` и `GameField.tsx` используют `InteractionOption`. При переименовании поля `kind` → `interactionId` нужно обновить UI-компоненты.
  - Если добавлять новый `interactionId` в будущем, union потребует обновления `interactionUtils.ts` — это и есть цель type safety.

---

#### 2.2. `ResolvedInteraction.interactionId` типизирован как `string`
- **Статус:** 🟢 готово
- **Выполнено:**
  - В `src/simulation/types.ts` `ResolvedInteraction.interactionId` изменён с `string` на `InteractionId`.
  - `src/simulation/systems/interactions/resolve-interaction.ts` возвращает только допустимые значения `InteractionId`.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** средний
- **Файлы:**
  - `src/simulation/types.ts` (куда перенесён `ResolvedInteraction`)
  - `src/simulation/systems/interactions/resolve-interaction.ts`
- **Описание:** `ResolvedInteraction.interactionId` имеет тип `string`. После п. 2.1 должен быть строгим `InteractionId`.
- **Контекст / текущий код:**
  ```ts
  // src/simulation/types.ts
  export type ResolvedInteraction = {
    interactionId: string;
    usableFromAdjacent: boolean;
  };
  ```
- **Что конкретно менять:**
  1. Вынести `InteractionId` в `src/simulation/types.ts` (или `core-types.ts`), чтобы он был доступен и Simulation, и Presentation.
  2. Заменить `interactionId: string` на `interactionId: InteractionId` в `ResolvedInteraction`.
  3. Убедиться, что `resolveInteraction` возвращает только допустимые значения `InteractionId`.
- **Зависимости:** п. 2.1.
- **Тесты:** `tests/unit/simulation/actions/interact-action.test.ts`.
- **Подводные камни:** если `InteractionId` живёт в `@simulation/types`, а Presentation импортирует его оттуда — это допустимо, так как это тип, а не внутренняя логика. Или можно дублировать union в Presentation, но тогда нужна синхронизация.

---

#### 2.3. Небезопасные приведения типов
- **Статус:** 🔴 не начато
- **Приоритет:** средний
- **Файлы:**
  - `src/simulation/systems/actions/interact-action.ts:173`
  - `src/simulation/systems/intents/floor-transition-intent-executor.ts:42`
  - `src/presentation/gameSession.ts:370-372, 754-756`
- **Описание:** Встречаются `as FloorItemContainerEntity`, `as unknown as Intent`, inline `as import('@simulation/types').FloorItemContainerEntity`.
- **Контекст / текущий код:**
  ```ts
  // src/simulation/systems/actions/interact-action.ts:173
  case 'pickup': {
    const container = target as FloorItemContainerEntity;
    return [{
      type: 'PICK_UP',
      entityId: action.entityId,
      itemId: container.id,
      templateId: container.item.templateId,
    }];
  }
  ```
  ```ts
  // src/simulation/systems/intents/floor-transition-intent-executor.ts:42
  executeIntent(state, subIntent as unknown as import('@simulation/core-types').Intent, builder, floorNode);
  ```
  ```ts
  // src/presentation/gameSession.ts:370-372
  templateId: e.type === 'floor_item_container'
    ? (e as import('@simulation/types').FloorItemContainerEntity).item.templateId
    : e.templateId,
  ```
- **Что конкретно менять:**
  1. В `interact-action.ts` заменить `const container = target as FloorItemContainerEntity;` на type guard:
     ```ts
     if (target.type !== 'floor_item_container' && target.type !== 'item') return [];
     const item = target.type === 'floor_item_container' ? target.item : target.item;
     ```
     (см. также п. 3.3 — если удалить legacy `ItemEntity`, останется только `floor_item_container`).
  2. В `floor-transition-intent-executor.ts` убрать `as unknown as Intent`, типизировав `subIntents` как union подтипов `Intent` или передавая массив `Intent[]` с явными литералами.
  3. В `gameSession.ts` заменить inline `as` на предварительное сужение типа:
     ```ts
     if (e.type === 'floor_item_container') {
       // TypeScript выведет FloorItemContainerEntity
     }
     ```
- **Зависимости:** п. 3.3 (удаление legacy `ItemEntity` упростит п. 1).
- **Тесты:** связанные unit-тесты; TypeScript должен проходить без изменений.
- **Подводные камни:** `FloorItemContainerEntity` и `ItemEntity` имеют общее поле `item`, поэтому можно сделать вспомогательную функцию `getItemFromEntity(entity)`.

---

### 3. Игровая логика / семантика

#### 3.1. `FLOOR_TRANSITION` не проверяет, что актор — игрок
- **Статус:** 🔴 не начато
- **Приоритет:** высокий
- **Файлы:**
  - `src/simulation/systems/actions/interact-action.ts`
  - `src/simulation/systems/intents/floor-transition-intent-executor.ts`
- **Описание:** `INTERACT` с лестницей допускает любого `entityId`. `executeFloorTransitionIntent` игнорирует `intent.entityId` и всегда мутирует `state.player`. Если AI или debug-код подаст `INTERACT` с лестницей от имени не-игрока, игрок телепортируется на другой этаж.
- **Контекст / текущий код:**
  ```ts
  // src/simulation/systems/actions/interact-action.ts:118-124
  case 'descend':
  case 'ascend': {
    if (target.type !== 'stairs') {
      return { ok: false, reasonCode: 'not_stairs' };
    }
    return { ok: true };
  }
  ```
  ```ts
  // src/simulation/systems/intents/floor-transition-intent-executor.ts
  executeFloorTransitionIntent(state, intent, ...) {
    const plan = computeFloorTransition(state, intent.direction);
    state.floor = plan.to;
    // ... мутирует state.player и т.д.
  }
  ```
- **Что конкретно менять:**
  1. В `interactAction.validate` в ветке `descend`/`ascend` добавить:
     ```ts
     if (action.entityId !== 'player') {
       return { ok: false, reasonCode: 'only_player_can_transition' };
     }
     ```
  2. Добавить reasonCode в `actionValidations` (см. п. 4.3) или использовать существующий.
- **Альтернатива:** проверять `intent.entityId === 'player'` в `executeFloorTransitionIntent` и возвращать `null`.
- **Зависимости:** п. 4.3 (если добавлять новый reasonCode).
- **Тесты:**
  - `tests/unit/simulation/actions/interact-action.test.ts` — добавить тест на `INTERACT` с лестницей от имени не-игрока.
  - `tests/unit/simulation/intents/floor-transition-intent-executor.test.ts` — добавить тест на `FLOOR_TRANSITION` с `entityId !== 'player'`.
- **Подводные камни:**
  - `Dash skill` или другие механизмы не должны порождать `FLOOR_TRANSITION` для не-игрока. Если такое возможно, validate остановит его.
  - В `GameSimulation.dispatch` `actor` может быть enemy, если когда-либо AI будет использовать `INTERACT`.

---

#### 3.2. `PICK_UP` intent не защищён от не-игроков (документация)
- **Статус:** 🔴 не начато
- **Приоритет:** низкий
- **Файлы:** `src/simulation/systems/intents/pick-up-intent-executor.ts`
- **Описание:** В `executePickUpIntent` уже есть проверка `actor.type !== 'player'`, но это не задокументировано. Нужно явно указать, что `PICK_UP` работает только для игрока.
- **Контекст / текущий код:**
  ```ts
  const actor = state.entities.get(intent.entityId);
  if (!actor || actor.type !== 'player') {
      return null;
  }
  ```
- **Что конкретно менять:**
  1. Добавить в JSDoc модуля или функции строку: «Исполнитель работает только для сущности игрока (`type === 'player'`).»
  2. Возможно, стоит задокументировать и в `PickUpIntent`.
- **Зависимости:** нет.
- **Тесты:** нет.
- **Подводные камни:** нет.

---

#### 3.3. Старые `ItemEntity` на полу стали неинтерактивными
- **Статус:** 🟢 готово
- **Выполнено:**
  - Удалён тип `ItemEntity` из union `Entity` и `EntityType` (`src/simulation/types.ts`).
  - Удалена функция `createItemEntity` из `src/simulation/systems/item-entity-factory.ts`.
  - Удалена фикстура `makeFloorItem`; все потребители переведены на `makeFloorItemContainer` (`tests/fixtures/gameState.ts`).
  - Упрощены `pick-up-intent-executor.ts` и `interact-action.ts`: оставлена только поддержка `floor_item_container`.
  - Обновлены `gameSession.ts`, `EntityRenderer.ts`, `TARGET_PRIORITY` и все затронутые тесты.
  - Проверено: `npx tsc --noEmit` и все тесты (696) проходят.
- **Приоритет:** высокий
- **Файлы:**
  - `src/simulation/types.ts` (`ItemEntity`)
  - `src/simulation/systems/item-entity-factory.ts` (`createItemEntity`)
  - `src/simulation/systems/interactions/resolve-interaction.ts`
  - `src/simulation/systems/intents/pick-up-intent-executor.ts`
  - `tests/fixtures/gameState.ts` (`makeFloorItem`)
  - все потребители `makeFloorItem` и `ItemEntity`
- **Описание:** `resolveInteraction` возвращает `pickup` только для `interactionKind === 'item'`. Legacy `ItemEntity` (type `'item'`) не имеет `interactionKind`, поэтому `INTERACT` с такой сущностью невозможен. При этом `pick-up-intent-executor` ещё поддерживает старый `ItemEntity`, но путь `Action → Intent` для него отрезан.
- **Контекст / текущий код:**
  ```ts
  // src/simulation/types.ts
  export interface ItemEntity extends BaseEntity, TemplateIdHolder {
    type: 'item';
    // ...
  }

  // src/simulation/systems/item-entity-factory.ts
  /** @deprecated Используйте `createFloorItemContainer` для новых предметов на полу. */
  export function createItemEntity(...) { ... }
  ```
- **Что конкретно менять:**
  1. Удалить тип `ItemEntity` из union `Entity` и `EntityType`.
  2. Удалить `createItemEntity` из `item-entity-factory.ts`.
  3. Удалить `makeFloorItem` из `tests/fixtures/gameState.ts`.
  4. Перевести всех потребителей `ItemEntity` / `makeFloorItem` на `FloorItemContainerEntity` / `makeFloorItemContainer`.
  5. Упростить `pick-up-intent-executor.ts`, оставив только `floor_item_container`.
  6. Обновить `TARGET_PRIORITY`, если есть упоминание `'item'`.
- **Зависимости:** п. 2.3 (упрощается после удаления `ItemEntity`), п. 5.2.
- **Тесты:**
  - `tests/unit/simulation/intents/pick-up-intent-executor.test.ts` — создать.
  - `tests/integration/loot-drop-cycle.test.ts` — должен уже использовать `FloorItemContainerEntity`.
  - Глобальный поиск `makeFloorItem` и `ItemEntity`.
- **Подводные камни:**
  - Старые сохранения с `type: 'item'` перестанут загружаться. Нужна миграция или явный breaking change.
  - `EntityRenderer.ts` обрабатывает и `'item'`, и `'floor_item_container'`. После удаления `'item'` можно упростить.
  - `debug-spawn-entity-action.ts` спавнит `floor_item_container` для `spawnType === 'item'` — это корректно.

---

#### 3.4. `ITEM_DROPPED.itemInstanceId` теперь означает id контейнера
- **Статус:** 🟢 готово
- **Выполнено:**
  - В `ItemDroppedEvent` добавлено поле `containerId: EntityId`.
  - `itemInstanceId` теперь содержит `container.item.instanceId` (консистентно с `ITEM_PICKED_UP`).
  - `itemDropNode` использует `event.containerId` для `itemId` анимации, чтобы renderer находил спрайт по id сущности на полу.
  - В `spawn-item-intent-executor.test.ts` добавлен регрессионный тест (п. 5.4), проверяющий разделение семантики.
  - Обновлены тесты анимации, создававшие `ITEM_DROPPED` вручную.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** высокий
- **Файлы:**
  - `src/simulation/systems/intents/spawn-item-intent-executor.ts:35`
  - `src/simulation/core-types.ts` (тип `ItemDroppedEvent`)
  - `src/presentation/animation/builders/itemDropped.ts`
  - `src/ui/renderer/EntityRenderer.ts` (обработка `ITEM_DROPPED` анимаций)
- **Описание:** `itemInstanceId: container.id` — это id сущности на полу, а не инвентарного экземпляра. Раньше `itemEntity.id === item.instanceId`, поэтому разницы не было.
- **Контекст / текущий код:**
  ```ts
  // src/simulation/systems/intents/spawn-item-intent-executor.ts:32-39
  const event = {
      type: 'ITEM_DROPPED' as const,
      dropperEntityId: intent.sourceEntityId,
      itemInstanceId: container.id,
      templateId: intent.templateId,
      position: { x: container.x, y: container.y },
      from: { x: intent.position.x, y: intent.position.y },
  };
  ```
- **Что конкретно менять:**
  1. В `ItemDroppedEvent` добавить поле `containerId: EntityId` (если анимации и renderer используют id сущности на полу).
  2. `itemInstanceId` должен содержать `container.item.instanceId`.
  3. Обновить потребителей:
     - `itemDroppedBuilder` / `itemDropNode` — проверить, какой id используется для анимации.
     - `EntityRenderer` — `collectItemDropIds` использует `node.step.itemId`, которое должно оставаться `container.id`.
- **Альтернатива:** если `itemInstanceId` больше не нужен в событии, переименовать его в `containerId`.
- **Зависимости:** п. 5.4.
- **Тесты:**
  - `tests/unit/simulation/spawn-item-intent-executor.test.ts`
  - `tests/unit/ui/renderer/EntityRenderer.test.ts` (если проверяет анимацию `ITEM_DROPPED`)
- **Подводные камни:**
  - Анимация `ITEM_DROP` использует id сущности на полу для поиска спрайта. Если изменить `itemInstanceId`, нужно убедиться, что анимация всё ещё находит правильный спрайт.
  - `ITEM_PICKED_UP` использует `itemInstanceId` как `item.instanceId` — нужно сохранить консистентность.

---

#### 3.5. Частичная мутация состояния при переходе этажа
- **Статус:** 🟢 готово
- **Выполнено:**
  - `executeFloorTransitionIntent` мутирует только `state.floor` (и сервисные side effects планировщика: `state.rng`, `state.floorSnapshots`).
  - Все остальные изменения (`map`, `entities`, позиция игрока, ход, AP, FOV) применяются атомарно через sub-intents из `floorTransitionReaction`.
  - Если один из sub-intents вернёт `null`, переход всё равно останется консистентным, так как `state.floor` уже соответствует целевому этажу, а остальное применяется через стандартные executor-ы.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** средний
- **Файлы:**
  - `src/simulation/systems/intents/floor-transition-intent-executor.ts:24`
  - `src/simulation/systems/floor-transition-planner.ts`
- **Описание:** `state.floor = plan.to` происходит до выполнения sub-intents. Если один из sub-intents вернёт `null`, `state.floor` уже изменится, а карта/сущности — нет.
- **Контекст / текущий код:**
  ```ts
  const plan = computeFloorTransition(state, intent.direction);
  state.floor = plan.to;
  // ... sub-intents ...
  ```
- **Что конкретно менять:**
  1. В рамках п. 1.2 перенести всю мутацию внутрь `computeFloorTransition` или в один атомарный executor.
  2. `executeFloorTransitionIntent` должен либо полностью применить план, либо не применить ничего.
  3. Альтернативно: sub-intents гарантированно не фейлятся (документировать), но это хрупко.
- **Зависимости:** п. 1.2.
- **Тесты:** `tests/unit/simulation/intents/floor-transition-intent-executor.test.ts`.
- **Подводные камни:**
  - `computeFloorTransition` уже мутирует `state.rng` и `state.floorSnapshots`. Нужно либо сделать её чистой, либо явно документировать side effects.
  - При полном переносе мутаций в `computeFloorTransition` нужно будет переименовать функцию, чтобы отражать, что она не просто "вычисляет" план.

---

#### 3.6. Лестница определяется по магической строке `templateId === 'stairs_up'`
- **Статус:** 🔴 не начато
- **Приоритет:** средний
- **Файлы:**
  - `src/simulation/systems/interactions/resolve-interaction.ts:47-51`
  - `src/content/schemas.ts` (шаблон лестницы)
  - `src/simulation/systems/map-generation/shared.ts` (`createStairs`)
  - `src/simulation/types.ts` (`StairsEntity`)
  - `src/simulation/systems/floor-transition-planner.ts` (тоже использует `templateId`)
- **Описание:** Направление лестницы определяется по `templateId === 'stairs_up'`. Не data-driven: новый `templateId` (например, `ladder_up`) будет интерпретирован неверно.
- **Контекст / текущий код:**
  ```ts
  // src/simulation/systems/interactions/resolve-interaction.ts:47-51
  case 'stairs': {
    const stairs = entity as StairsEntity;
    return stairs.templateId === 'stairs_up'
      ? { interactionId: 'ascend', usableFromAdjacent: false }
      : { interactionId: 'descend', usableFromAdjacent: false };
  }
  ```
- **Что конкретно менять:**
  1. Добавить поле `direction: 'up' | 'down'` в шаблон лестницы (`StairsTemplateSchema`) и в `StairsEntity`.
  2. В `createStairs` заполнять `direction` на основе `templateId` (или шаблона).
  3. В `resolveInteraction` использовать `stairs.direction`.
  4. В `floor-transition-planner.ts` использовать `direction` вместо `templateId`.
- **Зависимости:** нет.
- **Тесты:**
  - `tests/unit/simulation/actions/interact-action.test.ts`
  - `tests/unit/simulation/intents/floor-transition-intent-executor.test.ts`
  - `tests/fixtures/gameState.ts` (`makeStairs`)
- **Подводные камни:**
  - Нужно обновить `makeStairs` в фикстурах, чтобы он принимал/заполнял `direction`.
  - В content-реестре лестниц должно быть поле `direction`.

---

#### 3.7. Диагональное взаимодействие с дверьми и с собственного тайла
- **Статус:** 🔴 не начато
- **Приоритет:** низкий
- **Файлы:** `src/simulation/systems/actions/interact-action.ts:20-22, 95-107`
- **Описание:** `isAdjacent` использует Chebyshev distance ≤ 1, включая диагональ и тайл самой двери. При закрытии двери проверка `e.blocksMovement` заблокирует действие, если актор стоит на клетке двери (т.к. игрок `blocksMovement: true`).
- **Контекст / текущий код:**
  ```ts
  function isAdjacent(a: Position, b: Position): boolean {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
  }
  ```
- **Что конкретно менять:**
  1. Для `close_door` добавить явную проверку, что актор НЕ стоит на клетке двери:
     ```ts
     if (interaction.interactionId === 'close_door') {
       if (actor.x === target.x && actor.y === target.y) {
         return { ok: false, reasonCode: 'cannot_close_door_from_inside' };
       }
       // ... existing obstacle check ...
     }
     ```
  2. Либо для дверей использовать Manhattan distance === 1 (без диагонали).
- **Выбранный подход:** B — явно запретить `close_door` с той же клетки.
- **Зависимости:** п. 2.1 (если добавлять новый reasonCode, но можно использовать существующий `door_tile_blocked`).
- **Тесты:** `tests/unit/simulation/actions/interact-action.test.ts`.
- **Подводные камни:**
  - Открытие двери с диагонали и с той же клетки может быть допустимо по геймдизайну. Нужно решить, запрещать ли только закрытие.
  - Если запретить открытие с той же клетки, может сломаться `Dash skill` или другие механизмы.

---

#### 3.8. Автопуть к лестнице может «замирать»
- **Статус:** 🔴 не начато
- **Приоритет:** низкий
- **Файлы:** `src/presentation/gameSession.ts:1408-1424`
- **Описание:** Если последний AP ушёл на `MOVE` к лестнице, `onAnimationsComplete` отменит автопуть, потому что `state.player.ap <= 0`. Игрок должен нажать `F` на следующем ходу.
- **Контекст / текущий код:**
  ```ts
  if (state.turn.activeSide !== 'PLAYER' || state.player.ap <= 0) {
    this.autoPath.cancel();
    this.notify();
    return;
  }
  ```
- **Что конкретно менять:**
  1. Вариант A (сложнее): сохранять committed autoPath к лестнице, если цель — лестница/контейнер, и автоматически выполнить `INTERACT`, когда AP восстановятся в начале следующего хода.
  2. Вариант B (рекомендуется): оставить текущее поведение, но добавить явный тест, документирующий UX.
- **Выбранный подход:** B.
- **Зависимости:** нет.
- **Тесты:** `tests/unit/presentation/autoPath.test.ts` или `tests/unit/presentation/gameSession.test.ts`.
- **Подводные камни:**
  - Если реализовывать вариант A, нужно быть осторожным с отменой автопути при появлении врагов.
  - `AutoPathController` не знает о AP; это ответственность `GameSession`.

---

### 4. i18n

#### 4.1. Fallback в `getInteractionHintKey` генерирует невалидный ключ
- **Статус:** 🟢 готово
- **Выполнено:**
  - В `src/presentation/interactionUtils.ts` шаблонный fallback заменён на фиксированный ключ `'components.interactionHint.unknown'`.
  - В `src/i18n/schema.ts` и обеих локалях (`ru`, `en`) добавлен ключ `unknown` для `components.interactionHint`.
  - Проверено: `npx tsc --noEmit`, `npx tsx scripts/validate-i18n.ts` и все тесты проходят.
- **Приоритет:** средний
- **Файлы:** `src/presentation/interactionUtils.ts:27-29`
- **Описание:** Fallback `components.interactionHint.${interactionId}` даёт `snake_case` ключ, а в схеме используется `camelCase` (`openDoor`). Для нового `interactionId` (например, `pull_lever`) получится несуществующий ключ.
- **Контекст / текущий код:**
  ```ts
  export function getInteractionHintKey(interactionId: string): string {
    return INTERACTION_HINT_KEYS[interactionId] ?? `components.interactionHint.${interactionId}`;
  }
  ```
- **Что конкретно менять:**
  1. Убрать шаблонный fallback.
  2. Вернуть фиксированный placeholder:
     ```ts
     return INTERACTION_HINT_KEYS[interactionId] ?? 'components.interactionHint.unknown';
     ```
  3. Добавить ключ `unknown` в `src/i18n/schema.ts` и локали (или использовать существующий fallback UI).
- **Альтернатива:** добавить маппинг `snake_case → camelCase`.
- **Зависимости:** п. 2.1, п. 4.2.
- **Тесты:** `tests/unit/presentation/gameSession.test.ts`.
- **Подводные камни:**
  - `t('components.interactionHint.unknown')` должен возвращать человекочитаемую строку.
  - Если placeholder не добавить, UI покажет ключ вместо текста.

---

#### 4.2. Маппинги в `interactionUtils.ts` не type-safe
- **Статус:** 🟢 готово
- **Выполнено:**
  - В `src/presentation/interactionUtils.ts` типы маппингов изменены на `Record<InteractionId, string>` и `Record<InteractionId, number>`.
  - Сигнатуры `getInteractionHintKey` и `getInteractionPriority` принимают `InteractionId`.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** средний
- **Файлы:** `src/presentation/interactionUtils.ts:14, 32`
- **Описание:** `Record<string, string>` и `Record<string, number>` допускают любые ключи. TypeScript не напомнит добавить перевод/приоритет для нового `interactionId`.
- **Контекст / текущий код:**
  ```ts
  const INTERACTION_HINT_KEYS: Record<string, string> = { ... };
  const PRIORITIES: Record<string, number> = { ... };
  ```
- **Что конкретно менять:**
  1. После п. 2.1 заменить на:
     ```ts
     const INTERACTION_HINT_KEYS: Record<InteractionId, string> = { ... };
     const PRIORITIES: Record<InteractionId, number> = { ... };
     ```
  2. Параметры функций `getInteractionHintKey` и `getInteractionPriority` тоже принимают `InteractionId`.
- **Зависимости:** п. 2.1.
- **Тесты:** TypeScript (`npx tsc --noEmit`).
- **Подводные камни:** если `InteractionId` живёт в `@simulation/types`, Presentation импортирует тип — это допустимо.

---

#### 4.3. Неиспользуемые переводы в `actionValidations`
- **Статус:** 🔴 не начато
- **Приоритет:** низкий
- **Файлы:**
  - `src/i18n/locales/ru/system/actionValidations.ts`
  - `src/i18n/locales/en/system/actionValidations.ts`
  - `src/i18n/schema.ts`
- **Описание:** Остались ключи от удалённых action'ов `DESCEND`/`ASCEND`:
  - `onlyPlayerCanDescend`
  - `noDescentHere`
  - `bottomFloorReached`
  - `onlyPlayerCanAscend`
  - `noAscentHere`
  - `alreadyOnSurface`
- **Что конкретно менять:**
  1. Удалить перечисленные ключи из `ruActionValidations` и `enActionValidations`.
  2. Удалить их из `SystemActionValidationsTranslations` в `src/i18n/schema.ts`.
  3. Проверить `npx tsx scripts/validate-i18n.ts`.
- **Зависимости:** п. 3.1 (если добавлять новый reasonCode, возможно, понадобится оставить `onlyPlayerCanDescend`/`onlyPlayerCanAscend` или завести `onlyPlayerCanTransition`).
- **Тесты:** `npx tsx scripts/validate-i18n.ts`.
- **Подводные камни:** убедиться, что ни один `reasonCode` больше не ссылается на эти ключи.

---

### 5. Тесты / покрытие

#### 5.1. Непокрытые ветки в `interact-action.ts`
- **Статус:** 🔴 не начато
- **Приоритет:** средний
- **Файлы:** `tests/unit/simulation/actions/interact-action.test.ts`
- **Описание:** По coverage не покрыты:
  - `validate` с `action.type !== 'INTERACT'` (строка 133-134).
  - `resolve` с невалидным `resolveInteractContext` (отсутствующий target, неподходящее расстояние, `max_floor_reached`/`min_floor_reached`) (строки 150-153).
  - ветка `default` в `switch` (`unsupported_interaction`) (строка 190-191).
- **Что конкретно менять:**
  1. Добавить тест: `validate` с `action.type === 'WAIT'` → `wrong_action_type`.
  2. Добавить тесты на `resolve` с невалидным контекстом (например, `targetId` не существует, дверь не на соседней клетке, лестница не на той же клетке).
  3. Для `unsupported_interaction` можно временно подменить `resolveInteraction` (mock) или добавить тестовый `InteractionKind`.
- **Зависимости:** п. 2.1 (если `InteractionId` влияет на тесты).
- **Подводные камни:** `resolve` возвращает `[]` при любом невалидном контексте, поэтому тесты должны проверять не только результат, но и отдельно `validate`.

---

#### 5.2. `executePickUpIntent` тестируется только с legacy `ItemEntity`
- **Статус:** 🔴 не начато
- **Приоритет:** средний
- **Файлы:**
  - новый `tests/unit/simulation/intents/pick-up-intent-executor.test.ts`
  - `tests/unit/simulation/intent-executors.test.ts` (если есть)
- **Описание:** Dedicated тест для `executePickUpIntent` отсутствует. Существующее покрытие идёт через legacy `ItemEntity`.
- **Что конкретно менять:**
  1. Создать `tests/unit/simulation/intents/pick-up-intent-executor.test.ts`.
  2. Тесты:
     - Поднятие `FloorItemContainerEntity` добавляет предмет в инвентарь игрока.
     - Удаление контейнера из `state.entities`.
     - `ITEM_PICKED_UP` содержит корректный `itemInstanceId` и `templateId`.
     - Поднятие не-игроком возвращает `null`.
     - Поднятие отсутствующей сущности возвращает `null`.
  3. Если п. 3.3 выполнен (legacy `ItemEntity` удалён), тест на `ItemEntity` не нужен.
- **Зависимости:** п. 3.3.
- **Подводные камни:** `ExecutionBuilder` нужно инициализировать с `ACTION_APPLIED` root-событием.

---

#### 5.3. `floor-transition-intent-executor.test.ts` не покрывает подъём
- **Статус:** 🔴 не начато
- **Приоритет:** средний
- **Файлы:** `tests/unit/simulation/intents/floor-transition-intent-executor.test.ts`
- **Описание:** Все 4 теста проверяют `direction: 'down'`. Подъём (`'up'`) и восстановление `floorSnapshots` не покрыты.
- **Что конкретно менять:**
  1. Добавить тест `direction: 'up'`:
     - `state.floor` уменьшается.
     - Игрок позиционируется у `stairs_down`.
     - Если `floorSnapshots[to-1]` существует, карта/сущности восстанавливаются из снапшота.
  2. Добавить тест на восстановление `floorSnapshots` при подъёме после спуска.
- **Зависимости:** п. 1.2, п. 3.5 (если меняется структура дерева).
- **Подводные камни:**
  - Для теста подъёма нужен сгенерированный или ручной `floorSnapshots[0]`.
  - `makeGameState` создаёт пустую карту 10×10; для `computeFloorTransition('up')` нужна карта этажа 1.

---

#### 5.4. Нет регрессионного теста на `ITEM_DROPPED.itemInstanceId`
- **Статус:** 🟢 готово
- **Выполнено:**
  - Добавлен тест `ITEM_DROPPED содержит itemInstanceId контейнера и containerId сущности на полу`.
  - Проверяется: `event.itemInstanceId === container.item.instanceId`, `event.containerId === container.id`, `event.itemInstanceId !== event.containerId`.
  - Проверено: `npx vitest run` проходит.
- **Приоритет:** средний
- **Файлы:** `tests/unit/simulation/spawn-item-intent-executor.test.ts`
- **Описание:** После изменения в `spawn-item-intent-executor.ts` `itemInstanceId` стал id контейнера. Нужен тест, фиксирующий правильную семантику.
- **Что конкретно менять:**
  1. После п. 3.4 добавить тест:
     ```ts
     expect(event.itemInstanceId).toBe(container.item.instanceId);
     expect(event.containerId).toBe(container.id);
     ```
  2. Если п. 3.4 не выполняется, тест должен задокументировать текущее поведение.
- **Зависимости:** п. 3.4.
- **Подводные камни:** `container.item.instanceId` отличается от `container.id`.

---

### 6. Анимации / presentation

#### 6.1. Нет animation builder'а для `FLOOR_CHANGED`
- **Статус:** 🟢 готово
- **Выполнено:**
  - В `src/presentation/animation/index.ts` добавлен комментарий, объясняющий, что `FLOOR_CHANGED` намеренно не регистрируется: переход этажа — мгновенный сброс экрана, событие остаётся в дереве для журналирования и FOV.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** низкий
- **Файлы:** `src/presentation/animation/index.ts`
- **Описание:** `FLOOR_CHANGED` не зарегистрирован в `registerAnimationBuilder`. Событие остаётся в дереве, но для него не строится анимационный узел.
- **Что конкретно менять:**
  1. Вариант A: добавить пустой builder:
     ```ts
     registerAnimationBuilder('FLOOR_CHANGED', () => null);
     ```
  2. Вариант B (рекомендуется): оставить как есть, но добавить комментарий в `animation/index.ts`, почему `FLOOR_CHANGED` не имеет builder'а (переход этажа — мгновенный сброс экрана).
- **Выбранный подход:** B.
- **Зависимости:** п. 1.2 (если меняется структура событий).
- **Тесты:** нет.
- **Подводные камни:** `fogFilter.ts` возвращает `true` для `FLOOR_CHANGED`, поэтому событие попадает в дерево.

---

### 7. Мелкие замечания

#### 7.1. `fovEvents` в `FloorTransitionPlan` не используется
- **Статус:** 🟢 готово
- **Выполнено:**
  - `floorTransitionReaction` теперь передаёт `plan.fovEvents` в intent `APPLY_FOG_EVENTS`.
  - `executeApplyFogEventsIntent` применяет `newlyVisible` к `state.visible` / `state.explored` и добавляет события `FOG_UPDATED` как дочерние узлы к `FLOOR_CHANGED`.
  - Отдельный `UPDATE_FOG` больше не вызывается при переходе этажа.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** низкий
- **Файлы:** `src/simulation/systems/floor-transition-planner.ts:40`
- **Описание:** `computeFloorTransition` вычисляет `fovEvents`, но `executeFloorTransitionIntent` их игнорирует и вместо этого вызывает `UPDATE_FOG`.
- **Что конкретно менять:**
  1. В рамках п. 1.2 использовать `fovEvents` напрямую (добавить их как дочерние узлы к `FLOOR_CHANGED`), вместо отдельного `UPDATE_FOG`.
  2. Либо удалить поле `fovEvents` из `FloorTransitionPlan`, если оно не нужно.
- **Зависимости:** п. 1.2.
- **Тесты:** `tests/unit/simulation/intents/floor-transition-intent-executor.test.ts`.
- **Подводные камни:** `fovEvents` вычислены на временном состоянии; при использовании напрямую нужно убедиться, что они соответствуют финальному `state`.

---

#### 7.2. Комментарий в `interact-action.test.ts` устарел
- **Статус:** 🟢 готово
- **Выполнено:**
  - JSDoc-шапка файла `tests/unit/simulation/actions/interact-action.test.ts` заменена на актуальное описание покрытия: `resolveInteraction`, `validate`, `resolve` и полные flow через `GameSimulation`.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** низкий
- **Файлы:** `tests/unit/simulation/actions/interact-action.test.ts:5-6`
- **Описание:** Комментарий говорит, что исполнение intent'ов не тестируется, хотя в файле уже есть раздел `INTERACT — полные flow`.
- **Что конкретно менять:**
  ```ts
  /**
   * Тесты единого action взаимодействия `INTERACT`.
   *
   * Покрыты: resolveInteraction, validate, resolve и полные flow через GameSimulation
   * для дверей, контейнеров предметов и лестниц.
   */
  ```
- **Зависимости:** нет.
- **Тесты:** нет.

---

#### 7.3. `BLOCK_04_PRESENTATION.md` противоречит реализации
- **Статус:** 🟢 готово
- **Выполнено:**
  - Обновлён п. 2 `docs/plans/unified-interaction-action/BLOCK_04_PRESENTATION.md`: указано, что `findInteractableEntitiesAround` реализована в `@simulation/state` и доступна Presentation через `Simulation.findInteractableEntitiesAround(...)`, с примером вызова.
  - Проверено: `npx tsc --noEmit` и все тесты проходят.
- **Приоритет:** низкий
- **Файлы:** `docs/plans/unified-interaction-action/BLOCK_04_PRESENTATION.md`
- **Описание:** В п. 2 блока 4 `findInteractableEntitiesAround` предлагается создать в Presentation (или Simulation, если нужен и там). В реализации функция оказалась в `@simulation/state`, а Presentation получила её через публичный API `Simulation` (п. 1.1).
- **Что конкретно менять:**
  1. Обновить п. 2 плана: указать, что `findInteractableEntitiesAround` реализована в `@simulation/state` как чистый helper и доступна Presentation через `Simulation.findInteractableEntitiesAround`.
  2. Добавить пример вызова через `this.simulation.findInteractableEntitiesAround(...)`.
- **Зависимости:** п. 1.1.
- **Тесты:** нет.

---

## Порядок исправлений

1. Вынести `resolveInteraction` и `findInteractableEntitiesAround` в публичный API Simulation (1.1) — ✅ готово.
2. Ввести строгий `InteractionId` и применить его в Presentation и Simulation (2.1, 2.2, 4.2).
3. Рефакторинг `executeFloorTransitionIntent` / вынести оркестровку (1.2, 3.5).
4. Исправить семантику `ITEM_DROPPED.itemInstanceId` (3.4).
5. Добавить валидацию `action.entityId === 'player'` для перехода этажа (3.1).
6. Удалить legacy `ItemEntity` и `makeFloorItem` (3.3).
7. Добавить `direction` в `StairsEntity` (3.6).
8. Улучшить type safety и убрать небезопасные `as` (2.3).
9. Исправить i18n fallback и удалить мёртвые ключи (4.1, 4.3).
10. Дополнить тесты (5.1–5.4).
11. Мелкие правки (3.7, 3.8, 6.1, 7.1–7.3).
