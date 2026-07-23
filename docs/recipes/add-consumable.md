# Рецепт: добавление нового расходуемого предмета

## Когда применять

Нужно добавить новый расходуемый предмет (зелье, бинт, свиток и т.п.), который используется из инвентаря через действие `USE_ITEM`.

---

## Что понадобится

- JSON-шаблон расходника в `public/content/items/consumables/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Спрайт и иконка в `public/assets/items/`.
- Запись в `public/content/manifest.json`.

---

## Шаги

1. **Возьми шаблон** [`public/content/items/consumables/health_potion.json`](../../public/content/items/consumables/health_potion.json) или создай JSON по образцу:

   ```json
   {
     "id": "my_consumable",
     "spriteId": "my_consumable",
     "icon": "/assets/items/my_consumable.png",
     "fallback": "🧪",
     "type": "consumable",
     "stackable": true,
     "maxStack": 10,
     "value": 25,
     "consumable": {
       "effect": "heal",
       "value": 30
     },
     "apCost": 1
   }
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла.
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"consumable"`.
   - `stackable`, `maxStack` — можно ли складывать и максимальный размер стопки.
   - `value` — цена продажи.
   - `consumable.effect` — тип эффекта: `"heal"`, `"buff"`, `"damage"`, `"teleport"`, `"identify"`.
   - `consumable.value` — величина эффекта (например, количество восстановленного HP).
   - `consumable.duration` — длительность эффекта в ходах (для `"buff"`).
   - `apCost` — стоимость использования в AP.

   > **Важно:** на текущий момент полностью реализованы только эффекты `"heal"` и `"buff"`. Эффекты `"damage"`, `"teleport"` и `"identify"` описаны в схеме, но требуют доработки обработчика `src/simulation/systems/actions/use-item-action.ts`.

2. **Добавь тексты** в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`:

   ```ts
   my_consumable: {
     name: 'Мой расходник',
     description: 'Краткое описание эффекта при использовании.',
   },
   ```

3. **Добавь спрайт и иконку** в `public/assets/items/my_consumable.png`.

4. **Зарегистрируй в манифесте**. Добавь путь в массив `items` в `public/content/manifest.json`.

5. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/items/consumables/`.
- [ ] `id` совпадает с именем файла.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] Выбранный `consumable.effect` реализован в `use-item-action.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
