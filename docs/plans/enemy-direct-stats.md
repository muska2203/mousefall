# План: прямые статы врагов вместо экипировки (вариант C)

> **Статус:** реализован 2026-08-28 (этапы 1–4). Утверждён пользователем в диалоге 2026-08-28 (выбран вариант C из анализа экипировки врагов; атака босса — сохранить текущую {1,2}).
>
> **Источники:** анализ реализации экипировки врагов (сессия 2026-08-28), [`docs/game-design/equipment-modifiers-concept.md`](../game-design/equipment-modifiers-concept.md) §4, [`src/simulation/AGENTS.md`](../../src/simulation/AGENTS.md) (аффиксы, дальность атаки).
>
> **Формат работы:** последовательная реализация по этапам; после каждого этапа — `npm run typecheck` + тесты изменённой области.

---

## Проблема

Боевые данные врага размазаны по 3–4 файлам: шаблон сущности (HP, статы, AI), шаблоны предметов (урон, броня), модификаторы предметов (фирменные свойства), `grantedAbilities` предметов (способности). Экипировка врагов — фикция: экземпляров нет, аффиксы не роллятся, снять/подобрать нельзя, в UI не отображается, дальний бой планируется через способности, а не через оружие. Ради 4 врагов существуют 5 служебных шаблонов предметов + 2 enemy-only модификатора.

## Скоуп

Входит:
1. Новые поля `EntityTemplateSchema`: `attack` (профиль базовой атаки), `armor`, `modifiers` — вместо `equipment`.
2. Миграция 4 шаблонов врагов на прямые статы (с сохранением текущего поведения).
3. Ветки врага в рантайме: `createEnemy`, резолверы статов/тегов/дальности, `rebuildActiveRules`.
4. Удаление вражеских шаблонов оружия `cat_claw_*` и вражеских веток кода.
5. Обновление тестов, валидации контента, документации.

## Сознательно не входит

- Экипировка/инвентарь игрока и вся аффиксная машинерия экземпляров — без изменений.
- `cat_guardian_maul` и `cat_guardian_plate` как игроковские предметы — **остаются** (дроп босса через `lootTable`).
- Дальнобойные враги и позиционная атака AI — реализуются через способности (ability-based виды с `range`), отдельной задачей.
- Балансный проход (roadMap 1.4) — числа не пересматриваются, только переносятся.

## Дизайн-решения (утверждены в диалоге)

- **Прямые поля в шаблоне сущности.** `attack` структурно совпадает с `WeaponStatsSchema` (`damage {min,max}`, `range`, `minRange`, `damageDistribution`, `tags`) — схема переиспользуется (экспортируется под общим именем, например `AttackProfileSchema`). Поле обязательное (fail fast, все враги имеют атаку; NPC не существуют).
- **`armor: number`** (int ≥ 0, default 0) — базовая броня врага напрямую.
- **`modifiers: string[]`** — ID существующих шаблонов модификаторов (категория `modifiers`). Система модификаторов сохраняется без предметов-прокладок. Дубликаты запрещены (по образцу `RuleIdsSchema`).
- **Поведение не меняется.** Числа и свойства копируются из текущих предметов один в один. Атака босса — **{1,2} slashing + кровотечение** (как сейчас через `common_splinter_blade`), а не молот {6,10} — решение пользователя 2026-08-28. `cat_guardian_maul` остаётся только дропаемым предметом игрока.
- **Профиль атаки копируется на `EnemyEntity` при спавне** (прецеденты: `baseMaxHp`, `aiSightRadius`) — резолверы читают сущность без lookup в реестр, тесты не зависят от `initRegistry`. Список `modifiers` при пересборке правил читается из реестра по `templateId` (прецедент: `isBossTemplate`).
- **Теги атаки копируются как есть** (включая `delivery.weapon`) — правила и обработчики урона проверяют теги, смена тегов изменила бы поведение. Семантическая странность «у когтей delivery.weapon» фиксируется, но не чинится в этом плане.

## Таблица миграции контента

| Враг | attack (из предмета) | armor | modifiers | abilities |
|---|---|---|---|---|
| `cat_small` | {1,2} slashing, range 1, теги melee/single/weapon (из `common_splinter_blade`) | 0 | `mod_bleeding_on_hit` | — |
| `cat_mid` | {2,4} slashing (из `cat_claw_mid`) | 0 | — | — |
| `cat_big` | {3,5} slashing (из `cat_claw_big`) | 2 (из `common_tin_plate`) | `mod_spiked_thorns` | — |
| `cat_guardian` | {1,2} slashing (из `common_splinter_blade`) | 6 (из `cat_guardian_plate`) | `mod_bleeding_on_hit`, `mod_guardian_vitality` | — |

Удаляются: `cat-claw-small.ts`, `cat-claw-mid.ts`, `cat-claw-big.ts` + их тексты в `texts/{ru,en}/items.ts` + регистрация в `templates/items/index.ts`.

---

## Этапы реализации

### Этап 1. Контент-схема + типы симуляции + рантайм + миграция контента

> Одним проходом: typecheck зелёный только после завершения этапа целиком.

**Файлы:** `src/content/schemas.ts`, `src/content/validate-references.ts`, `src/simulation/types.ts`, `src/simulation/systems/map-generation/shared.ts`, `src/simulation/systems/stats/base-resolver.ts`, `src/simulation/systems/stats/weapon-range.ts`, `src/simulation/systems/tags/weapon-tags.ts`, `src/simulation/systems/rules/active-rule-lifecycle.ts`, `src/simulation/systems/item-affix-roll.ts`, `src/content/templates/entities/*.ts` (4 файла).

Контент:
- `schemas.ts`: удалить `EquipmentSchema` (`:44-48`) и поле `equipment` из `EntityTemplateSchema` (`:115`); добавить `attack` (переиспользование `WeaponStatsSchema` `:140-160` — вынести в общую схему `AttackProfileSchema`), `armor` (int ≥ 0, default 0), `modifiers` (array string, default [], refine без дубликатов).
- `validate-references.ts`: удалить проверки `equipment.*` (`:63-73`); добавить для `modifiers` сущности: существование в `content.modifiers` + запрет `scaling: perLevel` (по образцу `:170-176`). `applicableSubtypes` к сущностям не применяется.
- Миграция 4 шаблонов по таблице выше.

Симуляция:
- `types.ts`: `EnemyEntity` (`:205-229`) += `attack: AttackProfile` (runtime-тип), `baseArmor: number`; убрать `equippedWeaponId/ArmorId/AmuletId` из `EnemyEntity` (`:216-220`). `StatActor` (`:159-168`) и игрок не меняются.
- `shared.ts` `createEnemy` (`:339-422`): убрать цикл экипировки (`:386-414`); копировать `template.attack` → `enemy.attack`, `template.armor` → `enemy.baseArmor`; stat-модификаторы из `template.modifiers` (source `modifier:{id}`).
- `item-affix-roll.ts`: выделить варианты от списка ID — `collectStatModifiersFromIds(ids)` / `collectRuleIdsFromIds(ids)` через `tryGetModifier` (`registry.ts:868-870`); существующие `collectFixedStatModifiers(template)`/`collectFixedRuleIds(template)` (`:154-187`) остаются тонкими обёртками (используются превью игрока `simulation.ts:287`).
- `base-resolver.ts`: `getBaseDamageRange` (`:51-64`) и `getBaseArmor` (`:66-74`) — ветка врага: читать `attack.damage` / `baseArmor` с сущности. Сигнатуры расширить до `Entity` (или union), вызовы из `recalculate.ts`/`effective-stats.ts` проверить. Убрать устаревший комментарий `:11`.
- `weapon-tags.ts`: 4 функции (`:30-92`) — ветка врага: теги и дистрибуция из `enemy.attack`.
- `weapon-range.ts`: `getWeaponAttackRange` (`:28-43`) — ветка врага: `attack.range`/`attack.minRange`.
- `active-rule-lifecycle.ts`: вражеская ветка `rebuildActiveRules` (`:278-295`) — rule-модификаторы из `getEntity(actor.templateId).modifiers` (fail-safe `tryGetEntity`) через `collectRuleIdsFromIds`, ownerContext `{type:'entity', entityId: 'modifier:{modifierId}'}`.

### Этап 2. Удаление мёртвого контента

**Файлы:** `src/content/templates/items/weapons/cat-claw-*.ts` (3 файла), `templates/items/index.ts` (или `weapons/index.ts`), `src/content/texts/ru/items.ts`, `src/content/texts/en/items.ts`.

- Удалить шаблоны когтей, регистрацию, тексты ru/en.
- Прогнать `npm run validate:content` — проверить, что на когти нет ссылок (lootTable, пулы комнат).

### Этап 3. Тесты

Обновить:
- `tests/fixtures/gameState.ts:99-115` — `makeEnemy`: новые поля `attack`/`baseArmor` вместо `equipped*Id`.
- `tests/unit/simulation/mapgen.test.ts` — `makeEntityTemplate` без `equipment`, с `attack`.
- `tests/unit/content/cat-guardian-template.test.ts:11-52` — ассерты на `attack`/`armor`/`modifiers` вместо `equipment`; maul/plate по-прежнему валидные ItemTemplate.
- `tests/unit/simulation/systems/stats/stats.test.ts:205-219` — враг без оружия → теперь рейнж из `attack` фикстуры.
- `tests/unit/simulation/stats/weapon-damage-roll.test.ts:38`, `tests/integration/combat-scenarios/poison-counter-scenario.test.ts:161` — `equippedWeaponId: 'cat_claw_small'` → профиль атаки.
- `tests/integration/` (`validate-content.test.ts:419`, `loot-drop-cycle.test.ts:15`, `boss-room-locking.test.ts:35`, `post-death-loot-reaction.test.ts:12`, `boss-room-reaction.test.ts:34`) — механическое обновление тестовых шаблонов сущностей.
- `tests/integration/combat-scenarios/guardian-boss-scenario.test.ts:243` — `maxHp >= 90` должен проходить через `mod_guardian_vitality` из `modifiers` босса.

Новые:
- Резолверы врага: `getBaseDamageRange`/`getBaseArmor`/`getWeaponTags`/`getWeaponAttackRange` читают профиль врага (unit).
- Вражеская ветка `rebuildActiveRules` — ruleIds из `modifiers` шаблона (сейчас не покрыта вообще).
- Валидация: битая ссылка в `modifiers`, `perLevel`-модификатор у сущности — ошибки.

### Этап 4. Документация

- `docs/recipes/add-enemy.md:40-42,72` — пример и описание на `attack`/`armor`/`modifiers`.
- `docs/agents/CONTENT.md:58-66,116,131` — пример EntityTemplateInput, перечень проверок.
- `docs/game-design/mechanics-overview.md:28,170` — ручки баланса врага теперь прямые поля; changelog-запись.
- `docs/game-design/equipment-modifiers-concept.md:94` — норма «у врагов нет экземпляров» → «у врагов нет экипировки; свойства — через `modifiers` шаблона».
- `src/simulation/AGENTS.md:99-103,121,181-187` — параграфы про аффиксы/дальность: ветка врага.
- `src/content/AGENTS.md` — упоминание `attack`/`modifiers` сущности при необходимости.
- `docs/agents/SYNC_STATUS.md` — новая запись в истории; зафиксировать наблюдение: `cat_guardian_maul` никогда не был экипирован боссом (остался дропом игрока, его `mod_blunt_daze` в рантайме врагов не участвовал).

## Проверки после каждого этапа

- `npm run typecheck`
- `npm run validate:content`
- `npm test` (минимум — unit simulation/content + integration)

## Риски

- **Скрытые читатели `equipped*Id` врага** — инвентаризация выполнена (сессия 2026-08-28): только `base-resolver`, `weapon-tags`, `weapon-range`, `active-rule-lifecycle`; презентация читает equipped только у игрока.
- **Семантика `delivery.weapon` у врагов** — сохраняется для неизменности поведения правил; отдельный вопрос гигиены тегов — вне скоупа.
- **Сейвы** — не реализованы (`SAVES.md` `[DRAFT]`), миграция состояния не нужна.

---

## Журнал

- 2026-08-28 — план составлен и утверждён (вариант C; атака босса сохранена {1,2} + кровотечение).
- 2026-08-28 — план реализован (этапы 1–4). Схема: поле `equipment` удалено, добавлены `attack`/`armor`/`modifiers`; контент 4 врагов мигрирован по таблице; `cat_claw_*` и их тексты удалены; рантайм-ветки врага (`createEnemy`, резолверы, `rebuildActiveRules`) и тесты обновлены; документация актуализирована. Все проверки зелёные (`typecheck`, `validate:content`, `vitest`). Отступления от плана, принятые в реализации:
  - `WeaponStatsSchema` переименована в `AttackProfileSchema` (общая схема профиля атаки оружия и врагов), а не «экспорт под общим именем»;
  - `equippedWeaponId/ArmorId/AmuletId` убраны не только из `EnemyEntity`, но и из `StatActor` (остались только у `PlayerEntity`);
  - сигнатуры резолверов расширены до `Entity` с веткой по `type === 'enemy'`;
  - source stat-модификаторов врага и ownerContext его правил — `modifier:{id}`.
- 2026-08-28 — ревью реализации: `brace_stance` убрана из `abilities` `cat_big` (AI не использует способности без `aiPreparable`, врождённая «Стойка» была мёртвым контентом). Сама способность остаётся игроковской — через `grantedAbilities` `common_tin_plate`.
