# План: система выпадения и подбора лута

> Статус: утверждён для реализации.  
> Основан на архитектуре Action → Intent → Event Tree + WorldReaction + Deferred Deletion.

---

## 1. Цель

Сделать выпадение лута из поверженных врагов (и в будущем — из сундуков) через архитектурный механизм WorldReaction + IntentExecutor. Логика расчёта лута централизована, детерминирована, переиспользуема.

---

## 2. Изменения в JSON-контенте

### 2.1. Формат `lootTable`

Сейчас:
```json
"lootTable": ["health_potion", "health_potion", "sword"]
```

Станет:
```json
"lootTable": [
  { "templateId": "health_potion", "weight": 3 },
  { "templateId": "common_splinter_blade", "weight": 1 }
],
"lootDropCount": { "min": 1, "max": 1 }
```

- `templateId` — ID шаблона предмета.
- `weight` — вес для взвешенного рандома (чем больше, тем выше шанс).
- `lootDropCount` — сколько предметов выпадает из этой таблицы за раз (для врагов обычно 1, для сундуков может быть больше).
- Выбор детерминированный через `state.rng`.
- Формат массива объектов выбран для расширяемости: в будущем можно добавить `quantity`, `rarity`, `levelRequirement` без ломающих изменений схемы.

### 2.2. Файлы для обновления

- `public/content/entities/enemies/cat_small.json`
- `public/content/entities/enemies/cat_mid.json`
- `public/content/entities/enemies/cat_big.json`
- `src/simulation/schemas/contentSchemas.ts` — `lootTable` массив объектов + `lootDropCount`

---

## 3. Централизованный компонент: `LootCalculator`

**Файл:** `src/utils/loot.ts`

> Размещён в `utils/`, а не в `simulation/systems/`, потому что это чистая функция без зависимости от `GameState`. Туда же будут добавляться утилиты генерации лута для сундуков и других источников.

**API:**
```typescript
/**
 * Рассчитывает выпавший лут на основе взвешенной таблицы.
 * Детерминированный — использует seeded RNG из state.
 * Вызывается `count` раз, возвращает список templateId.
 */
export function calculateLootDrops(
  lootTable: Array<{ templateId: string; weight: number }>,
  count: number,
  rng: RNG,
): string[];
```

**Правила:**
- Суммирует все веса, выбирает один предмет за вызов.
- Вызывается `count` раз (count определяется вызывающей стороной — реакцией или action handler'ом сундука).
- Никаких side effects, чистая функция.
- Возвращает `string[]` длиной `count` (или меньше, если таблица пуста).

---

## 4. Архитектурное изменение: логическое удаление сущностей (Deferred Deletion)

Вместо немедленного удаления врага из `state.entities` при смерти, сущность **помечается** `isAlive = false` и остаётся в состоянии до конца хода. Это позволяет post-death реакциям (лут, опыт, квесты) обращаться к полным данным сущности через `state.entities.get(id)`.

> `isAlive` уже определён в `Attackable` (`src/simulation/types.ts`). Он используется в `findAllAliveAiActors`, `targeting`, `status-effect-ticker`. Теперь он становится полноценным механизмом жизненного цикла.

### 4.1. Обновление `executeDieIntent`

**Файл:** `src/simulation/systems/intents/die-intent-executer.ts`

Вместо `removeEnemy(state, intent.entityId)`:

```typescript
export const executeDieIntent: IntentExecutor<DieIntent> = (
    state: GameState,
    intent: DieIntent,
    builder: ExecutionBuilder,
    parent: ExecutionNode,
) => {
    const entity = state.entities.get(intent.entityId);
    if (!entity) return null;
    
    if (intent.entityId === PLAYER_ID) {
        state.player.hp = 0;
        state.player.isAlive = false;
        state.phase = 'dead';
        return builder.addChild(parent, {type: 'PLAYER_DIED'});
    } else {
        if ('isAlive' in entity) {
            entity.isAlive = false;
            entity.blocksMovement = false; // труп не блокирует проход
            return builder.addChild(parent, {
                type: 'ENTITY_DIED',
                entityId: intent.entityId,
                position: intent.position,
            });
        }
    }
    return null;
}
```

### 4.2. Защита `deathReaction` от двойного срабатывания

**Файл:** `src/simulation/systems/world-reactions/death-reaction.ts`

```typescript
export const deathReaction: WorldReaction = (state, event) => {
    if (event.type !== 'ENTITY_DAMAGED') return [];
    const entity = findAttackableEntity(state, event.targetId);
    if (!entity) return [];
    if (entity.hp > 0) return [];
    if (entity.isAlive === false) return []; // ← уже помечена мертвой
    const deathPos = { x: entity.x, y: entity.y };
    return [{ type: 'DIE', entityId: entity.id, position: deathPos }];
};
```

### 4.3. Фаза очистки мёртвых сущностей

**Файл:** `src/simulation/state.ts`

```typescript
export function cleanupDeadEntities(state: GameState): void {
  for (const [id, entity] of state.entities) {
    if ('isAlive' in entity && entity.isAlive === false) {
      state.entities.delete(id);
    }
  }
}
```

**Файл:** `src/simulation/simulation.ts`

Вызывать в `beginNextPlayerTurn()` (после завершения хода окружения, перед началом нового раунда):

```typescript
private beginNextPlayerTurn(): void {
    cleanupDeadEntities(this.state);
    this.state.turn.activeSide = 'PLAYER';
    this.state.turn.round += 1;
    this.state.player.ap = this.state.player.maxAp;
    // ...
}
```

### 4.4. Обновление `findAttackableEntity`

**Файл:** `src/simulation/state.ts`

```typescript
export function findAttackableEntity(
  state: GameState,
  id: EntityId,
): (Entity & Attackable) | undefined {
  const foundEntity = state.entities.get(id);
  if (foundEntity && 'hp' in foundEntity && foundEntity.isAlive !== false) {
    return foundEntity as Entity & Attackable;
  }
  return undefined;
}
```

> Это предотвращает атаку уже мёртвых сущностей и корректно работает с deferred deletion.

### 4.5. Новый Intent

```typescript
// Спавн конкретного предмета на поле
export type SpawnItemIntent = {
  type: 'SPAWN_ITEM';
  templateId: string;         // шаблон предмета
  position: Position;         // начальная точка — executor найдёт свободную клетку рядом
  sourceEntityId: EntityId;   // от кого выпал (для логов)
};
```

`DropLootIntent` **не вводится** — расчёт лута происходит внутри WorldReaction на `ENTITY_DIED`, которая сразу возвращает `SpawnItemIntent[]`.

### 4.6. Обновление существующего `ItemDroppedEvent`

Сейчас:
```typescript
export type ItemDroppedEvent = {
  type: 'ITEM_DROPPED';
  entityId: EntityId;         // неясно: тот, кто дропнул?
  itemInstanceId: ItemInstanceId;
  position: Position;
};
```

Станет:
```typescript
export type ItemDroppedEvent = {
  type: 'ITEM_DROPPED';
  dropperEntityId: EntityId;  // тот, от кого выпал предмет (враг / сундук)
  itemInstanceId: ItemInstanceId;
  templateId: string;         // шаблон предмета (для UI / логов / спрайтов)
  position: Position;
};
```

**Зачем переименование:** `entityId` в `ItemPickedUpEvent` означает "тот, кто подобрал", а в `ItemDroppedEvent` — "тот, кто дропнул". Это разные сущности, нужна ясность. `templateId` нужен UI, чтобы отрисовать спрайт содержимого.

### 4.7. Intent union

```typescript
export type Intent =
  | MoveIntent
  | DamageIntent
  | DieIntent
  | ApplyStatusIntent
  | ChangeFloorIntent
  | ConsumeMpIntent
  | SetCooldownIntent
  | ConsumeApIntent
  | TickStatusEffectsIntent
  | SpawnItemIntent;        // ← новый
```

### 4.8. GameEvent union

Без изменений в union (новых event'ов не добавляется, кроме обновления полей `ItemDroppedEvent`).

---

## 5. Реакция на смерть: `postDeathLootReaction`

**Файл:** `src/simulation/systems/world-reactions/post-death-loot-reaction.ts`

**Логика:**
- Подписана на `ENTITY_DIED`.
- Получает сущность: `const entity = state.entities.get(event.entityId);`
- Если `!entity || entity.type !== 'enemy'` — возвращает `[]`.
- Берёт `entity.templateId` → `tryGetEntity(templateId)`.
- Если шаблон не найден или `lootTable` пуст — возвращает `[]`.
- Определяет `count = rngInt(state.rng, template.lootDropCount.min, template.lootDropCount.max)`.
- Вызывает `calculateLootDrops(lootTable, count, state.rng)`.
- Возвращает массив `SpawnItemIntent[]`:
  ```typescript
  drops.map(templateId => ({
    type: 'SPAWN_ITEM',
    templateId,
    position: event.position,
    sourceEntityId: event.entityId,
  }));
  ```

**Регистрация** в `reactions.ts`:
```typescript
registerReaction('ENTITY_DIED', postDeathLootReaction, 0);
```

**Почему priority = 0:** `deathReaction` работает на `ENTITY_DAMAGED`, порождая `DIE` intent. `postDeathLootReaction` работает на `ENTITY_DIED` — они не конфликтуют по приоритету. Если позже добавятся другие post-death эффекты, можно выставить приоритеты.

---

## 6. IntentExecutor: `executeSpawnItemIntent`

**Файл:** `src/simulation/systems/intents/spawn-item-intent-executor.ts`

**Логика:**
1. Проверяет `tryGetItem(intent.templateId)`. Если не найден — возвращает `null` (graceful skip, симуляция не падает на невалидном контенте).
2. Определяет клетку для спавна:
   - Сначала `intent.position`.
   - Если занята — вызывает `findFreeTileNear(state, intent.position)` (см. раздел 6.1).
   - Если всё занято — fallback на `intent.position` (предметы могут стакаться на одной клетке).
3. Создаёт `ItemEntity`:
   - `id: nextEntityId(state, 'item')`
   - `type: 'item'`
   - `templateId: intent.templateId`
   - `x, y` — найденная клетка
   - Данные из шаблона предмета (name, icon и т.д.)
4. `state.entities.set(item.id, item)`.
5. Создаёт event `ITEM_DROPPED`:
   ```typescript
   {
     type: 'ITEM_DROPPED',
     dropperEntityId: intent.sourceEntityId,
     itemInstanceId: item.id,
     templateId: intent.templateId,
     position: { x: item.x, y: item.y },
   }
   ```
6. Добавляет в дерево: `builder.addChild(parent, event)`.
7. Возвращает `ExecutionNode`.

### 6.1. Утилита поиска свободной клетки

**Файл:** `src/utils/loot-spawn.ts` (или `src/utils/loot.ts`, если логически связано)

```typescript
/**
 * Находит ближайшую свободную клетку для спавна предмета.
 * Проверяет кольца вокруг origin по манхэттенскому расстоянию.
 */
export function findFreeTileNear(
  state: GameState,
  origin: Position,
  maxRadius?: number
): Position;
```

---

## 7. Полное дерево событий (пример)

```
ACTION_APPLIED (ATTACK)
└── DAMAGE
    └── ENTITY_DAMAGED
        └── DIE
            └── ENTITY_DIED
                ├── SPAWN_ITEM (health_potion)
                │   └── ITEM_DROPPED
                └── SPAWN_ITEM (common_splinter_blade)
                    └── ITEM_DROPPED
```

---

## 8. Подбор лежащего лута (отдельная задача, отдельный ПР)

### 8.1. Action `PICKUP`

Добавить новый тип действия `GameAction`:
```typescript
{ type: 'PICKUP' }
```

**ActionHandler (`src/simulation/systems/actions/pickup-action-handler.ts`):**
- `validate`: игрок стоит на клетке с `ItemEntity`.
- `resolve`: возвращает `PICKUP_ITEM` intent.
- `execute`: порождает `ACTION_APPLIED`.

**`PICKUP_ITEM` IntentExecutor:**
- Находит `ItemEntity` на клетке игрока.
- Добавляет предмет в `player.inventory`.
- Удаляет `ItemEntity` из `state.entities`.
- Порождает `ITEM_PICKED_UP` event.

**Почему отдельное действие, а не реакция на `ENTITY_MOVED`:**
- В roguelike подбор — это осознанное действие, а не побочный эффект ходьбы.
- Игрок может не хотеть подбирать мусор.
- Автопуть не должен неожиданно забивать инвентарь.
- В будущем можно добавить авто-подбор как опцию, но базовый механизм — явный `PICKUP`.

### 8.2. Взаимодействие с объектами (future: `INTERACT`)

В будущем для сундуков, дверей, рычагов (стоя рядом, а не на клетке) будет введён отдельный action `INTERACT`. Сейчас ограничиваемся `PICKUP` для предметов под ногами.

---

## 9. Отображение лута в UI

### 9.1. Presentation (`buildRenderInput`)
- Собирает все `ItemEntity` с поля в `renderInput.itemsOnFloor`.
- Для каждого: позиция + `templateId`.

### 9.2. UI / Renderer
- `ItemEntity` на поле рендерится как **контейнер** (общий спрайт мешка/бочки).
- **Поверх** него — мини-спрайт/иконка содержимого (`templateId`).
- Это позволит в будущем показывать много предметов на одной клетке (стопка).

> **Архитектурная заметка:** визуальное представление (мешок/бочка/иконка) — исключительно решение UI Layer. `ItemEntity` в Simulation хранит только `templateId`; Renderer решает, какой спрайт наложить.

### 9.3. AnimationPlanner
- `ITEM_DROPPED` → анимация "предмет падает на поле" (кратковременный tween или просто появление).

---

## 10. Тесты

### 10.1. `loot.test.ts` (`tests/unit/utils/loot.test.ts`)
- Взвешенный рандом с фиксированным seed.
- Граничные случаи: пустая таблица, один предмет, нулевые/отрицательные веса.
- `count = 3` → возвращает ровно 3 `templateId`.

### 10.2. `post-death-loot-reaction.test.ts`
- Враг без `lootTable` → реакция возвращает `[]`.
- Враг с `lootTable` → возвращает `SPAWN_ITEM` intents.
- Проверка `templateId` в каждом intent (через `state.entities.get`).
- Сущность `type !== 'enemy'` → реакция возвращает `[]`.

### 10.3. `spawn-item-intent-executor.test.ts`
- Проверяет, что `ItemEntity` создаётся и добавляется в `state.entities`.
- Проверяет fallback на соседние клетки через `findFreeTileNear`.
- Проверяет `ITEM_DROPPED` event (поля `dropperEntityId`, `templateId`, `position`).
- Невалидный `templateId` → `null`, state не меняется.

### 10.4. `find-free-tile-near.test.ts`
- Свободная клетка рядом находится корректно.
- Если все заняты — возвращает origin.

### 10.5. `deferred-deletion.test.ts` (новые)
- После `executeDieIntent` сущность остаётся в `state.entities` с `isAlive === false`.
- `findAttackableEntity` возвращает `undefined` для мёртвой сущности.
- `cleanupDeadEntities` физически удаляет мёртвых.
- `deathReaction` не срабатывает дважды на одну и ту же сущность.

### 10.6. Интеграционный тест
- Полный цикл: атака → смерть → `ITEM_DROPPED`.
- Проверяет дерево `ExecutionNode`.

---

## 11. Список файлов для изменения

| Файл | Что делать |
|------|-----------|
| `public/content/entities/enemies/*.json` | Переписать `lootTable` в формат массива объектов; добавить `lootDropCount` |
| `src/simulation/schemas/contentSchemas.ts` | Обновить `lootTable` на массив объектов с `templateId` + `weight`; добавить `lootDropCount` |
| `src/simulation/types.ts` | `isAlive` в `Attackable` становится обязательным для всех боевых сущностей (runtime-гарантия) |
| `src/utils/loot.ts` | **Новый** — централизованный расчёт лута (с параметром `count`) |
| `src/utils/loot-spawn.ts` | **Новый** — `findFreeTileNear` |
| `src/simulation/systems/intents/execute-intent.ts` | Зарегистрировать `executeSpawnItemIntent` |
| `src/simulation/systems/intents/spawn-item-intent-executor.ts` | **Новый** — executor для `SPAWN_ITEM` |
| `src/simulation/systems/intents/die-intent-executer.ts` | Логическое удаление: `isAlive = false`, `blocksMovement = false` |
| `src/simulation/systems/world-reactions/death-reaction.ts` | Защита от двойного срабатывания (`isAlive !== false`) |
| `src/simulation/systems/world-reactions/post-death-loot-reaction.ts` | **Новый** — реакция на `ENTITY_DIED` |
| `src/simulation/systems/world-reactions/reactions.ts` | Зарегистрировать `postDeathLootReaction` |
| `src/simulation/state.ts` | `cleanupDeadEntities`; обновить `findAttackableEntity` с проверкой `isAlive` |
| `src/simulation/simulation.ts` | Вызов `cleanupDeadEntities` в `beginNextPlayerTurn` |
| `src/simulation/core-types.ts` | Обновить `ItemDroppedEvent`; добавить `SpawnItemIntent` |
| `src/presentation/fogFilter.ts` | Обновить `ItemDroppedEvent` — `event.position` уже используется, `entityId` → `dropperEntityId` не влияет на логику видимости |
| `src/presentation/animationPlanner.ts` | Добавить обработку `ITEM_DROPPED` |
| `src/ui/renderer/...` | Отображение контейнера + иконки предмета |
| `tests/unit/utils/loot.test.ts` | **Новые** тесты на калькулятор |
| `tests/unit/simulation/...` | **Новые** тесты на реакцию, executor, deferred deletion |
| `tests/fixtures/...` | Обновить фикстуры врагов под новый формат `lootTable` и `lootDropCount` |

---

## 12. Расширяемость для сундуков

В будущем сундук:
- Не умирает, а открывается (действие `OPEN_CONTAINER`).
- Action handler вызывает `calculateLootDrops()` напрямую и порождает `SPAWN_ITEM` intents (без промежуточных event'ов/reaction'ов).
- `executeSpawnItemIntent` и `findFreeTileNear` переиспользуются без изменений.
- Количество выпадаемых предметов регулируется `lootDropCount` в шаблоне сундука.

---

## 13. Открытые вопросы

Все ключевые архитектурные вопросы решены:

- **Количество предметов:** `lootDropCount: { min, max }` в JSON-шаблоне источника лута. `calculateLootDrops` принимает `count` как параметр.
- **Проверка источника:** `postDeathLootReaction` проверяет `entity.type === 'enemy'` через `state.entities.get(event.entityId)`. Нет необходимости в хрупкой проверке `entityId !== 'player'`.
- **Приоритет:** `priority = 0`. Пересмотр при добавлении других post-death эффектов (опыт, квесты).
