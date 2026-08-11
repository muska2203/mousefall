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

## Разрешение исполнителей способностей

`getSkillExecutor` (`skills/skillExecutor.ts`) разрешает исполнитель в два пути:

1. **Фабрика по `kind` шаблона** — для параметризованных видов (`AbilityTemplateSchema` — discriminated union по `kind`): карта `KIND_FACTORIES` (`selfBuff` → `createSelfBuffSkill`, `swoop` → `createSwoopSkill`). Исполнитель собирается из параметров шаблона и кэшируется в реестре. У kind с фабрикой зарегистрированного исполнителя быть не должно — неоднозначность устранена.
2. **Legacy-реестр по id** — для видов без параметров (`fireball`, `magicSlap`, `dash`, `counterattack`, `cleave`, `suddenStrike`): исполнители регистрируются в `initSkillRegistry` (`skills/index.ts`).

Новая механика = новый член union + фабрика в `KIND_FACTORIES`; новый экземпляр существующего параметризованного вида = чистый контент (шаблон + тексты).

---

## Полная документация

- [`docs/agents/ACTION_SYSTEM.md`](../../docs/agents/ACTION_SYSTEM.md) — Action / Intent / Event
- [`docs/agents/TURN_FLOW.md`](../../docs/agents/TURN_FLOW.md) — ход игры
- [`docs/agents/AI_SYSTEM.md`](../../docs/agents/AI_SYSTEM.md) — AI врагов и тактические утилиты
- [`docs/agents/TESTING.md`](../../docs/agents/TESTING.md) — тестирование
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
