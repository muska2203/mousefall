# Рецепт: добавление нового оружия

## Когда применять

Нужно добавить новое оружие ближнего или дальнего боя.

---

## Что понадобится

- TS-шаблон оружия в `src/content/templates/items/weapons/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Если оружие даёт пассивный эффект — контентное правило в `src/simulation/content-rules/rules.ts`.
- Текст правила в `src/content/texts/ru/rules.ts` и `src/content/texts/en/rules.ts`.
- Спрайт и иконка в `public/assets/items/`.
- Регистрация в `src/content/templates/items/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/items/weapons/my-weapon.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {ItemTemplateInput} from '../../../schemas';

   export const myWeapon = {
     id: 'my_weapon',
     spriteId: 'my_weapon',
     icon: '/assets/items/my_weapon.png',
     fallback: '⚔️',
     type: 'weapon',
     stackable: false,
     maxStack: 1,
     value: 12,
     weapon: {
       baseDamage: 5,
       damageFormulaId: 'sword',
       range: 1,
       damageDistribution: [
         {damageTag: 'damage.physical.slashing', weight: 1.0},
       ],
       tags: ['attack.melee', 'target.single', 'delivery.weapon'],
     },
     grantedAbilities: [],
     equipModifiers: [],
     ruleIds: ['my_weapon_rule'],
   } satisfies ItemTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case (`my_weapon` → `my-weapon.ts`).
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"weapon"`.
   - `stackable`, `maxStack` — для оружия обычно `false` / `1`.
   - `value` — цена продажи.
   - `weapon.baseDamage` — базовый урон.
   - `weapon.damageFormulaId` — ID формулы урона из каталога `WEAPON_FORMULA_IDS` (`src/content/ids.ts`): `unarmed`, `club`, `dagger`, `staff`, `sword`. Enum — опечатка ловится typecheck'ом.
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

5. **Зарегистрируй шаблон** в `src/content/templates/items/index.ts` — добавь импорт и строку в массив `itemTemplates`:

   ```ts
   import {myWeapon} from './weapons/my-weapon';
   // ...
   export const itemTemplates: ItemTemplateInput[] = [
     // ...
     myWeapon,
   ];
   ```

6. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/items/weapons/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Если есть `ruleIds` — правила существуют и тексты правил добавлены.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/items/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
