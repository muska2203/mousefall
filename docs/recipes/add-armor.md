# Рецепт: добавление новой брони

## Когда применять

Нужно добавить новый предмет брони: нагрудник, плащ, шлем или другой элемент экипировки, который даёт `baseArmor`.

---

## Что понадобится

- JSON-шаблон брони в `public/content/items/armor/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Если броня даёт пассивный эффект — контентное правило в `src/simulation/content-rules/rules.ts`.
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Спрайт и иконка в `public/assets/items/`.
- Запись в `public/content/manifest.json`.

---

## Шаги

1. **Возьми шаблон** [`public/content/items/armor/common_patch_cloak.json`](../../public/content/items/armor/common_patch_cloak.json) или создай JSON по образцу:

   ```json
   {
     "id": "my_armor",
     "spriteId": "my_armor",
     "icon": "/assets/items/my_armor.png",
     "fallback": "🛡️",
     "type": "armor",
     "stackable": false,
     "maxStack": 1,
     "value": 10,
     "armor": {
       "baseArmor": 2
     },
     "grantedAbilities": [],
     "equipModifiers": [],
     "ruleIds": ["my_armor_rule"]
   }
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла.
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"armor"`.
   - `stackable`, `maxStack` — для брони обычно `false` / `1`.
   - `value` — цена продажи.
   - `armor.baseArmor` — плоское снижение получаемого урона.
   - `equipModifiers` — модификаторы характеристик при экипировке (опционально).
   - `ruleIds` — ID контентных правил (опционально).

2. **Добавь тексты** в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`:

   ```ts
   my_armor: {
     name: 'Моя броня',
     description: 'Краткое описание эффекта и внешнего вида.',
   },
   ```

3. **Если нужен пассивный эффект**, добавь контентное правило:
   - Рецепт: [`add-content-rule.md`](./add-content-rule.md).
   - Убедись, что ID правила указан в `ruleIds` шаблона брони.

4. **Добавь спрайт и иконку** в `public/assets/items/my_armor.png`.

5. **Зарегистрируй в манифесте**. Добавь путь в массив `items` в `public/content/manifest.json`.

6. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/items/armor/`.
- [ ] `id` совпадает с именем файла.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Если есть `ruleIds` — правила существуют и тексты правил добавлены.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
