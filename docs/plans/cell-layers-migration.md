# План: переход на слоистую модель клетки

> **Источник:** концепт [`docs/concepts/cell-layers-model.md`](../concepts/cell-layers-model.md).

---

## Общие правила для всех фаз

- После изменений TypeScript: `npm run typecheck`, `npm test`; после изменений контента: `npm run validate:content`.
- Каждая фаза завершается рабочим состоянием игры с зелёными тестами.
- Обновить `docs/agents/SYNC_STATUS.md`: добавить строку о статусе концепта/фазы.
- Отметить выполнение фазы в таблице «Прогресс» в конце этого файла.
- Минимальные изменения: не рефакторить смежный код вне списка шагов.

## Зависимости фаз

```
Фаза 1 (террейн)      ── независима
Фаза 2 (слои эффектов) ── независима
Фаза 3 (air/дым)      ── требует фазу 2
Фаза 4 (объекты/алтарь) ── независима; добавляет мировой слой правил `object`
Фаза 5 (ловушки)      ── требует фазу 4
Фаза 6                 ── опционально, требует фазы 1–2
```

Группы (1), (2→3), (4→5) независимы между собой, но выполняем в порядке нумерации.

---

## Фаза 1. Террейн (основа пола)

**Цель:** заменить `TileType = 'floor' | 'wall'` на строковые id террейнов с контентными шаблонами (`walkable`, `moveCost`, `blocksLOS`, `tags`, `ruleIds`). Пример: **песок** с `moveCost: 2`.

**Контекст для чтения:** `src/simulation/core-types.ts:34-68` (GameMap), `src/content/schemas.ts`, `src/content/loader.ts`, `src/content/registry.ts`, `docs/recipes/add-prop.md` (образец добавления контент-типа).

### Шаги

1. **Схема** (`src/content/schemas.ts`): `TerrainTemplateSchema` — `id`, `walkable: boolean`, `moveCost: int ≥ 1 (default 1)`, `blocksLOS: boolean (default false)`, `tags: TagsSchema`, `ruleIds: RuleIdsSchema`; `export type TerrainTemplate`. В `LoadedContent` добавить `terrains?: Map<string, TerrainTemplate>` — **опционально**, по образцу `props` (сотни тестовых моков собирают `LoadedContent` литералом; обязательное поле их сломает).
2. **Загрузчик** (`src/content/loader.ts`): поле `terrains: z.array(z.string())` в `ManifestSchema` (сделать `.default([])`, чтобы старый манифест не упал до перегенерации), `loadCategory(manifest.terrains, TerrainTemplateSchema, ...)`, сборка `terrains: new Map(...)`.
3. **Реестр** (`src/content/registry.ts`): `LocalizedTerrainTemplate` + `getTerrain/tryGetTerrain/getLocalizedTerrain/tryGetLocalizedTerrain/getAllTerrains/getAllLocalizedTerrains` по образцу tileEffects; везде паттерн `(getRegistry().terrains ?? new Map())`.
4. **Тексты**: `terrain: Record<string, ContentText>` в `ContentTexts` (`src/content/texts/types.ts`); файлы `src/content/texts/{ru,en}/terrain.ts`; подключить в обоих `index.ts`.
5. **Скрипты**: `scripts/generate-manifest.js` — `'terrains': 'terrains'` в `CATEGORY_MAP` + `terrains: []` в `categorize()`, перегенерировать манифест; `scripts/validate-content.ts` — `{key: 'terrain', map: registry.terrains}` в `validateTranslations()`; `src/simulation/content-rules/validation.ts` — цикл по `content.terrains` в `validateContentRuleReferences` (там же заодно добавить `props`/`doors`, если ещё нет).
6. **Тип** (`src/simulation/core-types.ts`): `TileType` → `type TileType = string` (имя оставить — минимизирует дифф); `GameMap.tiles` остаётся `TileType[][]`, но семантика — id террейна.
7. **Дефолтные террейны**: константы `DEFAULT_WALL_TERRAIN = 'wall'`, `DEFAULT_FLOOR_TERRAIN = 'floor'` в `src/simulation/systems/map-generation/shared.ts`; заменить литералы в `createTileGrid` (`src/simulation/state.ts:103`), `carveRoom/carveHCorridor/carveVCorridor` (`map-generation/shared.ts:38-58`), `tree-room-strategy.ts` (:717, :746).
8. **Проходимость** — заменить проверки `=== 'wall'` на `tryGetTerrain(id)?.walkable === false` (неизвестный id = непроходим, fail-safe): `src/simulation/state.ts:294` (`isBlocked`), `src/simulation/simulation.ts:1107` (`isTileWalkableForPlayer`), `src/simulation/ai/tactics/movement.ts:58`, `src/simulation/systems/intents/push-intent-executer.ts:49`, `src/simulation/skills/executors/dashSkill.ts:45,170`, `swoopSkill.ts:42,73`, `src/simulation/systems/loot-spawn.ts:19`. Вынести хелпер `isTerrainWalkable(terrainId)` в `state.ts`.
9. **«Только floor»-фильтры** — это НЕ проверки проходимости, а «можно ставить эффекты/спавнить». Ввести тег `ground` в шаблонах и хелпер `terrainHasTag(id, 'ground')`: `src/simulation/simulation.ts:1066`, `src/simulation/systems/actions/use-item-action.ts:116`, `debug-spawn-entity-action.ts:39`, `debug-spawn-tile-effect-action.ts:35`, `src/simulation/systems/intents/tile-effect-intent-executor.ts:76`.
10. **blocksLOS** (`src/simulation/state.ts:304`): первой проверкой — `tryGetTerrain(id)?.blocksLOS === true` (вместо `tile === 'wall'`).
11. **moveCost** (`src/simulation/systems/action-cost-resolver.ts:32`): для `MoveAction` стоимость = `tryGetTerrain(tiles[y+dy][x+dx])?.moveCost ?? 1`. Списание AP уже централизовано в `GameSimulation.executeAction` (`simulation.ts:854-906`), менять не нужно. **Ограничение итерации:** автопуть и AI-pathfinding (`src/utils/math.ts:167` `findPath`) остаются равностоимостными — зафиксировать в доке как известное ограничение.
12. **Рендер**: `src/presentation/displayState/types.ts:41` — `DisplayTile.type: string`; `builder.ts:49` (`toDisplayTile`); `src/ui/renderer/spriteRegistry.ts:14` — `getTileSprite(id)` вместо switch: конвенция `/assets/tiles/<id>.png` (положить `floor.png` — копия `floor1.png` — и `wall.png` уже есть). `TileRenderer` не трогать.
13. **Контент**: `public/content/terrains/floor.json` (walkable, moveCost 1, tags `["ground"]`), `wall.json` (walkable false, blocksLOS true), `sand.json` (walkable, moveCost 2, tags `["ground"]`); манифест; тексты ru/en; спрайт `public/assets/tiles/sand.png` через `scripts/gen-placeholder-sprite.py`.
14. **Песок в игре**: размещение песка генератором НЕ входит в фазу (проверка через debug/тесты на кастомной карте).

### Тесты

- Обновить `tests/fixtures/gameState.ts`: `makeTestMap` на id + регистрация тестовых шаблонов террейнов (по образцу `initObjectContentRegistry`); массово затронуты тесты с литералами `'floor'/'wall'` (fov, movement, skills, tree-room-strategy, autoPath, builder…).
- Новые: схема/реестр террейнов; `isBlocked`/`isTileWalkableForPlayer` от `walkable`; `blocksLOS` от террейна; `moveCost` в resolver (шаг на песок = 2 AP); интеграция — движение по песку тратит 2 AP.

### Документация

- `docs/recipes/add-terrain.md` + строка в `docs/recipes/README.md`.
- `src/content/AGENTS.md` (новая категория), при необходимости `src/simulation/AGENTS.md`.
- `docs/architecture/OVERVIEW.md` — упоминание террейна; в концепте отметить «фаза 1 реализована».

### Риски

- Много мест с литералами `'floor'/'wall'` — полный grep обязателен до завершения.
- Тестовые моки `LoadedContent` — поэтому поле опциональное.
- Путаница «непроходим» vs «нельзя спавнить» — шаги 8 и 9 разводят эти критерии явно.

---

## Фаза 2. Уникальность тайловых эффектов по слою

**Цель:** клетка `tileEffects[y][x]` хранит максимум один эффект каждого слоя; `TileEffectLayer` → `'cover' | 'aboveGround'`; спавн заменяет эффект того же слоя.

**Зависимости:** нет.
**Контекст для чтения:** `docs/architecture/TILE_EFFECTS.md`, `src/simulation/core-types.ts:134-159`, `src/simulation/systems/intents/tile-effect-intent-executor.ts`.

### Шаги

1. **Типы** (`src/simulation/core-types.ts`): `TileEffectLayer` → `'cover' | 'aboveGround'`; `TileEffects` → `Partial<Record<TileEffectLayer, TileEffectInstance>>`.
2. **Хранение/чтение развести**: внутри состояния и сериализации — структура по слоям. `getTileEffectsAt` (`src/simulation/state.ts:282`) по-прежнему возвращает `Record<type, TileEffectInstance>` (производную, ≤2 записей) — это сохраняет без изменений `condition-evaluator.ts` (`inTileEffect`, `tileEffectHasStatus`), `rule-context.ts` (`tileEffectsAtEventPosition`), `oil-ignition-near-burning-reaction.ts`.
3. **Исполнители** (`tile-effect-intent-executor.ts`):
   - `executeSpawnTileEffectIntent`: найти эффект того же слоя в клетке; если тот же `type` — продление `duration` (как сейчас); если другой — удалить через `executeRemoveTileEffectIntent` (событие `TILE_EFFECT_REMOVED`), затем создать новый (`TILE_EFFECT_CHANGED`). Удалить обработку `blockedByTileEffects`/`mutuallyExclusiveWithTileEffects`.
   - `executeRemoveTileEffectIntent`, `executeTickTileEffectsIntent`, оба status-исполнителя, `ensureTileEffectsCell` — доступ к ячейке по слою, а не по типу-ключу.
4. **Сбор правил** (`content-rule-reaction.ts:167-209`): итерировать значения ячейки (по слоям) вместо `Object.keys` по типам; `resolveTilesInRadius` (:370) — искать эффект по `instance.type === selector.effectType`.
5. **Схема** (`src/content/schemas.ts:208-230`): удалить поля `blockedByTileEffects` и `mutuallyExclusiveWithTileEffects`; обновить `.describe()` у `layer`. Удалить эти поля из `public/content/tile-effects/{water,oil}.json`.
6. **Presentation** (`src/presentation/displayState/builder.ts`): `getTileEffectOverlays` (:54) — итерировать эффекты ячейки; сортировка — сначала `cover`, затем `aboveGround`, внутри слоя по `renderOrder` (air всегда поверх cover); `createPatch` (:287-317) и `applyPatch` (:501) — под новую форму ячейки.
7. **Сериализация**: тип `FloorSnapshot.tileEffects` (`src/simulation/types.ts:597`), `SetMapIntent.tileEffects` (`core-types.ts:387`), `createTileEffectsGrid` (`state.ts:110`), `floor-transition-planner.ts` — тип меняется автоматически, проверить тесты восстановления этажа.

### Тесты

- Обновить `tests/fixtures/gameState.ts:311` (форма сетки).
- `tests/unit/simulation/intents/tile-effect-intent-executor.test.ts`: сценарии `blockedBy`/`mutuallyExclusive` заменить на «замена внутри слоя».
- Интеграция `tests/integration/tile-effects/*`: вода и масло — оба `cover`, сценарии вытеснения должны пройти через замену слоя без изменения поведения.
- Новый тест: сосуществование cover + aboveGround на одной клетке (шаблон с `layer: 'aboveGround'` из фикстуры).

### Документация

- `docs/architecture/TILE_EFFECTS.md`: §3 (модель данных), §8 (решения: «Взаимоисключение вместо отдельного преобразования» → «замена внутри слоя»; «Слои»).
- `docs/agents/TILE_EFFECTS.md`: шаг 1 (поля шаблона), «Частые ошибки».

### Риски

- События удаления/создания при замене слоя должны сохранить порядок REMOVED → CHANGED (от него зависят реакции и патчи).
- Существующие JSON-контент и тексты не должны сломаться до правки схемы — править схему и JSON одним шагом.

---

## Фаза 3. Air-эффекты: дым с blocksLOS

**Цель:** первый эффект слоя `aboveGround` — **дым**, блокирующий обзор (`blocksLOS`), но не движение.

**Зависимости:** фаза 2.
**Контекст для чтения:** `src/simulation/systems/fov.ts`, `blocksLOS` в `src/simulation/state.ts`, `docs/agents/TILE_EFFECTS.md` (процесс добавления эффекта).

### Шаги

1. **Схема** (`src/content/schemas.ts`): `blocksLOS: z.boolean().default(false)` в `TileEffectTemplateSchema`.
2. **LOS** (`blocksLOS` в `src/simulation/state.ts`; после фазы 1 первая проверка — террейн через `tryGetTerrain(tile)?.blocksLOS === true`): после проверок террейна/двери/пропа — `getTileEffectsAt(state, x, y)` → если любой эффект клетки имеет `tryGetTileEffect(type)?.blocksLOS === true` → true. После фазы 2 `getTileEffectsAt` возвращает производную запись «ключ — тип эффекта» от слоевой ячейки, поэтому проверка по типам работает без изменений; сырую ячейку (ключ — слой) здесь читать не нужно.
3. **Инвалидация FOV** (ключевой подводный камень): FOV пересчитывается только после действий игрока и по `UPDATE_FOG`. Появление/исчезновение дыма должно пересчитывать обзор: добавить мировую реакцию на `TILE_EFFECT_CHANGED`/`TILE_EFFECT_REMOVED` — если шаблон эффекта имеет `blocksLOS`, породить `UPDATE_FOG`.
4. **Контент**: `public/content/tile-effects/smoke.json` (`layer: 'aboveGround'`, `blocksLOS: true`, разумная `duration`, `ruleIds: []`); регистрация в манифесте; тексты в `src/content/texts/{ru,en}/tile-effects.ts`; спрайт `public/assets/tile-effects/smoke.png` (рендерер берёт `/assets/tile-effects/<id>.png` — существующая конвенция).
5. **Источник дыма**: расходник `smoke_bomb` по образцу `water_ball` (`consumable.effect: 'spawn_tile_effect'`, `tileEffectType: 'smoke'`) — JSON, манифест, тексты, спрайт `public/assets/items/smoke_bomb.png`; анимация `ITEM_THROW` подхватится автоматически. **Решение (принято в начале фазы):** полный цикл через расходник `smoke_bomb` — он проверяет путь создания эффекта из обычной игры (интеграционный тест `tests/integration/tile-effects/smoke-fov.test.ts` использует `USE_ITEM`).

### Тесты

- Unit: `blocksLOS` с эффектом на клетке (дым блокирует, вода — нет).
- Интеграция: дым между игроком и клеткой скрывает клетки за собой; после исчезновения дыма обзор восстанавливается (пересчёт FOV по событию).
- Замена внутри слоя: второй дым/другой air-эффект заменяет первый; cover и air сосуществуют на клетке.

### Документация

- `docs/architecture/TILE_EFFECTS.md` (поле `blocksLOS`, пример air-слоя, инвалидация FOV).
- `docs/agents/TILE_EFFECTS.md` (шаг 1 — новое поле).

### Риски

- Без шага 3 дым визуально «не работает» до следующего хода игрока — обязательно покрыть тестом.
- AI не учитывает дым (осознанное ограничение, зафиксировать в доке).

---

## Фаза 4. Объекты: слоты размещения, точка интереса (алтарь)

**Цель:** (а) единые правила совместимости объектов на клетке — слоты `solid`/`floorFixture`/`loot`; (б) новый вид сущности «точка интереса» — непроходимая, неразрушаемая, интерактивная; пример — **алтарь** с разовым эффектом через `ruleIds`; (в) мировой слой правил `object` в `ContentRuleReaction`. Кучи лута исключены из концепта (решение 2026-07-30) — контейнер лута остаётся одиночным предметом.

**Зависимости:** нет.
**Контекст для чтения:** `src/simulation/types.ts:87-295`, `src/simulation/systems/interactions/resolve-interaction.ts`, `src/simulation/systems/actions/interact-action.ts`, `src/simulation/content-rules/reaction/content-rule-reaction.ts:140-262`, `docs/agents/CONTENT_RULES_EDGE_CASES.md`.

### Шаги

1. **Слоты размещения**: функция `getPlacementSlot(entity): 'solid' | 'floorFixture' | 'loot' | null` в `src/simulation/state.ts` (вывод из типа: door/prop/poi → solid; stairs → floorFixture; floor_item_container → loot; акторы → null) + `canPlaceObjectAt(state, slot, position)`: solid несовместим со всеми объектами; floorFixture несовместим с solid и floorFixture; loot совместим с floorFixture, максимум один loot.
2. **Применить слоты**: `debug-spawn-entity-action.ts:60-70` (заменить ad-hoc `tile_occupied`/`tile_blocked`), `spawn-item-intent-executor.ts`, `interact-action.ts:105` (проверка `close_door`), генерация — `tree-room-strategy.ts` `buildDoors` и `shared.ts` `spawnEnemiesAndItems`.
3. **Шаблон точки интереса**: `PoiTemplateSchema` (`id`, `interactionKind: z.literal('poi')`, `ruleIds: RuleIdsSchema`, `charges: int (default 1)`, `renderScale`, `tags: TagsSchema`) в `src/content/schemas.ts`; `pois?: Map` в `LoadedContent` (опционально, как props); loader, registry (`getPoi/tryGetPoi/getLocalizedPoi/...`), тексты (`pois` в `ContentTexts`, в `{ru,en}/environment.ts`), `scripts/generate-manifest.js` (`'entities/pois': 'pois'`), validate-content.
4. **Сущность** (`src/simulation/types.ts`): `PointOfInterestEntity extends BaseEntity, TemplateIdHolder` — `type: 'poi'`, `blocksMovement: true`, `interactionKind: 'poi'`, `charges: number`. Без `Attackable` (неразрушаемость на уровне типов). Добавить в union `Entity`, `EntityType`, `TARGET_PRIORITY` (`state.ts:244`, значение 0).
5. **Взаимодействие**: `resolve-interaction.ts` — ветка `'poi'` → `{ interactionId: 'use_poi', usableFromAdjacent: true }`, только если `charges > 0`; `InteractionId` += `'use_poi'`; `interact-action.ts` — validate/resolve → новый интент `ACTIVATE_POI { entityId, targetPosition }`; исполнитель: декремент `charges`, событие `POI_USED { position, poiType, remainingCharges }` (`isFieldEvent: true`).
6. **Мировой слой `object`** (`content-rules`):
   - `types.ts`: `OwnerContext` += `{type: 'object'; position; entityId}`; `WorldContentRule.worldLayer` += `'object'`.
   - `content-rule-reaction.ts`: `WORLD_LAYER_ORDER` — вставить `object` после `tileEffectStatus`, перед `tileIntrinsic` (зафиксировать порядок: `global → tileEffect → tileEffectStatus → object → tileIntrinsic`); `collectRules` — для события с `eventPosition` взять объекты на клетке (`findAllEntitiesAt`, `state.ts:271`), отфильтровать не-акторы, для каждого собрать `ruleIds` его шаблона (`tryGetPoi`; пропы/двери — когда получат `ruleIds`, не в этой фазе).
7. **Контент алтаря**: `public/content/entities/pois/altar.json` (`charges: 1`, `ruleIds: ["altar_heals_player"]`); правило `altar_heals_player` в `CONTENT_RULES` (`src/simulation/content-rules/rules.ts`): trigger `POI_USED`, effect `heal` (фиксированное значение), target `eventSource`; тексты ru/en; спрайт `public/assets/objects/pois/altar.png` (placeholder-скрипт); спавн — только debug (`spawnType: 'poi'` в `core-types.ts:302`, `debug-spawn-entity-action.ts`, `DebugPanel.tsx`).
8. **UI**: `spriteRegistry.ts` — `getPoiSprite` (`/assets/objects/pois/<id>.png`); `EntityRenderer.ts` — ветка `poi`; popover — `poiDetailMapper.ts` + `buildFieldObjectPopover` (`gameSession.ts:786`); подсказка — `src/presentation/interactionUtils.ts` (ключ + приоритет) и i18n `src/i18n/locales/{ru,en}/components/interactionHint.ts` (+ схема `src/i18n/schema.ts`).

### Тесты

- Слоты: unit на `canPlaceObjectAt` (все пары слотов); debug-спавн уважает слоты.
- Точка интереса: загрузка шаблона, `resolveInteraction` (adjacent, charges>0 → null после исчерпания), активация тратит AP и заряд, правило лечит игрока, повторное использование недоступно.
- Слой `object`: порядок в `WORLD_LAYER_ORDER`, сбор из шаблона poi.

### Документация

- `docs/agents/CONTENT_RULES_EDGE_CASES.md` — порядок мировых слоёв.
- `docs/recipes/add-poi.md` (по образцу `add-prop.md`) + `docs/recipes/README.md`.
- `src/simulation/content-rules/AGENTS.md` — новый слой.

### Риски

- `EntityType`-switch'и размазаны по ~10 файлам (simulation, presentation, ui/renderer, i18n) — пройтись по всем веткам `entity.type`.
- `POI_USED` должен попасть в механизм `isFieldEvent` (см. `src/simulation/core-types.ts`, поле введено 2026-07-25).

---

## Фаза 5. Ловушки (колючки)

**Цель:** проходимый объект с идентичностью и состоянием `hidden`; одноразовая или постоянная (`oneShot` в шаблоне); срабатывает на вход через слой `object`. Пример: **колючки** — урон, одноразовые. Обезвреживание и механика поиска ловушек отложены, в фазу не входят (решение 2026-07-30).

**Зависимости:** фаза 4 (слоты, слой `object`, инфраструктура нового вида сущности).
**Контекст для чтения:** фаза 4 этого плана (как добавлялся poi), `docs/concepts/cell-layers-model.md` (слой 4).

### Шаги

1. **Шаблон**: `TrapTemplateSchema` (`id`, `ruleIds`, `oneShot: boolean (default true)`, `initiallyHidden: boolean (default true)`, `renderScale`, `tags`) в `schemas.ts`; `traps?: Map` в `LoadedContent` (опционально, как `pois`); loader/registry (`getTrap/tryGetTrap/...`)/texts (`traps` в `ContentTexts`, в `{ru,en}/environment.ts`)/generate-manifest (`'entities/traps': 'traps'`)/validate — по образцу фазы 4 (`PoiTemplateSchema`, `pois`).
2. **Сущность** (`types.ts`): `TrapEntity extends BaseEntity, TemplateIdHolder` — `type: 'trap'`, `blocksMovement: false`, `hidden: boolean`; union `Entity`, `EntityType`, `TARGET_PRIORITY` (0); добавить `case 'trap'` → `floorFixture` в `getPlacementSlot` (`src/simulation/state.ts`, фаза 4). Без `interactionKind` — обезвреживания нет.
3. **Срабатывание**: правило `spikes_deal_damage` в `CONTENT_RULES`: trigger `ENTITY_MOVED`, условие «владелец правила — ловушка на клетке события» (ownerContext `object` уже даёт это), effect `dealDamage`, target `eventSource`. Сбор правил ловушек: расширить блок `object` из фазы 4 (`content-rule-reaction.ts`, `collectRules` — сейчас там только ветка `entity.type === 'poi'` с `tryGetPoi`) — собирать правила ловушек клетки через `tryGetTrap` независимо от `hidden` (скрытая ловушка срабатывает).
4. **После срабатывания**: одноразовая ловушка — удаление сущности (с событием); постоянная — `hidden = false`, остаётся и может срабатывать повторно. Форму реализации (новый `RuleEffect` на удаление объекта-владельца правила или интент `DESTROY_OBJECT` + исполнитель) решить в начале фазы; для колючек — удаление.
5. **Рендер/видимость**: скрытая ловушка не рисуется и не попадает в popover/подсказки; видимая — спрайт `/assets/objects/traps/<id>.png`, `EntityRenderer` ветка, popover-маппер (по образцу `getPoiSprite`/poi-ветки из фазы 4). Обнаружение — только при срабатывании (постоянная раскрывается) и в debug-режиме; механика поиска ловушек отложена.
6. **Контент колючек**: `public/content/entities/traps/spikes.json` (`oneShot: true`, `initiallyHidden: true`, `ruleIds: ["spikes_deal_damage"]`); тексты ru/en; спрайт (placeholder); спавн — debug (`spawnType: 'trap'` — по образцу `'poi'`: `core-types.ts`, `debug-spawn-entity-action.ts`, `DebugPanel.tsx`; слот `floorFixture` уже выводится из типа, в debug-спавне добавить в `slotBySpawnType`). Размещение генератором — вне фазы.

### Тесты

- Срабатывание на входе игрока и врага: урон; одноразовая ловушка удаляется после срабатывания; постоянная раскрывается и срабатывает повторно.
- Скрытая ловушка не отображается (DisplayState/popover), но срабатывает.
- Слот `floorFixture`: ловушка не ставится на клетку с дверью/лестницей; контейнер лута может лежать на клетке с ловушкой.

### Документация

- `docs/recipes/add-trap.md` + `docs/recipes/README.md`.
- `docs/agents/CONTENT_RULES_EDGE_CASES.md` — поведение скрытых ловушек, одноразовые vs постоянные.
- Концепт: отметить «фаза 5 реализована».

### Риски

- Скрытая ловушка не должна влиять на pathfinding игрока — сейчас невидимые блокираторы уже игнорируются в `isTileWalkableForPlayer`, а ловушки не блокируют движение вовсе; проверить тестом автопути через клетку со скрытой ловушкой.
- Порядок слоёв: правила ловушки (слой `object`) идут после `tileEffect` — если клетка и горит, и с ловушкой, порядок детерминирован; зафиксировать в edge-cases.

---

## Фаза 6 (опционально). Трансформация террейна, начальные покрытия, AI

Выполняется отдельным решением после фаз 1–5. Состав:

1. **Трансформация террейна**: `RuleEffect { type: 'transformTerrain'; terrainId }` + интент `TRANSFORM_TERRAIN` + исполнитель (замена `map.tiles[y][x]`, событие `TERRAIN_TRANSFORMED`, патч DisplayState). Применение: прогоревшая растительность → выжженная земля. После фазы 1: `GameMap.tiles` — `TileType[][]`, где `TileType = string` (id террейна); замена клетки — просто запись нового id, проходимость/LOS/moveCost подхватываются из шаблона автоматически (`isTerrainWalkable`, `blocksLOS` в `state.ts`, `DefaultActionPointCostResolver`). Дефолтные террейны генерации — константы `DEFAULT_WALL_TERRAIN`/`DEFAULT_FLOOR_TERRAIN` в `src/simulation/systems/map-generation/shared.ts`.
2. **Начальные покрытия от генератора**: шаг размещения cover-эффектов при генерации этажа (растительность и т.п.) — расширение `GeneratedMap` и `GameSimulation.generateMap` (`simulation.ts:768`).
3. **Учёт эффектов клетки в AI/pathfinding**: взвешенный `findPath` (`src/utils/math.ts:167`), опасные клетки для врагов. Отправная точка — зафиксированное в фазе 1 ограничение: автопуть и AI-pathfinding равностоимостны, `moveCost` террейна учитывается только при списании AP за одиночный шаг (`DefaultActionPointCostResolver`), но не при выборе маршрута (см. `docs/architecture/OVERVIEW.md`).
4. **Мировой слой `terrain` в `ContentRuleReaction`**: активация `ruleIds` террейнов событиями на клетке (бафы/дебафы стоящего и т.п.) по аналогии со слоями `tileEffect`/`tileEffectStatus`. После фазы 1 `ruleIds` уже хранятся в шаблонах и валидируются (`validateContentRuleReferences`); в фазу 1 этот блок не входил (в шагах 1–14 его не было), поэтому вынесен сюда.

---

## Прогресс

| Фаза | Статус | Примечание |
|---|---|---|
| 1. Террейн | ✅ | Реализована 2026-07-29; пример: песок (moveCost 2) |
| 2. Слои эффектов | ✅ | Реализована 2026-07-30; уникальность по слою |
| 3. Air-эффекты | ✅ | Реализована 2026-07-30; дым (blocksLOS), источник — расходник smoke_bomb (решение: полный цикл через расходник, не debug-спавн) |
| 4. Объекты | ✅ | Реализована 2026-07-30; слоты solid/floorFixture/loot (`getPlacementSlot`/`canPlaceObjectAt`), poi + алтарь (разовое лечение через ruleIds), слой `object` (кучи лута исключены 2026-07-30) |
| 5. Ловушки | ⬜ | Пример: колючки (одноразовые; поиск и обезвреживание отложены) |
| 6. Опционально | ⬜ | По решению после фаз 1–5 |
