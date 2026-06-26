## В данной директории хранится логика выполнения всех намерений. 

### Все исполнители намерений должны реализовывать следующий тип

```typescript
type IntentExecutor<T extends Intent> = (
    state: GameState,
    intent: T,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => ExecutionNode | null;
```

### Исполнение намерения исполняется общей функцией, которая на основе типа намерения выбирает исполнителя

```typescript
export function executeIntent(
  state: GameState,
  intent: Intent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
): ExecutionNode | null {
    const executor = intentExecutors[intent.type] as IntentExecutor<any>;
    const resultNode = executor(
        state,
        intent,
        builder,
        parent,
    );
    if (resultNode !== null) {
        const reactionIntents = runWorldReactions(state, builder, resultNode);
        for (const reactionIntent of reactionIntents) {
            executeIntent(state, reactionIntent, builder, resultNode);
        }
    }
    return resultNode;
}
```
