# Задача 6: Отображение лута в Presentation и UI

> **Статус:** готова к реализации  
> **Зависимости:**
> - Задача 4 (`ItemDroppedEvent` с новыми полями `dropperEntityId`, `templateId`)
> **Сложность:** низкая–средняя

---

## Цель

Добавить отображение выпавших предметов на полу:
1. Presentation собирает `ItemEntity` для рендера.
2. `AnimationPlanner` обрабатывает `ITEM_DROPPED`.
3. UI/Rendrer отрисовывает предметы.

---

## Архитектурный контекст

Согласно `AGENTS.md` и `ARCHITECTURE.md`:
- Presentation — единственный мост между UI и Simulation.
- UI не знает о Simulation, работает только с ViewModel от Presentation.
- Presentation переводит дерево `ExecutionNode` в анимационные планы.
- UI Layer (`src/ui/`) отвечает за рендеринг через PixiJS и React.

Согласно `LOOT_SYSTEM_PLAN.md`:
- Presentation собирает все `ItemEntity` с поля в `renderInput.itemsOnFloor`.
- `ItemDroppedEvent` → анимация "предмет падает".
- Визуализация: общий контейнер (мешок) + иконка содержимого (`templateId`).

---

## Что нужно сделать

### 1. Presentation — сбор предметов на полу

**Файл:** `src/presentation/buildRenderInput.ts` (или аналогичный файл, где формируется render input)

Добавить в `renderInput`:
```typescript
itemsOnFloor: Array<{
  id: string;
  x: number;
  y: number;
  templateId: string;
}>;
```

Собирать из `state.entities`:
```typescript
const itemsOnFloor = Array.from(state.entities.values())
  .filter(e => e.type === 'item')
  .map(e => ({
    id: e.id,
    x: e.x,
    y: e.y,
    templateId: e.templateId,
  }));
```

### 2. AnimationPlanner — обработка `ITEM_DROPPED`

**Файл:** `src/presentation/animationPlanner.ts`

Добавить case для `ITEM_DROPPED`:
```typescript
case 'ITEM_DROPPED':
  animations.push({
    type: 'ITEM_DROP',
    itemId: event.itemInstanceId,
    position: event.position,
    templateId: event.templateId,
  });
  break;
```

> Тип анимации может быть простым "появлением" (fade in) или коротким tween'ом.

### 3. `fogFilter.ts` (если использует `ItemDroppedEvent`)

**Файл:** `src/presentation/fogFilter.ts`

Проверить, используется ли `entityId` из `ItemDroppedEvent`. Если да — заменить на `dropperEntityId`.

> В `LOOT_SYSTEM_PLAN.md` указано, что `event.position` уже используется, а `entityId` → `dropperEntityId` не влияет на логику видимости. Но стоит проверить.

### 4. UI / Renderer — отрисовка предметов

**Файл:** `src/ui/renderer/` (где отрисовываются сущности на карте)

Добавить отрисовку `ItemEntity`:
- Базовый спрайт-контейнер (мешок / бочка / универсальная иконка).
- Поверх — мини-иконка или спрайт, соответствующий `templateId`.
- Если на клетке несколько предметов — пока отрисовывать только верхний (стопки — future).

> **Важно:** решение о визуальном представлении (какой спрайт мешка, какая иконка) принимает UI Layer. `ItemEntity` хранит только `templateId`.

---

## Тесты

Согласно `TESTING_STRATEGY.md`, покрытие `src/ui/` и `src/presentation/` **не измеряется**. Однако:

- Можно добавить **юнит-тест** для `animationPlanner.ts`, проверяющий, что `ITEM_DROPPED` порождает анимацию нужного типа.
- UI-тесты (визуальная регрессия, скриншоты) — вне scope текущего проекта.

---

## Критерии приёмки

- [ ] `renderInput` содержит массив `itemsOnFloor` с позициями и `templateId`.
- [ ] `animationPlanner` обрабатывает `ITEM_DROPPED` и создаёт анимацию.
- [ ] Предметы на полу отображаются в UI (хотя бы базовый спрайт).
- [ ] `fogFilter.ts` не использует устаревший `entityId` из `ItemDroppedEvent`.
- [ ] `npm run typecheck` проходит.
- [ ] Dev-сервер (`npm run dev`) запускается без ошибок.
