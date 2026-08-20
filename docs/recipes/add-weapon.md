# Рецепт: добавление нового оружия

## Когда применять

Нужно добавить новое оружие ближнего или дальнего боя.

---

## Что понадобится

- TS-шаблон оружия в `src/content/templates/items/weapons/`.
- Тексты в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`.
- Если оружие даёт пассивный эффект — контентное правило в `src/simulation/content-rules/rules.ts` и rule-модификатор на него в `src/content/templates/modifiers/`.
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
     subtype: 'sword',
     level: 1,
     stackable: false,
     maxStack: 1,
     value: 12,
     weapon: {
       damage: { min: 4, max: 6 },
       range: 1,
       damageDistribution: [
         {damageTag: 'damage.physical.slashing', weight: 1.0},
       ],
       tags: ['attack.melee', 'target.single', 'delivery.weapon'],
     },
     grantedAbilities: [],
     fixedModifiers: ['mod_my_weapon_effect'],
   } satisfies ItemTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный ID, совпадает с именем файла в kebab-case (`my_weapon` → `my-weapon.ts`).
   - `spriteId` — ID спрайта.
   - `icon` — путь к иконке.
   - `fallback` — эмодзи, если иконка не загрузилась.
   - `type` — всегда `"weapon"`.
   - `subtype` — подтип из `WEAPON_SUBTYPE_IDS` (`src/content/ids.ts`): `sword`, `dagger`, `club`, `staff`, `sling`, `unarmed`. Определяет пул случайных аффиксов, выпадающих на экземпляры (см. [`add-modifier.md`](./add-modifier.md)). Enum — опечатка ловится typecheck'ом. Обязателен для экипировки.
   - `level` — уровень шаблона (целое ≥ 1). Выбирает рейнж ролла значений аффиксов (`ranges[level-1]`); в дальнейшем — привязка дропа к этажам. Обязателен для экипировки.
   - `stackable`, `maxStack` — для оружия обычно `false` / `1`.
   - `value` — цена продажи.
   - `weapon.damage` — рейнж урона `{min, max}`; конкретное значение роллится при каждом ударе со смещением вверх от ловкости атакующего (`rollWeaponDamage`). Формулы урона (`damageFormulaId`) удалены 2026-08-08.
   - `weapon.range` — максимальная дальность базовой атаки в клетках (дистанция Чебышёва, требуется прямая видимость; int ≥ 1, default 1). При `range > 1` базовая атака становится дальней: игрок выбирает цель на клетке через режим таргетинга (слот 0 хотбара).
   - `weapon.minRange` — минимальная дальность базовой атаки (int ≥ 1, default 1). При `minRange > 1` оружие не бьёт в упор: bump в соседнюю клетку отклоняется валидацией (`too_close_for_ranged_weapon`).
   - `weapon.damageDistribution` — распределение тегов урона.
   - `weapon.tags` — игровые теги для фильтрации правил.
   - `fixedModifiers` — ID модификаторов из категории `modifiers` (опционально) — фирменные свойства предмета (stat или rule). Заменяет удалённые 2026-08-09 `equipModifiers`/`ruleIds` предметов. Пассивный эффект подключается как rule-модификатор (`effect: {kind: 'rule', ruleId}`), обычно с `poolEligible: false`.

2. **Добавь тексты** в `src/content/texts/ru/items.ts` и `src/content/texts/en/items.ts`:

   ```ts
   my_weapon: {
     name: 'Моё оружие',
     description: 'Краткое описание эффекта и внешнего вида.',
   },
   ```

3. **Если нужен пассивный эффект**, добавь контентное правило и rule-модификатор на него, затем укажи модификатор в `fixedModifiers` оружия:
   - Рецепт правила: [`add-content-rule.md`](./add-content-rule.md).
   - Рецепт модификатора: [`add-modifier.md`](./add-modifier.md).

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
- [ ] Заданы `subtype` (из `WEAPON_SUBTYPE_IDS`) и `level` — обязательны для экипировки.
- [ ] Тексты добавлены в `ru/items.ts` и `en/items.ts`.
- [ ] Если есть `fixedModifiers` — модификаторы существуют, их `applicableSubtypes` включает `subtype` оружия; для rule-модификаторов правила существуют и тексты правил добавлены.
- [ ] Спрайт/иконка добавлены в `public/assets/items/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/items/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
