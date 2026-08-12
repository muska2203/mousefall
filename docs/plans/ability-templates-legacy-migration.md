# План: миграция оставшихся legacy-видов шаблонов способностей на фабрики по `kind`

> Контекст: продолжение плана [`ability-templates-kind-union.md`](./ability-templates-kind-union.md).
> Там мигрированы `swoop`, `selfBuff` (+`counterattack`), позже добавлен `groundSlam`; осталось 5 legacy-видов
> без параметров: `fireball`, `magicSlap`, `dash`, `cleave`, `suddenStrike` — их исполнители регистрируются
> по id в `src/simulation/skills/index.ts`, параметры механики зашиты в коде.
> Решения пользователя 2026-08-12:
> 1. **Урон способностей — фиксированные значения из шаблона.** Формулы со скейлингом от характеристик/уровня
>    (`int`/`str`/`skillLevel`) удаляются; будущие модификаторы урона вешаются через стандартные модификаторы
>    и контентные правила.
> 2. `cleave` мигрируется фабрикой без параметров (ради удаления legacy-реестра целиком).
> 3. Стейджинг: по одному виду за шаг, зелёные тесты после каждого шага.

---

## Диагноз (что зашито в коде сейчас)

| Вид | Файл исполнителя | Захардкожено |
|---|---|---|
| `fireball` | `executors/fireballSkill.ts` | дальность 5, радиус AoE 1, `baseDamage 20`, AoE-множитель 0.5 (в формуле), скейлинг `int×0.15`/`level×0.1`, хардкод `templateId === 'fireball'` в `getSkillLevel` |
| `magicSlap` | `executors/magicSlapSkill.ts` | дальность 5, 3 цели, `baseDamage 12`, скейлинг `int×0.2`/`level×0.05`, хардкод id |
| `dash` | `executors/dashSkill.ts` | `DASH_DISTANCE 2`, `DASH_BUMP_BASE_DAMAGE 5`, скейлинг `str×0.1`/`level×0.05` (формула `dash_bump`), хардкод id |
| `cleave` | `executors/cleaveSkill.ts` | числовых параметров нет (урон — ролл оружия); fallback-тег `CLEAVE_DAMAGE_TAG` + `console.warn` при каждом касте (шаблон сознательно без `damageTag` — урон оружейный) |
| `suddenStrike` | `executors/suddenStrikeSkill.ts` | длительность немоты 2 (урон — ролл оружия) |

Дополнительно: формула `swoop_slam` (используется уже мигрированным `swoop`) всё ещё скейлится от `str×0.12` —
под решение «фиксированный урон» подпадает и она.

Формула `push_bump` (урон столкновения от PUSH) — **не** формула способности, вне области плана, не меняется.

## Ключевые решения

- **A. Параметры видов в union (только базовые значения):**
  - `fireball`: `range` (5), `aoeRadius` (1), `centerDamage` (20), `aoeDamage` (10 — нынешние `20×0.5` до скейлинга).
  - `magicSlap`: `range` (5), `targetCount` (3), `baseDamage` (12).
  - `dash`: `distance` (2), `bumpDamage` (5).
  - `suddenStrike`: `silenceDuration` (2).
  - `cleave`: без параметров.
- **B. Фиксированный урон.** Формулы `fireball_center`, `fireball_aoe`, `magic_slap`, `dash_bump`, `swoop_slam`
  удаляются из `damageFormula.ts`; исполнители формируют плоский урон напрямую по образцу `groundSlam`.
  Остаются `ground_slam` (уже плоская) и `push_bump` (вне области). `skillLevel` в этих исполнителях больше
  не нужен — хардкоды `templateId` в `getSkillLevel` уходят вместе с формулами.
- **C. Фабрики в `KIND_FACTORIES`:** `createFireballSkill`, `createMagicSlapSkill`, `createDashSkill`,
  `createSuddenStrikeSkill`, `createCleaveSkill({id})` — каждый исполнитель переписывается на фабрику
  по образцу `createSwoopSkill` (параметры через замыкание, `id` из параметров).
- **D. Финал — удаление legacy-реестра.** Когда мигрированы все 5 видов: `registerSkill`/`initSkillRegistry`
  и legacy-ветка в `getSkillExecutor` удаляются, `skills/index.ts` упрощается до реэкспорта (точку вызова
  `initSkillRegistry` в bootstrap убрать). Реестр-кэш внутри `getSkillExecutor` сохраняется.
- **E. cleave:** fallback `CLEAVE_DAMAGE_TAG` переносится в фабрику (шаблон остаётся без `damageTag`),
  `console.warn` убирается — это штатная конфигурация, а не ошибка контента.

## Шаги (стейджинг, порядок — от простого паттерна к сложному)

### Шаг 1. `fireball` → `kind` с параметрами + фабрика
- Схема: член union `fireball` получает `range`/`aoeRadius`/`centerDamage`/`aoeDamage`; шаблон — значения 5/1/20/10.
- `fireballSkill.ts` → `createFireballSkill(params)`; регистрация в `skills/index.ts` удаляется; запись в `KIND_FACTORIES`.
- Формулы `fireball_center`/`fireball_aoe` удаляются; урон плоский (center/aoe по клеткам, как сейчас).
- Тесты fireball переводятся на `getSkillExecutor`/фабрику; ожидаемые числа урона пересчитываются под flat.

### Шаг 2. `magicSlap` → параметры + фабрика
- `range`/`targetCount`/`baseDamage` (5/3/12); формула `magic_slap` удаляется; хардкод id в `getSkillLevel` уходит.
- Тесты — аналогично.

### Шаг 3. `dash` → параметры + фабрика
- `distance`/`bumpDamage` (2/5); формула `dash_bump` удаляется; логика дверей/PUSH/BUMP без изменений.
- Тесты — аналогично.

### Шаг 4. `suddenStrike` → параметр + фабрика
- `silenceDuration` (2); урон остаётся роллом оружия (механика оружейного скилла, не формула способности).
- Тесты — аналогично.

### Шаг 5. `cleave` → фабрика без параметров
- `createCleaveSkill({id})`; fallback-тег переносится в фабрику, `console.warn` удаляется.
- Тесты — аналогично.

### Шаг 6. `swoop` — плоский урон
- Формула `swoop_slam` удаляется, `createSwoopSkill` формирует flat-урон из `baseDamage` шаблона
  (поведение численно меняется для владельцев с `str > 0` — принято решением о фиксированном уроне).
- `getSkillLevel` в `swoopSkill.ts`/`groundSlamSkill.ts` удаляется за ненадобностью.

### Шаг 7. Удаление legacy-реестра
- `registerSkill`/`initSkillRegistry`/`skills/index.ts` (как инициализатор) удаляются; legacy-ветка
  в `getSkillExecutor` убирается; вызов инициализации из bootstrap удаляется.
- `AbilityTemplate['kind']` теперь всегда имеет фабрику — тип `KIND_FACTORIES` меняется с `Partial<Record<...>>`
  на полный `Record`, забытый kind ловится компилятором.

### Шаг 8. Тесты и прогоны
- Моки/`mockAbility` при необходимости дополняются новыми полями; регрессия — существующие сценарные тесты
  (силence, двери dash, отталкивание) без изменений логики.
- Прогоны после каждого шага: `npm run typecheck`, `npm run validate:content`, unit/integration затронутых областей;
  после шага 7 — полный vitest.

### Шаг 9. Документация
- `src/content/AGENTS.md` — раздел «Способности»: legacy-виды исчезают, таблица параметров видов.
- `src/simulation/AGENTS.md` — разрешение исполнителя без legacy-ветки; фиксированный урон способностей.
- `docs/agents/CONTENT.md` — раздел «Шаблоны способностей (union kind)».
- `docs/recipes/add-ability.md` — параметры новых видов.
- `docs/game-design/mechanics-overview.md` — формулы урона способностей → фиксированные значения из контента.
- Журналы: `ability-templates-kind-union.md` (ссылка на этот план), этот план, `SYNC_STATUS.md`.

## Риски и принятые ограничения

1. **Численное изменение баланса**: удаление скейлинга `int`/`str`/`skillLevel` меняет итоговый урон fireball/
   magic_slap/dash/swoop для прокачанных персонажей. Принято решением пользователя; точные значения —
   черновые до балансного прохода (roadMap 1.4).
2. `skillLevel` способностей (`grantedAbilities[].level`) остаётся в типах, но после миграции не используется
   ни одной формулой урона способностей — зачистка уровней способностей, если понадобится, отдельной задачей.
3. `push_bump` сохраняет скейлинг от `str` — это механика столкновений, не способность; унификация при
   желании — отдельный разговор.

## Журнал

| Дата | Событие |
|---|---|
| 2026-08-12 | План составлен по итогам обсуждения. Утверждено: фиксированный урон из шаблона (формулы со скейлингом удаляются, модификаторы — через стандартные модификаторы и правила), `cleave` — фабрикой без параметров, стейджинг по видам. |
| 2026-08-12 | Выполнены шаги 1–9. Все 5 legacy-видов мигрированы: `fireball` (range/aoeRadius/centerDamage/aoeDamage 5/1/20/10), `magicSlap` (range/targetCount/baseDamage 5/3/12), `dash` (distance/bumpDamage 2/5), `suddenStrike` (silenceDuration 2), `cleave` (фабрика без параметров, fallback-тег перенесён в фабрику, `console.warn` удалён). Урон swoop/groundSlam стал плоским. **Отклонение от плана:** формула `push_bump` оказалась мёртвым кодом (ни одного вызова), поэтому после удаления формул со скейлингом и инлайна плоского урона в `createGroundSlamSkill` файл `damageFormula.ts` удалён целиком (вместо «остаются `ground_slam` и `push_bump`»); заодно удалены `getSkillLevel` из swoop/groundSlam и `DamageFormulaContext.skillLevel`. Legacy-реестр удалён: `registerSkill`/`initSkillRegistry`, legacy-ветка в `getSkillExecutor`, вызов в `defaultActionHandlerRegistry`; `KIND_FACTORIES` — полный `Record` (забытый kind ловится компилятором); `skills/index.ts` — только реэкспорт. Тесты: моки ~30 файлов на новые поля видов, исполнители в тестах собираются фабриками, `tests/helpers/test-skills.ts` удалён, `required-weapon-tags.test.ts` переведён на вид `selfBuff` (кастомные executors через реестр больше невозможны). Прогоны зелёные: typecheck, validate:content, validate:i18n, полный vitest (1588 passed; 13 failed в `tests/unit/ui/**` и `tests/unit/utils/tween.test.ts` — pre-existing на чистом HEAD, изъян коммита со скейлером скорости анимаций, вне области), perf. Документация: `src/content/AGENTS.md`, `src/simulation/AGENTS.md`, `docs/agents/CONTENT.md`, `docs/recipes/add-ability.md` (legacy-путь удалён), `docs/recipes/add-tile-effect.md`, `mechanics-overview.md`, `equipment-modifiers-concept.md`, SYNC_STATUS. |
