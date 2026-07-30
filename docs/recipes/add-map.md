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
     minRoomSize: 4,
     maxRoomSize: 10,
     enemyDensity: 0.6,
     itemDensity: 0.3,
     enemyPool: [
       'cat_small',
     ],
     itemPool: [
       'health_potion',
     ],
   } satisfies MapParamsInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный идентификатор параметров карты, совпадает с именем файла в kebab-case.
   - `strategy` — алгоритм генерации из каталога `MAP_STRATEGY_IDS` (`src/content/ids.ts`). На текущем этапе поддерживается только `"tree"` (дерево комнат от спавна до выхода). Добавление нового алгоритма — задача `system_design` (плюс расширение каталога).
   - `width` / `height` — размеры карты в клетках (20–100).
   - `minRooms` / `maxRooms` — диапазон количества комнат.
   - `minRoomSize` / `maxRoomSize` — диапазон размеров комнат.
   - `enemyDensity` — плотность врагов (0.0–1.0). Значение 1.0 соответствует примерно одному врагу на каждые 4×4 клеток комнаты.
   - `itemDensity` — плотность спавна предметов (0.0–1.0).
   - `enemyPool` — ID шаблонов сущностей, которые могут появляться на этаже.
   - `itemPool` — ID шаблонов предметов, которые могут появляться на этаже.

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
- [ ] Все `enemyPool` и `itemPool` указывают на существующие шаблоны.
- [ ] Шаблон зарегистрирован в `src/content/templates/maps/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
