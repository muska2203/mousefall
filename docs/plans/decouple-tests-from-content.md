# План: Отвязка тестов от контентных данных

> Статус: **выполнен** (2026-08-07).
> Основание: требование пользователя — тесты не должны зависеть от наполнения контентных шаблонов и балансных чисел, иначе любая балансная правка ломает тесты. Триггер: падение `relicViewModel.test.ts` после правки `rarity` в шаблонах реликвий.

---

## Принятые решения (утверждены пользователем 2026-08-07)

- **Объём:** отвязка от шаблонов, текстов, реестра **и от чисел правил** (`src/simulation/content-rules/rules.ts`, мировые правила). Интеграционные сценарии класса C (реальные id как фикстуры, assert'ится механика — poison/crit/blunt-daze/salamander и др.) **не трогаем**: они не ломаются при балансных правках.
- **Тесты, цель которых — сами шаблоны:** остаётся только структурная Zod-валидация; data-asserts (значения полей, размеры PNG) удаляются. Корректность реального контента охраняет `scripts/validate-content.ts`.

## Принципы рефакторинга

- Механика проверяется на синтетических фикстурах и тестовых правилах. Образцы в проекте: `tests/integration/loot-drop-cycle.test.ts`, `tests/integration/equipment-ability-cycle.test.ts`, `tests/integration/content-rule-sources.test.ts` + `tests/fixtures/content-rules.ts` (`withContentRules`/`withWorldContentRules`).
- Значения в assert'ах должны происходить из фикстур самого теста, а не из `src/content/**` / `rules.ts` / мировых правил.
- Поведение движка не меняется — это refactor, не system_design. Продакшен-код трогаем только если без этого отвязка невозможна (не ожидается).

## Аудит (факты, 2026-08-07)

Глобальный setup (`tests/setup/vitest-env.ts`) поднимает **мок-реестр** `createObjectContent()`, не реальный контент; реальный `initRegistry(buildContent())` каждый тест поднимает сам. Per-collection override в `src/content/registry.ts` нет — подмена только целиком через `initRegistry`. Для правил есть `setContentRulesOverride`/`setWorldContentRulesOverride` и обёртки `withContentRules`/`withWorldContentRules` с авто-откатом.

Жёстко зависимые файлы (класс A — ломаются при балансной правке):
1. `tests/unit/presentation/relicViewModel.test.ts` — реальный `buildContent()`, rarity, тексты, состав ruleIds, `statModifiers` (−5 maxHp).
2. `tests/unit/presentation/relicEffects.test.ts` — реальные правила и точные строки из `src/content/texts/{ru,en}/rules.ts`.
3. `tests/unit/simulation/content-rules/relic-rules.test.ts` — числа реальных правил (длительности, множители, бонусы) + describe «на реальном контенте» (жёсткий список 8 id, `statModifiers` шаблонов).
4. `tests/unit/content/relic-registry.test.ts:129-149` — describe на реальном контенте: `flavorText`, `toHaveLength(8)`.
5. `tests/integration/tile-effects/oil-burning-cycle.test.ts`, `ability-sources-cycle.test.ts` — точные длительности oil/water/burning из шаблонов.
6. `tests/integration/tile-effects/burning.test.ts` — точный урон тика (−3 HP) из мирового правила + длительность burning.
7. `tests/unit/content/cat-guardian-template.test.ts` — `placement.scale === 1.2`, размер PNG 128×128.

---

## Фаза 1. Unit: presentation и content

- [x] **1.1 `relicViewModel.test.ts`:** перевести на синтетический реестр (`initRegistry` с мок-шаблонами реликвий и нужными текстами — выяснить по коду, как собирается локализация, и подменить на том же уровне; образец моков — локальный `mockRelicTemplate` из `relic-registry.test.ts:25-43`). Assert'ить механику view-модели (группировка, порядок, перенос полей, построение effects, frameUrl по rarity фикстуры) со значениями из фикстур. После рефакторинга тест должен быть зелёным независимо от `rarity` реальных шаблонов.
- [x] **1.2 `relicEffects.test.ts`:** синтетические правила через `withContentRules`/override + собственные тексты правил (или мок уровня локализации). Убрать зависимость от строк `src/content/texts/**` и реальных `relic_*` ruleIds.
- [x] **1.3 `relic-registry.test.ts`:** удалить describe «реальный контент» (129-149) или перевести на синтетику; `toHaveLength(8)` убрать в любом случае. Синтетические части (45-127) не трогать.
- [x] **1.4 `cat-guardian-template.test.ts`:** убрать `placement.scale === 1.2` и проверку PNG 128×128; оставить только Zod-валидацию шаблонов. Заодно проверить `player-template.test.ts` — если есть data-asserts, убрать (структурные проверки вида `maxAp > 0` оставить).

## Фаза 2. Unit: правила реликвий

- [x] **2.1 `relic-rules.test.ts`:** переписать на тестовые правила (`tests/fixtures/content-rules.ts`, `withContentRules`): движок (стаки, `rebuildActiveRules`, модификаторы, триггеры) проверяется правилами, определёнными в самом тесте, — числа из фикстур. Удалить describe «шаблоны реликвий на реальном контенте» (asserts `statModifiers` реальных шаблонов и жёсткий список 8 id) — данные шаблонов охраняет `validate-content.ts` + схемная валидация.
- [x] **2.2** Убедиться, что покрытие механики не просело: каждая удалённая проверка механики (не данных!) должна иметь эквивалент на синтетике; проверки, смысл которых был «в шаблоне X записано число Y», не переносятся.

## Фаза 3. Integration: tile-effects

- [x] **3.1 `oil-burning-cycle.test.ts`, `ability-sources-cycle.test.ts`:** заменить точные длительности (oil 5, water 4, burning 3) на значения синтетических шаблонов (свой `initRegistry` с мок-tile-effects, образец — `initObjectContentRegistry` в `tests/fixtures/gameState.ts`) либо на relational asserts, если точное значение не суть теста.
- [x] **3.2 `burning.test.ts`:** урон тика (−3 HP) идёт из мирового правила — перевести на тестовое мировое правило через `withWorldContentRules` с известным процентом фикстуры; длительность burning — из мок-шаблона статуса. Проверка связки «реальное правило горения работает» осознанно жертвуется (решение пользователя: механика на синтетике).

## Фаза 4. Финал

- [x] **4.1 Прогоны:** `npm run typecheck`; `npx vitest run` (вся suite — включая ранее красный `relicViewModel.test.ts`, теперь должен быть зелёным при текущих шаблонах с `rarity: common`); `npx tsx scripts/validate-content.ts`; `npx tsx scripts/validate-i18n.ts`.
- [x] **4.2 Проверка-возврат:** grep оставшихся упоминаний реальных id/чисел в переделанных файлах; убедиться, что класс C не тронут.
- [x] **4.3 Документация:** `docs/agents/TESTING.md` — добавить принцип «тесты не зависят от балансных данных контента: значения — из фикстур, реальный контент охраняет validate-content»; запись в историю `docs/agents/SYNC_STATUS.md` (2026-08-07); журнал и чекбоксы этого плана.
- [x] **4.4** Отчёт пользователю; коммит — только по явной просьбе.

---

## Журнал прогресса

| Дата | Запись |
|---|---|
| 2026-08-07 | План создан по итогам аудита. Решения пользователя: объём «шаблоны + тексты + числа правил», template-тесты — только схема, сценарии класса C не трогаем. |
| 2026-08-07 | Фазы 1–3 выполнены: presentation-тесты на мок-реестре и подмене `texts/lookup`, `relic-rules.test.ts` на тестовых правилах, реальные describe удалены, tile-effects integration на новой фикстуре `tests/fixtures/tile-effects.ts`. Фаза 4: все прогоны зелёные (typecheck, vitest 178 файлов/1492 теста, validate-content, validate-i18n); принцип добавлен в `TESTING.md`, запись — в `SYNC_STATUS.md`. Нюанс: фикстуре tile-effects потребовались синтетические шаблоны статусов сущностей (oiled/wet/burning) — без них `resolveStatusBatch` схлопывал одновременные APPLY_STATUS в категорию 'generic' и терял burning. Отладочный `debug-burning.test.ts` удалён как рабочий мусор. |
