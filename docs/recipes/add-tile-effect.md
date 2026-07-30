# Рецепт: добавление нового тайлового эффекта

## Когда применять

Нужно добавить динамический материал на клетки карты (вода, масло, огонь) и/или его временное состояние (горение, замерзание и т.п.).

---

## Что понадобится

- TS-шаблон тайлового эффекта в `src/content/templates/tile-effects/`.
- (Опционально) TS-шаблон статуса тайлового эффекта в `src/content/templates/tile-effect-statuses/`.
- Тексты в `src/content/texts/{ru,en}/tile-effects.ts` и `src/content/texts/{ru,en}/tile-effect-statuses.ts`.
- Спрайты в `public/assets/tile-effects/`.
- Регистрация в `src/content/templates/tile-effects/index.ts` (и `src/content/templates/tile-effect-statuses/index.ts`, если есть статус).
- Контентные правила в `src/simulation/content-rules/rules.ts` или `src/simulation/content-rules/world-rules/global-rules.ts`, если эффект должен что-то делать.
- Тесты, если эффект влияет на геймплей.

---

## Шаги

1. **Создай шаблон материала** в `src/content/templates/tile-effects/oil.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {TileEffectTemplateInput} from '../../schemas';

   export const oil = {
     id: 'oil',
     layer: 'cover',
     duration: 5,
     renderOrder: 2,
     ruleIds: ['oil_applies_oiled', 'fire_damage_ignites_oil', 'fire_tile_damage_ignites_oil'],
     canHaveStatus: ['burning'],
     durationDecreasesWhenHasStatus: ['burning'],
   } satisfies TileEffectTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case.
   - `layer` — слой эффекта: `"cover"` (по умолчанию) или `"aboveGround"`. На клетке максимум один эффект каждого слоя: новый эффект слоя заменяет старый (поэтому вода и масло, оба `cover`, вытесняют друг друга без дополнительных настроек).
   - `duration` — базовая длительность материала в ходах.
   - `renderOrder` — порядок отрисовки относительно других эффектов на клетке (внутри своего слоя).
   - `ruleIds` — ID контентных правил, которые срабатывают на клетке с эффектом.
   - `canHaveStatus` — статусы тайловых эффектов, которые можно наложить на этот материал.
   - `durationDecreasesWhenHasStatus` — материал тикает только при указанных статусах (например, масло исчезает, пока горит).

2. **Если материал может менять поведение**, создай статус тайлового эффекта в `src/content/templates/tile-effect-statuses/burning.ts`:

   ```ts
   import type {TileEffectStatusTemplateInput} from '../../schemas';

   export const burning = {
     id: 'burning',
     duration: 3,
     neverExpires: true,
     ruleIds: ['burning_spreads_to_flammable', 'burning_deals_damage_on_entry', 'burning_applies_burning'],
     statusCategory: 'elemental',
     categoryPriority: 1,
     mutuallyExclusiveWith: [],
     blockedBy: [],
     renderOrder: 10,
   } satisfies TileEffectStatusTemplateInput;
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case.
   - `duration` — базовая длительность статуса.
   - `neverExpires` — если `true`, статус не тикает по длительности и снимается только вместе с родительским эффектом.
   - `ruleIds` — правила, активируемые, когда статус присутствует на клетке события.
   - `statusCategory` / `categoryPriority` — для разрешения конфликтов между статусами.
   - `mutuallyExclusiveWith` — статусы, снимаемые при наложении этого.
   - `blockedBy` — статусы, блокирующие наложение этого.
   - `renderOrder` — порядок отрисовки поверх базового материала.

3. **Разреши статус у материала**. Добавь ID статуса в `canHaveStatus` шаблона тайлового эффекта. Без этого исполнитель наложения статуса отклонит интент.

4. **Добавь тексты** в `src/content/texts/ru/tile-effects.ts`, `src/content/texts/en/tile-effects.ts`, а при наличии статуса — в `src/content/texts/{ru,en}/tile-effect-statuses.ts`:

   ```ts
   oil: {name: 'Масло'},
   burning: {name: 'Горящая поверхность'},
   ```

5. **Добавь спрайты** в `public/assets/tile-effects/<id>.png`. Рендерер ищет спрайты только в этой папке.

6. **Зарегистрируй шаблоны**. Добавь импорт и строку в массив `tileEffectTemplates` в `src/content/templates/tile-effects/index.ts` (и в массив `tileEffectStatusTemplates` в `src/content/templates/tile-effect-statuses/index.ts`, если есть статус):

   ```ts
   import {oil} from './oil';
   // ...
   export const tileEffectTemplates: TileEffectTemplateInput[] = [
     // ...
     oil,
   ];
   ```

7. **Добавь контентные правила**, если эффект должен что-то делать (наносить урон, распространяться, накладывать статус и т.п.):
   - Материал и статус тайлового эффекта автоматически попадают в мировые слои `tileEffect` и `tileEffectStatus` соответственно.
   - Глобальные правила без привязки к конкретному эффекту добавляй в `GLOBAL_WORLD_CONTENT_RULES` в `src/simulation/content-rules/world-rules/global-rules.ts`.
   - Полезные условия и селекторы: `inTileEffect`, `tileEffectHasStatus`, `tilesInRadius`, `entityHasTag`, `positionsInRadius`.
   - Эффект `spawnTileEffect` порождает новый тайловый эффект в выбранных клетках (например, при уничтожении объекта).
   - Рецепт правил: [`add-content-rule.md`](./add-content-rule.md).

8. **Добавь способность или предмет для появления в игре** (опционально):
   - Например, масло появляется из расходника `oil_bottle`, а вода — из `water_ball`.
   - Для способности: создай шаблон в `src/content/templates/abilities/<id-kebab>.ts`, `SkillExecutor` в `src/simulation/skills/executors/<id>Skill.ts` и зарегистрируй его в `src/simulation/skills/index.ts`.
   - Для расходника: создай шаблон в `src/content/templates/items/consumables/<id-kebab>.ts` с эффектом `spawn_tile_effect`, добавь текст в `src/content/texts/{ru,en}/items.ts` и зарегистрируй шаблон в `src/content/templates/items/index.ts`.
   - Добавь анимацию/спрайт для UI.

9. **Напиши тесты** (если эффект влияет на геймплей):
   - `tests/unit/simulation/intents/tile-effect-intent-executor.test.ts` — исполнители интентов.
   - `tests/unit/simulation/content-rules/<правило>.test.ts` — отдельные правила.
   - `tests/integration/tile-effects/<сценарий>.test.ts` — сквозные сценарии.

   Проверь edge cases: замена эффекта того же слоя при спавне (вытеснение), сосуществование эффектов разных слоёв на одной клетке, обновление длительности при повторном спавне, удаление вместе со статусами.

10. **Запусти проверки**:
    ```bash
    npm run validate:content
    npm run typecheck
    npm test
    ```

---

## Чеклист

- [ ] TS-шаблон тайлового эффекта создан в `src/content/templates/tile-effects/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Если есть статус — TS-шаблон создан в `src/content/templates/tile-effect-statuses/` и статус разрешён в `canHaveStatus`.
- [ ] Тексты добавлены в `ru/en/tile-effects.ts` (и `tile-effect-statuses.ts`, если есть статус).
- [ ] Спрайты добавлены в `public/assets/tile-effects/`.
- [ ] Шаблоны зарегистрированы в `index.ts` своих категорий.
- [ ] Контентные правила созданы и привязаны через `ruleIds` (если эффект делает что-то в игре).
- [ ] Тесты написаны (если эффект влияет на геймплей).
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
