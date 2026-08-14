# План: инфраструктура босс-файта (roadMap 1.3)

> **Статус:** утверждён 2026-08-14, **реализован 2026-08-14** (все этапы 1–7, ревью координатором после каждого).
>
> **Источники:** [`roadMap.md`](../../roadMap.md) п. 1.3 («Босс как контент», «Босс-комната», «Двери босс-комнаты»), [`docs/game-design/first-boss-concept.md`](../game-design/first-boss-concept.md), [`docs/game-design/floor-1-content-concept.md`](../game-design/floor-1-content-concept.md) (двери босс-комнаты — код, вне рамок концепта контента).
>
> **Формат работы:** агент-координатор делегирует этапы исполнителям, после каждого этапа — ревью и отметка в «Журнале».

---

## Скоуп

Входит:
1. Флаг `isBoss` в шаблоне сущности вместо `BOSS_TEMPLATE_IDS`; экран концовки — имена боссов из контента.
2. `bossPool` в `MapParams` + типы комнат `boss`/`reward`; генератор: босс-комната — самый дальний узел дерева, комната награды за ней (существующий exit-узел), лестница вниз остаётся в ней.
3. Гарантированный спавн одного случайного босса из `bossPool` в босс-комнате.
4. Двери босс-комнаты: новый шаблон (неразрушаемая, негорючая), универсальное состояние «заперта» (`isLocked`).
5. Логика запирания: вход игрока → двери закрываются и запираются; выход игрока до победы → отпираются (босс преследует существующим hunter-FSM); все боссы мертвы → отпираются насовсем.
6. Минимум presentation/UI: запрет взаимодействия с запертой дверью + строки лога, непроходимость для автопути/AI/рывка.

## Сознательно не входит

- Вид `kind: 'preset'` и категория `roomPresets` (префабы — этап 3).
- Тип комнаты `elite` (остаток 1.2), биом/визуальный стиль этажа.
- Условие победы `phase = 'victory'` (roadMap 1.5).
- «Рычаг» босс-комнаты (отложенная доработка этапа 3).
- Анимации lock/unlock и отдельный спрайт «заперта» (этап 6).

## Дизайн-решения (утверждены)

- **Топология готова.** `buildRoomTree` уже навешивает exit-узел на случайный из самых дальних узлов (`tree-room-strategy.ts:240-255`); узел максимальной глубины — всегда лист, поэтому у босс-комнаты ровно две связи (к родителю и к reward), обход невозможен. Меняется только назначение типов: exit-parent → `boss`, exit-узел → `reward`.
- **Связь «двери босс-комнаты» — через тег шаблона.** Двери на коридорах, касающихся босс-узла, создаются шаблоном `boss_door` с тегом `boss_room`. Runtime-контроллер находит их по тегу через реестр — топологию в состояние этажа протягивать не нужно. Босс-комната находится по `state.map.rooms` + `state.mapParams.bossRoomTypeId`.
- **Запирание — только если босс жив и внутри комнаты.** Roadmap фиксирует триггер «сам факт входа, безусловно» (без проверки обнаружения игрока боссом); запирание при боссе снаружи сломало бы преследование («босс выходит и преследует»). Уточнение: запираем при наличии живого босса в босс-комнате.
- **Неразрушаемость — флаг `indestructible` в `DoorTemplateSchema` + движковое обнуление урона в `applyDamageToEntity`** (по образцу `bulwark`): событие `ENTITY_DAMAGED` с damage 0 эмитится. Негорючесть — отсутствием тега `flammable` и пустым `canHaveStatus` (механика уже есть).
- **`isLocked` — универсальное поле `DoorEntity`**, независимое от босс-инфраструктуры.

---

## Этапы реализации

### Этап 1. Контент-схемы, валидация, контентные шаблоны
**Файлы:** `src/content/schemas.ts`, `src/content/validate-references.ts`, `src/content/templates/`.

- `EntityTemplateSchema` += `isBoss: z.boolean().default(false)`.
- `MapParamsSchema` += `bossPool: z.array(z.string()).min(1).optional()`, `bossRoomTypeId: z.string().default('boss')`, `rewardRoomTypeId: z.string().default('reward')`.
- `DoorTemplateSchema` += `indestructible: z.boolean().default(false)`.
- `validate-references.ts`: `bossPool` → entities (ошибка, если шаблон без `isBoss: true`); `bossRoomTypeId`/`rewardRoomTypeId` → roomTypes — только при заданном `bossPool`.
- Новый шаблон `doors/boss-door.ts`: id `boss_door`, теги `['boss_room']` (без `flammable`), `canHaveStatus: []`, `indestructible: true`, спрайты — переиспользовать деревянную дверь; регистрация в `doors/index.ts`; тексты ru/en (`texts/{ru,en}/environment.ts`, запись `doors`).
- Новые типы комнат `room-types/boss.ts` (`kind: 'generated'`, `maxPerFloor: 1`, размер 7–10, пустой `fill`) и `room-types/reward.ts` (`maxPerFloor: 1`, размер 4–6, `fill.guaranteedPois: ['altar']`); регистрация в `room-types/index.ts`.
- `maps/floor-1.ts` += `bossPool: ['cat_guardian']`.
- `entities/cat-guardian.ts` += `isBoss: true`.
- Тесты: дефолты схем; негативная валидация (`bossPool` на не-boss шаблон, битая ссылка).

### Этап 2. Дверь: `isLocked` + `indestructible` в симуляции
**Файлы:** `src/simulation/types.ts`, `core-types.ts`, `systems/intents/door-intent-executor.ts`, `systems/intents/execute-intent.ts`, `systems/interactions/resolve-interaction.ts`, `systems/actions/interact-action.ts`, `systems/damage/apply-damage.ts`, `systems/bossTracking.ts`, `systems/intents/die-intent-executer.ts`, `map-generation/shared.ts` (`createDoor`), i18n reason codes.

- `DoorEntity` += `isLocked: boolean`; `createDoor` инициализирует `false`.
- Интенты `LOCK_DOOR`/`UNLOCK_DOOR` + события `DOOR_LOCKED`/`DOOR_UNLOCKED` (по образцу OPEN/CLOSE); исполнители (lock на открытой двери сначала закрывает её); регистрация в `execute-intent.ts`; подписка `aiPerceptionReaction` на новые события (`world-reactions/reactions.ts`).
- `resolveInteraction`: запертая дверь → `null`; `interact-action.ts`: reason code `door_locked` + i18n.
- `apply-damage.ts`: цель — дверь с `indestructible` шаблоном → урон 0 (как `bulwark`).
- `bossTracking.ts`: удалить `BOSS_TEMPLATE_IDS`; `isBossTemplate(templateId)` → чтение `isBoss` из реестра (`tryGetEntity`); обновить вызов в `die-intent-executer.ts`.
- Тесты: lock/unlock исполнители, `resolveInteraction` запертой → null, неразрушаемость (урон 0, дверь не умирает), `isBossTemplate` по реестру.

### Этап 3. Генератор: босс-комната, комната награды, спавн босса, босс-двери
**Файлы:** `src/simulation/systems/map-generation/tree-room-strategy.ts` (+ `shared.ts` при необходимости).

- `assignRoomTypes`: при `params.bossPool` — exit-parent получает `bossRoomTypeId`, exit-узел — `rewardRoomTypeId`; оба исключаются из взвешенного ролла.
- `buildLayout`: позиции дверей помечаются `isBossRoomDoor` (коридор касается босс-узла — `node` или `node.parent`); сдвиг в `buildGameMap` сохраняет флаг.
- `buildDoors`: отмеченные позиции → шаблон `boss_door`, ставятся всегда (без пропуска «рядом уже есть дверь»); при невозможности — `console.warn`.
- `generate()`: при `params.bossPool` — случайный шаблон из пула через `state.rng`, спавн босса в центре босс-комнаты (`createEnemy`), добавление в `enemies` результата.
- `GeneratedMap` без изменений; лестница вниз остаётся в exit/reward-комнате.
- Тесты: назначение типов (босс = дальний узел, reward за ним), детерминизм по seed, спавн босса, шаблон дверей босс-комнаты; обновить `tree-room-strategy.test.ts` (форма doorPositions).

### Этап 4. Контроллер босс-комнаты (world-reactions)
**Файлы:** новый `src/simulation/systems/world-reactions/boss-room-reaction.ts`, `reactions.ts`.

- На `ENTITY_MOVED` (игрок): переход снаружи→внутрь босс-комнаты (contains-проверка `from`/`to` по `Room` из `state.map.rooms`, тип — `state.mapParams.bossRoomTypeId`) и есть живой босс внутри → каждой живой двери с тегом `boss_room`: `CLOSE_DOOR` (если открыта) + `LOCK_DOOR`. Переход внутрь→снаружи при живом боссе → `UNLOCK_DOOR` всем.
- На `ENTITY_DIED`: умер босс (`isBossTemplate`) и живых боссов не осталось → `UNLOCK_DOOR` всем дверям `boss_room` (насовсем — повторный вход не запирает, т.к. живых боссов нет).
- Преследование — существующий hunter-FSM босса; изменений AI-стратегии нет.
- Тесты: интеграционный сценарий (вход → заперто; выход → отперто; смерть босса → отперто насовсем; повторный вход не запирает).

### Этап 5. Проходимость запертой двери
**Файлы:** `src/simulation/ai/tactics/movement.ts`, `src/simulation/skills/` (dash), `src/presentation/pathfinding.ts`, `src/presentation/autoPathController.ts`.

- AI: `isTilePassableForEnemy` и подстановка `INTERACT` в `moveToward` — запертая дверь непроходима и не открывается.
- Рывок: запертая дверь блокирует dash (не пробивается).
- Presentation: `isTilePassable` — запертая непроходима; автопуть не подставляет `INTERACT` для запертой.
- Тесты по каждой точке.

### Этап 6. Presentation/UI: концовка, лог, подсказки
**Файлы:** `src/presentation/gameSession.ts`, `src/presentation/logBuilder.ts`, `src/presentation/interactionUtils.ts`, маппер поповера двери, `src/i18n/schema.ts`, локали ru/en.

- `getDefeatedBosses()`: имя через `getLocalizedEntity(templateId, locale).name`, fallback — `ending.unknownBoss`; удалить ключи `ending.boss1..boss4` (схема + локали).
- Лог: строки для `DOOR_LOCKED`/`DOOR_UNLOCKED` (ru/en).
- Подсказка взаимодействия и поповер двери: состояние «заперта» (текст, без нового спрайта).
- Тесты: концовка с локализованными именами, строки лога.

### Этап 7. Документация
- `roadMap.md` 1.3 — статусы; `first-boss-concept.md` — пометка об инфраструктуре; `mechanics-overview.md` (§6.4 + двери); `docs/agents/CONTENT.md` (`isBoss`/`indestructible`/`bossPool`); `src/simulation/AGENTS.md` (locked, контроллер); `src/content/AGENTS.md`; рецепты `add-door`/`add-room-type`; `docs/agents/SYNC_STATUS.md` (история + сводка); `docs/agents/INDEX.md` при необходимости.

## Проверки (каждый этап)

- `npm run typecheck`; `npm run validate:content` (этапы 1–3); `npm run test` затронутых областей; финальный полный прогон (известны 13 pre-existing падений скейлера скорости анимаций от 2026-08-12 — не регрессия).

## Открытые риски / краевые случаи

- Пропуск босс-двери из-за занятого solid-слота практически невозможен (коридоры не наполняются); при возникновении — warn, генерация не блокируется.
- `mapParams` фиксированы на `floor_1` для всех этажей (известное ограничение): босс будет на каждом этаже — приемлемо для MVP (roadMap 1.5 допускает заглушку перехода).
- Босс, потеряв игрока, вернётся к точке спавна (режим `return` hunter-FSM) — существующее поведение, не меняем.

## Журнал

| Дата | Этап | Результат |
|---|---|---|
| 2026-08-14 | — | План утверждён, начата реализация. |
| 2026-08-14 | 1 | Выполнен и прошёл ревью: `isBoss` в `EntityTemplateSchema`, `bossPool`/`bossRoomTypeId`/`rewardRoomTypeId` в `MapParamsSchema`, `indestructible` в `DoorTemplateSchema`; валидация босс-инфраструктуры (только при заданном `bossPool`); шаблоны `boss_door` (тег `boss_room`, без `flammable`), типы комнат `boss`/`reward` (weight 0, reward с `guaranteedPois: ['altar']`); `floor_1` += `bossPool: ['cat_guardian']`, `cat_guardian` += `isBoss`. Проверки: typecheck и validate:content чисты, тесты контента/валидации зелёные (62). |
| 2026-08-14 | 2 | Выполнен и прошёл ревью: `DoorEntity.isLocked`; интенты `LOCK_DOOR`/`UNLOCK_DOOR` + события `DOOR_LOCKED`/`DOOR_UNLOCKED` (эмитятся безусловно, как open/close; lock открытой двери сначала закрывает её); `resolveInteraction` запертой → null + reason `door_locked` в `interact-action` (i18n ru/en); неразрушаемость — обнуление урона в `applyDamageToEntity` через `tryGetDoor().indestructible` (по образцу bulwark) + защита от DIE в `deathReaction`; `BOSS_TEMPLATE_IDS` удалён — `isBossTemplate` читает реестр (`tryGetEntity().isBoss`); `aiPerceptionReaction` подписана (DOOR_LOCKED → door_closed, DOOR_UNLOCKED → null). Полный прогон: 1629 зелёных, 13 известных pre-existing падений. |
| 2026-08-14 | 3 | Выполнен и прошёл ревью: при заданном `bossPool` родитель exit-узла получает `bossRoomTypeId`, exit-узел — `rewardRoomTypeId`, оба исключены из ролла (дегенеративный случай exitParent === root защищён); `DoorPosition {x, y, isBossRoomDoor}` — пометка коридоров, касающихся босс-узла; `buildDoors` ставит `boss_door` всегда (без пропуска «рядом есть дверь», фейл слота → warn); спавн случайного босса из `bossPool` в центре босс-комнаты. Порядок rng без `bossPool` не изменился. Тесты: +5 в `tree-room-strategy.test.ts`; полный прогон 1634 зелёных, 13 известных падений. |
| 2026-08-14 | 4 | Выполнен и прошёл ревью: `world-reactions/boss-room-reaction.ts` — `bossRoomDoorReaction` (ENTITY_MOVED игрока: вход при живом боссе внутри → CLOSE+LOCK всем дверям с тегом `boss_room`; выход при живом боссе → UNLOCK) и `bossRoomUnlockOnBossDeathReaction` (ENTITY_DIED босса + живых боссов нет → UNLOCK насовсем). Регистрация в `reactions.ts`. Тесты: 18 unit + 4 интеграционных (вход→заперто, смерть→отперто насовсем, босс снаружи/мёртв → не запирает, разрушенные двери пропускаются). Замечание: выход из запертой комнаты ходьбой невозможен — реальный побег только телепортом (расходник) — by design roadMap. Полный прогон: 1656 зелёных, 13 известных падений. |
| 2026-08-14 | 5 | Выполнен и прошёл ревью: запертая дверь непроходима для AI (`isTilePassableForEnemy`/`findClosedDoorAt` в `ai/tactics/movement.ts`), блокирует dash как препятствие (`executors/dashSkill.ts` — OPEN_DOOR не эмитится, BUMP-остановка), исключена из автопути и клик-INTERACT (`gameSession.ts` `getAutoPathQueries`/`findSingleClosedDoorAt`/`moveOrAttack`, `autoPathController.ts`). `pathfinding.ts` не потребовался (коллбэки живут в gameSession). Выявлено на будущее: `executeOpenDoorIntent` без гарда `isLocked` — добавить движковый гард. +9 тестов; полный прогон 1665 зелёных, 13 известных падений. |
| 2026-08-14 | 6 | Выполнен и прошёл ревью: движковый гард `isLocked` в `executeOpenDoorIntent` (+2 теста); `getDefeatedBosses()` переведён на `tryGetLocalizedEntity(...).name` с fallback `screens.ending.unknownBoss` (заодно исправлен pre-existing баг: старые ключи `ending.bossN` жили в несуществующем неймспейсе — имена никогда не работали), ключи `ending.boss1..boss4` удалены из схемы и локалей; лог «Дверь заперта/отперта» (logBuilder + i18n ru/en); `DOOR_LOCKED/UNLOCKED` в fogFilter (по position) и displayState builder (LOCKED→патч CLOSED, UNLOCKED→NO_OP); поповер двери — строка «Заперта» (`DoorPopoverViewModel.isLocked`, `lockedLabel` ru/en). Подсказки взаимодействия правок не потребовали (resolveInteraction → null с этапа 2). +6 тестов; полный прогон 1671 зелёных, 13 известных падений. |
| 2026-08-14 | 7 | Выполнен и прошёл ревью: актуализированы `roadMap.md` (1.3 реализован, 1.2 — остатки сокращены до elite/preset/биом, риски), `first-boss-concept.md`, `mechanics-overview.md` (§6.4, §8, §9, §10), `docs/agents/CONTENT.md` (+раздел «Босс-инфраструктура»), `src/simulation/AGENTS.md` (+раздел про двери/контроллер), `src/content/AGENTS.md`, рецепты `add-room-type.md`/`add-prop.md`, `SYNC_STATUS.md` (сводка + история). INDEX.md не тронут — планы там не перечисляются. |
| 2026-08-14 | финал | Финальные проверки: typecheck, validate:content, validate:i18n чисты; полный прогон vitest — 1671 зелёных, 13 падений (подтверждено: все в `tests/unit/ui/animation`, `tests/unit/ui/renderer`, `tests/unit/utils/tween` — известные pre-existing падения скейлера скорости анимаций от 2026-08-12, не регрессия). План закрыт. |
