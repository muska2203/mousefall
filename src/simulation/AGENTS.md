# Правила слоя Simulation

> Работая в `src/simulation/`, соблюдай эти правила. Они приоритетнее общих.

---

## Критически важно

- **Никаких `Math.random()`** — только `createRNG()` из `utils/rng.ts`.
- **Headless** — никаких browser API, React, PixiJS, DOM.
- **Состояние мутируемое** внутри функций, но функции должны возвращать события через `ExecutionBuilder`.
- **Не импортировать** ничего из `ui/`, `presentation/`.

---

## Частые задачи

| Задача | Куда идти |
|--------|-----------|
| Добавить действие | `core-types.ts` (union `GameAction`) → создать handler в `systems/actions/` → зарегистрировать в `simulation.ts` |
| Добавить интент | `systems/intents/` → добавить executor |
| Добавить/изменить AI-стратегию | `docs/agents/AI_SYSTEM.md` → `src/simulation/ai/tactics/` для утилит, `src/simulation/ai/*-strategy.ts` для стратегии |
| Добавить debug-действие | `systems/actions/debug-*.ts` → зарегистрировать в `simulation.ts`. Должно проверять флаг debug-режима. |
| Добавить реакцию мира | `systems/world-reactions/` |
| Изменить ход | `simulation.ts`, метод `dispatch` |
| Изменить генерацию карт | `systems/mapgen.ts` (диспетчер) → `systems/map-generation/*-strategy.ts` |
| Добавить тип события | `core-types.ts` (union `GameEvent`) |

---

## Публичный API Simulation

- `dispatch(action)` — выполнить действие
- `step()` — выполнить следующую системную фазу или одно действие AI
- `preview(action)` — превью действия (для подсветки и проверки доступности)
- `getActionCost(action)` — получить стоимость действия в AP
- `getState()` — получить текущее состояние (`Readonly<GameState>`)
- `generateMap(params)` — сгенерировать новую карту
- `regenerateMap()` — перегенерировать текущий этаж (debug)
- `setDebugEnabled(enabled)` — включить/выключить debug-режим для чит-действий
- `getPlayerStats()` — рассчитанные характеристики игрока
- query-методы способностей, pathfinding'а и взаимодействий

Также из `@simulation/simulation` реэкспортируются read-only хелперы запросов к состоянию:
`findFirstAttackableEntityAt`, `findAllEntitiesAt`, `findStairsAt`.

---

## Детерминизм

- Одно начальное состояние + одна последовательность действий = один результат.
- Вся случайность только через seeded RNG.
- Нет `Date.now()`, `Math.random()`, async-операций.
- Порядок обработки сущностей консистентен (сортировка по ID).

---

## Полная документация

- [`docs/agents/ACTION_SYSTEM.md`](../../docs/agents/ACTION_SYSTEM.md) — Action / Intent / Event
- [`docs/agents/TURN_FLOW.md`](../../docs/agents/TURN_FLOW.md) — ход игры
- [`docs/agents/AI_SYSTEM.md`](../../docs/agents/AI_SYSTEM.md) — AI врагов и тактические утилиты
- [`docs/agents/TESTING.md`](../../docs/agents/TESTING.md) — тестирование
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
