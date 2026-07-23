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
| Добавить/изменить тайловый эффект | `docs/agents/TILE_EFFECTS.md` → `public/content/tile-effects/`, `src/simulation/content-rules/rules.ts`, `src/simulation/skills/executors/` |
| Добавить реакцию мира | `systems/world-reactions/` |
| Изменить ход | `simulation.ts`, метод `dispatch` |
| Изменить генерацию карт | `systems/mapgen.ts` (диспетчер) → `systems/map-generation/*-strategy.ts` |
| Добавить тип события | `core-types.ts` (union `GameEvent`) |
| Добавить/изменить игровой тег | `src/simulation/systems/tags/` (`tag-helpers.ts`, `tag-hierarchy.ts`, `weapon-tags.ts`) |
| Добавить/изменить тип урона | `src/simulation/systems/damage/damage-handlers.ts` + `src/simulation/systems/tags/weapon-tags.ts` + `src/simulation/systems/stats/effective-stats.ts` + `src/content/schemas.ts` |
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
- Канонический способ классифицировать урон, доставку и эффекты — **теги**. Тип урона задаётся только через иерархические теги (`damage.physical.*`, `damage.magical.*`).
- Основные хелперы: `hasTag`, `hasAllTags`, `hasAnyTag`, `mergeDamageIntentTags` (`systems/tags/tag-helpers.ts`); `expandTag`, `expandTags` (`systems/tags/tag-hierarchy.ts`). `mergeDamageIntentTags` объединяет теги, гарантируя ровно один damage.*-тег, — используется для формирования DAMAGE-интентов; приоритет у первого встреченного damage-тега.
- Теги оружия возвращает `getWeaponTags` (`systems/tags/weapon-tags.ts`). Безоружная атака имеет теги `attack.melee`, `target.single`, `delivery.weapon`, `delivery.unarmed`; её единственный тип урона — `damage.physical.blunt` (через `UNARMED_DAMAGE_DISTRIBUTION`).

### Распределение урона по оружию

Каждое оружие описывает распределение типов урона через массив `damageDistribution` в `WeaponStatsSchema`. Каждая запись содержит:

```ts
{ damageTag: GameplayTag; weight: number }
```

- `damageTag` — полный тег типа урона, например `damage.physical.slashing` или `damage.magical.fire`.
- `weight` — множитель веса этого типа. Веса не нормализуются; запись с максимальным весом считается основным типом оружия.
- Как минимум одна запись должна иметь `weight > 0`.

### Хелперы урона

Расположены в `systems/tags/weapon-tags.ts` и `systems/stats/effective-stats.ts`:

- `getEffectiveWeaponDamage(entity: Entity): number` — итоговый урон экипированного оружия после модификаторов.
- `getWeaponDamageDistribution(entity: Entity): Array<{ damageTag: GameplayTag; weight: number }>` — распределение типов урона экипированного оружия (для безоружной атаки возвращает `damage.physical.blunt` с весом 1.0).
- `getPrimaryDamageTag(entity: Entity): GameplayTag` — основной тег урона оружия, запись с максимальным `weight`.
- `getWeaponWeightForTag(entity: Entity, tag: GameplayTag): number` — вес указанного тега урона для экипированного оружия; если тег отсутствует — возвращает 0.

### Физический и магический урон

- Физический урон — `damage.physical.{piercing,slashing,blunt}`.
- Магический урон — `damage.magical.{fire,electric,poison,frost}`.
- Броня применяется только к физическому урону (тег `damage.physical`). Магический урон игнорирует броню, если в обработчике не указано иное.
- Реакции мира (горение, контратака и др.) проверяют теги события.

### Способности и требования к оружию

- `damageTag` в шаблоне способности задаёт тип урона для ability-based скиллов (например, `damage.magical.fire` у `fireball`).
- `requiredWeaponTags` проверяет теги экипированного оружия в `validate` `useAbilityAction` (`systems/actions/use-ability-action.ts`). Если оружие не удовлетворяет требованиям, скилл недоступен.
- Weapon-based скиллы обычно используют `getEffectiveWeaponDamage` и/или `getPrimaryDamageTag`/`getWeaponWeightForTag` для расчёта урона от текущего оружия.

---

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
