# Контракт Presentation: новое правило = Simulation + Presentation

> Документ фиксирует соглашение, введённое фазой 05.5: любое новое игровое правило должно реализовываться сразу в двух слоях — **Simulation** (логика) и **Presentation/UI** (отображение).

---

## 1. Цель

После фазы 05.5 Presentation Layer оперирует собственной моделью состояния — `DisplayState`. Симуляция остаётся headless и не знает об UI, а UI не знает о Simulation. Поэтому каждое новое правило, порождающее события, должно получить:

- `DisplayPatch` — чтобы UI показывал корректное промежуточное и финальное состояние;
- animation builder — если событие визуально значимо;
- строку combat log и i18n-ключи — если событие значимо для игрока;
- тесты Presentation — чтобы правило не терялось на границе Simulation → UI.

---

## 2. Архитектура

```
Simulation → GameEvent → DisplayPatch → PresentationNode → AnimationNode[] → UI
```

### 2.1. `DisplayState`

Файл: `src/presentation/displayState/types.ts`.

Минимальная модель игрового мира, из которой UI рисует поле, сущности, HP, статусы, туман войны и мета-информацию хода. Создаётся из `GameState` и обновляется патчами, а не прямой мутацией `GameState`.

### 2.2. `DisplayPatch`

Файл: `src/presentation/displayState/builder.ts`.

Неизменяемая запись об изменении `DisplayState`, порождённая одним `GameEvent`. Примеры: `ENTITY_MOVED`, `ENTITY_DAMAGED`, `STATUS_APPLIED`, `STATUS_REMOVED`, `FOG_UPDATED`, `NO_OP`.

### 2.3. `PresentationNode`

Файл: `src/presentation/displayState/types.ts`.

```ts
{
  event: GameEvent;
  patch: DisplayPatch;
  animations: AnimationNode[] | null;
  isFieldAnimation: boolean;
  parent: PresentationNode | null;
  children: PresentationNode[];
  side: TurnSide;
}
```

Связывает событие Simulation, патч состояния и набор анимаций, которые UI должен проиграть.

### 2.4. Применение патчей

Патчи применяются **по завершении анимаций**, а не сразу после `dispatch`:

1. `AnimationSequencer` вызывает `onNodeComplete(node)` после завершения каждого шага.
2. `GameSession` (или аналогичный координатор) применяет `node.patch` к `DisplayState`.
3. UI получает обновлённое `DisplayState` и перерисовывается.

После завершения **всех** анимаций фазы `DisplayState` ресинкается с финальным `GameState` — перестраховка на случай расхождений.

### 2.5. FOV-фильтрация

FOV-фильтр применяется **только к полевым анимациям** (`isFieldAnimation === true`). События, патчи и строки combat log не скрываются из-за тумана войны — игрок должен видеть лог и изменение состояния, даже если анимация за пределами видимости.

### 2.6. Тайловые эффекты

События `TILE_EFFECT_CHANGED` и `EXPLOSION_TRIGGERED` остаются вне контракта фазы 05.5 — их обработка запланирована на фазу 7.

---

## 3. Чеклист добавления нового правила

### Simulation

- [ ] Добавить/обновить `GameEvent` в `src/simulation/core-types.ts` (и реэкспорт в `src/simulation/types.ts`).
- [ ] Добавить эмиссию события в соответствующий `IntentExecutor` (`src/simulation/systems/intents/`).
- [ ] Если событие может быть триггером контентных правил, обновить `RuleContext` в `src/simulation/content-rules/rule-context.ts`.

### Presentation

- [ ] Добавить `DisplayPatch` в `src/presentation/displayState/builder.ts` (или `NO_OP`, если визуально не значимо).
- [ ] Если визуально значимо, добавить animation builder в `src/presentation/animation/builders/`.
- [ ] Зарегистрировать builder в `src/presentation/animation/register.ts` (файл загружается через `src/presentation/animation/index.ts`).
- [ ] Если событие значимо для игрока, добавить строку в `src/presentation/logBuilder.ts` и i18n-ключи:
  - `src/i18n/schema.ts` — `SystemLogBuilderTranslations`;
  - `src/i18n/locales/ru/system/logBuilder.ts`;
  - `src/i18n/locales/en/system/logBuilder.ts`.
- [ ] Добавить unit-тесты для патча и builder в `tests/unit/presentation/`.
- [ ] Если правило участвует в типовой цепочке, добавить интеграционный тест в `tests/integration/combat-scenarios/`.

### UI

- [ ] Если builder порождает новый тип `AnimationNode`, добавить/обновить executor в `src/ui/animation/executors/`.
- [ ] Убедиться, что renderer'ы читают изменение из `DisplayState`.

---

## 4. Примеры

### 4.1. Как добавить визуальный эффект для нового статуса

Допустим, правило накладывает статус `electrified`.

1. Событие `STATUS_APPLIED` уже существует в Simulation; новый `effectType` добавляется в тип `StatusEffectType`.
2. В `src/presentation/displayState/builder.ts` событие `STATUS_APPLIED` уже маппится в `StatusAppliedPatch` — дополнительных изменений не требуется.
3. Добавить animation builder в `src/presentation/animation/builders/statusElectrified.ts` (или расширить `statusAppliedBuilder`):

```ts
import type { GameEvent } from '@simulation/types';
import type { AnimationNode } from '@presentation/types';
import { buildAnimationNode } from '../core/builder-utils';

export function statusElectrifiedBuilder(event: GameEvent): AnimationNode[] | null {
  if (event.type !== 'STATUS_APPLIED' || event.effect.type !== 'electrified') return null;
  return [
    buildAnimationNode('PARTICLE_BURST', {
      entityId: event.entityId,
      effect: 'electrified',
    }),
  ];
}
```

4. Зарегистрировать builder в `src/presentation/animation/register.ts`:

```ts
import { statusElectrifiedBuilder } from './builders/statusElectrified';
registerAnimationBuilder('STATUS_APPLIED', statusElectrifiedBuilder);
```

> Примечание: если builder существует, добавлять новый регистратор не нужно — расширяйте существующий.

5. Добавить i18n-ключ `system.gameSession.effectElectrified` в `src/i18n/schema.ts` и оба locale-файла.
6. Добавить unit-тест в `tests/unit/presentation/animation/builders.test.ts` (или аналогичный).

### 4.2. Как добавить лог для нового события

Допустим, Simulation порождает новое событие `ENTITY_KNOCKED_BACK`.

1. Добавить `DisplayPatch` в `src/presentation/displayState/types.ts`:

```ts
export type EntityKnockedBackPatch = {
  type: 'ENTITY_KNOCKED_BACK';
  entityId: string;
  from: Position;
  to: Position;
};
```

2. Добавить обработку в `createPatch` и `applyPatch` в `src/presentation/displayState/builder.ts`.
3. Добавить обработку в `src/presentation/logBuilder.ts`:

```ts
case 'ENTITY_KNOCKED_BACK': {
  const name = getEntityDisplayName(state, event.entityId, locale);
  return { text: t('system.logBuilder.entityKnockedBack', { name }), variant: 'info' };
}
```

4. Добавить ключ в `src/i18n/schema.ts` и locale-файлы:

```ts
// src/i18n/locales/ru/system/logBuilder.ts
entityKnockedBack: '{{name}} отброшен назад',
```

5. Добавить unit-тест в `tests/unit/presentation/logBuilder.test.ts`.

---

## 5. Связанные документы

- `docs/agents/ACTION_SYSTEM.md` — добавление нового Action/Event в Simulation.
- `docs/agents/LAYERS.md` — правила архитектурных слоёв и запрещённые зависимости.
- `docs/plans/05.5-adaptaciya-presentation.md` — исходный план фазы 05.5.
- `src/presentation/displayState/` — типы, builder, синхронизация и планировщик.
- `src/presentation/animation/builders/` — animation builders.
- `src/presentation/animation/register.ts` — регистрация builders.
- `src/presentation/logBuilder.ts` — построитель combat log.
- `src/i18n/schema.ts` и `src/i18n/locales/*/system/logBuilder.ts` — переводы строк log.
