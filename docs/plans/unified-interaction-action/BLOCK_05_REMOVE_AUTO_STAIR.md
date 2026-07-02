# Блок 5. Удаление авто-спуска по лестнице

## Цель

Убрать автоматический переход на другой этаж при наступании на лестницу. Переход должен выполняться только явно через `INTERACT`.

## Контекст

Для выполнения блока нужно понимать:

- Результат Блока 3: переход по лестнице работает через `INTERACT` + `FLOOR_TRANSITION`.
- Где находится `stairsTransitionReaction`.
- Где регистрируются world reactions.
- Какие intent/event types связаны с автоспуском.
- Где в Presentation обрабатывается `STAIR_EXIT_TRIGGERED`.

## Что нужно сделать

### 1. Удалить `stairsTransitionReaction`

Найти world reaction, которая срабатывает на `ENTITY_MOVED` и порождает `TRIGGER_STAIR_EXIT`. Удалить её.

Удалить регистрацию этой реакции в общем списке world reactions.

### 2. Удалить `TRIGGER_STAIR_EXIT` intent

Удалить тип `TriggerStairExitIntent` из union `Intent`.

Удалить `executeTriggerStairExitIntent`.

Удалить регистрацию executor'а для `TRIGGER_STAIR_EXIT`.

### 3. Удалить `STAIR_EXIT_TRIGGERED` event

Удалить тип `StairExitTriggeredEvent` из union `GameEvent`.

### 4. Убрать обработку `STAIR_EXIT_TRIGGERED` в Presentation

Найти в `GameSession` места, где Presentation реагирует на `STAIR_EXIT_TRIGGERED` и автоматически вызывает `DESCEND` / `ASCEND`. Удалить эту логику.

### 5. Убедиться, что UI показывает подсказку на лестнице

Проверить, что `buildInteractionOptions` генерирует подсказку `descend` / `ascend`, когда игрок стоит на клетке с лестницей. Без этого игрок не поймёт, как спуститься.

### 6. Написать тесты

- Проверить, что наступание на лестницу не вызывает авто-переход.
- Проверить, что `INTERACT` с лестницей вызывает переход.
- Удалить или обновить старые тесты `stairs-reaction.test.ts`.

## Результат

После выполнения блока:

- Автоспуск по лестнице полностью удалён.
- Переход между этажами возможен только через `INTERACT`.
- `TRIGGER_STAIR_EXIT` и `STAIR_EXIT_TRIGGERED` больше не существуют.
- UI гарантированно показывает подсказку на лестнице.

## Следующий блок

[BLOCK_06_CLEANUP](./BLOCK_06_CLEANUP.md)
