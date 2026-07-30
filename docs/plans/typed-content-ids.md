# План: типизация ID-параметров контента (enum-подход)

> **Статус:** фазы 1–2 выполнены (2026-07-30). Фаза 3 (каталог игровых тегов) — отдельная задача, см. набросок ниже.
> **Исполнитель:** агент в новой сессии. Обязательные предварительные чтения: `AGENTS.md`, `docs/agents/PROTOCOL.md`, `docs/agents/SYNC_STATUS.md`, `docs/agents/LAYERS.md`.

---

## Контекст (что уже сделано)

- Контент-пайплайн мигрирован с JSON на TypeScript: шаблоны — TS-модули в `src/content/templates/<категория>/*.ts` (`satisfies XTemplateInput`), сборка через `buildContent()` в `src/content/templates/index.ts` (Zod-парс, дефолты, проверка дублей id). См. `docs/agents/CONTENT.md` (`[STABLE]`).
- Zod-схемы и все типы шаблонов — `src/content/schemas.ts`. Input-типы (`z.input<>`) для авторства — в конце того же файла.
- Уже типизированы через `z.enum`: `ItemTemplate.type/rarity`, `ConsumableEffect.effect`, `equipModifiers.stat/op`, `statusCategory`, `layer`, `direction`, `interactionKind`. Этот план закрывает оставшиеся «строковые дыры».
- Проверки после изменений: `npm run validate` (typecheck + i18n + content), `npm test`, `npm run test:perf`.

## Архитектурное ограничение (ключевое)

Из `docs/agents/LAYERS.md`: `content/ → (ничего)`, `simulation/ → content/`. Поэтому **все ID-константы и union-типы живут в слое content** (новый файл `src/content/ids.ts`, чистый TypeScript без Zod), а реестры simulation их потребуют. Обратный импорт (`schemas.ts` ← simulation) запрещён — он создал бы цикл, т.к. simulation уже импортирует `@content/schemas`.

Схемы подключают константы через `z.enum(CONST_ARRAY)` — `zod` в `schemas.ts` уже есть.

---

## Фаза 1: три enum-параметра

### 1.1. Новый файл `src/content/ids.ts`

```ts
/**
 * Замкнутые наборы строковых идентификаторов, на которые ссылаются шаблоны.
 * Единственный источник истины: схемы (z.enum) и реестры simulation
 * типизируются от этих констант.
 */

/** Формулы урона оружия (реализации — src/simulation/systems/stats/weapon-formulas.ts). */
export const WEAPON_FORMULA_IDS = ['unarmed', 'club', 'dagger', 'staff', 'sword'] as const;
export type WeaponFormulaId = typeof WEAPON_FORMULA_IDS[number];

/** Стратегии ИИ (реализации — src/simulation/ai/*-strategy.ts). */
export const AI_STRATEGY_IDS = ['hunter', 'simple-boss'] as const;
export type AiStrategyId = typeof AI_STRATEGY_IDS[number];

/** Стратегии генерации карты (реализации — src/simulation/systems/map-generation/*-strategy.ts). */
export const MAP_STRATEGY_IDS = ['tree'] as const;
export type MapStrategyId = typeof MAP_STRATEGY_IDS[number];
```

### 1.2. `weapon.damageFormulaId`

- **Сейчас:** `damageFormulaId: z.string().min(1)` в `WeaponStatsSchema` (`src/content/schemas.ts:96`). Опечатка молча откатывается на `unarmed` в `getWeaponDamage` (`src/simulation/systems/stats/weapon-formulas.ts:59`).
- **Реестр:** `weaponFormulas` (`weapon-formulas.ts:18`) — ключи `unarmed | club | dagger | staff | sword`.
- **Шаги:**
  1. `schemas.ts`: `damageFormulaId: z.enum(WEAPON_FORMULA_IDS)`.
  2. `weapon-formulas.ts`: `Record<WeaponFormulaId, WeaponFormula>`; `registerWeaponFormula(id: WeaponFormulaId, ...)`; `hasWeaponFormula(id: string)` оставить string (вызывается из валидации правил с непроверенными данными).
  3. Проверить использования `registerWeaponFormula` (задокументирована «для модов», моддинг отменён) — если вызовов нет, удалить функцию.
  4. Fallback `?? weaponFormulas.unarmed` в `getWeaponDamage` оставить (защита рантайм-данных из GameState), но комментарий уточнить: для шаблонов невалидный id теперь невозможен.
- **Внимание:** `validateContentRuleSemantics` (`src/simulation/content-rules/validation.ts:309-319`) проверяет `damageFormulaId` в эффектах правил — не трогаем.

### 1.3. `aiStrategyId`

- **Сейчас:** `aiStrategyId: z.string().min(1).optional()` в `EntityTemplateSchema` (`schemas.ts:71`).
- **Реестр:** `registerStrategy('hunter', ...)` (`src/simulation/ai/hunter-strategy.ts:23`), `registerStrategy('simple-boss', ...)` (`src/simulation/ai/simple-boss-strategy.ts:18`); реестр — `Record<string, AIStrategy>` (`strategy-registry.ts:35`).
- **Шаги:**
  1. `schemas.ts`: `aiStrategyId: z.enum(AI_STRATEGY_IDS).optional()`.
  2. `strategy-registry.ts`: `registerStrategy(id: AiStrategyId, ...)` — добавление новой стратегии потребует расширить `AI_STRATEGY_IDS`, компилятор подскажет. `getStrategy(id: string)` оставить string (из GameState приходит непроверенная строка; бросает на unknown).
  3. Проверить шаблоны `src/content/templates/entities/*.ts`: все `aiStrategyId` должны входить в набор (на момент плана: `hunter`, `simple-boss`).

### 1.4. `maps.strategy`

- **Сейчас:** `strategy: z.string().min(1).default('tree')` в `MapParamsSchema` (`schemas.ts:284`).
- **Диспетчер:** `getMapGenerationStrategy(params.strategy)` (`src/simulation/systems/mapgen.ts:45`), реестр — `src/simulation/systems/map-generation/strategy-registry.ts`; в проекте одна стратегия `tree`.
- **Шаги:**
  1. `schemas.ts`: `strategy: z.enum(MAP_STRATEGY_IDS).default('tree')`.
  2. Типизировать реестр генерации: регистрация по `MapStrategyId`.

### 1.5. Проверки фазы 1

- `npm run typecheck` — мок-шаблоны в `tests/fixtures/gameState.ts` и unit-тестах должны компилироваться (если где-то выдуманный formula/strategy id — привести к реальному).
- `npm test`, `npm run validate:content`.
- Обновить: `docs/agents/CONTENT.md` (упомянуть `ids.ts`), `docs/recipes/add-weapon.md` (поле `damageFormulaId` — теперь enum), `docs/recipes/add-enemy.md` (`aiStrategyId`), `docs/recipes/add-map.md` (`strategy`), `src/content/AGENTS.md` (структура слоя), `docs/agents/GLOSSARY.md` при необходимости. Запись в историю `SYNC_STATUS.md`.

---

## Фаза 2: валидация перекрёстных ссылок между шаблонами

Это не enum-типизация (ссылки на id других шаблонов union-типами не покрыть без порочных зависимостей), а расширение `validate-content`. Сейчас проверяются только `ruleIds` — несуществующий id в `lootTable` всплывёт только в рантайме при дропе.

### 2.1. Новый модуль `src/content/validate-references.ts`

Чистая функция `validateContentReferences(content: LoadedContent): ContentReferenceError[]` (без бросков — собирает все ошибки, как `validateContentRuleSemantics`). Проверки:

| Поле шаблона | Должно существовать в |
|---|---|
| `entities[].equipment.weapon/armor/amulet` | `items` |
| `entities[].abilities[]` | `abilities` |
| `entities[].lootTable[].templateId` | `items` |
| `players[].starterEquipment[]` | `items` |
| `maps[].enemyPool[]` | `entities` |
| `maps[].itemPool[]` | `items` |
| `statuses[].mutuallyExclusiveWith[]/blockedBy[]` | `statuses` |
| `tileEffects[].canHaveStatus[]/durationDecreasesWhenHasStatus[]` | `tileEffectStatuses` |
| `doors[].canHaveStatus[]`, `props[].canHaveStatus[]` | `statuses` |
| `items[].consumable.tileEffectType` | `tileEffects` |
| `items[].grantedAbilities[]`, `items[].abilityPool[].abilityId` | `abilities` |

(Состав сверить со схемами в `schemas.ts` при исполнении — таблица составлена по состоянию на 2026-07-30.)

### 2.2. Подключение

- `scripts/validate-content.ts`: вызвать после сборки контента, печатать ошибки, код выхода 1 при наличии.
- `src/bootstrap.ts`: вызвать после `initRegistry(buildContent())` — fail-fast при старте, как валидация правил.
- Тест: негативный кейс по образцу `tests/integration/validate-content.test.ts` (клонировать контент, сломать ссылку, ожидать ошибку с id).

### 2.3. Проверки фазы 2

- `npm run validate:content` на текущем контенте — код 0 (если найдёт реальные битые ссылки — исправить контент отдельным коммитом и зафиксировать в сводке).
- `npm test`. Обновить `docs/agents/CONTENT.md` (список проверок validate), запись в `SYNC_STATUS.md`.

---

## Фаза 3 (отдельная задача, только набросок): каталог игровых тегов

Самая большая «строковая дыра»: `GameplayTag = string` (`src/simulation/core-types.ts:28`). Опечатка в теге молча ломает срабатывание правил/условий.

- Теги используются и шаблонами (`tags`, `damageTag` в схемах), и кодом simulation — каталог должен лежать в content-слое: `src/content/gameplay-tags.ts` с `GAMEPLAY_TAGS = [...] as const` и `type GameplayTagLiteral = typeof GAMEPLAY_TAGS[number]`; `core-types.ts` реэкспортирует/подменяет `GameplayTag`.
- Состав: `damage.*`, `attack.*`, `target.*`, `delivery.*`, `status.*`, `flammable`, `ground` и пр. — собрать полный инвентарь grep'ом по `src/content/templates/`, `src/simulation/content-rules/`, `src/simulation/systems/tags/`.
- Иерархия (`damage.physical.slashing` → родитель `damage.physical`) продолжает выводиться из строк (`tag-hierarchy.ts`) — меняется только тип.
- Затронет много файлов simulation. Оформлять отдельным планом после фаз 1–2, когда подход `ids.ts` обкатан.

---

## Что осознанно НЕ делаем

- `ruleIds` в union-тип — создаст типовую зависимость `content → simulation` (правила живут в `src/simulation/content-rules/`); рантайм-валидация `validateContentRuleReferences` уже покрывает.
- `propKind`, `spriteId`, `icon`, `portraitImg` — свободные строки, enum только помешает росту.
- Формулы скиллов (`damageFormulas` в `src/simulation/skills/damageFormula.ts`) — на них ссылается только код executors, шаблоны их не используют.

## Риски

- Мок-контент в тестах с выдуманными id формул/стратегий — ловится typecheck'ом, чинится приведением к реальным id.
- Расширение наборов (новая формула/стратегия) теперь требует правки `ids.ts` — это намеренно: одна точка расширения вместо рассредоточенных строк.
- Если фаза 2 найдёт битые ссылки в текущем контенте — это пре-existing баги контента, чинить отдельно и явно.
