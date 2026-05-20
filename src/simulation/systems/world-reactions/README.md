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