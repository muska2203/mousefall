# Рецепт: добавление нового оружия

## Когда применять

Нужно добавить новое оружие ближнего или дальнего боя.

---

## Что понадобится

- JSON-шаблон оружия в `public/content/items/weapons/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Если оружие даёт пассивный эффект — контентное правило в `src/simulation/content-rules/rules.ts`.
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Спрайт и иконка в `public/assets/items/`.
- Запись в `public/content/manifest.json`.

---

## Шаги

1. **Возьми шаблон** [`public/content/examples/weapon-template.json`](../../public/content/examples/weapon-template.json) или создай JSON по образцу:

   ```json
   {
     "id": "my_weapon",
     "spriteId": "my_weapon",
     "icon": "/assets/items/my_weapon.png",
     "fallback": "⚔️",
     "type": "weapon",
     "stackable": false,
     "maxStack": 1,
     "value": 12,
     "weapon": {
       "baseDamage": 5,
       "damageFormulaId": "sword",
       "range": 1,
       "damageDistribution": [
         { "damageTag": "damage.physical.slashing", "weight": 1.0 }
       ],
       "tags": ["attack.melee", "target.single", "delivery.weapon"]
     },
     "grantedAbilities": [],
     "equipModifiers": [],
     "ruleIds": ["my_weapon_rule"]
   }
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла.
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"weapon"`.
   - `stackable`, `maxStack` — для оружия обычно `false` / `1`.
   - `value` — цена продажи.
   - `weapon.baseDamage` — базовый урон.
   - `weapon.damageFormulaId` — ID формулы урона (`sword`, `dagger`, `blunt` и т.п.).
   - `weapon.range` — дальность атаки.
   - `weapon.damageDistribution` — распределение тегов урона.
   - `weapon.tags` — игровые теги для фильтрации правил.
   - `ruleIds` — ID контентных правил (опционально).

2. **Добавь тексты** в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`:

   ```ts
   my_weapon: {
     name: 'Моё оружие',
     description: 'Краткое описание эффекта и внешнего вида.',
   },
   ```

3. **Если нужен пассивный эффект**, добавь контентное правило:
   - Рецепт: [`add-content-rule.md`](./add-content-rule.md).

4. **Добавь спрайт и иконку** в `public/assets/items/my_weapon.png`.

5. **Зарегистрируй в манифесте**. Добавь путь в массив `items` в `public/content/manifest.json`.

6. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/items/weapons/`.
- [ ] `id` совпадает с именем файла.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Если есть `ruleIds` — правила существуют и тексты правил добавлены.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
