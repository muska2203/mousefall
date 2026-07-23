# Рецепт: добавление нового амулета

## Когда применять

Нужно добавить новый амулет — предмет, который обычно даёт пассивный эффект через контентные правила (`ruleIds`) и/или модификаторы характеристик (`equipModifiers`).

---

## Что понадобится

- JSON-шаблон амулета в `public/content/items/amulets/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Контентное правило в `src/simulation/content-rules/rules.ts` (если амулет что-то меняет в бою).
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Спрайт и иконка в `public/assets/items/`.
- Запись в `public/content/manifest.json`.

---

## Шаги

1. **Возьми шаблон** [`public/content/items/amulet/common_ember_amulet.json`](../../public/content/items/amulet/common_ember_amulet.json) или создай JSON по образцу:

   ```json
   {
     "id": "my_amulet",
     "spriteId": "my_amulet",
     "icon": "/assets/items/my_amulet.png",
     "fallback": "📿",
     "type": "amulet",
     "stackable": false,
     "maxStack": 1,
     "value": 8,
     "equipModifiers": [],
     "ruleIds": ["my_amulet_rule"]
   }
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла.
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"amulet"`.
   - `stackable`, `maxStack` — для амулетов обычно `false` / `1`.
   - `value` — цена продажи.
   - `equipModifiers` — модификаторы характеристик при экипировке (опционально).
   - `ruleIds` — ID контентных правил (опционально, но для амулета — основной способ задать эффект).

   > Амулет не имеет отдельного блока характеристик, как `weapon` или `armor`. Его эффект реализуется через `ruleIds` и `equipModifiers`.

2. **Добавь тексты** в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`:

   ```ts
   my_amulet: {
     name: 'Мой амулет',
     description: 'Краткое описание эффекта и внешнего вида.',
   },
   ```

3. **Привяжи контентные правила** через `ruleIds`:
   - Рецепт: [`add-content-rule.md`](./add-content-rule.md).
   - Убедись, что каждый ID из `ruleIds` существует в `src/simulation/content-rules/rules.ts`.
   - Добавь тексты для правил в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.

4. **Добавь спрайт и иконку** в `public/assets/items/my_amulet.png`.

5. **Зарегистрируй в манифесте**. Добавь путь в массив `items` в `public/content/manifest.json`.

6. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/items/amulets/`.
- [ ] `id` совпадает с именем файла.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Если есть `ruleIds` — правила существуют и тексты правил добавлены.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
