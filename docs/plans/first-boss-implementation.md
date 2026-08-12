# План реализации первого босса «Кот-Страж»

> Источник требований: [`docs/game-design/first-boss-concept.md`](../game-design/first-boss-concept.md).
> **Вне объёма:** `isBoss`/`bossPool`, босс-комната и запирающиеся двери (roadMap 1.3 — отдельный план), числовой баланс (roadMap 1.4).

---

## Ключевые решения

- **A. Иммунитет к урону — движковый choke point, а не `modifyDamage multiply 0`.** Концептная схема не покрывает DAMAGE_TILE (у тайловых интентов нет `targetEntityId`, target-слой правил с условием `hasStatus` не собирается). Реализация: в `applyDamageToEntity` (`src/simulation/systems/damage/apply-damage.ts`) при статусе `bulwark` у цели `finalDamage = 0`; событие `ENTITY_DAMAGED` с damage 0 эмитится — статусы продолжают накладываться (как требует концепт). Пол min-1 в `damage-handlers.ts` снят отдельным решением пользователя (2026-08-10, выполнено первой итерацией): броня может обнулить физический урон; граница 1 сохранена только для процентного урона (`min: 1` в правилах тиков яда/горения). → Концепт-документ обновлён.
- **B. Self-buff — фабрика `createSelfBuffSkill` в `getSkillExecutor`:** способность наложения статуса на кастера не требует отдельного исполнителя — generic-исполнитель собирается из параметров шаблона. `counterattackSkill` не трогаем. *(Актуализировано 2026-08-11: поле `selfBuff` превратилось в член union `kind: 'selfBuff'` — см. план [`ability-templates-kind-union.md`](./ability-templates-kind-union.md).)*
- **C. ~~Swoop — фабрика `createSwoopSkill(...)`~~ — заменено планом [`ability-templates-kind-union.md`](./ability-templates-kind-union.md)** (утверждён 2026-08-10, реализован 2026-08-11): `AbilityTemplateSchema` — discriminated union по `kind`, параметры механики (`swoop`, `selfBuff`) живут в шаблоне, разрешение исполнителя — фабрики по kind (`KIND_FACTORIES`).
- **D. `dazed` от Удара — контентное правило** `ground_slam_daze` (триггер `ENTITY_DAMAGED` с тегом `skill.ground_slam` → `applyStatus dazed 2` по `eventTarget`), привязка через `ruleIds` шаблона способности. Прецедент — `fire_damage_ignites`.
- **E. Hunter FSM — вынос приватных хелперов** `updateHunterState`/`handleHunterWorldChange`/`engagePlayer` из `hunter-strategy.ts` в `ai-helpers.ts` (AI_SYSTEM.md запрещает дублирование) без смены поведения hunter.
- **F. «Конец хода» в стратегии — эвристика `AP ≤ 1 || closeCombat blocked`:** подготовка бесплатна (side-effect), исполнение платит на следующем ходу.

Подтверждено исследованием: телеграф подготовленного скилла полностью generic (`buildAIPreparedIntents` → `getAbilityAffectedPositions` → `TargetingRenderer`) — подсветка 5×5 заработает автоматически при корректном `getAffectedPositions` исполнителя; presentation-код не меняется. Тики статусов идут до `decideAction` фракции (`runFactionSetup`) — `bulwark` duration 1 снимается до хода босса, как задумано.

## Шаги

Граф зависимостей: 1, 4, 5 — независимы; 2 ← 1; 3 ← 1; 6 ← 4 (интерфейсно); 7 ← 2,3,4,5,6; 8 ← 7; 9 ← все.

### Шаг 1. Статус `bulwark`: тип, шаблон, тексты, иконка
- Изменить: `src/simulation/core-types.ts` (`StatusEffectType` += `'bulwark'`), `src/content/templates/statuses/index.ts`; `src/presentation/statusSorting.ts` (порядок отображения).
- Создать: `src/content/templates/statuses/bulwark.ts` (`ruleIds: []`, `statusCategory: 'physical'`); тексты `src/content/texts/{ru,en}/statuses.ts`; ассет `public/assets/statuses/bulwark.png` (placeholder-скрипт).
- Тесты: `validate:content`, validate-i18n; шаблон доступен через `getStatusTemplate('bulwark')`.

### Шаг 2. Семантика `bulwark` в движке ← 1
- Создать: `src/simulation/systems/bulwark-helper.ts` — `isBulwarked(entity)` по образцу `stun-helper.ts`.
- Изменить: `apply-damage.ts` (иммунитет → `finalDamage = 0`, событие эмитится); `push-intent-executer.ts` (толчок гасится, `return null`); `simulation.ts` `canActorAct` (~:923 — под `bulwark` только END_TURN; без `SKIP_STUNNED_TURN` и без сброса подготовки).
- Тесты (unit + `combat-scenarios/`): иммунитет к прямому урону, DAMAGE_TILE, тику burning, урону столкновения (0); статусы накладываются; PUSH не сдвигает; MOVE/ATTACK/USE_ABILITY отклоняются, `preparedAbility` сохраняется.

### Шаг 3. Обобщённый self-buff + «Глухая оборона» ← 1 (параллельно с 2)
- Изменить: `src/content/schemas.ts` (`AbilityTemplateSchema` += `selfBuff?`); `src/simulation/skills/skillExecutor.ts` (fallback в `getSkillExecutor`).
- Создать: `src/simulation/skills/executors/selfBuffSkill.ts`; `src/content/templates/abilities/bulwark.ts` (`apCost 1`, `cooldown 4`, `aiPreparable false`, `selfBuff {bulwark, 1}`); тексты ru/en; ассет `skills/bulwark.png`.
- Тесты: unit исполнителя и fallback; интеграция каста (кулдаун 4 выставляется).

### Шаг 4. Параметризация swoop + «Налёт» босса (независим) — ✅ выполнен 2026-08-11
- **Заменён планом [`ability-templates-kind-union.md`](./ability-templates-kind-union.md)** (union `kind` + стейджинг): `swoopSkill.ts` → фабрика `createSwoopSkill(...)`; `swoop` (2/1/8) и `guardian_swoop` (3/1/10) — шаблоны с `kind: 'swoop'` и параметрами в контенте; регистрация swoop в `skills/index.ts` удалена (исполнитель собирается фабрикой).
- Создано: шаблон `templates/abilities/guardian-swoop.ts` (`apCost 2`, `cooldown 2`, `aiPreparable true`, `damageTag blunt`, `spriteId 'swoop'`); тексты ru/en; композер анимации `swoopComposer` переиспользован для `guardian_swoop`.
- Тесты: дальность 3 в `getValidTargets` (`tests/unit/simulation/skills/swoop.test.ts`); регрессия swoop (существующие тесты).

### Шаг 5. Исполнитель «Удар по земле» + правило dazed (независим) — ✅ выполнен 2026-08-11
- **Адаптирован под union `kind`** (решение E плана [`ability-templates-kind-union.md`](./ability-templates-kind-union.md): новая механика = новый член union + фабрика): вместо исполнителя с константой `GROUND_SLAM_RADIUS` — параметризованный вид `kind: 'groundSlam'` (`radius`, `baseDamage` в шаблоне) и фабрика `createGroundSlamSkill` в `KIND_FACTORIES`.
- Создано: `src/simulation/skills/executors/groundSlamSkill.ts` (TargetMode `self`; `getAffectedPositions` — квадрат (2·radius+1)² от актуальной позиции кастера; `resolve` — DAMAGE-интенты всем damageable в радиусе кроме кастера, friendly fire; тег идентичности `skill.<id>` в интентах); `damageFormula.ts` += `ground_slam` (flat blunt); `src/simulation/content-rules/ground-slam-rules.ts` (`ground_slam_daze`: триггер `ENTITY_DAMAGED` с тегом `skill.ground_slam`, условие `eventRole: 'source'`, `applyStatus dazed 2` по `eventTarget`; подключено в `CONTENT_RULES`); шаблон `templates/abilities/ground-slam.ts` (`apCost 2`, `cooldown 4`, `aiPreparable true`, `radius 2`, `baseDamage 12` черновик, `ruleIds: ['ground_slam_daze']`); тексты ru/en; ассет-заглушка `skills/ground_slam.png`. Анимация — generic-дефолт, телеграф зоны автоматический (`getAffectedPositions`), presentation не менялся.
- Тесты: unit `tests/unit/simulation/skills/groundSlam.test.ts` (сборка через `getSkillExecutor`, 5×5, resolve по всем кроме кастера, теги); интеграция `tests/integration/combat-scenarios/ground-slam-scenario.test.ts` (dazed выжившим через правило, friendly fire, кастер не затронут, зона телеграфа через `getAbilityAffectedPositions`).

### Шаг 6. Тактика «приземление → столкновение» ← 4 (интерфейсно) — ✅ выполнен 2026-08-11
- Создать: `src/simulation/ai/tactics/ability.ts` — `findCollisionLanding(state, caster, abilityId, target): Position | null`: итерация `getValidTargets` в детерминированном порядке (расстояние до цели, затем x/y); цель в Chebyshev ≤ aoeRadius; направление `sign(target − landing) ≠ (0,0)`; клетка за целью — препятствие (за картой / непроходимый террейн / блокирующий объект / актор). Экспорт в `tactics/index.ts`.
- Тесты: `tests/unit/simulation/ai/tactics/ability.test.ts` — стена/актор/объект/свободная клетка/нет геометрии → null; детерминизм.

### Шаг 7. Стратегия `guardian-boss` + AIState ← 2,3,4,5,6 — ✅ выполнен 2026-08-11
- Изменить: `src/content/ids.ts` (`AI_STRATEGY_IDS` += `'guardian-boss'`); `src/simulation/ai/ai-state.ts` (`bossStage?: 1 | 2`, `bossTransitionPending?: boolean` — опциональные, сейвы не ломаются); вынос hunter FSM-хелперов в `ai-helpers.ts` (решение E).
- Создать: `src/simulation/ai/guardian-boss-strategy.ts`:
  - `updateState`: hunter FSM + переход `hp ≤ 50% maxHp && !bossStage` → `bossStage = 2; bossTransitionPending = true`.
  - `decideAction` по приоритетам: (1) `isBulwarked` → END_TURN; (2) `preparedAbility` → USE_ABILITY с подготовленными целями; (3) `bossTransitionPending` → сбросить флаг, `prepareAbility('ground_slam', [позиция босса])` + USE_ABILITY `bulwark`; (4) стадия 2, оба cd 0: AP > 1 → преследование/атака, AP ≤ 1 → подготовка Удара + каст Обороны; (5) `guardian_swoop` доступен, `findCollisionLanding` ≠ null, «конец хода» → подготовка Налёта + END_TURN (нет геометрии — придерживается); (6) hunter-поведение.
- Тесты: unit по образцу `hunter-strategy.test.ts` + интеграция: стадия 1 (придерживание без геометрии), переход (одноразовость, комбо на первом ходу после порога), стадия 2 (приоритет комбо, Оборона спадает до хода босса), срыв подготовки станом под Обороной, подготовка не сбрасывается Обороной.

### Шаг 8. Контент босса `cat_guardian` ← 7 — ✅ выполнен 2026-08-11
- Изменить: `src/content/templates/entities/cat-guardian.ts` — `abilities: ['guardian_swoop', 'ground_slam', 'bulwark']`, `aiStrategyId: 'guardian-boss'`, HP 80 → 90 (черновик, отметить балансным).
- Тесты: validate-content; интеграционный сценарий боя от ручного размещения; живая проверка — `DEBUG_SPAWN_ENTITY` (босс нигде не спавнится до плана босс-комнаты).

### Шаг 9. Документация и верификация ← все — ✅ выполнен 2026-08-11
- Документы (ниже); `npm run typecheck`, unit+integration тесты; проверить SYNC_STATUS.

## Документы для обновления

- `docs/game-design/first-boss-concept.md` — решение A (движковый иммунитет) в протокол решений + история.
- `roadMap.md` — выполненные пункты 1.3 (self-buff исполнитель).
- `docs/game-design/mechanics-overview.md` — bulwark, стадии босса, телеграфы.
- `docs/agents/AI_SYSTEM.md` — стратегия `guardian-boss`, тактика `ability.ts`.
- `src/simulation/AGENTS.md` — семантика bulwark, фабрика скиллов.
- `src/content/AGENTS.md` — поле `selfBuff` шаблона способности.
- `docs/recipes/add-ability.md` — `selfBuff` в процессе добавления способности.
- `docs/agents/SYNC_STATUS.md` — статусы + история.

## Риски и принятые ограничения

1. Цикл комбо фактически ~5 ходов вместо 4 (Оборона кулдаунится при касте, Удар — при исполнении на следующий ход); условие «оба cd 0» это корректно поглощает; корректировка — балансный проход 1.4.
2. `dazed` кратковременно висит на погибших Ударом целях (нет условия `isAlive` в condition-evaluator) — косметика, до CLEANUP.
3. Переход стадий при стане босса срабатывает на ближайшем реальном ходу (стан пропускает ход без вызова стратегии) — соответствует MVP-формулировке «в начале хода босса».
4. PUSH-иммунитет гасится без события — без визуального/лог-фидбэка «толчок поглощён» (пост-MVP).
5. Босс нигде не спавнится (`cat_guardian` вне пулов карт и `BOSS_TEMPLATE_IDS`) — живая проверка только debug-spawn до плана босс-комнаты.
6. Сейвы: у босса из старого сейва с HP < 50% переход сработает при первом ходе после загрузки — приемлемо, поля AIState опциональны.
7. Числа черновые: HP 90, уроны `guardian_swoop` ~10 / `ground_slam` ~12 — до балансного прохода 1.4.

## Журнал

| Дата | Событие |
|---|---|
| 2026-08-10 | План составлен по утверждённому концепту `first-boss-concept.md`; подтверждено исследованием кода (телеграф generic, порядок тиков, точки врезки). |
| 2026-08-10 | Пол «минимум 1 урона» снят из `damage-handlers.ts` (решение пользователя, первая итерация): нижняя граница — 0; для процентного урона граница 1 сохранена явным `min: 1` в правилах тиков яда/горения. Обновлены 4 теста, зависевших от пола (в т.ч. фикстуры cleave без оружия, маскировавшиеся полом). Решение A скорректировано: вопрос семантики multiply 0 снят вместе с полом. |
| 2026-08-10 | Выполнены шаги 1–3. Шаг 1: статус `bulwark` (тип в `StatusEffectType`, шаблон, тексты ru/en, иконка-заглушка, порядок в `statusSorting.ts`). Шаг 2: движковая семантика — `bulwark-helper.ts`, обнуление урона в `applyDamageToEntity` (событие с damage 0 эмитится), гашение PUSH, запрет действий в `canActorAct` без сброса подготовки; тесты `tests/unit/simulation/systems/bulwark.test.ts` и `tests/integration/combat-scenarios/bulwark-scenario.test.ts`. Шаг 3: поле `selfBuff` в `AbilityTemplateSchema`, фабрика `createSelfBuffSkill` + fallback в `getSkillExecutor`, способность `bulwark` (apCost 1, cooldown 4); тесты `tests/unit/simulation/skills/selfBuffSkill.test.ts`. Обновлены `src/simulation/AGENTS.md`, `src/content/AGENTS.md`, `docs/recipes/add-ability.md`, SYNC_STATUS. |
| 2026-08-11 | Выполнен шаг 4 по плану [`ability-templates-kind-union.md`](./ability-templates-kind-union.md) (решение C заменено на union `kind` + стейджинг): `AbilityTemplateSchema` — discriminated union по `kind` (8 видов: параметризованные `selfBuff`/`swoop` + 6 legacy), разрешение исполнителя — `KIND_FACTORIES` в `getSkillExecutor` (фабрика → кэш → legacy-реестр по id); `swoopSkill.ts` переписан на `createSwoopSkill(params)` (константы и инстанс удалены); шаблон `guardian_swoop` (3/1/10, apCost 2, cooldown 2, aiPreparable); валидация `statusType` self-buff в `validate-references.ts`; моки тестов мигрированы на union. Обновлены `src/content/AGENTS.md`, `src/simulation/AGENTS.md`, `docs/agents/CONTENT.md`, `docs/recipes/add-ability.md`, SYNC_STATUS. |
| 2026-08-11 | Выполнен шаг 5 (адаптирован под union `kind`, как шаг 4): новый параметризованный вид `kind: 'groundSlam'` (`radius`/`baseDamage` в шаблоне) вместо исполнителя с константой `GROUND_SLAM_RADIUS`; фабрика `createGroundSlamSkill` (TargetMode self, зона (2·radius+1)² от позиции кастера, DAMAGE всем damageable кроме кастера с тегом `skill.<id>`) + регистрация в `KIND_FACTORIES`; формула `ground_slam` (flat blunt); правило `ground_slam_daze` (`ground-slam-rules.ts`, условие `eventRole: 'source'`, dazed 2 по `eventTarget`) в `CONTENT_RULES`; шаблон `ground_slam` (radius 2, baseDamage 12 черновик, apCost 2, cooldown 4, aiPreparable) + тексты ru/en + ассет-заглушка. Анимация — generic-дефолт, телеграф зоны автоматический, presentation не менялся. Тесты: unit `groundSlam.test.ts` (6) + интеграция `ground-slam-scenario.test.ts` (3). Прогоны зелёные: typecheck, validate:content, validate:i18n, полный vitest (1574 теста). Обновлены `src/content/AGENTS.md`, `src/simulation/AGENTS.md`, `docs/agents/CONTENT.md`, `docs/recipes/add-ability.md`, SYNC_STATUS. |
| 2026-08-11 | Выполнены шаги 6–9 — план закрыт целиком. Шаг 6: тактика `findCollisionLanding` (`src/simulation/ai/tactics/ability.ts`): итерация `getValidTargets` в порядке (расстояние до цели, x, y), цель в зоне действия через `getAffectedPositions`, клетка за целью по направлению толчка — препятствие по семантике `executePushIntent` (позиция кастера исключена — к моменту толчка он прыгнул); экспорт в `tactics/index.ts`. Шаг 7: `AI_STRATEGY_IDS` += `guardian-boss`; `AIState` += опциональные `bossStage`/`bossTransitionPending` (сейвы не ломаются); hunter FSM-хелперы (`updateHunterState`/`handleHunterWorldChange`/`engagePlayer`) + `decideHunterAction` вынесены в `ai-helpers.ts` (решение E, поведение hunter не изменилось — его 9 тестов зелёные); новая стратегия `guardian-boss-strategy.ts` с приоритетами (1) bulwark → END_TURN, (2) исполнение подготовленного, (3) переход — немедленное комбо, (4) стадия 2 — комбо в конце хода (требует 1 AP на каст Обороны), (5) Налёт при геометрии столкновения в конце хода, (6) hunter-поведение; эвристика «конца хода» — `AP ≤ 1 || hunterAction === END_TURN` (решение F). Шаг 8: `cat_guardian` — `abilities: ['guardian_swoop', 'ground_slam', 'bulwark']`, `aiStrategyId: 'guardian-boss'`, HP 80 → 90 (черновик, отмечен балансным). Шаг 9: обновлены `AI_SYSTEM.md` (стратегия + тактика `ability.ts`), `mechanics-overview.md` (§2 union kind и 10 способностей, §3 статус bulwark, §7 стратегия), `roadMap.md` (статус 1.3), SYNC_STATUS. Тесты: unit `tactics/ability.test.ts` (8) + `guardian-boss-strategy.test.ts` (13), интеграция `guardian-boss-scenario.test.ts` (5, включая бой босса из шаблона через `createEnemy`). Прогоны зелёные: validate:content, typecheck, полный vitest (1600 тестов). Живая проверка debug-spawn не выполнялась (headless) — босс нигде не спавнится до плана босс-комнаты (риск 5). |
