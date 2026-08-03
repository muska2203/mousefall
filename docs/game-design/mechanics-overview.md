# Обзор механик для проектирования контента

> **Назначение.** Этот документ — точка входа для геймдизайнера: какие механики уже реализованы в проекте, какие «ручки» настройки они дают и каких механик не хватает. Источник правды — код (`src/simulation/`, `src/content/`); при изменении механик документ нужно актуализировать.
>
> Связанные документы: как добавлять контент — [`docs/agents/CONTENT.md`](../agents/CONTENT.md); крайние случаи правил — [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](../agents/CONTENT_RULES_EDGE_CASES.md).

---

## 1. Ядро: ход и бой

### 1.1 Пошаговая раундовая система

Раунд = фазы фракций в фиксированном порядке `player → allies → enemies → neutrals`, затем `environment-turn` (тик тайловых эффектов) и `round-recovery` (удаление мёртвых, сброс флагов). В начале хода фракции восстанавливаются AP, тикают статусы и кулдауны.

- Ручки: `maxAp` у шаблона сущности (по умолчанию 1); `factionId` (`player/allies/enemies/neutrals` — можно делать союзников и нейтралов).
- Файлы: `src/simulation/simulation.ts`, `docs/agents/TURN_FLOW.md`.

### 1.2 Очки действий (AP)

Стоимости: MOVE = `moveCost` террейна целевой клетки (fallback 1); ATTACK/INTERACT/EQUIP/UNEQUIP = 1; END_TURN = 0; USE_ABILITY = `apCost` шаблона (число или `'all'` — все текущие AP, максимум 3); USE_ITEM = `apCost` предмета. AP — главный балансный рычаг.

- Файлы: `src/simulation/systems/action-cost-resolver.ts`, `src/utils/constants.ts` (`MAX_ABILITY_ALL_AP_COST = 3`).

### 1.3 Атака, урон, броня, HP

Мили-атака по соседней клетке (bump-attack: движение во врага = атака). Броня вычитается **только из физического** урона (минимум 1); магический урон броню игнорирует. Попадания всегда точны: уклонение/точность/крит рассчитываются, но в боевых роллах **не используются** (см. §10 «Пробелы»). HP: игрок — 50 + vit×10; враги — `health.max` шаблона. Двери и пропы тоже разрушаемы (имеют HP/броню).

- Ручки: `combat.damage/armor` сущности, `weapon.baseDamage/baseArmor`, `damageDistribution` оружия, правила `modifyDamage`.
- Файлы: `src/simulation/systems/actions/attack-action.ts`, `src/simulation/systems/damage/apply-damage.ts`.

### 1.4 Характеристики и формулы урона

Базовые: `str, dex, int, vit`. Производные: урон (формула оружия), броня, maxHp, dodgeChance (dex×0.02), accuracy (dex×0.015), critChance (dex×0.01), critMultiplier (база 1.5). Модификаторы `StatModifier` (add/multiply, порядок multiply → add, уникальность по `source`).

Формулы урона оружия (выбираются `damageFormulaId`):

| ID | Формула |
|---|---|
| `unarmed` | 1 + str |
| `club` | base + str×1.5 |
| `dagger` | base + dex×1.2 |
| `staff` | base + int×0.5 |
| `sword` | base + str×0.8 + dex×0.5 |

- Файлы: `src/simulation/systems/stats/` (`weapon-formulas.ts`, `modifier-engine.ts`), `src/simulation/characterCreation.ts`.

### 1.5 Иерархические теги

Каноническая классификация — теги вида `a.b.c`: проверка по родителю работает автоматически (`damage.physical.slashing` удовлетворяет `damage.physical`). Теги на оружии/способностях/сущностях — главный механизм привязки правил.

- Семейства: `damage.physical.{slashing,piercing,blunt}`, `damage.magical.{fire,electric,poison,frost}`; `attack.{melee,ranged}`; `target.{single,multi,aoe}`; `delivery.{weapon,ability,projectile,spell,movement,unarmed}`; `effect.{burn,knockback}`; `reaction.counter`; `displacement.push`; `collision.*`; `status.*`; объектные `flammable`, `contains.oil`, `prop.barrel`; террейн `ground`.
- У оружия — `damageDistribution`: взвешенное распределение типов урона (например, «80% рубящий + 20% огненный»); запись с максимальным весом = основной тип.
- Файлы: `src/simulation/systems/tags/`.

---

## 2. Способности (скиллы)

Способность = контентный шаблон + кодовый исполнитель (`SkillExecutor`) + формула урона из реестра `src/simulation/skills/damageFormula.ts` (скейлинг от str/dex/int кастера и уровня скилла). Таргетинг: `self`, `single{range}`, `multi{range,count}`, `area{range,aoeRadius}`.

Ручки шаблона: `cooldown`, `apCost` (число или `'all'`), `damageTag` (ability-based урон), `requiredWeaponTags` (привязка к типу оружия), `aiPreparable` (AI может готовить на следующий ход), `tags`, `ruleIds`.

Существующие (7): `fireball` (AoE 3×3: центр 100%, периметр 50%; огонь, int), `magic_slap` (до 3 целей, электричество, `aiPreparable`), `dash` (рывок на 2 клетки, открывает двери, урон столкновения от str), `swoop` (прыжок + удар по земле AoE, `aiPreparable`), `cleave` (по цели и боковым клеткам, требует melee-оружие), `sudden_strike` (одиночный удар, требует melee-оружие), `counterattack` (self-бафф статуса на 2 хода).

- Файлы: `src/simulation/skills/`, `src/content/templates/abilities/`.
- Ограничение: численный урон не выносится в шаблон — новые формулы требуют кода.

---

## 3. Статусы

10 типов: `poisoned, burning, frozen, stunned, dazed, silenced, regenerating, counterattack, wet, oiled`. Экземпляр: `duration` (в ходах фракции носителя), `value`, `stacks`, `statModifiers`. Тик — в начале хода фракции носителя (у дверей/пропов — в `environment-turn`).

Система конфликтов: категории (`elemental/physical/mental/poison/generic`) с `categoryPriority` — один статус на категорию; `mutuallyExclusiveWith` (снимает старый); `blockedBy` (блокирует наложение).

Особые эффекты: `stunned` — пропуск хода, сбрасывает подготовленные скиллы; `silenced` — запрет способностей; `wet` снимает и несовместим с `burning`; `burning`↔`frozen` взаимоисключающи; `stunned` снимает `dazed`. Тики урона (яд 8% maxHp, горение 10% maxHp) заданы правилами — перенастраиваются контентом.

- Ручки: шаблон статуса (`ruleIds`, категория, приоритет, конфликты), параметры наложения (duration/value/stacks).
- Файлы: `src/simulation/systems/status-effect-ticker.ts`, `src/content/templates/statuses/`.

---

## 4. Контентные правила — главный инструмент дизайнера

Декларативный DSL: **триггер (событие/интент + теги) → условия → эффект → селектор целей**. Привязка к любому контенту через `ruleIds`. Новый контент с новым поведением часто создаётся **без изменения кода**. Порядок исполнения: слои `source → target → world (global → tileEffect → tileEffectStatus → object → tileIntrinsic) → radius`, внутри — `priority`, затем id.

- **Эффекты:** `applyStatus`, `dealDamage`, `heal`, `restoreAp`, `consumeAp`, `modifyDamage` (multiply/add + addTags; только интенты DAMAGE/DAMAGE_TILE), `counterAttack`, `applyTileEffectStatus`, `spawnTileEffect`.
- **Условия:** `chance`, `hasStatus`, `hasTag`, `entityHasTag`, `inTileEffect`, `tileEffectHasStatus`, `eventFieldEquals`, `eventRole`, `and/or/not`.
- **Селекторы:** `eventTarget`, `eventSource`, `self`, `collisionTarget`, `eventTileEffect`, `allInRadius`, `nearestEnemy`, `tilesInRadius`, `positionsInRadius`.
- **Числа (`ParametrizedValue`):** константа или ссылка на контекст (`eventDamage/eventAmount/eventDuration/eventStacks/eventMaxHp` × multiply, min, round).

Готовые правила-образцы для переиспользования: контратака (50%), вода→`wet`, масло→`oiled`, поджог масла огнём, урон и горение при входе в горящее масло, распространение горения, отравление от piercing/slashing (40%), ошеломление от blunt (25%), шипы брони, восстановление AP при ударе (15%), множители огненного урона (×1.5, +2, ×1.2 по горящим), урон и daze при столкновении после толчка, разлив масла из бочек с `contains.oil`, поджог `flammable`-объектов, лечение алтарём, урон колючек.

> **Важно:** текущий набор правил, предметов и способностей — тестовый: он создан для проверки работоспособности механик, а не как сбалансированный стартовый контент. Ориентируйтесь на него как на примеры использования DSL, а не как на готовый дизайн.

- Файлы: `src/simulation/content-rules/` (`types.ts`, `rules.ts`, `world-rules/global-rules.ts`).

---

## 5. Предметы и экипировка

- **Слоты экипировки (3):** weapon / armor / amulet. При экипировке применяются `equipModifiers` (add/multiply к любому стату включая базовые характеристики) и выдаются способности: `grantedAbilities` — гарантированные, `abilityPool` — одна роллится по весам при создании экземпляра (основа «проков» предметов).
- **Расходники (`USE_ITEM`):** реализованы эффекты `heal` (value HP), `buff` (пока жёстко `regenerating`), `spawn_tile_effect` (бросок материала в точку с LOS: вода/масло/дым; `radius`, `range` в шаблоне). `damage`/`teleport`/`identify` — заглушки в схеме.
- **Лут:** при смерти врага `lootDropTable` (взвешенное количество дропов) + `lootTable` (взвешенный выбор предметов) → дроп на свободную клетку рядом с трупом. Runtime random (не детерминировано seed'ом).
- **Инвентарь:** 20 ячеек, стаки (`stackable`/`maxStack`). У предметов есть `rarity` (common/rare/unique) и `value` — экономика не подключена (см. §10).
- Файлы: `src/simulation/systems/actions/equip-action.ts`, `use-item-action.ts`, `src/simulation/systems/world-reactions/post-death-loot-reaction.ts`, `src/content/templates/items/`.

---

## 6. Мир и окружение

### 6.1 Слоистая модель клетки

Клетка = террейн (ровно 1) + максимум 1 эффект слоя `cover` + максимум 1 эффект слоя `aboveGround` + объекты по слотам + актор. Слоты объектов: `solid` (дверь, проп, poi — несовместим ни с чем), `floorFixture` (лестница, ловушка), `loot` (контейнер предмета). Замена эффекта в слое даёт механику «вода смывает масло» (и наоборот).

- Слоты — `src/simulation/state.ts` (`getPlacementSlot`, `canPlaceObjectAt`).

### 6.2 Террейны

Статичный базис клетки. Ручки шаблона: `walkable`, `moveCost` (AP за вход; песок = 2), `blocksLOS`, `standing` (псевдо-3D отрисовка), `tags` (`ground` — можно ставить эффекты и объекты), `ruleIds`. Существующие: `floor`, `sand`, `wall`.

- Файлы: `src/content/templates/terrains/`.
- Ограничение: `moveCost` влияет только на списание AP; автопуть и AI-pathfinding равностоимостные.

### 6.3 Тайловые эффекты (материалы)

Динамические материалы на клетках. Принцип «материал ≠ механика»: сами эффекты урона не наносят, всё поведение — через `ruleIds` и статусы. Движение не блокируют никогда; могут блокировать обзор (`blocksLOS`). Длительность тикает раз в раунд; `durationDecreasesWhenHasStatus` — тик только при наличии статуса (масло стоит вечно, пока не горит). Повторный спавн того же типа продлевает длительность.

- Существующие: `water` (cover, → `wet`), `oil` (cover, горит и взрывается), `smoke` (aboveGround, `blocksLOS`).
- Статусы эффектов: шаблон `burning` (урон при входе, поджог стоящих, распространение на соседнее масло, взрыв при поджоге через world-реакцию, авто-поджог свежего масла рядом с огнём).
- Источники — расходники `water_ball`, `oil_bottle`, `smoke_bomb`.
- Файлы: `docs/architecture/TILE_EFFECTS.md`, `src/content/templates/tile-effects/`, `tile-effect-statuses/`.

### 6.4 Объекты

- **Двери:** открытие/закрытие (1 AP, с соседней клетки), HP/броня (разрушаемы), закрытая блокирует движение и LOS, горючие (`flammable` + `canHaveStatus: [burning]`), события дверей будят AI. Пример: `wooden_door` (3 HP).
- **Пропы:** разрушаемые, `blocksMovement`/`blocksLOS`, теги. Пример: `oil_barel` (`contains.oil`, `flammable`) — при гибели разливает масло, если горел — горящее.
- **POI (точки интереса):** неразрушаемые, непроходимые, разовость через `charges`, эффект декларативно через `ruleIds` на событие `POI_USED`. Пример: `altar` (1 заряд, лечение 25).
- **Ловушки:** проходимые, `initiallyHidden` (не видны до срабатывания), `oneShot` (одноразовая уничтожается; постоянная раскрывается и срабатывает повторно). Срабатывание — правило с триггером `ENTITY_MOVED`. Пример: `spikes` (одноразовые, 10 piercing). Обезвреживание не реализовано.
- Файлы: `src/content/templates/{doors,props,pois,traps}/`, рецепты `docs/recipes/add-poi.md`, `add-trap.md`.

### 6.5 Перемещения и столкновения

Интенты `JUMP`, `PUSH`, `TELEPORT_ENTITY`. Толчок: свободная клетка → перемещение; препятствие → `ENTITY_COLLIDED` (wall/actor/blocking-object). Глобальные правила: при столкновении после толчка обе стороны получают 5 blunt-урона и `dazed` на 2 хода — окружение становится оружием.

- Файлы: `src/simulation/systems/intents/push-intent-executer.ts`, `src/simulation/content-rules/world-rules/global-rules.ts`.

### 6.6 Зрение и туман войны

FOV игрока — recursive shadowcasting, радиус 8. Две сетки: `visible` (пересчёт после каждого действия) и `explored` (раз виденное — навсегда), сохраняются per-этаж. LOS блокируют независимо: террейн, закрытая дверь, проп, тайловый эффект с `blocksLOS` (дым). Таргетинг скиллов и расходников использует тот же FOV. У AI свой обзор (`aiSightRadius`).

- Ручки: `PLAYER_SIGHT_RANGE` (константа), `blocksLOS` на террейнах/пропах/эффектах, `aiSightRadius` у врагов.
- Файлы: `src/simulation/systems/fov.ts`.

### 6.7 Этажи и переходы

Подземелье — этажи 1..10 (`MAX_FLOOR`). Переход только игроком и только стоя на лестнице. Уходя с этажа, игра сохраняет снапшот (карта, сущности, explored, тайловые эффекты, RNG); при возврате этаж восстанавливается «как было» (эффекты не тикают, пока этаж неактивен). Игрок появляется на противоположной лестнице, AP восстанавливаются.

- Файлы: `src/simulation/systems/floor-transition-planner.ts`, шаблоны `src/content/templates/stairs/`.

---

## 7. AI врагов

«Стратегия решает что, утилиты — как». Стратегия выбирается `aiStrategyId` в шаблоне врага; состояние FSM — в `enemy.aiState`.

- **`hunter`** — FSM idle→chase→return: видит игрока → сближение и атака; теряет цель → идёт к последней позиции → возвращается домой.
- **`simple-boss`** — не двигается и не бьёт обычной атакой; видя игрока, **готовит** `aiPreparable`-способность (телеграф `ABILITY_PREPARED`) и исполняет её на следующий ход. Стан/немота отменяют подготовку.

Восприятие: `aiSightRadius` (default 6) + LOS; вне хода — уведомления о движении игрока и открытии/закрытии дверей.

- Ручки: `aiStrategyId`, `aiSightRadius`, innate `abilities`, флаг `aiPreparable` у способностей, `maxAp` врага, `equipment` врага.
- Файлы: `src/simulation/ai/`, `docs/agents/AI_SYSTEM.md` (`[DRAFT]` — источник правды код).

---

## 8. Генерация этажей

Единственная стратегия — `tree` (дерево комнат от спавна к выходу + коридоры с закрытыми дверями на концах). Seeded RNG — геометрия воспроизводима по seed.

Ручки `MapParams`: `width/height`, `minRooms/maxRooms`, `minRoomSize/maxRoomSize`, `enemyDensity` (1.0 ≈ враг на 4×4 клеток комнаты), `itemDensity` (шанс предмета на комнату), `enemyPool`, `itemPool`. Существующие карты: `default`, `floor_1`, `floor_2`.

- Файлы: `src/simulation/systems/map-generation/`, `src/content/templates/maps/`.

---

## 9. Прогрессия и создание персонажа

- **Создание персонажа:** выбор шаблона игрока (`starterEquipment` на выбор, `baseStats`), распределение 10 очков по 4 характеристикам. Классов нет — «класс» = шаблон игрока + стартовый набор. 7 шаблонов в `src/content/templates/players/`.
- **Статистика забега (`runStats`):** убийства, поднятые предметы, убитые боссы (`defeatedBossIds`; список боссов пока захардкожен). Фазы игры: `playing/dead/victory`.
- **Опыт и уровни — НЕ работают**, см. §10.

---

## 10. Пробелы: каких механик не хватает

Важно при планировании контента — эти вещи либо заготовки, либо отсутствуют.

### 10.1 Заявлено в схемах/типах, но не реализовано

| Механика | Что есть | Чего нет |
|---|---|---|
| Опыт и level-up | поля `xp/level`, `xpReward` у врагов, таблица `XP_PER_LEVEL` (10 ур.), событие `PLAYER_LEVELED_UP`, `source: 'levelup'` у способностей | начисление xp и повышение уровня |
| Уклонение/точность/крит | статы считаются (dodge/accuracy/critChance/critMultiplier), событие `ENTITY_MISSED` | использование в боевых роллах (попадание всегда точное) |
| Расходники damage/teleport/identify | значения в схеме эффектов | реализация (работают только heal/buff/spawn_tile_effect) |
| Экономика | `value`, тип `gold` у предметов | торговля, золото как механика |
| Сундуки | поле статистики `chestsOpened` | сами сундуки |
| `luck` | поле в `CharacterAttributes` | ни на что не влияет |
| Обезвреживание/поиск ловушек | концепт описан | реализация (обнаружение — только срабатыванием) |

### 10.2 Ограничения генерации мира

- Генератор размещает только врагов, лут, двери и лестницы. **Пропы, poi, ловушки и не-floor террейн (песок) на этажах не спавнятся** — только через debug-действия или доработку генератора. В `MapParams` нет пулов пропов/ловушек/poi/террейнов.
- Стратегия генерации одна (`tree`); ручного размещения объектов в `MapParams` нет.
- Мировой слой правил `terrain` (правила на террейнах) — отложенная фаза 6 слоистой модели; трансформация террейна правилами не реализована.

### 10.3 Ограничения AI и путей

- AI не учитывает тайловые эффекты, дым и `moveCost` при выборе пути/цели; не уклоняется от раскрытых ловушек (запланировано в фазе 6).
- Автопуть игрока равностоимостный — маршрут через песок не избегается.
- AI-стратегий две (`hunter`, `simple-boss`).

### 10.4 Ограничения выразительности правил

- Условия не применяются к модификаторам интентов (`modifyDamage` срабатывает по триггеру+тегам, без `conditions`).
- `ParametrizedValue` не поддерживает divide/add/max и ссылки на статы сущностей.
- Желаемые правила, которым не хватает выразительности DSL (выявлены при разборе ограничений): AP при убийстве, блок щитом, лечение при убийстве, яд снижает урон.
- Формализованный каталог игровых тегов не заведён (невыполненная фаза 3 типизации ID контента): теги — свободные строки без единого реестра и валидации.

### 10.5 Захардкожено в коде (не вынесено в контент)

- Параметры взрыва горящего масла: урон 2, радиус 1 (`burning-oil-explosion-reaction.ts`).
- Эффект `buff` расходников — всегда `regenerating`.
- Список боссов (`cat_king, owl_lord, rat_king, moth_queen` — планируется флаг `isBoss`).
- Формулы урона способностей (`damageFormula.ts`), формулы урона оружия, AI-стратегии — расширяются только кодом (+ запись в `src/content/ids.ts`).

---

## 11. Выводы для контент-планирования

- **Без изменения кода** можно создавать: врагов, предметы (оружие/броня/амулеты/расходники-бросалки), ловушки, poi, террейны, тайловые эффекты и их статусы, способности на базе существующих исполнителей, этажи — и, главное, **новое поведение через контентные правила + теги** (экологические комбо типа «масло + огонь» — эталон связки).
- **Требуют кода:** новые формулы урона (оружия и скиллов), AI-стратегии, новые эффекты скиллов и расходников, спавн объектов в генераторе, прогрессия (xp/level), боевые роллы (уклонение/крит), экономика.
- При добавлении контента следуй рецептам в `docs/recipes/` и проверяй `npm run validate:content`.

---

## История изменений

| Дата | Что изменилось |
|---|---|
| 2026-08-02 | Первоначальная версия: обзор механик по состоянию кода (ядро, правила, предметы, мир, AI, генерация) и перечень пробелов. |
