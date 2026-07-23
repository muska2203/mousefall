# Рецепт: добавление новой активной способности

## Когда применять

Нужно добавить новую активную способность (скилл), которую актор использует через действие `USE_ABILITY`.

---

## Что понадобится

- JSON-шаблон способности в `public/content/abilities/`.
- Тексты в `src/content/texts/ru/abilities.ts` и `src/content/texts/en/abilities.ts`.
- `SkillExecutor` в `src/simulation/skills/executors/<id>Skill.ts` (для способностей с уникальной логикой).
- Регистрация executor'а в `src/simulation/skills/index.ts`.
- Анимация в `src/presentation/animation/skills/<id>.ts` и импорт в `src/presentation/animation/register.ts` (если нужна визуализация).
- Спрайт и иконка в `public/assets/skills/`.
- Запись в `public/content/manifest.json`.

---

## Шаги

1. **Возьми шаблон** [`public/content/abilities/cleave.json`](../../public/content/abilities/cleave.json) или [`public/content/examples/ability-template.json`](../../public/content/examples/ability-template.json), затем создай JSON в `public/content/abilities/<id>.json`:

   ```json
   {
     "id": "my_ability",
     "spriteId": "my_ability",
     "cooldown": 2,
     "apCost": 1,
     "requiredWeaponTags": ["attack.melee"],
     "tags": ["delivery.ability", "attack.melee", "target.single"]
   }
   ```

   Поля:
   - `id` — уникальный ID, совпадает с именем файла.
   - `spriteId` — ID спрайта.
   - `cooldown` — ходов до повторного использования.
   - `apCost` — стоимость в AP (число или `"all"`).
   - `aiPreparable` — может ли AI подготавливать скилл на следующий ход.
   - `damageTag` — тег урона для ability-based скиллов (например, `"damage.magical.fire"`).
   - `requiredWeaponTags` — требования к тегам экипированного оружия (для weapon-based скиллов).
   - `tags` — игровые теги для фильтрации правил и UI.
   - `ruleIds` — ID декларативных контентных правил (опционально).

   > **Weapon-based** vs **ability-based**: если урон/эффект зависит от экипированного оружия — используй `requiredWeaponTags`. Если урон от формулы/характеристики — используй `damageTag`.

2. **Добавь тексты** в `src/content/texts/ru/abilities.ts` и `src/content/texts/en/abilities.ts`:

   ```ts
   my_ability: {
     name: 'Моя способность',
     description: 'Краткое описание эффекта, дальности и стоимости.',
   },
   ```

3. **Реализуй `SkillExecutor`** в `src/simulation/skills/executors/myAbilitySkill.ts`, если способность требует особой логики:

   ```ts
   import {Entity, GameState, Position} from '@simulation/types';
   import {Intent} from '@simulation/systems/intents/types';
   import {TargetMode} from '@simulation/core-types';
   import {SkillExecutor} from '@simulation/skills/skillExecutor';

   export const myAbilitySkill: SkillExecutor = {
     id: 'my_ability',

     getTargetMode(): TargetMode {
       return { type: 'self' };
     },

     getValidTargets(_state: GameState, caster: Entity): Position[] {
       return [{ x: caster.x, y: caster.y }];
     },

     preview(state: GameState, caster: Entity, _selectedTargets: Position[], hoveredTarget: Position | null): Intent[] {
       if (!hoveredTarget) return [];
       return this.resolve(state, caster, [hoveredTarget]);
     },

     getAffectedPositions(_state: GameState, caster: Entity, _selectedTargets: Position[], _hoveredTarget: Position | null): Position[] {
       return [{ x: caster.x, y: caster.y }];
     },

     resolve(_state: GameState, caster: Entity, _targets: Position[]): Intent[] {
       return [
         {
           type: 'APPLY_STATUS',
           entityId: caster.id,
           sourceEntityId: caster.id,
           status: {
             type: 'regenerating',
             duration: 3,
             value: 5,
             statModifiers: null,
           },
         },
       ];
     },
   };
   ```

   Интерфейс `SkillExecutor` обязует реализовать:
   - `getTargetMode` — режим выбора целей (`self`, `single`, `multi`, `area`).
   - `getValidTargets` — список допустимых клеток.
   - `preview` — интенты для превью при наведении.
   - `getAffectedPositions` — клетки, попадающие в зону действия.
   - `resolve` — итоговые интенты для исполнения.

   > Если способность полностью реализуется через декларативные `ruleIds` и не требует кастомного таргетинга, минимальный executor всё равно нужен: `getValidTargets` может возвращать пустой массив, а `resolve` — пустые интенты. Однако для большинства активных способностей требуется полноценная реализация.

4. **Зарегистрируй executor** в `src/simulation/skills/index.ts`:

   ```ts
   import {myAbilitySkill} from './executors/myAbilitySkill';
   // ...
   registerSkill(myAbilitySkill);
   ```

5. **Добавь анимацию** (опционально, но желательно):
   - Создай композер в `src/presentation/animation/skills/myAbility.ts`.
   - Зарегистрируй его через `registerSkillComposer('my_ability', myAbilityComposer)`.
   - Импортируй файл в `src/presentation/animation/register.ts`:
     ```ts
     import './skills/myAbility';
     ```

6. **Добавь спрайт и иконку** в `public/assets/skills/my_ability.png`.

7. **Зарегистрируй в манифесте**. Добавь путь в массив `abilities` в `public/content/manifest.json`.

8. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Распространённые детали

- **Weapon-based урон**: используй `getEffectiveWeaponDamage`, `getWeaponWeightForTag` и `mergeDamageIntentTags` из системы тегов.
- **Ability-based урон**: добавь формулу в `src/simulation/skills/damageFormula.ts` и вызывай по `damageFormulas['my_ability']`.
- **Контентные правила**: если способность должна триггеровать реакции, добавь `ruleIds` и создай правила по рецепту [`add-content-rule.md`](./add-content-rule.md).
- **AI**: если `aiPreparable: true`, убедись, что AI-стратегия умеет готовить этот скилл (см. `src/simulation/ai/`).

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/abilities/`.
- [ ] `id` совпадает с именем файла.
- [ ] Тексты добавлены в `ru/abilities.ts` и `en/abilities.ts`.
- [ ] `SkillExecutor` создан в `src/simulation/skills/executors/` (если требуется).
- [ ] Executor зарегистрирован в `src/simulation/skills/index.ts`.
- [ ] Анимация добавлена и зарегистрирована в `src/presentation/animation/register.ts` (если требуется).
- [ ] Спрайт/иконка добавлены в `public/assets/skills/`.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] Если есть `ruleIds` — правила существуют и тексты правил добавлены.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
