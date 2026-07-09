# Правила слоя Simulation

> Работая в `src/simulation/`, соблюдай эти правила. Они приоритетнее общих.

---

## Критически важно

- **Seeded RNG (`utils/rng.ts`)** — только для генерации мира (`mapgen`, `map-generation/*`, `floor-transition-planner`).
- **Runtime random (`utils/random.ts`)** — для игровой логики (контратака, горение, лут, ролл скиллов предметов). Не влияет на seed-детерминизм.
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
| Добавить/изменить игровой тег | `src/simulation/systems/tags/` (`tag-helpers.ts`, `tag-hierarchy.ts`, `weapon-tags.ts`) |
| Добавить/изменить тип урона | `src/simulation/systems/damage/damage-type-handlers.ts` + `core-types.ts` (`DamageType`) |
| Добавить исполнитель способности | `src/simulation/skills/` |
| Добавить обработчик входящего урона | `src/simulation/systems/world-reactions/` (проверяй теги через `hasTag`) |

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

## Теговая классификация и типы урона

- Игровые теги — это иерархические строки вида `a.b.c`. Родительские теги выводятся автоматически: `damage.physical.slashing` удовлетворяет проверке `damage.physical` и `damage`.
- Канонический способ классифицировать урон, доставку и эффекты — **теги**, а не `DamageType`.
- Основные хелперы: `hasTag`, `hasAllTags`, `hasAnyTag` (`systems/tags/tag-helpers.ts`); `expandTag`, `expandTags` (`systems/tags/tag-hierarchy.ts`).
- Теги оружия возвращает `getWeaponTags` (`systems/tags/weapon-tags.ts`). Безоружная атака имеет теги `attack.melee`, `target.single`, `delivery.unarmed`, `damage.physical.blunt`.
- **Тип урона (`DamageType` в `core-types.ts`) устаревает** и сохраняется для совместимости с существующими схемами контента и интентами. Новые механики должны опираться на теги:
  - физический урон — `damage.physical.{piercing,slashing,blunt}`;
  - магический урон — `damage.magical.{fire,electric,poison,frost}`.
- Броня применяется только к физическому урону (тег `damage.physical`). Магический урон игнорирует броню, если в обработчике не указано иное.
- Реакции мира (горение, контратака и др.) проверяют теги события, а не `damageType`.

## Детерминизм

- Одно начальное состояние + одна последовательность действий = один результат **геометрии уровня и начального спавна**.
- Генерация мира (карта, позиции врагов/предметов) — только через seeded RNG (`state.rng`).
- Игровые runtime-события (контратака, горение, лут, ролл скиллов предметов) используют `utils/random.ts` и не гарантируют повторяемость.
- Нет `Date.now()`, async-операций в игровой логике.
- Порядок обработки сущностей консистентен (сортировка по ID).

---

## Полная документация

- [`docs/agents/ACTION_SYSTEM.md`](../../docs/agents/ACTION_SYSTEM.md) — Action / Intent / Event
- [`docs/agents/TURN_FLOW.md`](../../docs/agents/TURN_FLOW.md) — ход игры
- [`docs/agents/AI_SYSTEM.md`](../../docs/agents/AI_SYSTEM.md) — AI врагов и тактические утилиты
- [`docs/agents/TESTING.md`](../../docs/agents/TESTING.md) — тестирование
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
