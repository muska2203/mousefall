# План: Зачистка боевых роллов + детерминированный крит

> Статус: **выполнен** (завершён 2026-08-07).
> Основание: `roadMap.md`, вопрос №1 из «Вопросы по механикам» (решено 2026-08-04) — удаление `accuracy`/`dodgeChance`/`critChance`/`ENTITY_MISSED` «по образцу этапа 0.1», детерминированный крит по `dazed`/`stunned`, перевод `weapon_poison_on_hit`/`weapon_blunt_daze` с `chance` на «всегда».

---

## Принятые проектные решения

- **Крит — глобальное мировое правило + минимальное расширение DSL** (выбор пользователя 2026-08-07), по образцу `status_burning_vulnerability` (`src/simulation/content-rules/world-rules/global-rules.ts:36-51`). Множитель берётся из effective-стата атакующего `critMultiplier` через новое поле `sourceCritMultiplier` в контекстной форме `ParametrizedValue` (образец — `eventMaxHp`). Стат `critMultiplier` остаётся в игре.
- **Индикация крита:** строка в боевом логе + floating text «Крит!» (выбор пользователя 2026-08-07). Правило добавляет событию тег `crit` через `addTags`; presentation ветвится по тегу (живой прецедент — `getDamageFamily` в `pixiFloatingTextExecutor.ts:48`). Тег без префикса `damage.` — чтобы не влиять на `getDamageHandler`.
- **`weapon_blunt_daze`:** при снятии `chance` добавить `eventRole: 'source'` — иначе «всегда» превратит известный изъян (дез владельца при ударе по нему, зафиксирован в ревью этапа 0) в постоянный баг.
- **Баланс значений/длительностей яда и деза НЕ меняем** — проход запланирован в этапе 1.4 (решение вопроса №1).
- Git-коммиты не делаем (пользователь не просил).

---

## Фаза A. Удаление боевых роллов (по образцу коммита f4dd603)

Удаляются статы `accuracy`, `dodgeChance`, `critChance` и событие `ENTITY_MISSED` (мёртвый задел: событие нигде не эмитится, статы нигде не читаются для роллов).

- [x] **A1. Симуляция — типы и дефолты:**
  - `src/simulation/types.ts` — поля из `StatActor` (≈159-161), derived-кэша `PlayerEntity` (≈192-196), `EnemyEntity` (≈223-227), `PlayerStatsSnapshot` (≈489-491);
  - `src/simulation/core-types.ts:87` — union статов `StatModifier`; `:510,571` — тип `EntityMissedEvent` и его место в union `GameEvent`;
  - `src/simulation/state.ts:81-83` и `src/simulation/systems/map-generation/shared.ts:215-217` — дефолты.
- [x] **A2. Симуляция — расчёт статов:**
  - `src/simulation/systems/stats/base-resolver.ts:68-82` — `getBaseDodgeChance`/`getBaseAccuracy`/`getBaseCritChance` (файл целиком не трогаем, `getBaseCritMultiplier` остаётся);
  - `src/simulation/systems/stats/effective-stats.ts:68-82` — effective-обёртки трёх статов;
  - `src/simulation/systems/stats/recalculate.ts:29-31` — запись derived-кэша;
  - `src/simulation/simulation.ts:292-294, 945-947` — снапшоты `getPlayerStats`.
- [x] **A3. Контент-схема:** `src/content/schemas.ts:166` — убрать три стата из `z.enum` в `StatModifierEntrySchema` (в шаблонах контента значений нет — проверено).
- [x] **A4. Presentation — обработчики ENTITY_MISSED:**
  - `src/presentation/fogFilter.ts:39-46` — case;
  - `src/presentation/logBuilder.ts:181-188` — строка лога;
  - `src/presentation/animation/register.ts:69` — регистрация билдера;
  - `src/presentation/animation/builders/entityMissed.ts` — удалить файл;
  - `src/presentation/animation/core/primitives.ts:19` — тип `EntityMissedEvent`.
- [x] **A5. i18n:**
  - `src/i18n/schema.ts` — убрать `dodgeChance`/`accuracy`/`critChance` из `SystemStatNamesTranslations` (≈399-411, `critMultiplier` остаётся) и `entityMissed` из `SystemLogBuilderTranslations` (≈369);
  - локали: `src/i18n/locales/{ru,en}/system/statNames.ts:8-11`, `src/i18n/locales/{ru,en}/system/logBuilder.ts:23`;
  - тексты создания персонажа `src/i18n/locales/{ru,en}/screens/characterCreation.ts:26,29-30` — убрать упоминания уклонения/точности/крита из описаний dex/int (dex остаётся в формулах урона оружия — переписать аккуратно).
- [x] **A6. Тесты:**
  - `tests/fixtures/gameState.ts:84-86, 118-120`;
  - `tests/unit/simulation/systems/stats/stats.test.ts:102-117, 286-333` — секции про dodge/accuracy/critChance (секцию critMultiplier сохранить);
  - `tests/unit/simulation/getPlayerStats.test.ts:125-127`;
  - `tests/unit/presentation/logBuilder.test.ts:149-151, 206` — кейс ENTITY_MISSED;
  - `tests/unit/presentation/animation/builders.test.ts:22, 418-421` — `entityMissedBuilder`;
  - моки в `tests/unit/ui/renderer/{EntityRenderer,UnitInfoRenderer,WorldRenderer,TargetingRenderer}.test.ts`.
- [x] **A7. Прогон:** `npm run typecheck` + тесты затронутых областей.

## Фаза B. Детерминированный крит (глобальное правило + расширение DSL)

- [x] **B1. Тип:** `src/simulation/content-rules/types.ts:59-68` — в контекстную форму `ParametrizedValue` добавить поле `'sourceCritMultiplier'` в union `field`; комментарий о направлении обобщения (stat-based resolver по TODO в :62).
- [x] **B2. Контекст:** `src/simulation/content-rules/rule-context.ts` — поле `sourceCritMultiplier?: number` в `RuleContext`; заполнение в `buildRuleContext` для DAMAGE-интента через `getEffectiveCritMultiplier(source)` (следить за циклическими импортами — `effective-stats` тянет контент-реестр).
- [x] **B3. Резолвер:** `src/simulation/content-rules/value-resolver.ts` — изменений не требуется (context-форма читает `ctx[field]`), убедиться тестом.
- [x] **B4. Правило:** `src/simulation/content-rules/world-rules/global-rules.ts` — новое правило `core_crit_on_dazed_stunned`:
  - trigger `{ event: 'DAMAGE' }` (без ограничения тегов — критует любой урон от актёра);
  - conditions: `or(hasStatus 'dazed' subject 'target', hasStatus 'stunned' subject 'target')` (образец `relic_opportunist_bonus`, `rules.ts:546-553`);
  - effect `modifyDamage`, `op: 'multiply'`, `value: {type: 'context', field: 'sourceCritMultiplier'}`, `addTags: ['crit']`;
  - `ownerContext: {type: 'world'}`, `worldLayer: 'global'`, priority 0.
- [x] **B5. Тесты:** unit на `buildRuleContext`/резолвер; интеграционный — атака по цели с `dazed` даёт урон ×1.5 и тег `crit` в событии `ENTITY_DAMAGED`; атака по цели без статусов — без изменений.

## Фаза C. Индикация крита (лог + floating text)

- [x] **C1. Лог:** `src/presentation/logBuilder.ts:102-108` — ветка `event.tags.includes('crit')` в обработчике `ENTITY_DAMAGED` → новый ключ `damageTakenCrit`; ключ в `SystemLogBuilderTranslations` (`src/i18n/schema.ts`) + локали `src/i18n/locales/{ru,en}/system/logBuilder.ts`.
- [x] **C2. Анимация:** билдер `entityDamaged` (`src/presentation/animation/builders/entityDamaged.ts` / `core/primitives.ts:81-92`) — при теге `crit` добавить `floatingTextNode(undefined, 'system.animation.crit', …)`; ключ `crit` в `SystemAnimationTranslations` (schema.ts:423-429) + локали `src/i18n/locales/{ru,en}/system/animation.ts`. Особый цвет не делаем (`styleKey` мёртв — зафиксировано, визуально текст белый, как все floating text).
- [x] **C3. Тесты:** `tests/unit/presentation/logBuilder.test.ts`, `tests/unit/presentation/animation/builders.test.ts` — кейсы с тегом `crit`.

## Фаза D. Правила оружия — с `chance` на «всегда»

- [x] **D1.** `src/simulation/content-rules/rules.ts:222-261`:
  - `weapon_poison_on_hit` — убрать `{type: 'chance', probability: 40}`;
  - `weapon_blunt_daze` — убрать `{type: 'chance', probability: 25}` и добавить `{type: 'eventRole', role: 'source'}` (фикс изъяна самодеза, обязателен при «всегда»).
- [x] **D2. Тексты правил:** `src/content/texts/{ru,en}/rules.ts:8,12` — убрать упоминания вероятности из описаний.
- [x] **D3. Тесты:** прогнать `tests/integration/combat-scenarios/poison-counter-scenario.test.ts`; добавить/проверить кейс, что владелец `cat-guardian-maul` не дезится при ударе по нему.
- [x] **D4.** Зафиксировать в этом плане: баланс длительностей/значений — этап 1.4.

## Фаза E. Финал

- [x] **E1.** Полный прогон: `npm run typecheck`, `npm test`, `npx tsx scripts/validate-i18n.ts`, `npx tsx scripts/validate-content.ts`.
- [x] **E2. Документация:**
  - `docs/game-design/mechanics-overview.md` §10.1 — пробел «боевые роллы» закрыт;
  - `docs/agents/SYNC_STATUS.md` — запись в истории;
  - `roadMap.md` — пометка о выполнении зачистки (вопрос №1 реализован);
  - обновить чекбоксы и журнал этого плана.
- [x] **E3.** Отчёт пользователю; коммит — только по явной просьбе.

---

## Журнал прогресса

| Дата | Запись |
|---|---|
| 2026-08-07 | План создан. Решения: крит — глобальное правило + поле `sourceCritMultiplier` в DSL; индикация — лог + floating text по тегу `crit`; `weapon_blunt_daze` получает `eventRole: 'source'`. |
| 2026-08-07 | Фаза A выполнена (A1–A7): удалены статы `accuracy`/`dodgeChance`/`critChance` и событие `ENTITY_MISSED` по всему коду (типы, дефолты, резолверы, снапшоты, схема контента, presentation, i18n, тесты); `critMultiplier` сохранён. Описания dex/int в создании персонажа переписаны под фактические формулы урона оружия. Typecheck чист; тесты затронутых областей: 1293 passed, 1 failed — `relicViewModel.test.ts` (редкость реликвии), падение вызвано несвязанными незакоммиченными правками редкости реликвий (`rare` → `common`). |
| 2026-08-07 | Фазы B и C выполнены (B1–B5, C1–C3): поле `sourceCritMultiplier` в DSL и `RuleContext` (заполняется из derived-кэша `actor.critMultiplier` — без циклического импорта effective-stats); мировое правило `core_crit_on_dazed_stunned` (урон ×critMultiplier по dazed/stunned + тег `crit`); индикация — строка лога `damageTakenCrit` и floating text «Крит!»/«Crit!» в `entityDamagedBuilder`. Тесты: unit на buildRuleContext/резолвер, интеграционный `crit-on-dazed-scenario`, кейсы в logBuilder/builders; в `relic-rules.test.ts` обновлено ожидание opportunist (пересечение с критом по dazed/stunned: 19.5 вместо 13). Typecheck чист; vitest (unit simulation+presentation, integration) — всё зелёное, кроме известного `relicViewModel.test.ts` (несвязанные правки редкости реликвий); validate-i18n — ru/en синхронны. |
| 2026-08-07 | Фаза D выполнена (D1–D4): `weapon_poison_on_hit` лишился `chance: 40` (яд — всегда), `weapon_blunt_daze` лишился `chance: 25` и получил обязательный `eventRole: 'source'` (фикс самодеза). Тексты правил ru/en переписаны на «всегда при ударе». Новый сценарий `blunt-daze-scenario.test.ts`: цель удара владельца `cat_guardian_maul` дезится всегда; владелец не дезится при дробящем ударе по нему (безоружная атака крысы). poison-counter остался зелёным. Упоминаний вероятности 40/25 в актуальных доках нет — не трогал. Typecheck чист; vitest (unit/simulation + integration): 903 passed; validate-i18n — ru/en синхронны. |
| 2026-08-07 | Фаза E выполнена (E1–E3), план закрыт. Полный прогон: typecheck чист; весь vitest — 1492 passed / 1 failed (pre-existing `relicViewModel.test.ts`, чужие незакоммиченные правки редкости реликвий); validate-i18n и validate-content — зелёные. Документация: `mechanics-overview.md` (§1.3 — детерминированный бой и крит-правило, §1.4 — производные без ролловых статов, строка §10.1 и пункт §11 про роллы убраны, запись в истории), `SYNC_STATUS.md` (запись в истории), `roadMap.md` (пометка «Реализовано (2026-08-07)» в вопросе №1, строка про XP убрана из рисков). Точечных противоречий в `content-rules/AGENTS.md`/`README.md` и [STABLE]-доках не найдено — не трогал. |
