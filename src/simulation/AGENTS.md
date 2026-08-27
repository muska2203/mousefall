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
| Добавить/изменить тайловый эффект | `docs/agents/TILE_EFFECTS.md` → `src/content/templates/tile-effects/`, `src/simulation/content-rules/rules.ts`, `src/simulation/skills/executors/` |
| Добавить реакцию мира | `systems/world-reactions/` |
| Добавить окно poi / изменить механику окна | `systems/poi-windows/` (интерфейс `PoiWindowMechanic`, реестр `POI_WINDOW_MECHANICS`) + рецепт `docs/recipes/add-poi.md` (раздел «Объект с окном») |
| Изменить ход | `simulation.ts`, метод `dispatch` |
| Изменить генерацию карт | `systems/mapgen.ts` (диспетчер) → `systems/map-generation/*-strategy.ts` |
| Добавить тип события | `core-types.ts` (union `GameEvent`) |
| Добавить/изменить игровой тег | `src/simulation/systems/tags/` (`tag-helpers.ts`, `tag-hierarchy.ts`, `weapon-tags.ts`) |
| Добавить/изменить тип урона | `src/simulation/systems/damage/damage-handlers.ts` + `src/simulation/systems/tags/weapon-tags.ts` + `src/simulation/systems/stats/effective-stats.ts` + `src/content/schemas.ts` |
| Добавить исполнитель способности | `src/simulation/skills/` |
| Добавить обработчик входящего урона | `src/simulation/systems/world-reactions/` (проверяй теги через `hasTag`) |
| Добавить/изменить террейн | `docs/recipes/add-terrain.md` → `src/content/templates/terrains/`; хелперы `state.ts` |

---

## Террейны (основа пола клетки)

- `GameMap.tiles[y][x]` хранит строковый id террейна (`TileType = string`, `core-types.ts`). Стена — тоже террейн (`walkable: false`).
- Дефолтные id для генерации: `DEFAULT_WALL_TERRAIN` / `DEFAULT_FLOOR_TERRAIN` (`systems/map-generation/shared.ts`).
- Проходимость — только через `isTerrainWalkable(id)` (`state.ts`): fail-safe, неизвестный id = непроходим. Не сравнивай тайлы с литералами `'wall'`/`'floor'`.
- «Можно ставить эффекты/спавнить» — отдельный критерий: `terrainHasTag(id, 'ground')` (`state.ts`). Не путать с проходимостью.
- Обзор: `blocksLOS` читает `blocksLOS` шаблона террейна; стоимость MOVE: `moveCost` террейна целевой клетки в `DefaultActionPointCostResolver`.
- Известное ограничение итерации: автопуть и AI-pathfinding (`findPath`, `utils/math.ts`) равностоимостные — `moveCost` влияет только на списание AP за одиночный шаг, а не на выбор маршрута.

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
`findFirstAttackableEntityAt`, `findAllEntitiesAt`, `findStairsAt`, `buildEntityPositionIndex`.

---

## Позиционный индекс сущностей

- Сущности хранятся в `GameState.entities` (реестр по id); позиционного индекса в состоянии **нет** — запросы «что на клетке» идут через хелперы `state.ts` (`findAllEntitiesAt`, `findDoorAt`, `isBlocked`, `blocksLOS` и др.).
- В горячих циклах (поклеточные проверки в FOV, A*-pathfinding) строй локальный индекс один раз через `buildEntityPositionIndex(state.entities)` и передавай его опциональным параметром `index` в read-хелперы — это O(1) на клетку вместо O(N) скана. Индекс не хранится в `GameState` и не переживает пересчёт.

---

## Теговая классификация и типы урона

- Игровые теги — это иерархические строки вида `a.b.c`. Родительские теги выводятся автоматически: `damage.physical.slashing` удовлетворяет проверке `damage.physical` и `damage`.
- Канонический способ классифицировать урон, доставку и эффекты — **теги**. Тип урона задаётся только через иерархические теги (`damage.physical.*`, `damage.magical.*`).
- Основные хелперы: `hasTag`, `hasAllTags`, `hasAnyTag`, `mergeDamageIntentTags` (`systems/tags/tag-helpers.ts`); `expandTag`, `expandTags` (`systems/tags/tag-hierarchy.ts`). `mergeDamageIntentTags` объединяет теги, гарантируя ровно один damage.*-тег, — используется для формирования DAMAGE-интентов; приоритет у первого встреченного damage-тега. Исключение — `addTags` правил-модификаторов в `content-rules/modifiers/apply-intent-modifiers.ts`: правило может добавить вторую «школу» урона (например, `relic_salamander_heart` делает урон оружия огненным), поэтому после модификаторов damage.*-тегов может быть несколько (roadmap 0.6).
- Теги оружия возвращает `getWeaponTags` (`systems/tags/weapon-tags.ts`). Безоружная атака имеет теги `attack.melee`, `target.single`, `delivery.weapon`, `delivery.unarmed`; её единственный тип урона — `damage.physical.blunt` (через `UNARMED_DAMAGE_DISTRIBUTION`).
- Слот оружия у игрока никогда не пустует: `unarmed` — реальный экземпляр предмета, экипируемый по умолчанию (при создании персонажа без стартового оружия — `systems/starting-equipment.ts`; при снятии оружия — `systems/actions/unequip-action.ts`). Снять `unarmed` нельзя (валидация UNEQUIP отклоняет с reason-кодом `cannot_unequip_unarmed`); при экипировке другого оружия поверх `unarmed` его экземпляр удаляется из инвентаря (`systems/actions/equip-action.ts`).

### Распределение урона по оружию

Каждое оружие описывает распределение типов урона через массив `damageDistribution` в `WeaponStatsSchema`. Каждая запись содержит:

```ts
{ damageTag: GameplayTag; weight: number }
```

- `damageTag` — полный тег типа урона, например `damage.physical.slashing` или `damage.magical.fire`.
- `weight` — множитель веса этого типа. Веса не нормализуются; запись с максимальным весом считается основным типом оружия.
- Как минимум одна запись должна иметь `weight > 0`.

### Хелперы урона

Расположены в `systems/tags/weapon-tags.ts`, `systems/stats/effective-stats.ts` и `systems/stats/weapon-damage-roll.ts`:

- `getEffectiveWeaponDamageRange(entity: Entity): DamageRange` — итоговый рейнж урона экипированного оружия после модификаторов (`applyDamageModifiers`: add/multiply применяются к обоим концам рейнжа).
- `rollWeaponDamage(state: GameState, actor: Entity): number` — ролл конкретного урона в момент удара из эффективного рейнжа (через `state.runtimeRng`), смещён вверх эффективной ловкостью по формуле `min + round((max − min) × u^(1/(1 + dex·DEX_DAMAGE_BIAS_K)))`. Используется в attack-action, контратаке и weapon-based скиллах.
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
- Weapon-based скиллы обычно используют `rollWeaponDamage` и/или `getPrimaryDamageTag`/`getWeaponWeightForTag` для расчёта урона от текущего оружия.

### Аффиксы экипировки

Экземпляр предмета экипировки несёт единый список `InventoryItem.affixes` (`ItemAffix {modifierId, value, origin}`): сначала фирменные аффиксы (`origin: 'fixed'`, из `fixedModifiers` шаблона, детерминированы), затем до 2 случайных (`origin: 'rolled'`): 1 положительный + до 1 отрицательного с шансом `NEGATIVE_AFFIX_CHANCE`. Сборка — один раз при создании экземпляра (`systems/item-affix-roll.ts`, `createItemAffixes(state.rng, template)`; фирменные — `buildFixedAffixes`, ролл — `rollItemAffixes`). Пул ролла фильтруется по `poolEligible` и `applicableSubtypes` и исключает модификаторы из `fixedModifiers` предмета и rule-модификаторы с ruleId, конфликтующим с фирменными; значение — из рейнжа уровня шаблона (`ranges[level-1]`, clamp к последнему; `scaling: fixed` → детерминированное `value`, `scaling: none` → `value = null`). При экипировке stat-аффиксы и правила применяются единым проходом только из `item.affixes`: stat превращаются в модификаторы с источником `item_{instanceId}` (снятие — общий `removeModifiersBySource`), rule добавляются в `activeRules` с `paramValue` экземпляра (доступно правилу через `ParametrizedValue {type: 'ownerParam'}`). У врагов экземпляров нет — их фирменные свойства читаются из шаблона: `collectFixedStatModifiers(template)` (спавн в `map-generation/shared.ts`, превью в `simulation.ts`) и `collectFixedRuleIds(template)` (в `rebuildActiveRules`).

---

## Детерминизм

- Одно начальное состояние + одна последовательность действий = один результат **геометрии уровня и начального спавна**.
- Генерация мира (карта, позиции врагов/предметов) — только через seeded RNG (`state.rng`).
- Игровые runtime-события (контратака, горение, лут, ролл скиллов предметов) используют `utils/random.ts` и не гарантируют повторяемость.
- Нет `Date.now()`, async-операций в игровой логике.
- Порядок обработки сущностей консистентен (сортировка по ID).

---

## Статус «Глухая оборона» (bulwark)

Движковая семантика (не контентные правила), хелпер `isBulwarked` (`systems/bulwark-helper.ts`, по образцу `stun-helper.ts`):

- Иммунитет к любому урону: `applyDamageToEntity` обнуляет `finalDamage`, но событие `ENTITY_DAMAGED` с damage 0 эмитится — статусы накладываются как обычно (контрплей срыва подготовки).
- Иммунитет к толчкам: PUSH гасится в `push-intent-executer.ts` без события (фидбэк — пост-MVP).
- Запрет действий носителя: `canActorAct` разрешает только END_TURN; в отличие от stunned — без SKIP_STUNNED_TURN и без сброса подготовленного скилла.
- Длительность тикает через общий TICK_STATUS_EFFECTS (спадает в setup фракции носителя до decideAction).

## Stat-модификаторы статусов (status statModifiers)

Движковая семантика поля `statModifiers` шаблона статуса (`StatusTemplateSchema`), хелпер `systems/statuses/status-stat-modifiers.ts`:

- Модификаторы применяются к актору при наложении **нового** статуса (source = `instanceId` экземпляра; при обновлении длительности существующего не переприменяются — как activeRules) и снимаются (`removeModifiersBySource`) на всех путях удаления: expire в TICK_STATUS_EFFECTS, вытеснение mutuallyExclusive, стеки → 0, конец `stunned`.
- Статы — общий набор `StatNameSchema`, включая `maxAp`: восстановление AP (`restore-ap-intent-executer`) и снапшот `getPlayerStats` читают эффективный maxAp (`getEffectiveMaxAp`, округление, ≥ 0). Пример контента — шаблон `dazed` (штраф −1 к maxAp).
- `ap` не клампится при спадании бафа: может временно превышать базовый maxAp до конца хода.

## Статус «Обездвижен» (rooted)
Движковая семантика (не контентные правила), хелпер `isRooted` (`systems/rooted-helper.ts`, по образцу `stun-helper.ts`):

- Запрет самостоятельного перемещения: `moveEntity.validate` отклоняет MOVE с reason-кодом `actor_rooted`; рывок (`executors/dashSkill.ts`) и прыжок (`executors/swoopSkill.ts`) не имеют валидных целей и резолвятся в пустой список интентов (в т.ч. для подготовленных AI-способностей).
- Атаки и способности по целям в досягаемости разрешены — в `canActorAct` rooted не участвует (в отличие от stunned/bulwark).
- Внешние перемещения (PUSH) не блокируются: толчок идёт через MOVE-интент мимо валидации действия — поэтому проверки стоят в действиях и исполнителях скиллов, а не в `executeMoveIntent`.
- Телепорт блокируется: исполнитель `TELEPORT_ENTITY` возвращает null для rooted-носителя, если интент не помечен `ignoreRooted` (системные телепорты — переход между этажами — помечаются явно, `floor-transition-reaction.ts`).
- AI: `decideHunterAction` (`ai/ai-helpers.ts`) под rooted не делает шагов — атакует только видимую цель в соседней клетке, иначе END_TURN.
- Длительность тикает через общий TICK_STATUS_EFFECTS.

## Сокрытие сущностей (concealsEntities)

Движковая семантика поля `concealsEntities` шаблона тайлового эффекта (взвешанная мука), хелперы `tileConcealsEntities` / `isEntityConcealedFrom` (`state.ts`, рядом с `blocksLOS`):

- Сущность на concealing-клетке видна наблюдателю только с дистанции ≤ 1 (Чебышёв); правило симметрично для игрока и AI.
- FOV-грид (`state.visible`) не меняется — клетки видимы, скрыта только сущность; инвалидация обзора не нужна, проверка выполняется в момент запроса.
- Точки применения: восприятие AI (`canSeePosition`/`canSeePlayer`), валидация позиционной атаки (reason `no_line_of_sight`), `getBasicAttackValidTargets`, `getDamageablePositionsWithinRange` (таргетинг способностей обеих сторон). На стороне показа — `isEntityConcealedFromPlayer` (`presentation/displayState/visibility.ts`): рендер врагов, hover/popover, подготовленные намерения AI, автопуть.
- Скрываются только акторы; статические объекты на concealing-клетках отображаются как обычно.

## Двери: `isLocked`, `indestructible`, контроллер босс-комнаты

- `DoorEntity.isLocked` — универсальное состояние «заперта» (инициализируется `false` в `createDoor`, `map-generation/shared.ts`). Запертую дверь нельзя открыть: `resolveInteraction` возвращает `null`, `interact-action` отвечает reason-кодом `door_locked`, движковый гард стоит в `executeOpenDoorIntent`; она непроходима для AI (`ai/tactics/movement.ts` — `isTilePassableForEnemy`/`findClosedDoorAt`), рывка (`executors/dashSkill.ts` — BUMP-остановка) и автопути игрока (`gameSession.ts`). Интенты `LOCK_DOOR`/`UNLOCK_DOOR` (lock открытой двери сначала закрывает её) + события `DOOR_LOCKED`/`DOOR_UNLOCKED` (эмитятся безусловно, как open/close; `aiPerceptionReaction` на них подписана).
- `DoorTemplateSchema.indestructible` — неразрушаемая дверь: `applyDamageToEntity` обнуляет любой урон по ней (по образцу bulwark, событие `ENTITY_DAMAGED` с damage 0 эмитится), `deathReaction` её не убивает.
- Контроллер босс-комнаты `systems/world-reactions/boss-room-reaction.ts`: `bossRoomDoorReaction` (ENTITY_MOVED игрока — вход в босс-комнату при живом боссе внутри → LOCK_DOOR всем живым дверям с тегом `boss_room`, открытую дверь исполнитель закрывает сам с событием DOOR_CLOSED; выход при живом боссе → UNLOCK_DOOR) и `bossRoomUnlockOnBossDeathReaction` (ENTITY_DIED босса + живых боссов не осталось → UNLOCK насовсем, актор интента — PLAYER_ID). Босс-комната находится через `state.map.rooms` + `state.mapParams.bossRoomTypeId`, её двери — по тегу шаблона `boss_room` через реестр контента (топология в состояние этажа не протягивается). Признак босса — `isBossTemplate(templateId)` (`systems/bossTracking.ts`), читает `isBoss` из реестра контента (`BOSS_TEMPLATE_IDS` удалён).
- Генератор (`tree-room-strategy.ts`) при заданном `params.bossPool` назначает `bossRoomTypeId` родителю exit-узла (самый дальний узел дерева), `rewardRoomTypeId` — exit-узлу, ставит на коридорах босс-узла двери шаблона `params.bossDoorId` (default `boss_door`; всегда, без пропуска «рядом есть дверь») и спавнит случайного босса из пула (seeded `state.rng`) в центре босс-комнаты.

## Базовая атака: позиционная и направленная формы

- `AttackAction` (`core-types.ts`) — две формы: направленная (dx, dy — legacy bump-attack по соседней клетке) и позиционная (`targetPosition?: Position` — выбор цели на клетке).
- Дальность оружия — хелпер `getWeaponAttackRange(entity): {minRange, range}` (`systems/stats/weapon-range.ts`) читает `weapon.range`/`weapon.minRange` шаблона (оба default 1; без оружия — 1/1).
- **Метрика дистанций в бою — Чебышёв (квадрат)**, единая с 8-направленным движением, AOE и FOV (радиус FOV квадратный — `systems/fov.ts`, без евклидова отсечения). Общий предикат дальности `isInWeaponRange(attackRange, from, to)` (там же): чебышёвская дистанция ∈ [minRange, range] — рукопашное оружие (1/1) бьёт все 8 соседних клеток, оружие с minRange 2 не бьёт ни по одной из них. `getWeaponAttackLosRadius` = `range` (квадратный FOV покрывает всю зону).
- Валидация позиционной формы (`systems/actions/attack-action.ts`): на клетке должна быть damageable-цель, предикат `isInWeaponRange`, LOS через `computeFOV` с радиусом `getWeaponAttackLosRadius`; reason-коды `no_target_at_tile`/`target_out_of_range`/`target_too_close`/`no_line_of_sight`.
- Дальнобойное оружие (minRange > 1) в упор не бьёт вообще: направленный bump отклоняется с reason-кодом `too_close_for_ranged_weapon` (деградации в unarmed нет; игрок видит тост, presentation по-прежнему может пытаться атаковать — решение на валидации).
- Известное ограничение: AI строит только направленный bump (`ai/tactics/movement.ts` — `attackTarget`), позиционной формы у него нет. Сейчас безопасно (враги не экипируют оружие), но враг с оружием `minRange > 1` не сможет атаковать вовсе — позиционную форму в AI добавлять вместе с первым дальнобойным врагом.
- API для UI: `getBasicAttackTargetMode()`/`getBasicAttackValidTargets()`/`getBasicAttackRangeCells()` в `GameSimulation`. Валидные цели — damageable-сущности в LOS по предикату `isInWeaponRange`; `getBasicAttackRangeCells` — ВСЕ клетки зоны (без LOS и без требования сущности, клетки ближе minRange не включаются) для подсветки радиуса.
- `findNearestAttackPosition(target)` — query автопути к врагу: ближайшая к игроку атакующая клетка (проходимая, `isInWeaponRange`, LOS из клетки-кандидата тем же FOV, что валидация атаки) + кратчайший путь до неё; пустой путь = игрок уже в позиции, null = кандидатов нет. Приоритет выбора: визуально ближайшая к игроку клетка (евклидова дистанция), при равенстве — кратчайший путь, затем координаты (y, x); длина пути намеренно вторична.

## Разрешение исполнителей способностей

`getSkillExecutor` (`skills/skillExecutor.ts`) собирает исполнитель фабрикой по `kind` шаблона (`AbilityTemplateSchema` — discriminated union по `kind`): карта `KIND_FACTORIES` покрывает все виды (`selfBuff`, `swoop`, `groundSlam`, `fireball`, `magicSlap`, `dash`, `suddenStrike`, `cleave`, `throw`, `search`) — забытый вид ловится компилятором. Исполнитель собирается из параметров шаблона и кэшируется; регистрации исполнителей не существует (legacy-реестр `registerSkill`/`initSkillRegistry` удалён 2026-08-12).

Вид `search` (2026-08-23, концепт этажа 1, п.5 §3): раскрытие скрытых ловушек в радиусе из шаблона (Чебышёв, только LOS) через интент `REVEAL_OBJECT`; targetMode `self`, урон отсутствует. Способность `search` выдаётся игроку врождённой — поле `innateAbilities` в `PlayerTemplateSchema`, применяется в `applyCharacterConfig` (пуш в `player.abilities` с `source: 'innate'` + `addActiveRulesForAbility`, по образцу innate-способностей врагов в `createEnemy`).

Затронутые клетки способности: опциональный метод `SkillExecutor.getTouchedPositions(state, caster, targets)` — клетки, которых реально коснулось применение; `use-ability-action` исполняет их интентом `TOUCH_TILES` последним в пачке — событием `TILES_AFFECTED`, дочерним к `ABILITY_USED`, чтобы момент тряски определялся позицией узла в дереве исполнения (у swoop — после приземления); Presentation автоматически добавляет тряску этих клеток (см. `docs/agents/PRESENTATION_CONTRACT.md` §2.9). Реализован для `search` (вся видимая зона поиска, явно) и `swoop` (derive из резолв-интентов `DAMAGE_TILE`).

Семантика столкновения `swoop` (2026-08-27): удар по земле — плоский урон `baseDamage` и радиальное отталкивание по квадрату `aoeRadius` БЕЗ центральной клетки (`buildAoeIntents`) — проходит и при свободном приземлении, и при подставке. Клетка с живым актором — валидная цель («подставка»: удвоенный `baseDamage` актору (без ошеломления) — вместо AoE по его клетке, из радиального отталкивания он исключён — жертву отпихивает PUSH на ближайшую свободную от непроходимых объектов соседнюю клетку прочь от кастера — `findVictimPushCell`, тай-брейки: евклидова дистанция² от начала каста по убыванию, затем y, затем x — а кастер приземляется на освободившуюся клетку). Жертва недвижима (под «Глухой обороной» или все соседние клетки заняты): вместо её отталкивания кастер сам отбрасывается на ближайшую к началу каста свободную клетку (`findRepelCell`, кольца Чебышёва 1–2 вокруг цели + исходная) — точечный урон жертве и удар по земле при этом проходят. Непроходимая цель (устаревший подготовленный прицел) — «отскок» (урона нет, dazed кастеру, тот же отброс). Перемещение жертвы толчком исполняется волной реакций позже прыжка кастера, поэтому JUMP приземления помечается `ignoreBlockedByEntityId` — опциональным полем `JumpIntent`, игнорирующим блокировку клетки указанной сущностью (обход в `emitEntityMoved`). Интент `DAMAGE_TILE` поддерживает опциональное `excludeEntityId` — сущность, которую удар по клетке не задевает (кастер в момент приземления); клетка при этом получает `TILE_DAMAGED` как обычно.

Урон способностей — фиксированные значения из параметров шаблона (без скейлинга от характеристик и уровня; реестр формул `damageFormula.ts` удалён 2026-08-12). Исключение — оружейные виды (`cleave`, `suddenStrike`): урон — ролл оружия (`rollWeaponDamage`). Модификаторы урона способностей вешаются через стандартные модификаторы и контентные правила.

Новая механика = новый член union + фабрика в `KIND_FACTORIES`; новый экземпляр существующего вида = чистый контент (шаблон + тексты).

Паттерн прицеливания: опциональный метод `SkillExecutor.getCastableCells` возвращает все клетки, куда способность в принципе может быть нацелена (независимо от наличия целей); query — `getAbilityCastableCells(abilityId)`. Реализован для `throw` (видимые клетки 8 лучей), `magicSlap` (видимые клетки радиуса) и `suddenStrike` (8 соседних клеток); у видов, где валидные цели уже совпадают с зоной каста (`fireball`, `dash`, `swoop`, `cleave`), паттерна нет. Presentation передаёт паттерн в `targetingOverlay.radiusCells` — рендерится тускло под яркой подсветкой валидных целей.

Мгновенное применение без выбора клетки: query `getAbilityAutoSelfTarget(abilityId)` (`simulation.ts`) возвращает клетку игрока, если единственная валидная цель и вся зона действия (`getAffectedPositions`) — клетка самого игрока (небоевые self-скиллы: `search`, `selfBuff`), иначе `null` (боевые self-AoE вроде `groundSlam` требуют подтверждения клеткой). Presentation в `GameSession.beginTargeting` при не-null результате диспатчит `USE_ABILITY` сразу, не включая режим таргетинга. Правило универсально: будущие скиллы «на себя/союзника» без союзников в радиусе получат авто-каст на себя тем же путём.

---

## Полная документация

- [`docs/agents/ACTION_SYSTEM.md`](../../docs/agents/ACTION_SYSTEM.md) — Action / Intent / Event
- [`docs/agents/TURN_FLOW.md`](../../docs/agents/TURN_FLOW.md) — ход игры
- [`docs/agents/AI_SYSTEM.md`](../../docs/agents/AI_SYSTEM.md) — AI врагов и тактические утилиты
- [`docs/agents/TESTING.md`](../../docs/agents/TESTING.md) — тестирование
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
