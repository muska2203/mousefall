# Рецепт: добавление террейна (основы пола)

## Когда применять

Нужно добавить новый террейн клетки: пол, воду, песок, лава и т.п.
Террейн — структурная основа клетки (ровно один на клетку, обязателен).
Стена — тоже террейн (с `walkable: false`).

---

## Что понадобится

- TS-шаблон террейна в `src/content/templates/terrains/`.
- Тексты в `src/content/texts/ru/terrain.ts` и `src/content/texts/en/terrain.ts`.
- Спрайт в `public/assets/tiles/` (или placeholder через `scripts/gen-placeholder-sprite.py`).
- Регистрация в `src/content/templates/terrains/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/terrains/sand.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {TerrainTemplateInput} from '../../schemas';

   export const sand = {
     id: 'sand',
     walkable: true,
     moveCost: 2,
     blocksLOS: false,
     tags: ['ground'],
     ruleIds: [],
   } satisfies TerrainTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла в kebab-case.
   - `walkable` — проходим ли террейн для движения.
   - `moveCost` — стоимость входа на клетку в AP (int ≥ 1, default 1).
     Учитывается только при списании AP за одиночный шаг: автопуть и
     AI-pathfinding остаются равностоимостными (известное ограничение итерации).
   - `blocksLOS` — блокирует ли линию видимости (default false).
   - `tags` — игровые теги. Тег `ground` означает «на эту клетку можно ставить
     тайловые эффекты и спавнить объекты» (проверки `terrainHasTag`).
   - `ruleIds` — контентные правила террейна. Хранятся в шаблоне; мировой слой
     `terrain` в `ContentRuleReaction` пока не реализован (см. план
     `docs/plans/cell-layers-migration.md`).

2. **Добавь тексты** в `src/content/texts/ru/terrain.ts` и `en/terrain.ts`:

   ```ts
   export const terrain: Record<string, ContentText> = {
     sand: {
       name: 'Песок',
       flavorText: '...',
     },
   };
   ```

3. **Добавь спрайт** в `public/assets/tiles/{id}.png`.
   Рендерер берёт спрайт по конвенции `/assets/tiles/<id>.png` (`getTileSprite`).
   Для placeholder'а:
   ```bash
   py scripts/gen-placeholder-sprite.py --name sand --dir public/assets/tiles --size 64 --color "#d2b48c"
   ```

4. **Зарегистрируй шаблон** в `src/content/templates/terrains/index.ts` — добавь импорт и строку в массив `terrainTemplates`:

   ```ts
   import {sand} from './sand';
   // ...
   export const terrainTemplates: TerrainTemplateInput[] = [
     // ...
     sand,
   ];
   ```

5. **Перегенерируй манифест ассетов** (новый спрайт должен попасть в манифест):
   ```bash
   npm run generate-asset-manifest
   ```

6. **Проверь валидацию**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Как террейн используется в коде

- `GameMap.tiles[y][x]` хранит строковый id террейна (`TileType = string`).
- Проходимость: `isTerrainWalkable(id)` (`src/simulation/state.ts`) —
  неизвестный id считается непроходимым (fail-safe).
- Спавн/эффекты: `terrainHasTag(id, 'ground')` (`src/simulation/state.ts`) —
  это НЕ то же самое, что проходимость.
- Обзор: `blocksLOS` читает `tryGetTerrain(id)?.blocksLOS`.
- Стоимость MOVE: `DefaultActionPointCostResolver` берёт `moveCost` террейна
  целевой клетки (fallback 1).
- Дефолтные id для генерации карт: `DEFAULT_WALL_TERRAIN` / `DEFAULT_FLOOR_TERRAIN`
  в `src/simulation/systems/map-generation/shared.ts`.
- Доступ к шаблонам: `getTerrain` / `tryGetTerrain` / `getLocalizedTerrain` и др.
  в `src/content/registry.ts`.

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/terrains/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Тексты добавлены в `ru/terrain.ts` и `en/terrain.ts`.
- [ ] Спрайт добавлен в `public/assets/tiles/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/terrains/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
