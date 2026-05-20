## В данной директории хранится логика выполнения всех намерений. 

### Все исполнители намерений должны реализовывать следующий тип

```typescript
type IntentExecutor<T extends Intent> = (
    state: GameState,
    intent: T,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => void;
```

### Исполнение намерения исполняется общей функцией, которая на основе типа намерения выбирает исполнителя

```typescript
export function executeIntent(
  state: GameState,
  intent: Intent,
  builder: ExecutionBuilder,
  parent: ExecutionNode,
) {
    const executor = intentExecutors[intent.type] as IntentExecutor<any>;
    executor(
        state,
        intent,
        builder,
        parent,
    );
}
```
