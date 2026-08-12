# Рецепт: добавление новой активной способности

## Когда применять

Нужно добавить новую активную способность (скилл), которую актор использует через действие `USE_ABILITY`.

---

## Что понадобится

- TS-шаблон способности в `src/content/templates/abilities/`.
- Тексты в `src/content/texts/ru/abilities.ts` и `src/content/texts/en/abilities.ts`.
- Для **нового экземпляра существующего вида** (`selfBuff`, `swoop`, `groundSlam`, `fireball`, `magicSlap`, `dash`, `suddenStrike`, `cleave`) — только шаблон и тексты: исполнитель собирается фабрикой из параметров шаблона.
- Для **новой механики** — новый член union `kind` в `AbilityTemplateSchema` + фабрика в `KIND_FACTORIES` (`src/simulation/skills/skillExecutor.ts`); это уже задача системного дизайна, а не чистого контента.
- Анимация в `src/presentation/animation/skills/<id>.ts` и импорт в `src/presentation/animation/register.ts` (если нужна визуализация).
- Спрайт и иконка в `public/assets/skills/`.
- Регистрация в `src/content/templates/abilities/index.ts`.

---

## Шаги

1. **Выбери `kind`** — вид механики способности (дискриминатор union, camelCase):
   - **существующий вид** (`selfBuff`, `swoop`, `groundSlam`, `fireball`, `magicSlap`, `dash`, `suddenStrike`, `cleave`) — параметры механики задаются в шаблоне, исполнитель соберётся фабрикой автоматически;
   - нужной механики нет — это новая механика: новый член union + фабрика в движке (см. `src/simulation/AGENTS.md`), выход за рамки этого рецепта.

2. **Создай TS-шаблон** в `src/content/templates/abilities/my-ability.ts`. Имя файла — `id` в kebab-case, константа — camelCase:

   ```ts
   import type {AbilityTemplateInput} from '../../schemas';

   export const myAbility = {
     id: 'my_ability',
     kind: 'cleave',
     spriteId: 'my_ability',
     cooldown: 2,
     apCost: 1,
     requiredWeaponTags: ['attack.melee'],
     tags: ['delivery.ability', 'attack.melee', 'target.single'],
   } satisfies AbilityTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Общие поля (база union):
   - `id` — уникальный ID, совпадает с именем файла в kebab-case (`my_ability` → `my-ability.ts`).
   - `kind` — вид механики (см. шаг 1); обязателен.
   - `spriteId` — ID спрайта.
   - `cooldown` — ходов до повторного использования.
   - `apCost` — стоимость в AP (число или `"all"`).
   - `aiPreparable` — может ли AI подготавливать скилл на следующий ход.
   - `damageTag` — тег урона для ability-based скиллов (например, `"damage.magical.fire"`).
   - `requiredWeaponTags` — требования к тегам экипированного оружия (для weapon-based скиллов).
   - `tags` — игровые теги для фильтрации правил и UI.
   - `ruleIds` — ID декларативных контентных правил (опционально).

   Поля видов:
   - `kind: 'selfBuff'` — `statusType` (тип накладываемого на кастера статуса; валидируется — статус обязан существовать) и `duration` (ходов). Пример — `bulwark` («Глухая оборона»).
   - `kind: 'swoop'` — `jumpRadius` (радиус выбора точки приземления, ≥ 1), `aoeRadius` (радиус удара вокруг точки, ≥ 0), `baseDamage` (урон, ≥ 0). Примеры — `swoop` (2/1/8), `guardian_swoop` (3/1/10).
   - `kind: 'groundSlam'` — `radius` (радиус удара вокруг кастера, ≥ 1), `baseDamage` (урон, ≥ 0). DAMAGE-интенты несут тег идентичности `skill.<id>` — на него опираются контентные правила (например, `ground_slam_daze`). Пример — `ground_slam` (2/12).
   - `kind: 'fireball'` — `range` (дальность выбора клетки, ≥ 1), `aoeRadius` (радиус зоны вокруг неё, ≥ 0), `centerDamage` (урон по центру), `aoeDamage` (урон по периметру). Пример — `fireball` (5/1/20/10).
   - `kind: 'magicSlap'` — `range` (дальность, ≥ 1), `targetCount` (число целей, ≥ 1), `baseDamage` (урон по каждой цели). Пример — `magic_slap` (5/3/12).
   - `kind: 'dash'` — `distance` (дистанция рывка, ≥ 1), `bumpDamage` (урон столкновения с актором). Пример — `dash` (2/5).
   - `kind: 'suddenStrike'` — `silenceDuration` (длительность немоты цели с подготовленной способностью, ≥ 1). Урон — ролл оружия. Пример — `sudden_strike` (2).
   - `kind: 'cleave'` — без параметров: урон — ролл оружия по дуге из трёх клеток.

   > Урон способностей — фиксированные значения из шаблона (без скейлинга от характеристик и уровня). Модификаторы урона вешаются через стандартные модификаторы и контентные правила. Исключение — оружейные виды (`cleave`, `suddenStrike`): их урон — ролл экипированного оружия.

   > **Weapon-based** vs **ability-based**: если урон/эффект зависит от экипированного оружия — используй `requiredWeaponTags`. Если урон фиксированный — задавай его полями вида и помечай `damageTag`.

3. **Добавь тексты** в `src/content/texts/ru/abilities.ts` и `src/content/texts/en/abilities.ts`:

   ```ts
   my_ability: {
     name: 'Моя способность',
     description: 'Краткое описание эффекта, дальности и стоимости.',
   },
   ```

4. **Добавь анимацию** (опционально, но желательно):
   - Создай композер в `src/presentation/animation/skills/myAbility.ts`.
   - Зарегистрируй его через `registerSkillComposer('my_ability', myAbilityComposer)`.
   - Импортируй файл в `src/presentation/animation/register.ts`:
     ```ts
     import './skills/myAbility';
     ```
   - Если способность — новый экземпляр существующего вида, переиспользуй композер: `registerSkillComposer('my_ability', swoopComposer)` в файле существующей анимации (пример — `guardian_swoop` в `skills/swoop.ts`).

5. **Добавь спрайт и иконку** в `public/assets/skills/my_ability.png`.

6. **Зарегистрируй шаблон** в `src/content/templates/abilities/index.ts` — добавь импорт и строку в массив `abilityTemplates`:

   ```ts
   import {myAbility} from './my-ability';
   // ...
   export const abilityTemplates: AbilityTemplateInput[] = [
     // ...
     myAbility,
   ];
   ```

7. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Распространённые детали

- **Weapon-based урон**: ролль урон оружия через `rollWeaponDamage(state, actor)` (`src/simulation/systems/stats/weapon-damage-roll.ts`) — конкретное значение из рейнжа `weapon.damage {min,max}` со смещением от ловкости; вес и теги — `getWeaponWeightForTag` и `mergeDamageIntentTags` из системы тегов (пример: фабрика `createCleaveSkill`). Актуально при создании нового вида механики (новый член union + фабрика).
- **Контентные правила**: если способность должна триггеровать реакции, добавь `ruleIds` и создай правила по рецепту [`add-content-rule.md`](./add-content-rule.md).
- **AI**: если `aiPreparable: true`, убедись, что AI-стратегия умеет готовить этот скилл (см. `src/simulation/ai/`).

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/abilities/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] `kind` выбран и указан в шаблоне; поля вида заполнены.
- [ ] Тексты добавлены в `ru/abilities.ts` и `en/abilities.ts`.
- [ ] Анимация добавлена и зарегистрирована в `src/presentation/animation/register.ts` (если требуется).
- [ ] Спрайт/иконка добавлены в `public/assets/skills/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/abilities/index.ts`.
- [ ] Если есть `ruleIds` — правила существуют и тексты правил добавлены.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
