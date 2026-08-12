# Рецепт: добавление новой активной способности

## Когда применять

Нужно добавить новую активную способность (скилл), которую актор использует через действие `USE_ABILITY`.

---

## Что понадобится

- TS-шаблон способности в `src/content/templates/abilities/`.
- Тексты в `src/content/texts/ru/abilities.ts` и `src/content/texts/en/abilities.ts`.
- Для **нового экземпляра параметризованного вида** (`selfBuff`, `swoop`, `groundSlam`) — только шаблон и тексты: исполнитель собирается фабрикой из параметров шаблона.
- Для **legacy-вида** (`fireball`, `magicSlap`, `dash`, `cleave`, `suddenStrike`) — `SkillExecutor` в `src/simulation/skills/executors/<id>Skill.ts` и его регистрация в `src/simulation/skills/index.ts`.
- Для **новой механики** — новый член union `kind` в `AbilityTemplateSchema` + фабрика в `KIND_FACTORIES` (`src/simulation/skills/skillExecutor.ts`); это уже задача системного дизайна, а не чистого контента.
- Анимация в `src/presentation/animation/skills/<id>.ts` и импорт в `src/presentation/animation/register.ts` (если нужна визуализация).
- Спрайт и иконка в `public/assets/skills/`.
- Регистрация в `src/content/templates/abilities/index.ts`.

---

## Шаги

1. **Выбери `kind`** — вид механики способности (дискриминатор union, camelCase):
   - **Параметризованный вид** (`selfBuff`, `swoop`, `groundSlam`) — параметры механики задаются в шаблоне, исполнитель соберётся фабрикой автоматически (шаги 3–4 не нужны);
   - **legacy-вид** (`fireball`, `magicSlap`, `dash`, `cleave`, `suddenStrike`) — механика зашита в зарегистрированном по id исполнителе;
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

   Поля параметризованных видов:
   - `kind: 'selfBuff'` — `statusType` (тип накладываемого на кастера статуса; валидируется — статус обязан существовать) и `duration` (ходов). Пример — `bulwark` («Глухая оборона»).
   - `kind: 'swoop'` — `jumpRadius` (радиус выбора точки приземления, ≥ 1), `aoeRadius` (радиус удара вокруг точки, ≥ 0), `baseDamage` (базовый урон, ≥ 0). Примеры — `swoop` (2/1/8), `guardian_swoop` (3/1/10).
   - `kind: 'groundSlam'` — `radius` (радиус удара вокруг кастера, ≥ 1), `baseDamage` (базовый урон, ≥ 0). DAMAGE-интенты несут тег идентичности `skill.<id>` — на него опираются контентные правила (например, `ground_slam_daze`). Пример — `ground_slam` (2/12).

   > **Weapon-based** vs **ability-based**: если урон/эффект зависит от экипированного оружия — используй `requiredWeaponTags`. Если урон от формулы/характеристики — используй `damageTag`.

3. **Добавь тексты** в `src/content/texts/ru/abilities.ts` и `src/content/texts/en/abilities.ts`:

   ```ts
   my_ability: {
     name: 'Моя способность',
     description: 'Краткое описание эффекта, дальности и стоимости.',
   },
   ```

4. **Реализуй `SkillExecutor`** в `src/simulation/skills/executors/myAbilitySkill.ts` — только для legacy-вида с особой логикой.

   > **Параметризованные виды** (`selfBuff`, `swoop`, `groundSlam`) отдельного executor'а не требуют: `getSkillExecutor` собирает и кэширует исполнитель фабрикой из `KIND_FACTORIES` по `kind` шаблона (шаги 4–5 пропускаются). У kind с фабрикой зарегистрированного исполнителя быть не должно — фабрика побеждает по построению.

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

5. **Зарегистрируй executor** в `src/simulation/skills/index.ts`:

   ```ts
   import {myAbilitySkill} from './executors/myAbilitySkill';
   // ...
   registerSkill(myAbilitySkill);
   ```

6. **Добавь анимацию** (опционально, но желательно):
   - Создай композер в `src/presentation/animation/skills/myAbility.ts`.
   - Зарегистрируй его через `registerSkillComposer('my_ability', myAbilityComposer)`.
   - Импортируй файл в `src/presentation/animation/register.ts`:
     ```ts
     import './skills/myAbility';
     ```
   - Если способность — новый экземпляр существующего вида, переиспользуй композер: `registerSkillComposer('my_ability', swoopComposer)` в файле существующей анимации (пример — `guardian_swoop` в `skills/swoop.ts`).

7. **Добавь спрайт и иконку** в `public/assets/skills/my_ability.png`.

8. **Зарегистрируй шаблон** в `src/content/templates/abilities/index.ts` — добавь импорт и строку в массив `abilityTemplates`:

   ```ts
   import {myAbility} from './my-ability';
   // ...
   export const abilityTemplates: AbilityTemplateInput[] = [
     // ...
     myAbility,
   ];
   ```

9. **Запусти проверки**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Распространённые детали

- **Weapon-based урон**: ролль урон оружия через `rollWeaponDamage(state, actor)` (`src/simulation/systems/stats/weapon-damage-roll.ts`) — конкретное значение из рейнжа `weapon.damage {min,max}` со смещением от ловкости; вес и теги — `getWeaponWeightForTag` и `mergeDamageIntentTags` из системы тегов (пример: `cleaveSkill`).
- **Ability-based урон**: добавь формулу в `src/simulation/skills/damageFormula.ts` и вызывай по `damageFormulas['my_ability']`.
- **Контентные правила**: если способность должна триггеровать реакции, добавь `ruleIds` и создай правила по рецепту [`add-content-rule.md`](./add-content-rule.md).
- **AI**: если `aiPreparable: true`, убедись, что AI-стратегия умеет готовить этот скилл (см. `src/simulation/ai/`).

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/abilities/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] `kind` выбран (параметризованный вид / legacy-вид) и указан в шаблоне; поля вида заполнены.
- [ ] Тексты добавлены в `ru/abilities.ts` и `en/abilities.ts`.
- [ ] `SkillExecutor` создан в `src/simulation/skills/executors/` (только legacy-вид с особой логикой).
- [ ] Executor зарегистрирован в `src/simulation/skills/index.ts` (только legacy-вид).
- [ ] Анимация добавлена и зарегистрирована в `src/presentation/animation/register.ts` (если требуется).
- [ ] Спрайт/иконка добавлены в `public/assets/skills/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/abilities/index.ts`.
- [ ] Если есть `ruleIds` — правила существуют и тексты правил добавлены.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
