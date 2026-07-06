# План: отделение игрового рандома от seeded RNG

## Цель

Создать отдельный источник случайности для игровой логики (не связанный с `state.rng`), чтобы seeded RNG использовался только при генерации мира (mapgen). Игровые события (контратака, поджог, лут, ролл скиллов предметов) должны использовать обычный рандом на базе `Math.random()`.

## Граница: что остаётся на seeded RNG

- `src/simulation/systems/mapgen.ts`
- `src/simulation/systems/map-generation/*`
- `src/simulation/systems/floor-transition-planner.ts` (переносит rngState между этажами ради mapgen)
- `src/utils/rng.ts` (сам модуль seeded RNG остаётся без изменений)

## Что переезжает на обычный рандом

1. **`src/utils/random.ts` (новый модуль)**
   - `randomFloat(): number` — [0, 1)
   - `randomInt(min, max): number` — [min, max]
   - `randomChance(percent): boolean` — 0..100
   - `randomPick<T>(array): T`
   - `randomShuffle<T>(array): T[]`
   - Все функции используют `Math.random()` и не принимают/не мутируют состояние.

2. **`src/utils/loot.ts`**
   - `rollLootDropCount(table, rng)` → `rollLootDropCount(table)` (убрать аргумент `rng`, использовать `randomFloat`)
   - `calculateLootDrops(table, count, rng)` → `calculateLootDrops(table, count)` (убрать аргумент `rng`, использовать `randomFloat`)
   - Обновить JSDoc: убрать упоминания seeded RNG.

3. **`src/simulation/systems/item-ability-roll.ts`**
   - `rollItemAbility(template, rng)` → `rollItemAbility(template)` (убрать аргумент `rng`, использовать `randomFloat`)
   - Обновить JSDoc.

4. **`src/simulation/systems/inventory-factory.ts`**
   - `rollItemAbility(template, state.rng)` → `rollItemAbility(template)`
   - Обновить комментарий про детерминизм.

5. **`src/simulation/systems/world-reactions/post-death-loot-reaction.ts`**
   - `rollLootDropCount(..., state.rng)` → `rollLootDropCount(...)`
   - `calculateLootDrops(..., state.rng)` → `calculateLootDrops(...)`

6. **`src/simulation/systems/world-reactions/fire-damage-reaction.ts`**
   - `rngChance(state.rng, 10)` → `randomChance(10)`
   - Импорт заменить с `@utils/rng` на `@utils/random`.

7. **`src/simulation/systems/actions/attack-action.ts`**
   - `rngChance(state.rng, 50)` → `randomChance(50)`
   - Импорт заменить с `@utils/rng` на `@utils/random`.
   - Это также устранит баг: `preview()` больше не будет мутировать `state.rng`.

## Обновление тестов

- `tests/unit/utils/loot.test.ts` — убрать передачу `rng`, проверять, что результат из допустимого набора (вместо предсказуемого значения).
- `tests/unit/simulation/systems/item-ability-roll.test.ts` — убрать `rng`, заменить seeded-проверки на проверку диапазона/вхождения в пул.
- `tests/unit/simulation/post-death-loot-reaction.test.ts` — заменить моки `state.rng` на моки функций из `@utils/random` (или `Math.random`).
- `tests/unit/simulation/world-reactions/fire-damage-reaction.test.ts` — заменить `vi.spyOn(rngModule, 'rngChance')` на `vi.spyOn(randomModule, 'randomChance')`.
- `tests/unit/simulation/skills/counterattack.test.ts` — заменить `vi.spyOn(rngModule, 'rngChance')` на `vi.spyOn(randomModule, 'randomChance')`.

## Проверка

1. `npm run typecheck`
2. `npm test -- --run`
3. Убедиться, что `state.rng` больше не используется в `src/simulation/systems/actions/`, `src/simulation/systems/world-reactions/` (кроме mapgen), `src/utils/loot.ts`, `src/simulation/systems/inventory-factory.ts`, `src/simulation/systems/item-ability-roll.ts`.

## Дополнительно

- Обновить `src/utils/README.md`, если там описываются seeded-функции как единственный источник рандома.
- Обновить комментарии в `starting-equipment.ts`, убрав упоминание детерминизма через `state.rng` (оно теперь обеспечивается только геометрией уровня, а не содержимым предметов).
