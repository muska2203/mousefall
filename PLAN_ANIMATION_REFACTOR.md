# План рефакторинга анимационной системы

> **Статус:** Черновик плана для последовательной реализации.
> **Цель:** Устранить антипаттерны (magic numbers, гигантские switch, setTimeout vs performance.now(), orphaned типы) и заложить масштабируемую архитектуру для спрайтовых, PixiJS- и UI-оверлейных анимаций.

---

## 0. Принятые архитектурные решения

| Вопрос | Решение |
|--------|---------|
| **Tween-движок** | Собственная реализация. Единые хелперы `lerp` / `easing` + интеграция с PixiJS `Ticker`. Никаких новых npm-зависимостей. |
| **Структура очереди** | **Дерево**, изоморфное дереву `ExecutionNode`. Сиблинги (дети одного родителя) запускаются **параллельно**. Цепочка parent → child — **последовательно** (дети стартуют после завершения родителя). |
| **Сигнализация о завершении** | `Promise`-based API. `AnimationSequencer.run()` возвращает `{ blockingDone: Promise<void>, allDone: Promise<void> }`. `setTimeout` полностью вымирает. |
| **Визуальный охват** | Спрайтовые сдвиги (PixiJS), частицы/вспышки (PixiJS `Graphics`/`Container`), UI-оверлеи (DOM поверх canvas). |

---

## 1. Инфраструктура: Tween и централизованный конфиг

### 1.1. Создать `src/utils/tween.ts`
- `lerp(a: number, b: number, t: number): number`
- `clamp01(t: number): number`
- `Easing` — объект с функциями:
  - `linear(t)`
  - `easeOutQuad(t)`
  - `easeInQuad(t)`
  - `easeOutBack(t)`
- `runTickerTween(opts)` — микро-движок:
  - Принимает `duration`, `easing`, `onUpdate(progress: number)`, `onComplete()`.
  - Регистрируется через коллбэк `requestAnimationFrame` / PixiJS `Ticker` (внешний источник времени).
  - Возвращает функцию `cancel()`.

### 1.2. Создать `src/utils/animationConfig.ts`
- `ANIMATION_CONFIG: Record<AnimationStepType, AnimationConfigEntry>`
- Каждая запись содержит: `duration: number`, `blocking: boolean`, `easing: EasingType`.
- Все хардкод-числа (`200`, `100`) из `animationPlanner.ts` переезжают сюда.
- Должна быть **единственная точка правки** для баланса скорости анимаций.

---

## 2. Типы Presentation: от flat массива к дереву

### 2.1. Рефактор `src/presentation/types.ts`
- Переименовать существующий `AnimationPlan` union в **`AnimationStep`**.
- **Убрать** из шагов поля `duration` и `blocking` (теперь они живут в `ANIMATION_CONFIG`).
- Добавить новые шаги:
  - `ATTACK` — `attackerId`, `targetId`.
  - `PARTICLE_BURST` — `x`, `y`, `color`, `count` (база для крови/вспышек).
  - `UI_FLOATING_TEXT` — `text`, `x`, `y`, `styleKey`.
- Добавить рекурсивный тип дерева:
  ```ts
  export type AnimationNode = {
    step: AnimationStep;
    children: AnimationNode[];
  };
  ```
- Обновить `RenderInput`:
  ```ts
  animations: AnimationNode[] | null;
  // вместо старого AnimationPlan[] | null
  ```

---

## 3. Планировщик анимаций (Presentation Layer)

### 3.1. Рефактор `src/presentation/animationPlanner.ts`
- Заменить `buildAnimationPlans(result): AnimationPlan[]` на **`buildAnimationTree(result): AnimationNode[]`**.
- Ввести **registry builders**:
  ```ts
  const eventToStep = new Map<string, (event: GameEvent) => AnimationStep | null>();
  ```
- Зарегистрировать мапперы:
  - `ENTITY_MOVED` → `MOVE`
  - `ENTITY_DAMAGED` → `DAMAGE`
  - `ENTITY_DIED` → `DEATH`
  - `FOG_UPDATED` → `FOG_UPDATE`
  - `ENTITY_ATTACKED` → `ATTACK` (убираем orphaned тип)
- Реализовать `convertNode(execNode: ExecutionNode): AnimationNode | null`:
  - Если `event.type` есть в registry → создаём `AnimationNode` с `step` и рекурсивно конвертируем `children`.
  - Если событие **не** маппится → возвращаем `null`. При этом дети **поднимаются** вверх как сиблинги к ближайшему анимированному предку (flatten up). Это позволяет пропускать неанимированные события (`AP_SPENT` и др.) без нарушения дерева.
- Собирать корневые `AnimationNode[]` из `result.phases` → `actions`.

---

## 4. Ядро UI: AnimationSequencer

### 4.1. Создать `src/ui/animation/types.ts`
```ts
export interface AnimationExecutor {
  canExecute(step: AnimationStep): boolean;
  execute(step: AnimationStep, ctx: AnimationContext): Promise<void>;
}

export type AnimationContext = {
  worldRenderer: WorldRenderer;
  overlayContainer: HTMLElement; // для DOM-based эффектов
};

export type AnimationRunResult = {
  blockingDone: Promise<void>; // ввод разблокируется по этому Promise
  allDone: Promise<void>;      // все анимации (включая non-blocking) завершены
};
```

### 4.2. Создать `src/ui/animation/sequencer.ts`
- `class AnimationSequencer`:
  - `constructor(executors: AnimationExecutor[], ctx: AnimationContext)`
  - `run(nodes: AnimationNode[]): AnimationRunResult`

- Алгоритм `runNode(node)`:
  1. Читать `config = ANIMATION_CONFIG[node.step.type]`.
  2. Найти executor: `executors.find(e => e.canExecute(node.step))`.
  3. Если executor не найден — `console.warn` + мгновенный `resolve`.
  4. Если `config.blocking` — инкремент `blockingCounter`.
  5. `await executor.execute(node.step, context)`.
  6. Если `config.blocking` — декремент `blockingCounter`; если стал `0` — резолвим `blockingDone`.
  7. `await Promise.all(node.children.map(child => runNode(child)))`.

- Корневые ноды тоже запускаются через `Promise.all`, так что **несколько корневых действий** (например, ход игрока + реакция мира) могут идти параллельно, если это допустимо по логике фаз.

---

## 5. Исполнители анимаций (AnimationExecutors)

Каждый executor — изолированный адаптер. Добавление новой анимации = новый файл + регистрация в `GameField`.

### 5.1. `src/ui/animation/spriteExecutor.ts`
- `canExecute`: `MOVE`, `ATTACK`, `DEATH`.
- `execute` делегирует в `WorldRenderer`:
  - `worldRenderer.animateMove(entityId, from, to, config)`
  - `worldRenderer.animateAttack(attackerId, targetId, config)`
  - `worldRenderer.animateDeath(entityId, config)`
- Все методы `WorldRenderer` **возвращают `Promise<void>`**, резолвящийся по завершении tween.

### 5.2. `src/ui/animation/cameraExecutor.ts` (side-эффект)
- Камера — это не отдельный `AnimationStep`, а side-эффект от `MOVE` игрока.
- **Решение:** не выделять отдельный executor. `spriteExecutor` при обработке `MOVE` с `entityId === player.id` дополнительно запускает `worldRenderer.animateCamera(...)` параллельно со спрайтом (`Promise.all([spritePromise, cameraPromise])`).

### 5.3. `src/ui/animation/fogExecutor.ts`
- `canExecute`: `FOG_UPDATE`.
- Работает с `FogRenderer`.
- Реализовать анимацию открытия тайлов (например, fade-in alpha от 0.5 до 1.0 за `duration`).
- Возвращает `Promise<void>`.

### 5.4. `src/ui/animation/uiOverlayExecutor.ts`
- `canExecute`: `UI_FLOATING_TEXT`, `DAMAGE` (рендерится как floating text с цифрой урона).
- Создаёт DOM-элементы в `overlayContainer` (HTMLElement поверх canvas).
- Позиционирует через координаты тайлов → экранные координаты (через математику или API `WorldRenderer`).
- Анимирует через `runTickerTween` (подъём + fade-out).
- Удаляет DOM по завершении.

### 5.5. `src/ui/animation/particleExecutor.ts` (база)
- `canExecute`: `PARTICLE_BURST`.
- Создаёт временные `Graphics` / `Sprite` внутри `WorldRenderer.root`.
- Анимирует разлёт частиц через `runTickerTween`.
- Удаляет контейнер частиц по завершении.

---

## 6. Рефакторинг WorldRenderer и EntityRenderer

### 6.1. `src/ui/renderer/EntityRenderer.ts`
- **Убрать** тип `MoveAnimation` и `activeMoves: Map<string, MoveAnimation>`.
- Ввести обобщённый `ActiveTween`:
  ```ts
  type ActiveTween = {
    fromX: number; fromY: number;
    toX: number; toY: number;
    startTime: number; duration: number; easing: EasingFn;
    onUpdate: (x: number, y: number) => void;
    onComplete: () => void;
  };
  ```
- `activeAnimations: Map<string, ActiveTween>`.
- Методы:
  - `animateMove(entityId, from, to, config): Promise<void>`
  - `animateAttack(entityId, targetPos, config): Promise<void>` — сдвиг на тайл к цели и обратно.
  - `animateDeath(entityId, config): Promise<void>` — `alpha` → 0, `scale` → 0, затем `destroy()` спрайта.
- `updateAnimations(now)` — обновляет все `ActiveTween`, резолвит `onComplete` завершённых и удаляет их из Map.
- **`update(input)` становится синхронным.** Убрать `async` и `await Promise.all` для текстур.
  - `getTexture` должен возвращать `Texture` синхронно из `TextureCache`. Если текстуры нет — использовать `Texture.EMPTY` и подменять при фоновой загрузке.

### 6.2. `src/ui/renderer/WorldRenderer.ts`
- **Убрать** метод `playAnimations(...)`.
- Добавить публичные методы:
  - `animateMove(...): Promise<void>`
  - `animateAttack(...): Promise<void>`
  - `animateDeath(...): Promise<void>`
  - `animateCamera(fromTile, toTile, config): Promise<void>` — Promise-based камера.
- `onTick` обновляет entity tweens и camera tween.

### 6.3. `src/ui/renderer/FogRenderer.ts`
- Добавить `animateReveal(positions, config): Promise<void>`.
- Если анимация тумана не критична для MVP — можно сделать мгновенное открытие + `resolve()`, но API должно быть Promise-based.

---

## 7. Рефакторинг GameField

### 7.1. `src/ui/components/GameField.tsx`
- **Удалить** весь блок `setTimeout` и вычисление `blockingDuration`.
- При монтировании создать экземпляр `AnimationSequencer` с полным набором executors.
- При изменении `renderInput`:
  ```ts
  if (renderInput.animations && renderInput.animations.length > 0) {
    const result = sequencer.run(renderInput.animations);
    result.blockingDone.then(() => {
      onCompleteRef.current();
    });
  }
  ```
- `isInputBlocked` остаётся на основе `renderInput.phase === 'animating'`.
- Перед размонтированием — вызывать `sequencer.cancelAll()` (прерывание всех активных анимаций).

---

## 8. Адаптация GameSession

### 8.1. `src/presentation/gameSession.ts`
- Заменить вызов `buildAnimationPlans(result)` на `buildAnimationTree(result)`.
- Убедиться, что `buildRenderInput` отдаёт `animations: AnimationNode[] | null`.
- `onAnimationsComplete()` остаётся без изменений в публичном API, но теперь он вызывается по реальному завершению анимаций, а не по таймауту.

---

## 9. Тесты

### 9.1. `tests/unit/utils/tween.test.ts`
- `lerp` на границах.
- `clamp01` на отрицательных и >1.
- Каждая easing-функция возвращает ожидаемые значения на `t = 0`, `0.5`, `1`.

### 9.2. `tests/unit/presentation/animationPlanner.test.ts`
- Простое дерево `ExecutionNode` → корректное `AnimationNode` дерево.
- Непрозрачные узлы (без анимации) пропускаются, их дети поднимаются как сиблинги.
- `ENTITY_ATTACKED` порождает `ATTACK` шаг.

### 9.3. `tests/unit/ui/animation/sequencer.test.ts`
- Мок-executors (фиктивные Promise с `setImmediate` / `setTimeout(0)`).
- **Последовательность:** дети стартуют только после `resolve` родителя.
- **Параллельность:** сиблинги стартуют одновременно (проверка через счётчик).
- **Blocking:** `blockingDone` резолвится только после завершения всех `blocking` узлов, но раньше `allDone`, если есть non-blocking хвост.

### 9.4. `tests/unit/ui/renderer/EntityRenderer.test.ts`
- Проверка, что `animateMove` возвращает `Promise<void>`.
- Проверка прерывания предыдущей анимации (вызов новой `animateMove` до завершения старой).

---

## 10. Чек-лист приёмки

- [ ] В проекте **нет** `setTimeout`, связанного с анимациями / блокировкой ввода.
- [ ] `EntityRenderer.update` — **синхронный**, нет `async/await` внутри.
- [ ] Все длительности анимаций вынесены в **`ANIMATION_CONFIG`**.
- [ ] Добавление нового типа анимации требует правки **трёх** файлов: тип (`types.ts`), builder (`animationPlanner.ts` registry), executor (`ui/animation/xxxExecutor.ts`).
- [ ] `ATTACK` порождается планировщиком и обрабатывается рендерером (спрайтовый сдвиг).
- [ ] `DAMAGE` отображается через `uiOverlayExecutor` (всплывающая цифра урона).
- [ ] `DEATH` анимирует fade-out + scale-down спрайта перед удалением.
- [ ] `FOG_UPDATE` анимирует открытие тайлов (хотя бы простой fade).
- [ ] Блокировка ввода (`animating`) снимается ровно после завершения последней `blocking` анимации.
- [ ] При пролаге или фоновой вкладке анимация и разблокировка остаются **синхронизированными** (единый источник времени через PixiJS Ticker / `performance.now()`).
- [ ] Все тесты (` tween`, `animationPlanner`, `sequencer`) проходят.

---

## 11. Последовательность выполнения (рекомендуемый порядок)

1. **Этап 1** — `src/utils/tween.ts` + `src/utils/animationConfig.ts` (инфраструктура).
2. **Этап 2** — `src/presentation/types.ts` + `src/presentation/animationPlanner.ts` (новое дерево).
3. **Этап 3** — `src/ui/animation/types.ts` + `src/ui/animation/sequencer.ts` (ядро sequencer).
4. **Этап 4** — `src/ui/renderer/EntityRenderer.ts` + `WorldRenderer.ts` (Promise-based API, синхронный `update`).
5. **Этап 5** — `src/ui/animation/spriteExecutor.ts` + `fogExecutor.ts` + `uiOverlayExecutor.ts` (исполнители).
6. **Этап 6** — `src/ui/components/GameField.tsx` (убрать setTimeout, подключить sequencer).
7. **Этап 7** — `src/presentation/gameSession.ts` (подключить `buildAnimationTree`).
8. **Этап 8** — Тесты (`tween`, `planner`, `sequencer`).
9. **Этап 9** — Реализация orphaned типов (`ATTACK`, `DAMAGE` как floating text, `DEATH`).
10. **Этап 10** — Финальный чек-лист приёмки.
