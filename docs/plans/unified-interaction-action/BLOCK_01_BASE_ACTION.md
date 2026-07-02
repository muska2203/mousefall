# Блок 1. Базовый action `INTERACT`

## Цель

Создать фундамент единого action взаимодействия с объектами: тип action, признак `interactionKind` на сущностях, функцию выбора взаимодействия `resolveInteraction`, базовый handler и регистрацию в симуляции.

## Контекст

Для выполнения блока нужно понимать:

- Трёхфазную систему `Action → Intent → Event`.
- Где определяются типы `GameAction`, `Intent`, `GameEvent`.
- Как регистрируются action handlers.
- Как определяется стоимость AP.
- Как устроены runtime-сущности (`DoorEntity`, `StairsEntity`).

## Что нужно сделать

### 1. Добавить `InteractAction` в union `GameAction`

Добавить новый тип action:

```ts
export type InteractAction = {
  type: 'INTERACT';
  entityId: EntityId; // кто взаимодействует
  targetId: EntityId; // с какой сущностью
};
```

Включить его в union `GameAction`.

### 2. Добавить `interactionKind` в runtime-сущности

Добавить поле `interactionKind` в:

- `DoorEntity` — значение `'door'`.
- `StairsEntity` — значение `'stairs'`.

Поле должно задаваться при создании сущности и может задаваться в JSON-шаблоне.

### 3. Добавить `interactionKind` в content-схемы

В Zod-схемы шаблонов добавить поле:

- `DoorTemplateSchema` — `interactionKind: z.enum(['door'])`.
- `StairsTemplateSchema` — `interactionKind: z.enum(['stairs'])`.

Обновить JSON-шаблоны дверей и лестниц, добавив `interactionKind`.

### 4. Создать `resolveInteraction`

Создать функцию:

```ts
export type ResolvedInteraction = {
  interactionId: string;
  usableFromAdjacent: boolean;
};

export function resolveInteraction(
  state: GameState,
  entity: Entity,
  actor: Entity,
): ResolvedInteraction | null;
```

На этом этапе реализовать только двери и лестницы:

- `interactionKind === 'door'`:
  - `isOpen === false` → `{ interactionId: 'open_door', usableFromAdjacent: true }`
  - `isOpen === true` → `{ interactionId: 'close_door', usableFromAdjacent: true }`
- `interactionKind === 'stairs'`:
  - `templateId === 'stairs_up'` → `{ interactionId: 'ascend', usableFromAdjacent: false }`
  - иначе → `{ interactionId: 'descend', usableFromAdjacent: false }`

Контейнеры предметов (`interactionKind === 'item'`) будут добавлены в Блоке 2.

### 5. Создать `interact-action.ts` handler

Создать action handler с тремя методами:

- `validate(state, action)`:
  - Проверить `action.type === 'INTERACT'`.
  - Найти актора и цель.
  - Вызвать `resolveInteraction` для цели.
  - Проверить расстояние: если `usableFromAdjacent` — актёр должен быть на соседней клетке, иначе — на той же клетке.
  - Для лестниц дополнительно проверить границы этажей (`MAX_FLOOR`, `floor <= 1`).
- `resolve(state, action)`:
  - На этом этапе вернуть пустой массив или заглушку. Конкретные intent'ы будут реализованы в Блоке 3.
- `execute(state, action, intents, builder, parent)`:
  - Стандартно исполнить все intent'ы из `resolve` через `executeIntent`.

### 6. Зарегистрировать handler

Зарегистрировать `'INTERACT'` в реестре action handlers.

### 7. Установить стоимость AP

В `action-cost-resolver` добавить:

```ts
case 'INTERACT':
  return 1;
```

### 8. Написать тесты

Добавить тесты на:

- `resolveInteraction` для дверей и лестниц.
- `interact-action.validate` для разных целей.
- Стоимость AP для `INTERACT`.

## Результат

После выполнения блока:

- `INTERACT` action существует в системе.
- `resolveInteraction` умеет определять доступное взаимодействие для дверей и лестниц.
- Handler проходит валидацию, но пока не выполняет полезной работы в `resolve`.
- Все тесты нового функционала проходят.
- Старые action'ы (`OPEN_DOOR`, `CLOSE_DOOR`, `DESCEND`, `ASCEND`) продолжают работать.

## Следующий блок

[BLOCK_02_FLOOR_ITEM_CONTAINER](./BLOCK_02_FLOOR_ITEM_CONTAINER.md)
