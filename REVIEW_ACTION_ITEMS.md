# Архитектурные замечания — Action Items

> Файл создан по результатам ревью незалитых правок.
> Каждый пункт содержит: контекст, конкретные файлы/строки, проблему и предлагаемое решение.
> Использовать как чеклист для последовательного исправления.

---

## P0 — Блокирующие (нарушение слоёв / баги)

### P0-1. Presentation импортирует Content Registry напрямую

**Контекст:**
- `ARCHITECTURE.md`: Presentation может зависеть от Simulation **только через публичный API** (`dispatch`, `preview`, `getState`, `generateMap`).
- Content Registry (`src/simulation/content/registry.ts`) — внутренняя инфраструктура Simulation.

**Где:**
- `src/presentation/gameSession.ts` (строка ~17): `import { tryGetAbility } from '@simulation/content/registry'`
- `src/presentation/logBuilder.ts` (строка ~15): `import { tryGetEntity } from '@simulation/content/registry'`

**Проблема:**
- Presentation получает доступ к внутренностям Simulation, минуя API.
- В тестах Presentation приходится инициализировать весь Content Registry (см. `tests/unit/presentation/targeting.test.ts`).

**Решение:**
1. В `src/simulation/types.ts` в интерфейс `Simulation` добавить:
   ```ts
   getAbilityInfo(abilityId: string): { name: string; spriteId: string; mpCost: number; cooldown: number } | null;
   getEntityDisplayName(entityId: string): string;
   ```
2. Реализовать эти методы в `src/simulation/simulation.ts` (делегировать в Content Registry).
3. В `gameSession.ts`:
   - Убрать `import { tryGetAbility } from '@simulation/content/registry'`.
   - В `getAbilityTemplate` вызывать `this.simulation!.getAbilityInfo(abilityId)`.
4. В `logBuilder.ts`:
   - Убрать `import { tryGetEntity } from '@simulation/content/registry'`.
   - Функция `getEntityDisplayName` должна получать `Simulation` как параметр или использовать метод из `GameState` (если displayName будет храниться там).
   - Альтернатива: добавить `displayName` в `BaseEntity` при загрузке/создании, тогда не нужен вызов в logBuilder.

---

### P0-2. `runStatusTicks` создаёт фиктивное событие с захардкоженными значениями

**Контекст:**
- Система Action → Intent → Event требует, чтобы события отражали реальность.
- `src/simulation/systems/intents/tick-status-effects-intent-executer.ts` уже порождает правильные `ENTITY_DAMAGED` и `STATUS_REMOVED`.

**Где:**
- `src/simulation/simulation.ts`, метод `runStatusTicks()` (приватный метод класса `GameSimulation`).

**Текущий код (проблемный):**
```ts
const builder = new ExecutionBuilder({
  type: 'STATUS_TICKED',
  entityId: entity.id,
  effectType: 'burning', // ← ВСЕГДА burning, независимо от реального эффекта
  value: 0,              // ← ВСЕГДА 0
});
executeIntent(this.state, intent, builder, builder.root);
```

**Проблема:**
- Если у сущности эффект `poisoned`, в дереве событий всё равно будет `STATUS_TICKED { effectType: 'burning', value: 0 }`.
- Это ломает логи и анимации.

**Решение:**
- Вариант А (простой): убрать `ExecutionBuilder` на каждый tick-intent. Вместо этого использовать один корневой узел на сущность, а `tick-status-effects-intent-executer.ts` пусть сам создаёт дочерние `STATUS_TICKED` события с правильными `effectType` и `value`.
- Вариант Б (если нужен корень): собирать реальные типы и значения из `holder.statusEffects` перед созданием `ExecutionBuilder`:
  ```ts
  const realEffect = holder.statusEffects[0]; // или объединять
  const builder = new ExecutionBuilder({
    type: 'STATUS_TICKED',
    entityId: entity.id,
    effectType: realEffect.type as StatusEffectType,
    value: realEffect.value,
  });
  ```

---

## P1 — Важные (архитектурные антипаттерны)

### P1-1. UI Layer знает о конкретных ID способностей

**Контекст:**
- `ARCHITECTURE.md`: UI не должен содержать игровой логики и знать о конкретном контенте.
- Presentation готовит анимационные планы, UI только исполняет.

**Где:**
- `src/ui/animation/skillExecutor.ts` (строка ~28):
  ```ts
  if (step.abilityId === 'fireball') {
    await ctx.worldRenderer.animateProjectile(step.from, target, ...);
    await ctx.worldRenderer.animateExplosion(target, ...);
  }
  ```

**Проблема:**
- UI знает, что `fireball` — это снаряд + взрыв. Если добавится новый скилл с похожей механикой, придётся править UI.

**Решение:**
1. В `src/presentation/types.ts` добавить новые шаги анимации:
   ```ts
   | { type: 'PROJECTILE'; from: Position; to: Position; color?: number }
   | { type: 'EXPLOSION'; center: Position; radius: number; color?: number }
   ```
2. В `src/presentation/animationPlanner.ts` (в функции `convertExecutionNode` или при обработке `ABILITY_USED`) разворачивать `ABILITY_USED` в цепочку:
   - `ABILITY_CAST` (пульсация кастера)
   - `PROJECTILE` (если скилл требует)
   - `EXPLOSION` (если скилл требует AoE)
   - Дети (DAMAGE, DEATH и т.д.)
3. В `src/ui/animation/skillExecutor.ts` оставить только обработку `ABILITY_CAST`.
4. Создать новые executors в UI: `ProjectileAnimationExecutor`, `ExplosionAnimationExecutor`.
5. `WorldRenderer.animateProjectile` / `animateExplosion` остаются, но UI вызывает их по универсальным шагам, не зная `abilityId`.

---

### P1-2. `GameSession` ломает инкапсуляцию `TargetingController`

**Контекст:**
- `TargetingController` имеет метод `beginTargeting(abilityId, simulation)`, но он нигде не используется.

**Где:**
- `src/presentation/gameSession.ts`, метод `beginTargeting` (строки ~279-295):
  ```ts
  this.targeting.phase = 'targeting';
  this.targeting.state = { abilityId, stepIndex: 0, selectedTargets: [], validTargets };
  ```

**Проблема:**
- Дублирование логики выбора целей. `TargetingController` создан как инкапсулированный класс, но `GameSession` обходит его API.

**Решение:**
- Заменить тело `beginTargeting` на делегирование:
  ```ts
  beginTargeting(abilityId: string): void {
    if (!this.simulation) return;
    const ok = this.targeting.beginTargeting(abilityId, this.simulation);
    if (!ok) return;
    this.targetingHover = null;
    this.notify();
  }
  ```
- Проверить, что `TargetingController.beginTargeting` корректно заполняет `validTargets` (сейчас делает это через `simulation.getAbilityValidTargets`).
- Аналогично проверить `submitTarget` — возможно, часть логики валидации тоже можно делегировать `TargetingController`.

---

### P1-3. `previewTarget` вызывает `notify()` на каждый `mousemove`

**Контекст:**
- `GameSession` использует паттерн Pub/Sub (`subscribe` / `notify`) для React `useSyncExternalStore`.
- `notify()` инвалидирует кеш ViewModel и вызывает все колбэки.

**Где:**
- `src/presentation/gameSession.ts`, метод `previewTarget` (строки ~339-345):
  ```ts
  previewTarget(hoveredPosition: Position | null): PresentationActionPreview {
    this.targetingHover = hoveredPosition;
    const state = this.simulation!.getState();
    const result = this.targeting.previewTarget(hoveredPosition, this.simulation!, state);
    this.notify(); // ← вызывается при КАЖДОМ движении мыши
    return result;
  }
  ```

**Проблема:**
- При движении мыши по игровому полю React перерисовывает весь `GameScreen` и все дочерние компоненты на каждый пиксель.

**Решение:**
- Вариант А (простой): убрать `this.notify()` из `previewTarget`.
  - `getViewModel()` вызывается при следующем рендере React'а.
  - `buildTargetingOverlay` использует `this.targetingHover`, который уже обновлён.
  - React вызовет `getViewModel()` самостоятельно при следующем рендере, если состояние изменилось... но `useSyncExternalStore` требует `notify()` для триггера.
  - Поэтому нужно либо отдельное хранилище для targeting overlay.
- Вариант Б (правильный): выделить `targetingNotifier` — отдельный `Set<() => void>`, на который подписывается только компонент/рендерер, отвечающий за targeting overlay (например, `TargetingRenderer` через `WorldRenderer`).
  - `GameScreen` и левая/правая панели НЕ подписываются на targetingNotifier.
  - Это требует изменений в UI, но решает проблему окончательно.
- Вариант В (компромисс): throttle `notify()` в `previewTarget` (например, 60fps через `requestAnimationFrame` или простой флаг). Но это костыль.

**Рекомендация:** начать с Варианта А (убрать notify), проверить, не сломается ли hover. Если React не перерисовывает без notify — добавить `notify()` только если targetingOverlay действительно изменился (сравнение предыдущего и нового состояния).

---

## P2 — Желательные (качество кода, детерминизм)

### P2-1. Дублирование логики камеры в UI

**Где:**
- `src/ui/components/GameField.tsx` (строки ~203-216 и ~228-241):
  - Вычисление `cameraX`, `cameraY`, `scale` для `screen → world` преобразования.
- `src/ui/renderer/WorldRenderer.ts` (метод `render()`):
  - Та же логика камеры для `world → screen`.

**Проблема:**
- Если изменится логика камеры (например, smooth follow), mouse picking сломается.

**Решение:**
- В `WorldRenderer` добавить публичный метод:
  ```ts
  screenToWorld(screenX: number, screenY: number): Position {
    const scale = this.lastInput?.zoom ?? 1;
    const playerScreenX = this.lastInput!.state.player.x * TILE_SIZE;
    const playerScreenY = this.lastInput!.state.player.y * TILE_SIZE;
    const viewW = this.viewportWidth / scale;
    const viewH = this.viewportHeight / scale;
    const cameraX = playerScreenX + TILE_SIZE / 2 - viewW / 2;
    const cameraY = playerScreenY + TILE_SIZE / 2 - viewH / 2;
    return {
      x: Math.floor((screenX / scale + cameraX) / TILE_SIZE),
      y: Math.floor((screenY / scale + cameraY) / TILE_SIZE),
    };
  }
  ```
- В `GameField` убрать ручное вычисление и вызывать `rendererRef.current!.screenToWorld(mouseX, mouseY)`.

---

### P2-2. `as any` в Skill Executors

**Где:**
- `src/simulation/skills/executors/fireballSkill.ts` (строки ~55-56):
  ```ts
  const damage = formula({
    caster: caster as any,
    target: entity as any,
    ...
  });
  ```
- `src/simulation/skills/executors/magicSlapSkill.ts` (строки ~51-52) — аналогично.

**Проблема:**
- Скрывает несоответствие типов. `Entity` не гарантирует `baseStats`.

**Решение:**
- Добавить type guard в `src/simulation/state.ts` (или рядом):
  ```ts
  export function hasBaseStats(e: Entity): e is PlayerEntity | EnemyEntity {
    return 'baseStats' in e && e.baseStats !== undefined;
  }
  ```
- В skill executors проверять `hasBaseStats(caster)` и `hasBaseStats(target)` перед вызовом формулы.
- Исправить тип `DamageFormulaContext` — `caster` и `target` должны быть `PlayerEntity | EnemyEntity`, а не `any`.

---

### P2-3. `executeSetCooldownIntent` не порождает событие

**Где:**
- `src/simulation/systems/intents/set-cooldown-intent-executer.ts`

**Текущий код:**
```ts
export const executeSetCooldownIntent: IntentExecutor<SetCooldownIntent> = (
  state, intent, _builder, _parent,
) => {
  const actor = state.entities.get(intent.entityId);
  if (!actor || !('abilities' in actor)) return null;
  const runtimeAbility = actor.abilities.find(a => a.templateId === intent.abilityId);
  if (runtimeAbility) {
    runtimeAbility.currentCooldown = intent.turns;
  }
  return null; // ← нет события
};
```

**Проблема:**
- Дерево событий неполное. Нет аудита изменения cooldown.

**Решение:**
1. В `src/simulation/core-types.ts` добавить событие:
   ```ts
   export type CooldownSetEvent = {
     type: 'COOLDOWN_SET';
     entityId: EntityId;
     abilityId: string;
     turns: number;
   };
   ```
   и включить его в union `GameEvent`.
2. В `executeSetCooldownIntent`:
   ```ts
   return builder.addChild(parent, {
     type: 'COOLDOWN_SET',
     entityId: intent.entityId,
     abilityId: intent.abilityId,
     turns: intent.turns,
   });
   ```

---

## P3 — Мелкие правки (можно сделать вместе с любым другим пунктом)

### P3-1. Дубликат `StatusTickedEvent` в union `GameEvent`

**Где:** `src/simulation/core-types.ts`
- Строка ~245: `| StatusTickedEvent`
- Строка ~248: `| StatusTickedEvent` (повтор)

**Решение:** Удалить один из них.

---

### P3-2. Опциональное поле `statModifiers?` в `core-types.ts`

**Где:** `src/simulation/core-types.ts` (строка ~91):
```ts
export type StatusEffect = {
  type: StatusEffectType;
  duration: number;
  value: number;
  statModifiers?: StatModifier[]; // ← optional
};
```

**Проблема:**
- В начале `core-types.ts` заявлено правило: *«Никаких опциональных полей, если они не опциональны в рантайме (используйте явный null)»*.

**Решение:**
```ts
statModifiers: StatModifier[] | null;
```
- Проверить все места создания `StatusEffect` (fireballSkill, apply-status-intent-executer, тесты, фикстуры) и передать `null` вместо отсутствия поля.

---

### P3-3. `skillExecutor.ts` и skill executors импортируют `TargetMode` не из `core-types`

**Где:**
- `src/simulation/skills/skillExecutor.ts:3`
- `src/simulation/skills/executors/fireballSkill.ts:3`
- `src/simulation/skills/executors/magicSlapSkill.ts:3`

**Проблема:**
- `TargetMode` уже определён в `core-types.ts`. Импорт из `actions/types` создаёт лишнюю связанность между skills и action system.

**Решение:**
- Заменить `import { TargetMode } from '@simulation/systems/actions/types'` на `import { TargetMode } from '@simulation/core-types'` во всех трёх файлах.

---

### P3-4. `(text as any).worldX` в `TargetingRenderer`

**Где:** `src/ui/renderer/TargetingRenderer.ts` (строки ~147-148, ~199-200, ~217-218)

**Проблема:**
- Нарушение типизации PixiJS. `Text` не имеет полей `worldX` / `worldY`.

**Решение:**
- Создать `WeakMap<Text, { worldX: number; worldY: number }>` в классе `TargetingRenderer`.
- В методах `drawDamageNumber`, `drawStatusIcon`, `drawDeathMarker` сохранять координаты в WeakMap.
- В `syncTextLayer` (WorldRenderer) читать из WeakMap вместо `(child as any).worldX`.
- Альтернатива: если `syncTextLayer` живёт в `WorldRenderer`, а `TargetingRenderer` — его друг, можно хранить Map в `WorldRenderer` и давать доступ через метод.

---

## Чеклист исправлений

- [x] P0-1. Убрать импорты `content/registry` из Presentation, добавить методы в `Simulation`
- [x] P0-2. Исправить `runStatusTicks` — убрать захардкоженные `burning`/`value: 0`
- [x] P1-1. Убрать `abilityId === 'fireball'` из UI, добавить универсальные `PROJECTILE`/`EXPLOSION` шаги в Presentation
- [x] P1-2. Исправить инкапсуляцию `TargetingController` в `GameSession`
- [x] P1-3. Оптимизировать `previewTarget` — убрать лишние `notify()`
- [x] P2-1. Добавить `screenToWorld` в `WorldRenderer`, убрать дублирование из `GameField`
- [x] P2-2. Убрать `as any` в skill executors, добавить type guard
- [x] P2-3. Добавить событие `COOLDOWN_SET` для `SET_COOLDOWN` intent
- [x] P3-1. Удалить дубликат `StatusTickedEvent` в union
- [x] P3-2. `statModifiers?:` → `statModifiers: ... | null`
- [x] P3-3. Импортировать `TargetMode` из `core-types` в skills
- [x] P3-4. Заменить `(text as any).worldX` на `WeakMap`
