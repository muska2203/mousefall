# Рецепт: добавление типа комнаты

## Когда применять

Нужно добавить новый тип комнаты для процедурной генерации этажа: обычная комната,
стартовая, комната награды, элитная и т.п. Тип комнаты задаёт размеры комнаты и её
наполнение (враги, предметы, пропы, ловушки, лужи, гарантированные poi).

Комната босса и комната награды уже существуют как типы `boss`/`reward` с `weight: 0` —
они не участвуют во взвешенном ролле: генератор назначает их напрямую при заданном
`bossPool` карты (самому дальнему узлу дерева и exit-узлу за ним). Заранее нарисованные
комнаты — отдельный вид `preset` (ASCII-сетка + легенда), реализация запланирована
в roadmap 1.3; этот рецепт — про генерируемый вид `generated`.

---

## Что понадобится

- TS-шаблон типа комнаты в `src/content/templates/room-types/`.
- Регистрация в `src/content/templates/room-types/index.ts`.
- Подключение id типа в `roomTypePool` (и/или `startRoomTypeId`) карт из
  `src/content/templates/maps/`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/room-types/elite.ts`. Имя файла —
   `id` в kebab-case (`normal_deep` → `normal-deep.ts`), константа — camelCase:

   ```ts
   import type {RoomTypeTemplateInput} from '../../schemas';

   export const elite = {
     id: 'elite',
     kind: 'generated',
     weight: 0.3,
     minDepth: 2,
     maxPerFloor: 1,
     minSize: 5,
     maxSize: 9,
     fill: {
       enemyPool: [{templateId: 'cat_big', weight: 1}],
       enemyDensity: 1.5,
       itemPool: [{templateId: 'health_potion', weight: 1}],
       itemDensity: 0.2,
     },
   } satisfies RoomTypeTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла в kebab-case.
   - `kind` — вид типа: `"generated"` (генерируемая комната). Вид `"preset"`
     (заранее нарисованная комната) появится в roadmap 1.3.
   - `weight` — вес при взвешенном ролле типа для комнаты (default 1). `weight: 0`
     выключает тип из ролла — такой тип может назначаться только генератором
     напрямую (как `boss`/`reward` при заданном `bossPool` карты).
   - `minDepth` — минимальная глубина узла в дереве комнат, с которой тип может
     выпасть (default 0). Глубина стартовой комнаты — 0.
   - `maxPerFloor` — максимум комнат этого типа на этаж (опционально).
   - `minSize` / `maxSize` — диапазон размеров комнаты (2–20; реальные размеры
     кратны 3 — наследие сетки дерева комнат).
   - `fill` — наполнение комнаты:
     - `enemyPool` / `itemPool` / `propPool` / `trapPool` / `tileEffectPool` —
       взвешенные пулы id шаблонов (`{templateId, weight}`); пустой или отсутствующий
       пул = этого наполнения нет.
     - `enemyDensity` / `itemDensity` / `propDensity` / `trapDensity` /
       `tileEffectDensity` — плотности (default 0). Ожидаемое количество =
       `площадь комнаты / 16 × density`; целая часть гарантирована, дробная —
       шансом. Тайловые эффекты ставятся пятнами 1–3 клетки.
     - `guaranteedPois` — id poi, которые гарантированно ставятся в комнату
       (например, `['relic_altar']` у стартовой комнаты).

   Спавн идёт только внутри комнат; клетка старта игрока исключается.
   Стартовая комната делается пустой через тип с пустыми пулами (`start`),
   а не через хардкод генератора.

2. **Зарегистрируй шаблон** в `src/content/templates/room-types/index.ts` — добавь
   импорт и строку в массив `roomTypeTemplates`:

   ```ts
   import {elite} from './elite';
   // ...
   export const roomTypeTemplates: RoomTypeTemplateInput[] = [
     // ...
     elite,
   ];
   ```

3. **Подключи тип к карте** — добавь `id` в `roomTypePool` шаблона карты
   (`src/content/templates/maps/`, см. `docs/recipes/add-map.md`). Без этого тип
   не будет использоваться.

4. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Как тип комнаты используется в коде

- Генератор (`src/simulation/systems/map-generation/tree-room-strategy.ts`)
  строит дерево комнат, назначает каждому узлу тип взвешенным роллом из
  `roomTypePool` карты (корню — `startRoomTypeId`), затем `fillRooms`
  (`src/simulation/systems/map-generation/shared.ts`) наполняет комнаты.
  Исключение: при заданном `bossPool` карты типы `bossRoomTypeId`/`rewardRoomTypeId`
  (по умолчанию `boss`/`reward`, `weight: 0`) назначаются напрямую — самому
  дальнему узлу дерева и exit-узлу за ним; в центре босс-комнаты спавнится
  случайный босс из пула.
- Размеры узла дерева берутся из `minSize/maxSize` назначенного типа.
- Доступ к шаблонам: `getRoomType` / `tryGetRoomType` / `getAllRoomTypes`
  в `src/content/registry.ts`.
- `Room.roomTypeId` (`src/simulation/core-types.ts`) хранит назначенный тип —
  доступен для логики этажа (награды, события).

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/room-types/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Все id в пулах `fill` указывают на существующие шаблоны.
- [ ] Шаблон зарегистрирован в `src/content/templates/room-types/index.ts`.
- [ ] `id` добавлен в `roomTypePool` хотя бы одной карты.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
