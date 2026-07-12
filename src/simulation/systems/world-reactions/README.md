## В данной директории хранится логика реакций мира на выполненные действия

### Каждая реакция должна реализовать тип ниже и зарегистрирована в реестре: `const worldReactions: ReactionMap`
```typescript
export type WorldReaction<T extends GameEvent> = (
    state: GameState,
    event: T,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => void;
```

### Любое исполнение намерения может вызвать реакцию мира, что может породить другие исполнения намерений и т.д.

---

## Грядущая миграция на ContentRuleReaction

> ⚠️ Этот раздел описывает планируемую эволюцию системы реакций. Текущий код в этой папке остаётся рабочим до завершения миграции.

Часть существующих реакций мира будет перенесена в новую data-driven систему контентных правил (`ContentRuleReaction`) в рамках плана внедрения боевой концепции:

- [`docs/plans/combat-implementation-roadmap/README.md`](../../../../plans/combat-implementation-roadmap/README.md) — общий план;
- [`docs/plans/combat-implementation-roadmap/phase-01/reaction-inventory.md`](../../../../plans/combat-implementation-roadmap/phase-01/reaction-inventory.md) — классификация реакций;
- [`docs/plans/combat-implementation-roadmap/phase-01/intent-event-flow.md`](../../../../plans/combat-implementation-roadmap/phase-01/intent-event-flow.md) — поток Intent → Event → World Reaction.

### Принцип разделения

- **Системные реакции** остаются кодом: смерть, дроп лута, разрешение толчка, переходы этажей, AI-уведомления.
- **Контентные реакции** становятся декларативными правилами: огненный урон → горение, урон/стан от столкновений, тик горения, контратака.

### Точка врезки новой системы

Новые слои будут добавлены внутри общей функции `executeIntent` (`../intents/execute-intent.ts`):

1. **Модификаторы на интенте** — перед вызовом конкретного `IntentExecutor`.
2. **Контентные реакции на событии** — после `IntentExecutor`, перед запуском системных `WorldReaction`.

Включение новых слоёв будет управляться runtime-флагом в `Simulation`; на ранних фазах флаг активируется только для пилотных сценариев.

### Что не меняется

- Системные реакции в этой папке остаются рабочими.
- Правило «IntentExecutor выполняет ровно одно семантическое действие и порождает ровно одно семантическое событие» сохраняется.
- Дерево `ExecutionNode` остаётся основным способом организации событий.
