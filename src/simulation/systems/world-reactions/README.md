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

## Миграция на ContentRuleReaction

> Контентные мировые реакции перенесены в data-driven систему контентных правил (`ContentRuleReaction`).
> Старые императивные реакции (`fireDamageReaction`, `burningTickReaction`, `collisionDamageReaction`, `collisionStunReaction`) удалены из реестра.

### Что осталось в этой папке

- **Системные реакции** остаются кодом: смерть, дроп лута, разрешение толчка, переходы этажей, AI-уведомления.
- **Контентные реакции** теперь декларативные правила в `src/simulation/content-rules/`.
- **`counterAttackReaction` полностью перенесена в контентные правила** (`counterattack_trigger` и `counterattack_damage`). Системная реакция удалена.

### Точка врезки новой системы

Контентные реакции запускаются внутри `executeIntent` (`../intents/execute-intent.ts`) после `IntentExecutor`, перед системными `WorldReaction`.

Новая система включена по умолчанию через `GameState.featureFlags.contentRulesEnabled`.

### Что не меняется

- Системные реакции в этой папке остаются рабочими.
- Правило «IntentExecutor выполняет ровно одно семантическое действие и порождает ровно одно семантическое событие» сохраняется.
- Дерево `ExecutionNode` остаётся основным способом организации событий.
