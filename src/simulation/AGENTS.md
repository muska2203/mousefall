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
| Добавить действие | `systems/actions/types.ts` → создать handler в `systems/actions/handlers/` → зарегистрировать |
| Добавить интент | `systems/intents/` → добавить executor |
| Добавить реакцию мира | `systems/world-reactions/` |
| Изменить ход | `simulation.ts`, метод `dispatch` |
| Изменить генерацию карт | `systems/mapgen.ts` |
| Добавить тип события | `types.ts` (union `GameEvent`) |

---

## Публичный API Simulation

- `dispatch(action)` — выполнить действие
- `preview(action)` — превью действия (для подсветки)
- `getState()` — получить текущее состояние (`Readonly<GameState>`)
- `generateMap()` — сгенерировать новую карту

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
- [`docs/agents/TESTING.md`](../../docs/agents/TESTING.md) — тестирование
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
