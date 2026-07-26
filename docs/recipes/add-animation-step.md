# Рецепт: добавление нового AnimationStep

## Когда применять

Нужно добавить новый визуальный примитив в анимационный конструктор: луч, молнию, шлейф, падение с неба и т.д. Этот рецепт не затрагивает Simulation — только Presentation и UI.

---

## Что понадобится

- Новый вариант в `AnimationStep` (`src/presentation/types.ts`).
- Запись в `ANIMATION_CONFIG` (`src/utils/animationConfig.ts`) — длительность, `blocking`, `easing`.
- UI-исполнитель в `src/ui/animation/<step>Executor.ts`, зарегистрированный через `registerAnimationExecutor`.
- Импорт executor-файла в `src/ui/components/GameField.tsx` для срабатывания side-effect.
- Builder/composer в Presentation, который создаёт узел с новым шагом (например, `src/presentation/animation/skills/<ability>.ts` или `src/presentation/animation/builders/<event>.ts`).
- Unit-тесты исполнителя и builder/composer.

---

## Шаги

1. **Добавь тип шага в `src/presentation/types.ts`.**

   ```ts
   export type AnimationStep =
     | ...
     | {
         type: 'BEAM';
         from: Position;
         to: Position;
         color: number;
       }
     | ...;
   ```

   > Не добавляй визуальные параметры в JSON-шаблоны контента. Цвета, спрайты и режимы отрисовки живут в коде Presentation/UI.

2. **Добавь конфигурацию в `src/utils/animationConfig.ts`.**

   ```ts
   export const ANIMATION_CONFIG = {
     ...
     BEAM: { duration: 250, blocking: true, easing: Easing.easeOutQuad },
     ...
   } as const satisfies Record<string, AnimationConfigEntry>;
   ```

3. **Добавь helper для создания узла (опционально, но рекомендуется).**

   В `src/presentation/animation/core/primitives.ts`:

   ```ts
   export function beamNode(
     from: Position,
     to: Position,
     color: number,
     children: AnimationNode[],
   ): AnimationNode {
     return {
       step: { type: 'BEAM', from, to, color },
       children,
     };
   }
   ```

4. **Создай UI-исполнитель в `src/ui/animation/beamExecutor.ts`.**

   ```ts
   import type {AnimationContext, AnimationExecutor} from './types';
   import type {AnimationStep} from '@presentation/types';
   import {ANIMATION_CONFIG} from '@utils/animationConfig';
   import {TILE_SIZE} from '@utils/constants';
   import {registerAnimationExecutor} from './registry';
   import {runBeam} from './primitives/beam';

   export class BeamAnimationExecutor implements AnimationExecutor {
     canExecute(step: AnimationStep): boolean {
       return step.type === 'BEAM';
     }

     async execute(step: AnimationStep, ctx: AnimationContext): Promise<void> {
       if (step.type !== 'BEAM') return;
       const config = ANIMATION_CONFIG.BEAM;
       // ... преобразование тайловых координат в мировые пиксели
       return runBeam({
         parent: ctx.worldRenderer.root,
         ticker: ctx.ticker,
         duration: config.duration,
         easing: config.easing,
         fromX, fromY, toX, toY,
         color: step.color,
       });
     }
   }

   registerAnimationExecutor(new BeamAnimationExecutor());
   ```

5. **Зарегистрируй executor в `src/ui/components/GameField.tsx`.**

   Добавь импорт для side-effect:

   ```ts
   import '@ui/animation/beamExecutor';
   ```

   После этого `GameField` получит executor автоматически через `getAnimationExecutors()`.

6. **Создай builder/composer, который использует новый шаг.**

   Пример — skill composer в `src/presentation/animation/skills/beam.ts`:

   ```ts
   import {abilityCastNode, beamNode} from '../core/primitives';
   import type {SkillComposer} from './registry';
   import {registerSkillComposer} from './registry';

   const LIGHTNING_COLOR = 0x88ddff;

   export const lightningBoltComposer: SkillComposer = (event, children) => {
     const target = event.targets[0];
     if (!target) return [abilityCastNode(event, children)];

     return [
       abilityCastNode(event, [
         beamNode(event.from, target, LIGHTNING_COLOR, children),
       ]),
     ];
   };

   registerSkillComposer('lightning_bolt', lightningBoltComposer);
   ```

   Импортируй файл в `src/presentation/animation/register.ts`:

   ```ts
   import './skills/beam';
   ```

7. **Добавь тесты.**

   - `tests/unit/ui/animation/beamExecutor.test.ts` — проверяет `canExecute` и отрисовку через мок PixiJS.
   - `tests/unit/presentation/animation/skills.test.ts` — проверяет, что composer строит дерево с нужным шагом.

8. **Запусти проверки.**

   ```bash
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] Новый вариант добавлен в `AnimationStep` (`src/presentation/types.ts`).
- [ ] Конфигурация добавлена в `ANIMATION_CONFIG` (`src/utils/animationConfig.ts`).
- [ ] UI-исполнитель создан в `src/ui/animation/` и зарегистрирован через `registerAnimationExecutor`.
- [ ] Executor импортирован в `src/ui/components/GameField.tsx` (side-effect).
- [ ] Builder/composer создан и использует новый шаг.
- [ ] Composer/builder зарегистрирован (через `registerSkillComposer` или `registerAnimationBuilder`).
- [ ] Unit-тесты добавлены для исполнителя и builder/composer.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
