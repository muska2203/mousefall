# План: единый action взаимодействия с объектами

> Статус: черновик плана, требует детальной проработки внедрения.
>
> Цель: объединить `PICKUP`, `OPEN_DOOR`, `CLOSE_DOOR`, `DESCEND`, `ASCEND` в один универсальный action `INTERACT`, чтобы упростить UI, AI и добавление новых интерактивных объектов.

---

## 1. Проблема

Сейчас каждый способ взаимодействия с объектом мира имеет собственный action type:

- `PICKUP` — поднять предмет.
- `OPEN_DOOR` / `CLOSE_DOOR` — открыть/закрыть дверь.
- `DESCEND` / `ASCEND` — спуститься/подняться по лестнице.

Это приводит к тому, что при добавлении нового интерактивного объекта (рычаг, кнопка, сундук, ловушка) приходится трогать множество мест:

1. `src/simulation/core-types.ts` — новый `GameAction`.
2. `src/simulation/systems/actions/` — новый handler.
3. `src/simulation/systems/intents/` — новый intent executor.
4. `src/simulation/simulation.ts` — регистрация handler.
5. `src/presentation/gameSession.ts` — логика подсказок `buildInteractionOptions`.
6. `src/presentation/autoPathController.ts` — логика автопути.
7. `src/presentation/animation/` — обработка новых событий.
8. `src/ui/components/` — подсказки, поповеры.
9. `src/i18n/locales/*.json` — переводы.
10. Тесты.

Хочется иметь единую точку входа для всех объектов, с которыми можно взаимодействовать.

---

## 2. Цель

Ввести единый action `INTERACT`, который принимает только целевую сущность. Что именно произойдёт при взаимодействии, решает сам объект в текущем состоянии.

Преимущества:

- **Для UI:** не нужно знать типы объектов — только единый action и подсказку, которую даёт Presentation.
- **Для AI:** не нужно специально обрабатывать двери, лестницы, предметы — достаточно решить «взаимодействовать с объектом».
- **Для контента:** добавление нового объекта не требует нового action type.
- **Для симуляции:** меньше дублирования в action handlers.

---

## 3. Новая модель

### 3.1. Action

```ts
export type InteractAction = {
  type: 'INTERACT';
  entityId: EntityId; // кто взаимодействует
  targetId: EntityId; // с какой сущностью
};
```

Action не содержит `targetPosition` и не содержит `interactionId`. Целевая сущность однозначно определяется по `targetId`, а способ взаимодействия — по её текущему состоянию.

### 3.2. Intent

`INTERACT` action handler в `resolve()` сразу выбирает конкретный intent. Промежуточный `INTERACT_WITH_OBJECT` intent не используется.

Возможные intent'ы, которые порождает `INTERACT`:

```ts
// Дверь
{ type: 'OPEN_DOOR'; entityId: EntityId; targetPosition: Position }
{ type: 'CLOSE_DOOR'; entityId: EntityId; targetPosition: Position }

// Контейнер предмета на полу
{ type: 'PICK_UP'; entityId: EntityId; itemId: EntityId; templateId: string }

// Лестница
{ type: 'FLOOR_TRANSITION'; entityId: EntityId; direction: 'down' | 'up' }
```

`FLOOR_TRANSITION` — новый intent type, который заменяет собой всю работу текущих `DESCEND` / `ASCEND` action handlers.

### 3.3. Данные в сущности и в контенте

В runtime-сущности хранится постоянный признак вида взаимодействия:

```ts
entity.interactionKind: 'door' | 'stairs' | 'item' | 'lever' | ...;
```

Этот признак задаётся в JSON-шаблоне объекта и валидируется через Zod-схему. Конкретное доступное действие вычисляется динамически по состоянию сущности.

#### Контейнер предмета на полу

Предмет на полу представлен отдельной сущностью-контейнером:

```ts
export type FloorItemContainerEntity = {
  id: EntityId;
  type: 'floor_item_container';
  x: number;
  y: number;
  interactionKind: 'item';
  item: InventoryItem; // сам предмет
  blocksMovement: false;
};
```

При взаимодействии (`interactionId: 'pickup'`) предмет (`item`) перемещается в инвентарь актора, а сам контейнер удаляется с поля.

Такое разделение позволяет в будущем добавлять другие контейнеры (сундук, труп, куча предметов), которые также будут иметь `interactionKind: 'item'` или собственный kind.

Примеры в шаблонах:

```json
// public/content/entities/doors/wooden_door.json
{
  "id": "wooden_door",
  "interactionKind": "door",
  "maxHp": 30,
  "armor": 2
}

// public/content/entities/stairs/stairs_down.json
{
  "id": "stairs_down",
  "interactionKind": "stairs"
}

// public/content/items/consumables/health_potion.json
{
  "id": "health_potion",
  "type": "consumable"
}
```

`interactionKind: 'item'` задаётся не в шаблоне предмета, а в runtime-сущности контейнера, которая спавнится на полу.

### 3.4. Разрешение взаимодействия

```ts
export type ResolvedInteraction = {
  interactionId: string;        // 'open_door', 'close_door', 'pickup', 'descend', 'ascend'
  usableFromAdjacent: boolean;
};

export function resolveInteraction(
  state: GameState,
  entity: Entity,
  actor: Entity,
): ResolvedInteraction | null;
```

Стоимость AP для всех взаимодействий одинаковая — 1 AP. Поэтому `apCost` не хранится в `ResolvedInteraction`.

Примеры:

| Объект | Состояние | Результат `resolveInteraction` |
|---|---|---|
| Дверь | `isOpen === false` | `{ interactionId: 'open_door', usableFromAdjacent: true }` |
| Дверь | `isOpen === true` | `{ interactionId: 'close_door', usableFromAdjacent: true }` |
| Лестница вниз | — | `{ interactionId: 'descend', usableFromAdjacent: false }` |
| Лестница вверх | — | `{ interactionId: 'ascend', usableFromAdjacent: false }` |
| Контейнер предмета на полу | — | `{ interactionId: 'pickup', usableFromAdjacent: false }` |
| Рычаг | — | `{ interactionId: 'pull_lever', usableFromAdjacent: true }` |

---

## 4. Разделение ответственности

| Задача | Ответственный слой/модуль |
|---|---|
| Какое взаимодействие доступно для объекта | `Simulation.resolveInteraction()` |
| Можно ли выполнить action | `Simulation.preview()` |
| Стоимость AP | `Simulation.getActionCost()` — всегда 1 для `INTERACT` |
| Формирование единого `INTERACT` action | `Presentation` (GameSession, AutoPathController) |
| Преобразование `interactionId` в i18n-ключ | `Presentation.getInteractionHintKey()` |
| Рендеринг подсказки | `UI` — просто отображает `t(labelKey)` |
| Переводы | `src/i18n/locales/*.json` |

Presentation — единственное место, где игровое понятие превращается в текст для пользователя. UI не знает типов объектов. Simulation не знает о UI.

---

## 5. Где формируются подсказки

Подсказка формируется в `GameSession.buildInteractionOptions`:

```ts
for (const entity of findInteractableEntitiesAround(state, player, 1)) {
  const interaction = resolveInteraction(state, entity, player);
  if (!interaction) continue;

  const action: GameAction = {
    type: 'INTERACT',
    entityId: player.id,
    targetId: entity.id,
  };

  if (canPerform(action)) {
    options.push({
      kind: interaction.interactionId,
      action,
      targetPosition: { x: entity.x, y: entity.y }, // только для ViewModel
      labelKey: getInteractionHintKey(interaction.interactionId),
      priority: getInteractionPriority(interaction.interactionId),
    });
  }
}
```

`getInteractionHintKey` — чистая функция в Presentation:

```ts
const INTERACTION_HINT_KEYS: Record<string, string> = {
  open_door: 'components.interactionHint.openDoor',
  close_door: 'components.interactionHint.closeDoor',
  pickup: 'components.interactionHint.pickup',
  descend: 'components.interactionHint.descend',
  ascend: 'components.interactionHint.ascend',
  pull_lever: 'components.interactionHint.pullLever',
};
```

UI получает готовый `labelKey` и вызывает `t(labelKey)`.

---

## 6. Пошаговый план миграции

1. **Добавить `INTERACT` action** в `src/simulation/core-types.ts`.
2. **Добавить `FLOOR_TRANSITION` intent** в `src/simulation/core-types.ts`.
3. **Добавить `interactionKind` в сущности** дверей, лестниц и контейнеров предметов на полу.
4. **Ввести сущность `FloorItemContainerEntity`** и заменить текущий `ItemEntity` на полу на контейнер.
5. **Создать `resolveInteraction`** в `src/simulation/systems/interactions/`.
6. **Создать `interact-action.ts` handler** и зарегистрировать его в `src/simulation/simulation.ts`.
7. **Создать `executeFloorTransitionIntent`** и зарегистрировать его в `src/simulation/systems/intents/execute-intent.ts`.
8. **Обновить `action-cost-resolver.ts`**: `INTERACT` стоит 1 AP.
9. **Обновить `GameSession.buildInteractionOptions`** для генерации `INTERACT` options.
10. **Обновить `AutoPathController`** для использования `INTERACT` вместо специфических action'ов. Открытые двери проходятся через `MOVE`, а не `INTERACT`.
11. **Обновить `GameSession.moveOrAttack`** — шаг в закрытую дверь должен превращаться в `INTERACT`.
12. **Удалить `stairsTransitionReaction`, `TRIGGER_STAIR_EXIT` intent и `STAIR_EXIT_TRIGGERED` event**.
13. **Добавить i18n-ключи** для всех `interactionId`.
14. **Написать тесты** для `resolveInteraction`, `interact-action`, `executeFloorTransitionIntent`, контейнера предметов.
15. **Постепенно удалить старые action types** (`PICKUP`, `OPEN_DOOR`, `CLOSE_DOOR`, `DESCEND`, `ASCEND`) после полного перехода, но **оставить внутренние intent types** `OPEN_DOOR`, `CLOSE_DOOR`, `PICK_UP` для `Dash skill` и других внутренних механизмов.

---

## 7. Как план ложится в текущую реализацию

### 7.1. Action / Intent / Event

Текущая архитектура уже разделена на три фазы (`docs/agents/ACTION_SYSTEM.md`):

```
Action → validate() → resolve() → Intent[] → execute() → Event
```

`INTERACT` action handler работает как чистый маршрутизатор:

- `validate()` — проверяет, доступно ли взаимодействие, через `resolveInteraction`.
- `resolve()` — выбирает конкретный intent в зависимости от цели и её состояния.
- `execute()` — стандартно исполняет intent'ы через `executeIntent`.

Таким образом, `INTERACT` не порождает промежуточного intent'а. Сразу получаем:

- `OPEN_DOOR` / `CLOSE_DOOR` → `door-intent-executor.ts`
- `PICK_UP` → `pick-up-intent-executor.ts`
- `FLOOR_TRANSITION` → новый `executeFloorTransitionIntent`

Event-деревья (`DOOR_OPENED`, `ITEM_PICKED_UP`, `FLOOR_CHANGED`) останутся прежними, анимации и логи не сломаются.

### 7.2. Регистрация обработчиков

Сейчас handlers регистрируются в `src/simulation/simulation.ts` (строки 785–803):

```ts
registry.register('PICKUP', pickupEntity);
registry.register('OPEN_DOOR', openDoorAction);
registry.register('CLOSE_DOOR', closeDoorAction);
registry.register('DESCEND', descendAction);
registry.register('ASCEND', ascendAction);
```

Добавится:

```ts
registry.register('INTERACT', interactAction);
```

Старые handlers можно оставить на время миграции, а затем удалить.

### 7.3. Стоимость AP

Списание AP централизовано в `src/simulation/simulation.ts:executeAction` через `CONSUME_AP` intent. Стоимость `INTERACT` всегда 1 AP:

```ts
// action-cost-resolver.ts
case 'INTERACT':
  return 1;
```

Никакого lookup и никакого `apCost` в `ResolvedInteraction`.

### 7.4. Presentation: подсказки

Сейчас `GameSession.buildInteractionOptions` (строки 512–625) жёстко перечисляет пять видов взаимодействий. Его можно заменить на универсальный цикл через `resolveInteraction`.

`InteractionOption` (`src/presentation/types.ts`, строки 320–330) остаётся почти без изменений: поле `kind` будет содержать `interactionId`, а `action` — `INTERACT`.

`InteractionHint.tsx` и `GameField.tsx` не изменятся, потому что они уже работают с готовым `label` и `targetPosition`.

### 7.5. Presentation: автопуть

`AutoPathController` (строки 232–309) сейчас явно возвращает `OPEN_DOOR`, `PICKUP`, `DESCEND`, `ASCEND`. Его логика меняется следующим образом:

- `'door'`:
  - Закрытая → `INTERACT` с `targetId` двери (открыть).
  - Открытая → `MOVE` на клетку двери (пройти). Не `INTERACT`, чтобы не закрыть дверь.
- `'interactable'` → `INTERACT` с `targetId` объекта. Проходимые объекты (контейнеры предметов, лестницы) по-прежнему требуют сначала встать на клетку.
- `'enemy'` остаётся `ATTACK`, если мы не хотим объединять атаку вообще.

### 7.6. Presentation: moveOrAttack

`GameSession.moveOrAttack` (строки 1420–1472) сейчас при шаге в закрытую дверь отправляет `OPEN_DOOR`. Нужно заменить на `INTERACT` с `targetId` двери. Приоритет остаётся: враг > дверь > ходьба.

### 7.7. Content-слой

`interactionKind` добавляется в JSON-шаблоны дверей и лестниц. Контейнер предмета на полу получает `interactionKind: 'item'` при создании, не из шаблона предмета.

- `DoorTemplateSchema` — `interactionKind: z.enum(['door'])`
- `StairsTemplateSchema` — `interactionKind: z.enum(['stairs'])`

При создании сущности (`createDoor`, `createStairs`, `createFloorItemContainer`) значение копируется из шаблона или задаётся явно.

`resolveInteraction` определяет конкретное действие по `entity.interactionKind` + состоянию:

```ts
switch (entity.interactionKind) {
  case 'door':
    return entity.isOpen
      ? { interactionId: 'close_door', usableFromAdjacent: true }
      : { interactionId: 'open_door', usableFromAdjacent: true };

  case 'stairs':
    return entity.templateId === 'stairs_up'
      ? { interactionId: 'ascend', usableFromAdjacent: false }
      : { interactionId: 'descend', usableFromAdjacent: false };

  case 'item':
    return { interactionId: 'pickup', usableFromAdjacent: false };
}
```

Этот подход **более централизованный**, чем текущий: логика взаимодействия сосредоточена в одной функции, а не размазана по отдельным action handlers. Однако он **не является полностью data-driven**: добавление принципиально нового поведения (например, рычага) всё равно потребует изменения `resolveInteraction` и intent executor.

> **TODO:** После стабилизации системы вынести поведения в регистр `InteractionBehaviorRegistry`, чтобы новые виды взаимодействий можно было добавлять без изменения `resolveInteraction`.

### 7.8. Тесты

Текущие тесты покрывают все заменяемые action'ы:

- `tests/unit/simulation/actions/pickup-action.test.ts`
- `tests/unit/simulation/door.test.ts`
- `tests/unit/simulation/world-reactions/stairs-reaction.test.ts`
- `tests/unit/presentation/autoPath.test.ts`

При миграции:

1. Добавить `tests/unit/simulation/actions/interact-action.test.ts`.
2. Добавить `tests/unit/simulation/intents/floor-transition-intent.test.ts`.
3. Обновить `autoPath.test.ts` — ожидать `type: 'INTERACT'`.
4. Оставить тесты дверей/предметов как regression-тесты, но заменить `OPEN_DOOR`/`PICKUP` на `INTERACT`.
5. Добавить тесты для `resolveInteraction`.

---

## 8. Найденные проблемы и нюансы

### 8.1. Подозрительная проверка препятствий у двери

В `src/simulation/systems/actions/door-action.ts` (строки 49–57) проверка препятствий выполняется при `expectedOpen === false`, то есть при **открытии**, а не при закрытии. Скорее всего, это баг: препятствия должны проверяться при закрытии двери, чтобы не защемить сущность в дверном проёме.

При рефакторинге стоит исправить: проверка препятствий должна быть при `!expectedOpen` (то есть когда мы закрываем дверь).

### 8.2. `FLOOR_TRANSITION` intent executor

Для лестниц вводится новый intent type `FLOOR_TRANSITION`. Его executor выполняет всю работу, которая сейчас выполняется в `floor-transition-action.ts:execute`:

```ts
export const executeFloorTransitionIntent: IntentExecutor<FloorTransitionIntent> = (
  state, intent, builder, parent,
) => {
  const plan = computeFloorTransition(state, intent.direction);
  state.floor = plan.to;

  const floorNode = builder.addChild(parent, {
    type: 'FLOOR_CHANGED',
    from: plan.from,
    to: plan.to,
  });

  const subIntents = [
    { type: 'SET_MAP', map: plan.map, explored: plan.explored },
    { type: 'SET_ENTITIES', entities: plan.entities },
    { type: 'TELEPORT_ENTITY', entityId: 'player', x: plan.playerPosition.x, y: plan.playerPosition.y },
    { type: 'BEGIN_TURN', side: 'PLAYER', round: plan.turn.round },
    { type: 'RESTORE_AP', entityId: 'player' },
    { type: 'UPDATE_FOG' },
  ] as const;

  for (const subIntent of subIntents) {
    executeIntent(state, subIntent, builder, floorNode);
  }

  return floorNode;
};
```

Это специальный случай сложной атомарной операции. В будущем можно заменить на world reaction каскад, но для первой итерации такой подход достаточен.

### 8.3. Явный спуск/подъём по лестнице

Автоспуск по лестнице (`stairsTransitionReaction`) убирается. Переход на другой этаж выполняется только явно через `INTERACT` с лестницей.

Это упрощает логику:

- `stairsTransitionReaction` удаляется.
- `TRIGGER_STAIR_EXIT` intent удаляется.
- `STAIR_EXIT_TRIGGERED` event удаляется.
- Presentation больше не реагирует на авто-событие лестницы.
- Игрок сам решает, когда спускаться/подниматься, нажимая F на клетке с лестницей.

**Важно:** UI должен гарантированно показывать подсказку взаимодействия на клетке с лестницей.

### 8.4. Внутренние intent types остаются

`OPEN_DOOR`, `CLOSE_DOOR`, `PICK_UP` и прочие низкоуровневые intent types **оставляем** как внутренние строительные блоки. Они используются:

- `interact-action.ts` — `resolve()` порождает их из `INTERACT`.
- `src/simulation/skills/executors/dashSkill.ts` (строки 150–161) — dash в закрытую дверь порождает `OPEN_DOOR` intent.

Удаляются только **action types**: `PICKUP`, `OPEN_DOOR`, `CLOSE_DOOR`, `DESCEND`, `ASCEND`.

### 8.5. Подсказка «поднять что-то»

Сейчас `PICKUP` поднимает первый предмет на клетке. Подсказка может быть общей («Поднять») или конкретной («Поднять зелье здоровья»). Для первой итерации достаточно общей подсказки. Конкретизация через `interactionArgs` — отдельная задача.

---

## 9. Рекомендуемый подход к миграции

Чтобы минимизировать риски, рекомендуется делать миграцию поэтапно:

### Этап 1. Добавить `INTERACT` без удаления старых action'ов

- Добавить `InteractAction` и `FloorTransitionIntent`.
- Добавить `interactionKind` в сущности.
- Ввести `FloorItemContainerEntity`.
- Создать `resolveInteraction`.
- Создать `interact-action.ts` handler.
- Создать `executeFloorTransitionIntent`.
- Зарегистрировать handler и intent executor.
- Добавить `INTERACT` в `action-cost-resolver.ts` (стоимость 1).
- Написать тесты на `INTERACT`.

### Этап 2. Перевести Presentation

- `GameSession.buildInteractionOptions` генерирует `INTERACT` options.
- `AutoPathController` возвращает `INTERACT`.
- `GameSession.moveOrAttack` использует `INTERACT` для дверей.
- Обновить `autoPath.test.ts`.

### Этап 3. Удалить старые action'ы

- Удалить `PICKUP`, `OPEN_DOOR`, `CLOSE_DOOR`, `DESCEND`, `ASCEND` из `GameAction`.
- Удалить `TRIGGER_STAIR_EXIT` intent и `STAIR_EXIT_TRIGGERED` event.
- Удалить `stairsTransitionReaction`.
- Удалить соответствующие handlers из `simulation.ts`.
- Удалить/обновить старые тесты.
- Обновить `docs/agents/ACTION_SYSTEM.md` и чеклисты.

---

## 10. Принятые архитектурные решения

| Вопрос | Решение |
|---|---|
| Спуск/подъём по лестнице | Только явный `INTERACT`. Автоспуск по наступанию (`stairsTransitionReaction`) и связанные `TRIGGER_STAIR_EXIT` / `STAIR_EXIT_TRIGGERED` удаляются. |
| Подход к централизации | Это **более централизованный** подход, не полностью data-driven. `interactionKind` задаётся в JSON-шаблоне и копируется в runtime-сущность. `resolveInteraction` вычисляет действие по `interactionKind` + состоянию. |
| Масштабируемость в будущем | После стабилизации системы вынести поведения в регистр `InteractionBehaviorRegistry` (TODO). |
| Предмет на полу | Вводится сущность-контейнер `FloorItemContainerEntity` с `interactionKind: 'item'`. При `pickup` предмет из контейнера перемещается в инвентарь, контейнер удаляется. |
| Проверка препятствий при закрытии двери | Исправляем: препятствия проверяются при закрытии, а не при открытии. |
| Подсказка для предметов | Общая — «Поднять». Конкретизация («Поднять зелье здоровья») — отдельная задача. |
| AutoPath и открытые двери | Открытая дверь проходится через `MOVE`, а не через `INTERACT` (чтобы не закрывать). |
| AP cost | Все взаимодействия стоят 1 AP. Никакого `apCost` в `ResolvedInteraction`. |
| Выбор конкретного intent | Происходит в `resolve()` action handler `INTERACT`. Промежуточный `INTERACT_WITH_OBJECT` intent не используется. |
| Внутренние intent types | `OPEN_DOOR`, `CLOSE_DOOR`, `PICK_UP`, `FLOOR_TRANSITION` остаются как низкоуровневые строительные блоки. Удаляются только action types. |
| AI | AI — отдельная задача. Текущая цель — единая точка взаимодействия с объектами для игрока и Presentation. |

## 11. Риски и открытые вопросы

- **Дверь и MOVE.** Сейчас `GameSession.moveOrAttack` при шаге в закрытую дверь отправляет `OPEN_DOOR`. Нужно аккуратно заменить на `INTERACT` без поломки автопути.
- **Контейнер предмета на полу.** Текущий `ItemEntity` на полу нужно заменить на `FloorItemContainerEntity`. Это касается фабрики, генератора карты, отображения, тестов.
- **Сохранения.** `serialization.ts` сейчас закомментирован, но при его восстановлении новое поле `interactionKind` и новый тип сущности `floor_item_container` должны сериализоваться.
- **Анимации.** Старые события (`DOOR_OPENED`, `ITEM_PICKED_UP`, `FLOOR_CHANGED`) можно оставить. Главное, чтобы `INTERACT` action приводил к тем же деревьям событий.
- **Удаление авто-спуска.** Нужно убедиться, что игрок не застрянет на клетке с лестницей из-за отсутствия автоперехода. UI должен гарантированно показывать подсказку F.
- **Подсказки по всем объектам.** Механика подсказок уже есть на UI. После перехода в `buildInteractionOptions` должны генерироваться подсказки для всех интерактивных объектов вокруг игрока.
- **`FLOOR_TRANSITION` intent executor.** Executor вызывает sub-intents (`SET_MAP`, `SET_ENTITIES` и т.д.). Это специальный случай сложной атомарной операции, но он немного нарушает идеал чистой архитектуры. В будущем можно заменить на world reaction каскад.

---

## 12. Следующий шаг

Начать реализацию с этапа 1: добавить `INTERACT` action параллельно существующим, не удаляя их.
