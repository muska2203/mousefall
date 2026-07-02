# Блок 2. Контейнер предмета на полу

## Цель

Заменить прямое размещение `ItemEntity` на полу на сущность-контейнер `FloorItemContainerEntity`, который хранит сам предмет и имеет `interactionKind: 'item'`.

## Контекст

Для выполнения блока нужно понимать:

- Как сейчас создаются предметы на полу.
- Где находится union runtime-сущностей.
- Как отображаются предметы на полу в UI.
- Как работает `pick-up-intent-executor`.
- Результат Блока 1: `resolveInteraction` уже умеет работать с `interactionKind`, но пока не знает про `'item'`.

## Что нужно сделать

### 1. Создать тип `FloorItemContainerEntity`

Добавить новый тип сущности:

```ts
export type FloorItemContainerEntity = {
  id: EntityId;
  type: 'floor_item_container';
  x: number;
  y: number;
  displayName: string;
  interactionKind: 'item';
  item: InventoryItem;
  blocksMovement: false;
  templateId: string; // templateId самого предмета, для отображения
};
```

Включить его в union runtime-сущностей.

### 2. Добавить `interactionKind: 'item'` в `resolveInteraction`

Расширить `resolveInteraction`:

```ts
case 'item':
  return { interactionId: 'pickup', usableFromAdjacent: false };
```

### 3. Создать фабрику `createFloorItemContainer`

Создать функцию, которая принимает `InventoryItem` и позицию, и возвращает `FloorItemContainerEntity`:

```ts
export function createFloorItemContainer(
  state: GameState,
  item: InventoryItem,
  position: Position,
): FloorItemContainerEntity;
```

Функция генерирует id контейнера, отдельный от `instanceId` предмета.

### 4. Заменить создание предметов на полу

Найти все места, где сейчас создаётся `ItemEntity` на полу:

- Фабрика предметов.
- Генератор карты (spawn items).
- Debug-спавн.

Заменить на создание `FloorItemContainerEntity` через `createFloorItemContainer`.

### 5. Обновить `pick-up-intent-executor`

Адаптировать `executePickUpIntent` для работы с `FloorItemContainerEntity`:

- Получить контейнер по `itemId`.
- Проверить, что это `floor_item_container`.
- Добавить `container.item` в инвентарь актора.
- Удалить контейнер из `state.entities`.
- Увеличить `runStats.itemsPickedUp`.
- Породить событие `ITEM_PICKED_UP` с `itemInstanceId` предмета.

На время миграции можно оставить поддержку старого `ItemEntity`, если он ещё где-то используется.

### 6. Обновить отображение предметов на полу

Найти места, где UI/Presentation работает с предметами на полу:

- EntityRenderer — как выбирается спрайт.
- FieldObjectPopover — как отображается информация о предмете.
- `GameSession.buildFieldObjectPopover` — если нужно.

Для `FloorItemContainerEntity` спрайт и имя берутся из `container.item.templateId`.

### 7. Обновить поиск предметов на клетке

Найти функции вроде `findAllEntitiesAt(...).filter(e => e.type === 'item')` и заменить на поиск `floor_item_container`.

### 8. Написать тесты

Добавить тесты на:

- Создание `FloorItemContainerEntity`.
- Поднятие предмета из контейнера.
- `resolveInteraction` для контейнера.
- Отображение контейнера (если применимо).

## Результат

После выполнения блока:

- Предметы на полу хранятся в `FloorItemContainerEntity`.
- `resolveInteraction` умеет обрабатывать `interactionKind: 'item'`.
- Поднятие предмета работает через контейнер.
- UI корректно отображает контейнеры.
- Старый `ItemEntity` может временно поддерживаться, но новые предметы создаются как контейнеры.

## Следующий блок

[BLOCK_03_INTENT_EXECUTION](./BLOCK_03_INTENT_EXECUTION.md)
