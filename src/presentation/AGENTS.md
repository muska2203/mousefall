# Правила слоя Presentation

> Работая в `src/presentation/`, соблюдай эти правила. Они приоритетнее общих.

---

## Критически важно

- **Единственный мост** между UI и Simulation.
- **Не содержать игровую логику** — не считать урон, не решать, можно ли ходить.
- **Не мутировать `GameState` напрямую** — только через `simulation.dispatch()`.
- **Не импортировать `ui/`** — Presentation не зависит от способа отрисовки.
- **Не использовать browser API** (DOM, localStorage) — это ответственность UI.

---

## Ответственность

- Хранение сессионного состояния UI (выбранный тайл, режим ввода, автопуть)
- Перевод событий UI → команды Simulation
- Перевод дерева событий Simulation (`ExecutionNode`) → анимационные планы + combat log
- Управление автопутём
- **Оркестрация save/load** — запрос состояния у Simulation, serialize/deserialize, передача UI для записи

---

## Частые задачи

| Задача | Куда идти |
|--------|-----------|
| Добавить новое событие в анимацию | `animation/builders/<event>.ts` → зарегистрировать в `animation/index.ts` |
| Добавить новый скилл | `animation/skills/<abilityId>.ts` → зарегистрировать в `animation/skills/registry.ts` |
| Добавить строку в combat log | `logBuilder.ts` (или аналог) |
| Добавить сессионное состояние | `gameSession.ts` / `types.ts` |
| Изменить ViewModel | `types.ts` (тип `ViewModel`) + формирующий код |
| Добавить обработку UI-события | `gameSession.ts` |

---

## Публичный API Simulation (единственное, от чего зависит Presentation)

- `simulation.dispatch(action)`
- `simulation.preview(action)`
- `simulation.getState()`
- `simulation.generateMap()`

---

## Полная документация

- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
- [`docs/agents/TURN_FLOW.md`](../../docs/agents/TURN_FLOW.md) — ход игры
- [`docs/agents/SAVES.md`](../../docs/agents/SAVES.md) — система сохранений
- [`docs/architecture/DATA_FLOW.md`](../../docs/architecture/DATA_FLOW.md) — поток данных
