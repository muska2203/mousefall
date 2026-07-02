# Блок 4. Presentation и UI

## Цель

Перевести Presentation на использование `INTERACT` action: подсказки взаимодействия, автопуть, `moveOrAttack`, i18n.

## Контекст

Для выполнения блока нужно понимать:

- Результат Блока 1: `INTERACT` action существует и имеет стоимость 1 AP.
- Результат Блока 3: `INTERACT` корректно порождает intent'ы для всех типов объектов.
- Как работает `GameSession.buildInteractionOptions`.
- Как работает `AutoPathController`.
- Как работает `GameSession.moveOrAttack`.
- Где находятся i18n-ключи подсказок.
- Что `InteractionHint.tsx` и `GameField.tsx` принимают уже готовый `label` и `targetPosition`.

## Что нужно сделать

### 1. Добавить функцию `getInteractionHintKey` в Presentation

Создать чистую функцию, которая мапит `interactionId` в i18n-ключ:

```ts
const INTERACTION_HINT_KEYS: Record<string, string> = {
  open_door: 'components.interactionHint.openDoor',
  close_door: 'components.interactionHint.closeDoor',
  pickup: 'components.interactionHint.pickup',
  descend: 'components.interactionHint.descend',
  ascend: 'components.interactionHint.ascend',
};

export function getInteractionHintKey(interactionId: string): string {
  return INTERACTION_HINT_KEYS[interactionId] ?? `components.interactionHint.${interactionId}`;
}
```

### 2. Использовать `Simulation.findInteractableEntitiesAround`

Хелпер `findInteractableEntitiesAround` реализован в `@simulation/state` как чистая функция и доступен Presentation через публичный API `Simulation`:

```ts
const interactables = this.simulation!.findInteractableEntitiesAround(player, 1);
```

Функция перебирает сущности в радиусе Чебышёва и фильтрует по наличию `interactionKind`. Реализация находится в Simulation, потому что хелпер используется как внутри слоя симуляции (например, для AI и вспомогательных query), так и через публичный API Presentation.

### 3. Переписать `GameSession.buildInteractionOptions`

Заменить жёстко заданный набор опций на универсальный цикл:

```ts
const options: InteractionOption[] = [];

for (const entity of findInteractableEntitiesAround(state, player, 1)) {
  const interaction = resolveInteraction(state, entity, player);
  if (!interaction) continue;

  const action: GameAction = {
    type: 'INTERACT',
    entityId: player.id,
    targetId: entity.id,
  };

  const preview = this.simulation!.preview(action);
  if (!preview.valid) continue;

  const cost = this.simulation!.getActionCost(action);
  if (player.ap < cost) continue;

  options.push({
    kind: interaction.interactionId,
    action,
    targetPosition: { x: entity.x, y: entity.y },
    labelKey: getInteractionHintKey(interaction.interactionId),
    priority: getInteractionPriority(interaction.interactionId),
  });
}

return options.sort(...);
```

### 4. Добавить `getInteractionPriority`

Если приоритетов мало, можно сделать простую функцию:

```ts
const PRIORITIES: Record<string, number> = {
  pickup: 0,
  descend: 1,
  ascend: 1,
  open_door: 2,
  close_door: 2,
};
```

### 5. Обновить `AutoPathController`

#### Дверь

- Если дверь закрыта → `INTERACT` с `targetId` двери.
- Если дверь открыта → `MOVE` на клетку двери.

#### Интерактивные объекты (контейнеры, лестницы)

- Если актёр стоит на клетке с объектом → `INTERACT`.
- Если актёр рядом, но объект проходимый → сначала `MOVE` на клетку, на следующем шаге `INTERACT`.

#### Враг

- Остаётся `ATTACK`.

### 6. Обновить `GameSession.moveOrAttack`

При шаге в закрытую дверь вместо `OPEN_DOOR` отправлять `INTERACT`:

```ts
if (door && !door.isOpen) {
  this.dispatch({
    type: 'INTERACT',
    entityId: state.player.id,
    targetId: door.id,
  });
  return;
}
```

Приоритет остаётся: враг > дверь > ходьба.

### 7. Добавить i18n-ключи

Добавить в локали ключи:

- `components.interactionHint.openDoor`
- `components.interactionHint.closeDoor`
- `components.interactionHint.pickup`
- `components.interactionHint.descend`
- `components.interactionHint.ascend`

Обновить `src/i18n/schema.ts`, если он строго типизирован.

### 8. Проверить `InteractionHint.tsx` и `GameField.tsx`

Эти компоненты уже работают с `label` и `targetPosition` из ViewModel. Изменений быть не должно, если `InteractionHintViewModel` сохраняет структуру.

### 9. Написать тесты

Обновить `tests/unit/presentation/autoPath.test.ts`:

- Ожидать `type: 'INTERACT'` вместо `OPEN_DOOR`, `PICKUP`, `DESCEND`.
- Проверить, что открытая дверь проходится через `MOVE`.
- Проверить, что закрытая дверь открывается через `INTERACT`.
- Проверить, что контейнеры и лестницы активируются через `INTERACT`.

Добавить тесты на `GameSession.buildInteractionOptions`, если их нет.

## Результат

После выполнения блока:

- Игрок видит подсказки взаимодействия для всех интерактивных объектов.
- Автопуть использует `INTERACT`.
- `moveOrAttack` использует `INTERACT` для дверей.
- UI не содержит специфической логики для типов объектов.
- Старые action types всё ещё существуют в Simulation, но Presentation их больше не отправляет.

## Следующий блок

[BLOCK_05_REMOVE_AUTO_STAIR](./BLOCK_05_REMOVE_AUTO_STAIR.md)
