# Рецепт: добавление нового расходуемого предмета

## Когда применять

Нужно добавить новый расходуемый предмет (зелье, бинт, свиток и т.п.), который используется из инвентаря через действие `USE_ITEM`.

---

## Что понадобится

- TS-шаблон расходника в `src/content/templates/items/consumables/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Спрайт и иконка в `public/assets/items/`.
- Регистрация в `src/content/templates/items/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/items/consumables/my-consumable.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {ItemTemplateInput} from '../../../schemas';

   export const myConsumable = {
     id: 'my_consumable',
     spriteId: 'my_consumable',
     icon: '/assets/items/my_consumable.png',
     fallback: '🧪',
     type: 'consumable',
     stackable: true,
     maxStack: 10,
     value: 25,
     consumable: {
       effect: 'heal',
       value: 30,
     },
     apCost: 1,
   } satisfies ItemTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case (`my_consumable` → `my-consumable.ts`).
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"consumable"`.
   - `stackable`, `maxStack` — можно ли складывать и максимальный размер стопки.
   - `value` — цена продажи.
   - `consumable.effect` — тип эффекта: `"heal"`, `"buff"`, `"spawn_tile_effect"`, `"damage"`, `"teleport"`, `"identify"`.
   - `consumable.value` — величина эффекта (например, количество восстановленного HP).
   - `consumable.duration` — длительность эффекта в ходах (для `"buff"`).
   - `consumable.tileEffectType` — ID тайлового эффекта (только для `"spawn_tile_effect"`, например `"water"` или `"oil"`).
   - `consumable.radius` — радиус области действия в клетках (только для `"spawn_tile_effect"`).
   - `consumable.range` — дальность броска в клетках (только для `"spawn_tile_effect"`).
   - `apCost` — стоимость использования в AP.

   > **Важно:** на текущий момент полностью реализованы эффекты `"heal"`, `"buff"` и `"spawn_tile_effect"`. Эффекты `"damage"`, `"teleport"` и `"identify"` описаны в схеме, но требуют доработки обработчика `src/simulation/systems/actions/use-item-action.ts`.

2. **Добавь тексты** в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`:

   ```ts
   my_consumable: {
     name: 'Мой расходник',
     description: 'Краткое описание эффекта при использовании.',
   },
   ```

3. **Добавь спрайт и иконку** в `public/assets/items/my_consumable.png`.

4. **Зарегистрируй шаблон** в `src/content/templates/items/index.ts` — добавь импорт и строку в массив `itemTemplates`:

   ```ts
   import {myConsumable} from './consumables/my-consumable';
   // ...
   export const itemTemplates: ItemTemplateInput[] = [
     // ...
     myConsumable,
   ];
   ```

5. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/items/consumables/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/items/index.ts`.
- [ ] Выбранный `consumable.effect` реализован в `use-item-action.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
