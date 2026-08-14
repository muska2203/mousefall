# Рецепт: добавление новой карты

## Когда применять

Нужно добавить новый набор параметров процедурной генерации этажа (подземелья).

---

## Что понадобится

- TS-шаблон параметров карты в `src/content/templates/maps/`.
- Регистрация в `src/content/templates/maps/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/maps/floor-1.ts`. Имя файла — `id` в kebab-case (`floor_1` → `floor-1.ts`), константа — camelCase:

   ```ts
   import type {MapParamsInput} from '../../schemas';

   export const floor1 = {
     id: 'floor_1',
     strategy: 'tree',
     width: 50,
     height: 50,
     minRooms: 6,
     maxRooms: 10,
     roomTypePool: [
       {templateId: 'normal', weight: 1},
     ],
     startRoomTypeId: 'start',
   } satisfies MapParamsInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный идентификатор параметров карты, совпадает с именем файла в kebab-case.
   - `strategy` — алгоритм генерации из каталога `MAP_STRATEGY_IDS` (`src/content/ids.ts`). На текущем этапе поддерживается только `"tree"` (дерево комнат от спавна до выхода). Добавление нового алгоритма — задача `system_design` (плюс расширение каталога).
   - `width` / `height` — размеры карты в клетках (20–100).
   - `minRooms` / `maxRooms` — диапазон количества комнат.
   - `roomTypePool` — взвешенный пул типов комнат этажа (минимум 1). Типы комнат — отдельная контентная категория (`src/content/templates/room-types/`), задают размеры и наполнение комнат; рецепт — `docs/recipes/add-room-type.md`.
   - `startRoomTypeId` — тип стартовой комнаты (должен присутствовать в `roomTypePool`).
   - `relicPool` — опциональный пул реликвий для алтаря выбора реликвии на этом этаже.

   Размеры комнат, пулы и плотности наполнения (враги, предметы, пропы, ловушки, лужи) больше не задаются в карте — они живут в типах комнат.

2. **Зарегистрируй шаблон** в `src/content/templates/maps/index.ts` — добавь импорт и строку в массив `mapParams`:

   ```ts
   import {floor1} from './floor-1';
   // ...
   export const mapParams: MapParamsInput[] = [
     // ...
     floor1,
   ];
   ```

3. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/maps/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] `strategy` — `"tree"` (единственная поддерживаемая стратегия).
- [ ] `roomTypePool` непустой, все id типов комнат существуют; `startRoomTypeId` входит в пул.
- [ ] Шаблон зарегистрирован в `src/content/templates/maps/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
