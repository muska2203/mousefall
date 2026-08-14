# План: типы комнат в генераторе этажей (roadMap 1.2, концепт п.1 §3)

> **Статус:** утверждён 2026-08-14, **реализован 2026-08-14**.
>
> **Источник:** [`docs/game-design/floor-1-content-concept.md`](../game-design/floor-1-content-concept.md) §3 п.1 (пулы объектов в генераторе), расширенный решением пользователя 2026-08-14: вместо плоских `propPool`/`trapPool` в `MapParams` — полноценные **типы комнат** (roadMap 1.2) с форматом, готовым к пресетным комнатам (босс-комната 1.3, префабы этапа 3).

---

## Дизайн-решения (утверждены)

- **Тип комнаты — контентный шаблон** новой категории `roomTypes` (по образцу `terrains`/`pois`).
- **Формат — discriminated union по `kind`** (прецедент: union `kind` шаблонов способностей):
  - `kind: 'generated'` — прямоугольник `minSize`/`maxSize` + процедурное `fill`. **Реализуется в этом плане.**
  - `kind: 'preset'` — ссылка `presetId` на категорию `roomPresets` (ASCII-сетка + легенда с `doorSocket`/`spawnRole`/`randomFill`). **Только зафиксирован в дизайне, реализация — в 1.3 вместе с босс-комнатой.** Добавление вида — аддитивное расширение union, шаблоны `generated` останутся валидными.
- **Общие поля типа:** `id`, `weight`, `minDepth`, `maxPerFloor`.
- **Наполнение (`fill`):** пулы `enemies`/`items`/`props`/`traps`/`tileEffects`, плотности **от площади** (ожидаемое число = площадь/16 × множитель), `guaranteedPois`.
- **Лужи масла/воды** генератором — в этом плане (пятна 1–3 клетки). Мука по-прежнему только из источников (концепт §2).
- Типы этого плана: `start` + `normal`. `elite`/`boss`/`reward` — позже (1.2 продолжение / 1.3).
- Спавн только в комнатах (не в коридорах). Стартовая комната пуста **через свой шаблон**, без хардкода «пропуск rooms[0]».

## Шаги реализации

1. **Категория `roomTypes`:** `RoomTypeTemplateSchema` (union по `kind`, сейчас только `'generated'`), `templates/room-types/`, `buildContent()`, реестр, тексты не нужны (debug-сущность).
2. **Шаблоны:** `start` (пустой `fill`, `guaranteedPois: [relic_altar]`), `normal` (черновые плотности).
3. **`MapParamsSchema`:** удалить `enemyPool`/`itemPool`/`enemyDensity`/`itemDensity`/`startPoiId`; добавить `roomTypePool: string[]` + `startRoomTypeId`. Миграция `floor-1` (пропы `oil_barel`, ловушки `spikes`, лужи `oil`/`water`, низкие черновые плотности), `floor-2`, `default`.
4. **Валидация:** `checkRefs` для пулов типов и `roomTypePool`/`startRoomTypeId` в `validate-references.ts`.
5. **Генератор:** `Room` += `roomTypeId`; назначение типов после `buildLayout` (корень → `startRoomTypeId`; остальные — взвешенный ролл по `weight` с учётом `minDepth`/`maxPerFloor`, через `state.rng`); единая `fillRoom()` (враги/предметы/пропы/ловушки через `canPlaceObjectAt`; лужи пятнами 1–3 клетки в `tileEffects`); `spawnEnemiesAndItems`/`spawnStartPoi` поглощаются.
6. **`GeneratedMap`** += `props`, `traps`, `tileEffects`; потребители (`simulation.ts`, `floor-transition-planner.ts`) применяют массивы и накатывают начальные тайловые эффекты.

## Тесты

- Назначение типов: корень = start, детерминизм по seed, `maxPerFloor`/`minDepth`.
- Заливка `normal` от площади: враги, предметы, пропы, ловушки, лужи.
- Стартовая комната: алтарь есть, врагов/ловушек нет.
- Слоты размещения: проп не на двери, ловушка не на пропе.
- Лужи попадают в `tileEffects` состояния.
- Негативная валидация битых ссылок в пулах.
- Регрессия: `floor_2`/`default` генерируются.

## Документация

- `roadMap.md` (1.2), `floor-1-content-concept.md` (п.1 §3 → выполнен, правка про лужи/формат), `mechanics-overview.md` (§6.4, §10.2), новый рецепт `docs/recipes/add-room-type.md`, `docs/agents/CONTENT.md`, история `SYNC_STATUS.md`.

## Сознательно не входит

- `kind: 'preset'` и категория `roomPresets` (1.3).
- Типы `elite`/`boss`/`reward`, взвешенные пулы внутри типов, ловушки в коридорах, повороты/отражения пресетов.

## Журнал

| Дата | Шаг | Результат |
|---|---|---|
| 2026-08-14 | — | План утверждён, начата реализация. |
| 2026-08-14 | 1–6 + документация | Реализация завершена: категория `roomTypes` (схема union по `kind`, реестр, `buildContent`); шаблоны `start`/`normal`/`normal_deep`; `MapParams` переведён на `roomTypePool` + `startRoomTypeId` (пулы/плотности/размеры комнат удалены из карт); валидация ссылок пулов; генератор назначает типы узлам дерева и наполняет комнаты через `fillRooms` (враги/предметы/пропы/ловушки/лужи + `guaranteedPois`); `Room.roomTypeId`, `GeneratedMap` += `props`/`traps`/`tileEffects`; потребители и тесты обновлены (`fill-rooms.test.ts`, переписан `tree-room-strategy.test.ts`). Проверки: typecheck и validate:content чисты, vitest зелёный кроме 13 известных pre-existing падений (скейлер скорости анимаций от 2026-08-12). Документация обновлена: рецепт `add-room-type.md`, `add-map.md`, `add-poi.md`, `CONTENT.md`, `src/content/AGENTS.md`, `mechanics-overview.md`, `roadMap.md` 1.2, концепт этажа, SYNC_STATUS. |
