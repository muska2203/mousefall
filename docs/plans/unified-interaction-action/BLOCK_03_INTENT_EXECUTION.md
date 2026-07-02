# Блок 3. Выполнение intent'ов из `INTERACT`

## Цель

Научить `INTERACT` action handler в `resolve()` выбирать и порождать конкретные intent'ы, а также создать новый intent `FLOOR_TRANSITION` для перехода между этажами.

## Контекст

Для выполнения блока нужно понимать:

- Результат Блока 1: существует `INTERACT` action, `resolveInteraction`, handler-заглушка.
- Результат Блока 2: существует `FloorItemContainerEntity`.
- Как работают существующие intent executors (`door-intent-executor`, `pick-up-intent-executor`).
- Как происходит переход между этажами в текущей реализации.
- Что такое `computeFloorTransition` и какие sub-intent'ы он порождает.

## Что нужно сделать

### 1. Реализовать `resolve()` в `interact-action.ts`

В `resolve()` action handler получить цель через `targetId`, вызвать `resolveInteraction`, и в зависимости от `interactionId` вернуть конкретный intent:

#### Дверь

```ts
return [{
  type: 'OPEN_DOOR',
  entityId: action.entityId,
  targetPosition: { x: target.x, y: target.y },
}];
```

или

```ts
return [{
  type: 'CLOSE_DOOR',
  entityId: action.entityId,
  targetPosition: { x: target.x, y: target.y },
}];
```

#### Контейнер предмета

```ts
const container = target as FloorItemContainerEntity;
return [{
  type: 'PICK_UP',
  entityId: action.entityId,
  itemId: container.id,
  templateId: container.item.templateId,
}];
```

#### Лестница

```ts
return [{
  type: 'FLOOR_TRANSITION',
  entityId: action.entityId,
  direction: interaction.interactionId === 'descend' ? 'down' : 'up',
}];
```

### 2. Добавить `FloorTransitionIntent` в union `Intent`

```ts
export type FloorTransitionIntent = {
  type: 'FLOOR_TRANSITION';
  entityId: EntityId;
  direction: 'down' | 'up';
};
```

### 3. Создать `executeFloorTransitionIntent`

Создать intent executor, который делает то же, что сейчас делают `descendAction.execute` / `ascendAction.execute`:

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

### 4. Зарегистрировать `executeFloorTransitionIntent`

Добавить `'FLOOR_TRANSITION'` в реестр intent executors.

### 5. Обновить валидацию `interact-action.ts`

Убедиться, что `validate()` корректно проверяет:

- Дверь жива и в правильном состоянии.
- Контейнер предмета существует.
- Лестница существует и переход возможен по границам этажей.
- При закрытии двери нет препятствий на клетке.

### 6. Адаптировать существующие executors при необходимости

Проверить, что `executeOpenDoorIntent` / `executeCloseDoorIntent` корректно работают с `targetPosition`, полученным из `target.x / target.y`.

Проверить, что `executePickUpIntent` корректно работает с `FloorItemContainerEntity` (это было сделано в Блоке 2).

### 7. Написать тесты

Добавить тесты на:

- `interact-action.resolve` для дверей, контейнеров, лестниц.
- Полный flow: `INTERACT` → открытие двери.
- Полный flow: `INTERACT` → поднятие предмета.
- Полный flow: `INTERACT` → переход на другой этаж.
- `executeFloorTransitionIntent`.

## Результат

После выполнения блока:

- `INTERACT` action полностью функционален.
- Все целевые взаимодействия (двери, предметы, лестницы) работают через `INTERACT`.
- `FLOOR_TRANSITION` intent заменяет `DESCEND` / `ASCEND` action handlers.
- Старые action handlers (`pickup-action`, `door-action`, `floor-transition-action`) всё ещё существуют, но новые вызовы идут через `INTERACT`.

## Следующий блок

[BLOCK_04_PRESENTATION](./BLOCK_04_PRESENTATION.md)
