# Блок 6. Удаление старых action'ов и cleanup

## Цель

Удалить устаревшие action types (`PICKUP`, `OPEN_DOOR`, `CLOSE_DOOR`, `DESCEND`, `ASCEND`) и их handlers, обновить тесты и документацию.

## Контекст

Для выполнения блока нужно понимать:

- Результаты всех предыдущих блоков.
- Что внутренние intent types (`OPEN_DOOR`, `CLOSE_DOOR`, `PICK_UP`, `FLOOR_TRANSITION`) **оставляются**, потому что они используются `INTERACT` и другими механизмами (например, Dash skill).
- Что `Dash skill` порождает `OPEN_DOOR` intent напрямую — его не ломать.
- Где находятся старые тесты и как они устроены.
- Где находится `docs/agents/ACTION_SYSTEM.md`.

## Что нужно сделать

### 1. Удалить старые action types из `GameAction`

Удалить из union `GameAction`:

- `PickUpAction`
- `OpenDoorAction`
- `CloseDoorAction`
- `DescendAction`
- `AscendAction`

### 2. Удалить старые handlers

Удалить файлы:

- `src/simulation/systems/actions/pickup-action.ts`
- `src/simulation/systems/actions/door-action.ts`
- `src/simulation/systems/actions/floor-transition-action.ts`

Убрать их регистрацию из реестра action handlers.

### 3. Удалить старые тесты или перевести их на `INTERACT`

Для каждого старого теста решить:

- **Удалить**, если функционал полностью покрыт новыми тестами.
- **Переписать**, если тест проверяет важную логику (например, поведение двери, поднятие предмета, переход между этажами). В таком случае в тестах вместо старого action использовать `INTERACT`.

Тесты для пересмотра:

- `tests/unit/simulation/actions/pickup-action.test.ts`
- `tests/unit/simulation/door.test.ts`
- `tests/unit/simulation/floor-transition.test.ts` (если есть)
- `tests/unit/presentation/autoPath.test.ts`

### 4. Удалить упоминания старых action'ов в Simulation

Пройтись по коду Simulation и убрать проверки на старые action types, если они остались.

### 5. Обновить `docs/agents/ACTION_SYSTEM.md`

В чеклисте добавления нового action указать, что для объектных взаимодействий теперь используется `INTERACT`. Обновить примеры, если они есть.

### 6. Обновить основной план

После выполнения всех блоков обновить `docs/plans/UNIFIED_INTERACTION_ACTION.md`: поменять статус на «Выполнено» или «В процессе», отметить завершённые пункты.

### 7. Итоговое тестирование

Запустить полный набор тестов:

```bash
npm test
```

Убедиться, что:

- Все unit-тесты проходят.
- Все integration-тесты проходят.
- Игра запускается без ошибок.
- Взаимодействия с дверьми, предметами и лестницами работают корректно.

### 8. Проверить `Dash skill`

Убедиться, что `src/simulation/skills/executors/dashSkill.ts` всё ещё может порождать `OPEN_DOOR` intent, потому что этот intent type остаётся.

## Результат

После выполнения блока:

- Старые action types полностью удалены.
- Все объекты взаимодействуют через `INTERACT`.
- Внутренние intent types остались как строительные блоки.
- Все тесты проходят.
- Документация актуальна.

## Завершение

После этого блока задача считается выполненной.
