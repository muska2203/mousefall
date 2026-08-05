# Рецепт: добавление нового врага

## Когда применять

Нужно добавить нового врага (NPC, который видит игрока, ходит и атакует).

---

## Что понадобится

- TS-шаблон врага в `src/content/templates/entities/`.
- Тексты в `src/content/texts/ru/entities.ts` и `src/content/texts/en/entities.ts`.
- AI-стратегия в `src/simulation/ai/` (если врагу нужно нестандартное поведение).
- Спрайт в `public/assets/entities/`.
- Регистрация в `src/content/templates/entities/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/entities/my-enemy.ts`. Имя файла — `id` в kebab-case (`my_enemy` → `my-enemy.ts`), константа — camelCase:

   ```ts
   import type {EntityTemplateInput} from '../../schemas';

   export const myEnemy = {
     id: 'my_enemy',
     maxAp: 2,
     aiStrategyId: 'hunter',
     aiSightRadius: 4,
     health: {
       max: 15,
     },
     baseStats: {
       str: 1,
       dex: 3,
       int: 0,
       vit: 0,
     },
     equipment: {
       weapon: 'common_splinter_blade',
     },
     lootTable: [
       {
         templateId: 'health_potion',
         weight: 3,
       },
     ],
     lootDropTable: [
       {
         count: 0,
         weight: 5,
       },
       {
         count: 1,
         weight: 1,
       },
     ],
     renderScale: 1.0,
   } satisfies EntityTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла в kebab-case (`my_enemy` → `my-enemy.ts`).
   - `maxAp` — максимум очков действий за ход.
   - `aiStrategyId` — ID стратегии из каталога `AI_STRATEGY_IDS` (`src/content/ids.ts`): `hunter`, `simple-boss`. Enum — опечатка ловится typecheck'ом. Если нужна новая — сначала добавь стратегию (`system_design`) и её ID в каталог.
   - `aiSightRadius` — радиус обнаружения.
   - `health.max` — максимальное HP.
   - `baseStats` — базовые характеристики (`str`, `dex`, `int`, `vit`).
   - `equipment.weapon` — ID оружия из `src/content/templates/items/weapons/`.
   - `lootTable` — предметы, которые может нести в инвентаре.
   - `lootDropTable` — сколько предметов из `lootTable` выпадет при смерти.
   - `renderScale` — масштаб спрайта.

2. **Добавь тексты** в `src/content/texts/ru/entities.ts` и `src/content/texts/en/entities.ts`:

   ```ts
   my_enemy: {
     name: 'Мой враг',
     flavorText: 'Краткое описание для лора.',
   },
   ```

3. **Добавь спрайт** в `public/assets/entities/my_enemy.png`.

4. **Зарегистрируй шаблон** в `src/content/templates/entities/index.ts` — добавь импорт и строку в массив `entityTemplates`:

   ```ts
   import {myEnemy} from './my-enemy';
   // ...
   export const entityTemplates: EntityTemplateInput[] = [
     // ...
     myEnemy,
   ];
   ```

5. **Добавь тест** (опционально, но рекомендуется):
   - `tests/unit/simulation/content-loading.test.ts` — проверка загрузки шаблона.
   - Интеграционный тест на бой с новым врагом.

6. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/entities/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Тексты добавлены в `ru/entities.ts` и `en/entities.ts`.
- [ ] Спрайт добавлен в `public/assets/entities/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/entities/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
