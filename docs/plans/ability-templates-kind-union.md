# План: шаблоны способностей — discriminated union `kind`

> Контекст: шаг 4 плана [`first-boss-implementation.md`](./first-boss-implementation.md) (параметризация swoop + «Налёт» босса).
> Подход утверждён пользователем 2026-08-10: **union kind + стейджинг** — сейчас мигрируем `swoop` и `selfBuff`, legacy-виды объявляются без параметров.
> Этот план заменяет решение C и формулировку шага 4 в `first-boss-implementation.md`.

---

## Диагноз (почему переделываем)

- Шаблон способности владеет только метаданными (`cooldown`, `apCost`, `tags`, `spriteId`, тексты); параметры механики (радиусы, уроны, длительности) зашиты в коде исполнителей и `damageFormula.ts` — настройка баланса из контента невозможна, главная цель темплейтов для способностей не выполняется.
- Схема — плоский «мешок опционалов»: `selfBuff` значимо только для self-buff'ов, `damageTag` — для дамажащих, `requiredWeaponTags` — для оружейных.
- Ловушка fallback'а: при наличии и зарегистрированного исполнителя, и параметров в шаблоне реестр молча побеждает.
- Сплит-брейн баланса: стоимость/кулдаун — в шаблоне, радиус/урон — в коде.

## Ключевые решения

- **A. `AbilityTemplateSchema` → `z.discriminatedUnion('kind', [...])`.** Общая база: `id`, `spriteId`, `cooldown`, `apCost`, `aiPreparable`, `requiredWeaponTags`, `tags`, `ruleIds`, `damageTag?` (сквозное поле, остаётся в базе — сигнатуры `getSkillDamageTag`/`getAbilityTags` не меняются).
- **B. Члены union с параметрами:** `kind: 'selfBuff'` (`statusType`, `duration` — из нынешнего поля `selfBuff`), `kind: 'swoop'` (`jumpRadius ≥ 1`, `aoeRadius ≥ 0`, `baseDamage ≥ 0`). **Legacy-виды без параметров:** `'fireball'`, `'magicSlap'`, `'dash'`, `'counterattack'`, `'cleave'`, `'suddenStrike'` — только `kind`. Имена kind-литералов — camelCase (дискриминатор вида, не контентный id).
- **C. Разрешение исполнителя — фабрики по kind.** Карта `KIND_FACTORIES`: `{ selfBuff: createSelfBuffSkill, swoop: createSwoopSkill }`. Порядок `getSkillExecutor`: шаблон → фабрика для `kind` → собрать + закэшировать; иначе legacy-реестр по id; иначе `undefined`. У kind с фабрикой зарегистрированного исполнителя не существует — неоднозначность устранена.
- **D. swoop — фабрика `createSwoopSkill({id, jumpRadius, aoeRadius, baseDamage})`.** Константы (`SWOOP_JUMP_RADIUS`, `SWOOP_AOE_RADIUS`, `SWOOP_BASE_DAMAGE`) и инстанс `swoopSkill` удаляются; экспорт `SWOOP_AOE_RADIUS` убирается (никем не импортируется; тактика шага 6 плана босса будет читать `aoeRadius` из шаблона). Хардкод `templateId === 'swoop'` в `getSkillLevel` заменяется на `params.id`.
- **E. Новая механика = новый член union + фабрика в движке** (соответствует LAYERS.md «новая игровая механика — код simulation»); новый экземпляр существующей механики = чистый контент.

## Шаги

### Шаг 1. Схема union `kind`
- Изменить: `src/content/schemas.ts` — `AbilityTemplateSchema` → discriminated union (база + 8 членов); типы `AbilityTemplate`/`AbilityTemplateInput` выводятся из union.
- Мигрировать шаблоны: `swoop` (kind + 2/1/8), `bulwark` (`selfBuff: {...}` → `kind: 'selfBuff', statusType, duration`), 6 legacy-шаблонов получают `kind`.

### Шаг 2. Фабрики и разрешение исполнителя
- Изменить: `src/simulation/skills/executors/swoopSkill.ts` → `createSwoopSkill(params)`; `src/simulation/skills/skillExecutor.ts` — карта фабрик по kind + новый порядок разрешения; `src/simulation/skills/index.ts` — удалить регистрацию swoop.
- Поведение swoop (2/1/8) не меняется — регрессия существующими тестами.

### Шаг 3. Контент «Налёт» босса
- Создать: `src/content/templates/abilities/guardian-swoop.ts` (`kind: 'swoop'`, 3/1/~10 черновик, `apCost 2`, `cooldown 2`, `aiPreparable`, `damageTag blunt`, `spriteId 'swoop'`); строка в `templates/abilities/index.ts`; тексты `src/content/texts/{ru,en}/abilities.ts`.
- Изменить: `src/presentation/animation/skills/swoop.ts` — `registerSkillComposer('guardian_swoop', swoopComposer)`. Телеграф зоны generic — без изменений.

### Шаг 4. Валидация `selfBuff.statusType`
- Изменить: `src/content/validate-references.ts` — проверка `statusType` self-buff способности → существование статуса (принцип fail fast; сейчас не проверяется нигде).

### Шаг 5. Тесты
- Обновить: `mockAbility`-хелпер под union; `tests/unit/simulation/skills/swoop.test.ts` — на фабрику/`getSkillExecutor` + тест дальности 3 для `guardian_swoop`; моки в `ai-simple-boss.test.ts`, `targeting.test.ts`, selfBuff/bulwark-тестах; негативный тест валидации statusType.
- Прогнать: `npm run validate:content`, validate-i18n, `npm run typecheck`, unit + integration тесты затронутых областей.

### Шаг 6. Документация
- `docs/plans/first-boss-implementation.md` — решение C и шаг 4 заменены ссылкой на этот план; запись в журнале.
- `src/content/AGENTS.md` — раздел «Способности» → union `kind`.
- `docs/agents/CONTENT.md` — описание схемы способностей.
- `docs/recipes/add-ability.md` — новый процесс (выбор kind, параметры вида).
- `src/simulation/AGENTS.md` — разрешение исполнителя (фабрики по kind + legacy-реестр).
- `docs/agents/SYNC_STATUS.md` — запись в истории.

## Риски и принятые ограничения

1. Legacy-виды (`fireball` и др.) объявлены в union, но параметров не имеют — их исполнители по-прежнему регистрируются по id в `skills/index.ts`; параметризация — точечно, когда понадобится (`counterattack` мигрирован в вид `selfBuff` 2026-08-11).
2. Числа `guardian_swoop` (урон ~10) — черновые, до балансного прохода roadMap 1.4.
3. Полная миграция всех 8 исполнителей на фабрики по kind сознательно отложена (стейджинг) — диф остаётся обозримым.

## Журнал

| Дата | Событие |
|---|---|
| 2026-08-10 | План составлен по итогам обсуждения шага 4 плана первого босса. Рассмотрены варианты: фабрика в движке (первоначальное решение C), плоские поля на семейство (прецедент selfBuff), удаление шаблонов способностей (отклонено — метаданные/баланс легитимно контент), union kind. Утверждён union kind + стейджинг. |
| 2026-08-11 | Выполнены шаги 1–6. Схема `AbilityTemplateSchema` — discriminated union по `kind` (база + 8 членов); шаблоны мигрированы (`swoop` 2/1/8, `bulwark` → `kind: 'selfBuff'`, 6 legacy получили `kind`). Фабрики: `createSwoopSkill(params)` (константы и инстанс удалены, хардкод templateId → `params.id`), карта `KIND_FACTORIES` в `getSkillExecutor`, регистрация swoop удалена. Контент `guardian_swoop` (3/1/10 черновик, apCost 2, cooldown 2, aiPreparable, damageTag blunt, spriteId 'swoop') + тексты ru/en + переиспользование `swoopComposer`. Валидация `statusType` self-buff в `validate-references.ts`. Тесты: mockAbility и ~20 файлов моков на union, swoop.test.ts на фабрику + дальность 3 guardian_swoop, негативный тест statusType. Прогоны зелёные: typecheck, validate:content, validate:i18n, полный vitest (1565 тестов), perf. Документация: `src/content/AGENTS.md`, `src/simulation/AGENTS.md`, `docs/agents/CONTENT.md`, `docs/recipes/add-ability.md`, `first-boss-implementation.md` (решение C и шаг 4), SYNC_STATUS. |
| 2026-08-11 | Мигрирован `counterattack` (кандидат из «Рисков и принятых ограничений»): шаблон → `kind: 'selfBuff'` (`statusType: 'counterattack'`, `duration: 2` — параметр длительности стал контентным), `counterattackSkill.ts` и его регистрация в `skills/index.ts` удалены, член union `counterattack` убран (legacy осталось 5 видов). Поведение не изменилось — фабрика `createSelfBuffSkill` изначально написана по образцу `counterattackSkill`; реакция контратаки живёт в контентных правилах и от исполнителя не зависит. Тест `counterattack.test.ts` переведён на `getSkillExecutor`/фабрику (сценарные тесты реакции без изменений). Полный прогон зелёный (1565 тестов). |
