# Фаза 7. Тайловые эффекты и перенос правил статусов в контент

> **Статус:** Этап 1 выполнен. Этапы 2–4 в очереди.
> План разбит на 4 этапа. Этап 1 — обязательная подготовка, без которой этапы 2–4 не работают.

---

## Цель

1. Урон от статусов (`burning`, `poisoned`) должен быть описан через `ruleIds` в JSON-шаблонах статусов, а не через мировые правила.
2. Статусы перестают применяться к не-акторам (дверям, объектам).
3. Окружение (огонь, масло, вода, туман) реализуется через слой тайловых эффектов.
4. Двери и другие горючие объекты получают урон от тайловых эффектов, а не от статусов.

---

## Общий подход

- **Статусы — про актёров.** `burning`, `poisoned`, `wet`, `oiled` и т.д. остаются у существ.
- **Тайловые эффекты — про окружение.** Огонь, масло, вода, туман — это состояние клетки, а не существа.
- **Правила статусов** описываются в `CONTENT_RULES` и ссылаются через `ruleIds` в `public/content/statuses/*.json`.
- **Правила тайловых эффектов** описываются в `CONTENT_RULES` / `GLOBAL_WORLD_CONTENT_RULES` с `worldLayer: 'tileEffect'` и собираются в `ContentRuleReaction` из `tileEffects` в позиции события.
- **Горючие объекты** помечаются тегом `flammable` в своём шаблоне. Огонь тухнет, если в клетке нет горючего объекта/тайлового эффекта.

---

## Этап 1. Перенос правил статусов в контентные и удаление статусов у не-акторов

### 1.1. Задачи

- Перенести `burning_tick_damage` и `status_poison_tick_damage` из `GLOBAL_WORLD_CONTENT_RULES` в `CONTENT_RULES`.
- Добавить `ruleIds` в `burning.json` и `poisoned.json`.
- Запретить наложение статусов на не-акторов.
- Обновить/удалить тесты, которые проверяют горение дверей через статус.

### 1.2. Изменения в коде

**`src/simulation/content-rules/world-rules/global-rules.ts`**

Удалить правила:

- `burning_tick_damage`
- `status_poison_tick_damage`

**`src/simulation/content-rules/rules.ts`**

Добавить их в `CONTENT_RULES`:

```ts
{
  id: 'burning_tick_damage',
  trigger: { event: 'STATUS_TICKED', tags: ['status.burning'] },
  effect: {
    type: 'dealDamage',
    amount: { type: 'context', field: 'eventMaxHp', multiply: 0.1, min: 1, round: true },
    tags: ['damage.magical.fire'],
  },
  target: { type: 'eventTarget' },
  priority: 0,
},
{
  id: 'status_poison_tick_damage',
  trigger: { event: 'STATUS_TICKED', tags: ['status.poisoned'] },
  effect: {
    type: 'dealDamage',
    amount: { type: 'context', field: 'eventMaxHp', multiply: 0.08, min: 1, round: true },
    tags: ['damage.magical.poison'],
  },
  target: { type: 'eventTarget' },
  priority: 0,
},
```

**`public/content/statuses/burning.json`**

```json
{
  "id": "burning",
  "ruleIds": ["burning_tick_damage"],
  ...
}
```

**`public/content/statuses/poisoned.json`**

```json
{
  "id": "poisoned",
  "ruleIds": ["status_poison_tick_damage"],
  ...
}
```

**`src/simulation/systems/intents/apply-status-intent-executer.ts`**

Добавить после проверки `statusEffects`:

```ts
if (!isActor(target)) {
  // Не-акторы не получают статусы.
  return null;
}
```

> Возможно, позже понадобится событие `STATUS_BLOCKED` с причиной `not_actor`, но для MVP достаточно `null`.

### 1.3. Изменения в типах (опционально, если хотим убрать `statusEffects` у дверей)

- Убрать `StatusEffectHolder` из `DoorEntity`.
- Удалить поле `statusEffects: []` из `createDoor`.
- В `executeTickStatusEffectsIntent` и `tickAllStatusEffects` убрать обработку не-акторов.

Это можно сделать позже, но лучше сразу, чтобы не путать.

### 1.4. Тесты

- Удалить/переписать в `tests/unit/simulation/status-effects/burning.test.ts` тесты на горение дверей.
- Удалить/переписать в `tests/unit/simulation/status-effects/tick-phases.test.ts` проверку тиков у не-акторов.
- Добавить/обновить тесты в `tests/unit/simulation/content-rules/reaction/content-rule-reaction.test.ts`, что `burning`/`poisoned` срабатывают по `ruleIds` у актёров.
- Убедиться, что `fire-scenario.test.ts` и `poison-counter-scenario.test.ts` продолжают проходить.

### 1.5. Критерий готовности

- `burning` и `poisoned` у актёров наносят урон через `ruleIds`.
- Двери не могут получить статус.
- Все тесты актёров проходят; тесты дверей удалены или переписаны.

---

## Этап 2. Тайловые эффекты: фреймворк и огонь

### 2.1. Задачи

- Реализовать хранение и жизненный цикл тайловых эффектов.
- Добавить intents/events для спавна, тика и удаления тайловых эффектов.
- Добавить поддержку тайловых целей в `ContentRuleReaction` (селекторы `allOnTile` и `tilesInRadius`).
- Реализовать тайловый эффект `fire`:
  - наносит урон всем сущностям на клетке;
  - распространяется на соседние клетки (радиус 1);
  - тухнет, если в клетке нет горючего объекта/тайлового эффекта;
  - не тухнет, если в клетке есть `flammable`-объект (например, деревянная дверь).

### 2.2. Изменения в коде

#### 2.2.1. Типы и состояние

**`src/simulation/core-types.ts`**

```ts
export type TileEffectType = 'fire' | 'oil' | 'water' | 'fog';

export type TileEffect = {
  type: TileEffectType;
  duration: number;
  /** Дополнительное состояние, например { ignited: true } для масла. */
  state?: Record<string, unknown>;
};

export type TileEffectTickedEvent = {
  type: 'TILE_EFFECT_TICKED';
  x: number;
  y: number;
  tileEffectType: TileEffectType;
  tags: GameplayTag[];
};

export type TileEffectSpawnedEvent = {
  type: 'TILE_EFFECT_SPAWNED';
  x: number;
  y: number;
  tileEffect: TileEffect;
};

export type TileEffectRemovedEvent = {
  type: 'TILE_EFFECT_REMOVED';
  x: number;
  y: number;
  tileEffectType: TileEffectType;
};

export type SpawnTileEffectIntent = {
  type: 'SPAWN_TILE_EFFECT';
  x: number;
  y: number;
  tileEffect: TileEffect;
};

export type RemoveTileEffectIntent = {
  type: 'REMOVE_TILE_EFFECT';
  x: number;
  y: number;
  tileEffectType: TileEffectType;
};

export type TickTileEffectsIntent = { type: 'TICK_TILE_EFFECTS' };
```

Добавить новые события в `GameEvent` и интенты в `Intent`.

**`src/simulation/types.ts`**

```ts
export type GameState = {
  ...
  tileEffects: TileEffect[][][]; // tileEffects[y][x] = список эффектов на клетке
};
```

Инициализировать пустую сетку в `createNewGameState`.

#### 2.2.2. Хелперы для тайловых эффектов

Новый модуль: `src/simulation/systems/tile-effects/tile-effect-helpers.ts`.

```ts
export function getTileEffectsAt(state: GameState, x: number, y: number): TileEffect[];
export function hasTileEffect(state: GameState, x: number, y: number, type: TileEffectType): boolean;
export function addTileEffect(state: GameState, x: number, y: number, effect: TileEffect): void;
export function removeTileEffect(state: GameState, x: number, y: number, type: TileEffectType): void;
export function hasFuelAt(state: GameState, x: number, y: number): boolean;
```

`hasFuelAt` проверяет:

- есть ли на клетке сущность с тегом `flammable`;
- есть ли на клетке горючий тайловый эффект (например, `oil` на этапе 3).

#### 2.2.3. Intent-executor'ы

Новые модули:

- `src/simulation/systems/intents/spawn-tile-effect-intent-executor.ts`
- `src/simulation/systems/intents/remove-tile-effect-intent-executor.ts`
- `src/simulation/systems/intents/tick-tile-effects-intent-executor.ts`

`executeTickTileEffectsIntent`:

1. Итерирует по `state.tileEffects`.
2. Для каждого эффекта:
   - Если `type === 'fire'`:
     - Если `hasFuelAt(x, y)` — сбросить/оставить `duration` (например, `duration = 3`).
     - Иначе — уменьшить `duration` на 1.
   - Эмитит `TILE_EFFECT_TICKED` с тегами `tileEffect.fire`.
   - Запускает `ContentRuleReaction` для этого события (урон, распространение).
   - Если `duration <= 0` — добавляет `REMOVE_TILE_EFFECT` в очередь.
3. Выполняет удаления.

> На этапе 2 `fire` — единственный тайловый эффект, поэтому логику топлива можно захардкодить для `fire`. На этапе 4 обобщить через `tileEffectDefinitions`.

**`src/simulation/systems/intents/execute-intent.ts`**

Зарегистрировать новые executor'ы:

```ts
SPAWN_TILE_EFFECT: executeSpawnTileEffectIntent,
REMOVE_TILE_EFFECT: executeRemoveTileEffectIntent,
TICK_TILE_EFFECTS: executeTickTileEffectsIntent,
```

#### 2.2.4. Интеграция с ходом окружения

**`src/simulation/simulation.ts`, `runEnvironmentTurn`**

Заменить тик статусов у не-акторов на тик тайловых эффектов:

```ts
// Старый код
// for (const entity of entities) { tickEntityStatusEffects(...) }

// Новый код
executeIntent(this.state, { type: 'TICK_TILE_EFFECTS' }, builder, root);
```

#### 2.2.5. Расширение `ContentRuleReaction` для тайловых целей

**`src/simulation/content-rules/types.ts`**

```ts
export type TargetSelector =
  | ...
  | { type: 'allOnTile' }
  | { type: 'tilesInRadius'; radius: number; center: 'eventPosition' };

export type RuleEffect =
  | ...
  | { type: 'spawnTileEffect'; tileEffectType: TileEffectType; duration: number | ParametrizedValue };
```

**`src/simulation/content-rules/reaction/content-rule-reaction.ts`**

- Расширить `resolveTarget` и `buildIntents` так, чтобы они могли возвращать и обрабатывать не только `EntityId`, но и тайловые координаты.
- Минимальный вариант: ввести `RuleTarget = { kind: 'entity'; id: EntityId } | { kind: 'tile'; x: number; y: number }`.
- `allOnTile` — возвращает все сущности на `eventPosition` (акторы + двери + т.д.).
- `tilesInRadius` — возвращает координаты клеток в радиусе Chebyshev distance.
- `spawnTileEffect` — порождает `SPAWN_TILE_EFFECT` интенты для каждой клетки.

> Если расширение `ContentRuleReaction` кажется слишком большим для этапа 2, можно сделать распространение огня напрямую в `executeTickTileEffectsIntent`, но сохранить правило `fire_spreads` как концепт/документацию, чтобы перенести в систему правил на этапе 4.

#### 2.2.6. Правила для огня

**`src/simulation/content-rules/world-rules/global-rules.ts`** или **`src/simulation/content-rules/rules.ts`**

На этапе 2 огненные правила можно оставить в мировых (`worldLayer: 'tileEffect'`) или вынести в `tileEffectDefinitions` (см. ниже). Важно, чтобы они работали.

```ts
{
  id: 'fire_tile_damage',
  trigger: { event: 'TILE_EFFECT_TICKED', tags: ['tileEffect.fire'] },
  effect: {
    type: 'dealDamage',
    amount: 5, // или % maxHp, обсуждается с дизайном
    tags: ['damage.magical.fire'],
  },
  target: { type: 'allOnTile' },
  priority: 0,
  ownerContext: { type: 'world' },
  worldLayer: 'tileEffect',
},
{
  id: 'fire_spreads',
  trigger: { event: 'TILE_EFFECT_TICKED', tags: ['tileEffect.fire'] },
  effect: {
    type: 'spawnTileEffect',
    tileEffectType: 'fire',
    duration: 1,
  },
  target: { type: 'tilesInRadius', radius: 1, center: 'eventPosition' },
  priority: 1,
  ownerContext: { type: 'world' },
  worldLayer: 'tileEffect',
},
```

> `fire_spreads` спавнит огонь на всех соседних клетках. Если там нет топлива, он потухнет на следующем тике. Это даёт естественное «попытка распространения».

#### 2.2.7. Горючие объекты

**`src/content/schemas.ts`**

Добавить `tags` в `DoorTemplateSchema`:

```ts
export const DoorTemplateSchema = z.object({
  id: z.string().min(1),
  interactionKind: z.enum(['door']),
  maxHp: z.number().int().positive(),
  armor: z.number().int().nonnegative().default(0),
  renderScale: z.number().min(0).optional().default(1.0),
  openSpriteId: z.string().min(1).optional(),
  tags: TagsSchema, // <-- добавить
}).describe('Шаблон двери');
```

**`public/content/entities/doors/wooden_door.json`**

```json
{
  "id": "wooden_door",
  "interactionKind": "door",
  "maxHp": 30,
  "armor": 2,
  "renderScale": 1.0,
  "openSpriteId": "wooden_door_open",
  "tags": ["flammable"]
}
```

**`src/simulation/types.ts`**

Добавить `tags: GameplayTag[]` в `DoorEntity` (или базовый `BaseEntity`, если теги понадобятся всем).

**`src/simulation/systems/map-generation/shared.ts`, `createDoor`**

Копировать `tags` из шаблона в сущность двери.

#### 2.2.8. Спавн огня

На этапе 2 достаточно спавнить огонь через debug-действие или тестовый хелпер. Позже, на этапе 3–4, огонь будет появляться от огненных способностей и горящего масла.

Для проверки можно добавить правило:

```ts
{
  id: 'fire_damage_ignites_tile',
  trigger: { event: 'ENTITY_DAMAGED', tags: ['damage.magical.fire'] },
  effect: { type: 'spawnTileEffect', tileEffectType: 'fire', duration: 3 },
  target: { type: 'tilesInRadius', radius: 0, center: 'eventPosition' },
  priority: 0,
  ownerContext: { type: 'world' },
  worldLayer: 'tileEffect',
}
```

> Это правило спавнит огонь на клетке, где произошёл огненный урон. Если в клетке есть дверь, огонь не потухнет; если нет — потухнет через 3 тика.

#### 2.2.9. Presentation

- Добавить `tileEffects` в `DisplayState` ([src/presentation/displayState/types.ts](src/presentation/displayState/types.ts)).
- Обновить `resyncDisplayState` или аналогичный синк, чтобы отдавать tile-эффекты в UI.
- Добавить отрисовку overlay огня на тайле (можно временный спрайт/цвет).
- Добавить combat log сообщения для `TILE_EFFECT_SPAWNED`, `TILE_EFFECT_REMOVED`, `TILE_EFFECT_TICKED`.

### 2.3. Тесты

- `tile-effect-lifecycle.test.ts` — спавн, удаление, тик.
- `fire-persistence.test.ts` — огонь не тухнет на деревянной двери, тухнет на пустой клетке.
- `fire-spread.test.ts` — огонь распространяется в радиусе 1 и не распространяется через стены (или тухнет на стене).
- `fire-damage.test.ts` — огонь наносит урон дверям и акторам на клетке.
- `no-status-on-door.test.ts` — дверь не получает статус `burning`, но получает урон от тайлового огня.

### 2.4. Критерий готовности

- Тайловые эффекты хранятся в `GameState`, тикают в `environment-turn`.
- `fire` наносит урон сущностям на клетке.
- `fire` распространяется на соседние клетки.
- `fire` тухнет без топлива, горит на `flammable`-объектах.
- Дверь получает урон от огня, не от статуса `burning`.

---

## Этап 3. Тайловый эффект масло и взаимодействие с акторами и огнём

### 3.1. Задачи

- Добавить тайловый эффект `oil`.
- Реализовать взаимодействие масла с акторами (`oiled` статус).
- Реализовать горение масла (`oil` с `state: { ignited: true }`).
- Реализовать распространение огня через масло.
- Начать использовать прямые переходы: огонь + масло → горящее масло.

### 3.2. Изменения в коде

#### 3.2.1. Реестр тайловых эффектов

Создать `src/simulation/systems/tile-effects/tile-effect-definitions.ts`:

```ts
export type TileEffectDefinition = {
  type: TileEffectType;
  ruleIds: string[];
  isFuel: boolean;
};

export const TILE_EFFECT_DEFINITIONS: Record<TileEffectType, TileEffectDefinition> = {
  fire: { type: 'fire', ruleIds: ['fire_tile_damage', 'fire_spreads'], isFuel: false },
  oil: { type: 'oil', ruleIds: ['oil_applies_oiled'], isFuel: true },
  water: { type: 'water', ruleIds: ['water_applies_wet'], isFuel: false },
  fog: { type: 'fog', ruleIds: ['fog_reduces_ranged_accuracy'], isFuel: false },
};
```

#### 3.2.2. Сбор правил из тайловых эффектов в `ContentRuleReaction`

В `collectRules` добавить:

```ts
if (ctx.eventPosition) {
  const effects = getTileEffectsAt(state, ctx.eventPosition.x, ctx.eventPosition.y);
  for (const effect of effects) {
    const def = TILE_EFFECT_DEFINITIONS[effect.type];
    for (const ruleId of def.ruleIds) {
      const rule = tryGetContentRule(ruleId);
      if (!rule) continue;
      result.push({
        layer: 'world',
        rule: toActiveRule(rule, { type: 'tileEffect', position: { x, y }, tileEffectType: effect.type }),
        selfId: null,
        worldLayer: 'tileEffect',
      });
    }
  }
}
```

Теперь правила тайловых эффектов можно убрать из `GLOBAL_WORLD_CONTENT_RULES` и вынести в `CONTENT_RULES`, а шаблоны эффектов ссылаться на них через `ruleIds`.

#### 3.2.3. Правила масла

```ts
{
  id: 'oil_applies_oiled',
  trigger: { event: 'TILE_EFFECT_TICKED', tags: ['tileEffect.oil'] },
  effect: { type: 'applyStatus', statusType: 'oiled', duration: 3 },
  target: { type: 'allOnTile' },
  priority: 0,
  ownerContext: { type: 'tileEffect', position: { x: 0, y: 0 }, tileEffectType: 'oil' }, // позиция заполняется в runtime
  worldLayer: 'tileEffect',
},
{
  id: 'burning_oil_applies_burning',
  trigger: { event: 'TILE_EFFECT_TICKED', tags: ['tileEffect.oil', 'tileEffect.ignited'] },
  effect: { type: 'applyStatus', statusType: 'burning', duration: 3 },
  target: { type: 'allOnTile' },
  priority: 0,
  worldLayer: 'tileEffect',
},
```

> Для тега `tileEffect.ignited` нужно, чтобы `executeTickTileEffectsIntent` добавлял теги из `state` эффекта.

#### 3.2.4. Прямые переходы масло ↔ огонь

В `executeTickTileEffectsIntent` или отдельном `resolveTileEffectTransitions`:

- Если на клетке есть `fire` и `oil` (не `ignited`) → `oil.state.ignited = true`, эмитить `TILE_EFFECT_CHANGED`.
- Если `oil` с `ignited=true` и `water` → `oil` удаляется, спавнится `fog`.
- Если `oil` с `ignited=true` тикнулся → уменьшать `duration` масла; при 0 масло сгорает и удаляется.
- Огонь на клетке с `oil` не тухнет, пока масло не сгорело.

#### 3.2.5. Спавн масла

- Абилки/предметы могут спавнить `oil` через `SPAWN_TILE_EFFECT`.
- Для тестов можно использовать debug-действие.

#### 3.2.6. Актор входит в клетку с маслом

Пока достаточно, что `oil_applies_oiled` срабатывает на `TILE_EFFECT_TICKED`. Если нужен мгновенный эффект при входе, добавить правило на `ENTITY_MOVED` с `allOnTile` и проверкой `hasTileEffect` в `targetConditions` (на этапе 4).

### 3.3. Тесты

- `oil-applies-oiled.test.ts` — актор в клетке с маслом получает `oiled`.
- `oil-ignites.test.ts` — огненный урон по клетке с маслом поджигает его.
- `burning-oil-spreads.test.ts` — горящее масло распространяется на соседнее масло.
- `water-extinguishes-oil.test.ts` — вода тушит горящее масло и создаёт туман (если вода реализована).

### 3.4. Критерий готовности

- `oil` накладывает `oiled` на акторов.
- Огонь поджигает масло.
- Горящее масло распространяется и наносит урон.
- Правила тайловых эффектов собираются из `TILE_EFFECT_DEFINITIONS` в `ContentRuleReaction`.

---

## Этап 4. Доработка остальных тайловых эффектов

### 4.1. Вода

- `water` накладывает `wet` на акторов.
- `water` тушит `fire` (прямой переход: удалить `fire`).
- `water` + горящее `oil` → тушение масла + спавн `fog`.
- `water` проводит электрический урон.

Правила:

```ts
water_applies_wet
water_extinguishes_fire
water_extinguishes_burning_oil
water_conducts_electricity
```

### 4.2. Туман

- `fog` снижает точность дальних атак.
- `fog` даёт шанс уклонения/скрытности.
- Огненный урон рассеивает `fog`.
- Вода продлевает `fog`.

Правила:

```ts
fog_reduces_ranged_accuracy
fog_grants_concealment
fire_disperses_fog
water_extends_fog
```

### 4.3. Материалы и теги

- Добавить материал/теги для других объектов: `dry_grass`, `wooden_barrel`, `stone_wall`.
- Расширить `hasFuelAt` на учёт тегов тайла (например, `flammable_floor`).
- Металлические/каменные двери не горят.

### 4.4. Визуал и UI

- Persistent overlay для water/oil/fog/fire.
- Combat log для стихийных комбо (взрыв, тушение, пар).
- Анимации для `EXPLOSION_TRIGGERED`.

### 4.5. Полный набор прямых переходов

| Комбинация | Результат |
|---|---|
| огненный урон + `oil` | `oil` ignited + `EXPLOSION` |
| `water` + горящее `oil` | масло тухнет, спавн `fog` |
| `water` + `fire` | огонь тухнет |
| `fire` + `fog` | `fog` удаляется |
| `water` + `fog` | `fog` продлевается |
| огненный урон + `water` | вода испаряется? (опционально) |

### 4.6. Критерий готовности

- Работают все стартовые тайловые эффекты: `fire`, `oil`, `water`, `fog`.
- Базовые стихийные комбо работают.
- Все guardian tests и тесты фаз 1–3 проходят.
- Presentation/UI отображает tile-эффекты и ключевые события.

---

## Общие критерии завершения фазы

- `burning`/`poisoned` у актёров работают через `ruleIds`.
- У не-акторов нет статусов.
- Двери и другие горючие объекты получают урон от тайловых эффектов.
- `fire` тикает, распространяется и тухнет без топлива.
- `oil` взаимодействует с акторами и огнём.
- `water` и `fog` работают по концепту.
- Все тесты проходят; `validate:content` и `typecheck` чистые.

---

## Риски и открытые вопросы

1. **Расширение `ContentRuleReaction` для tile-целей.** Это самое большое изменение в системе правил. Если оно окажется слишком тяжёлым, на этапе 2 можно сделать распространение огня в `executeTickTileEffectsIntent`, а правило `fire_spreads` оформить позже.
2. **Двойной урон.** Актор, стоящий в огне и имеющий `burning`, получает урон и от tile-эффекта, и от статуса. Это допустимо, но нужно явно задокументировать или уменьшить урон от tile-эффекта по акторам.
3. **Что делать, если дверь разрушена, а огонь остался.** Решение: огонь продолжает гореть, пока есть топливо. Если дверь — единственное топливо, огонь потухнет через 1–3 тика.
4. **Нужен ли реестр тайловых эффектов в JSON.** Сейчас `TILE_EFFECT_DEFINITIONS` — код. В будущем можно вынести в `public/content/tile-effects/`, но это за рамками текущей фазы.
5. **Производительность.** Тик по всей сетке `tileEffects` каждый раунд может быть дорогим на больших картах. Оптимизация: хранить активный список tile-эффектов или ограничить максимальную длительность.

---

## Связанные документы

- [`src/simulation/content-rules/AGENTS.md`](../../src/simulation/content-rules/AGENTS.md) — локальные правила слоя content-rules.
- [`src/simulation/AGENTS.md`](../../src/simulation/AGENTS.md) — общие правила слоя simulation.
- [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](../../docs/agents/CONTENT_RULES_EDGE_CASES.md) — порядок слоёв, mid-chain статусы, жизненный цикл `activeRules`.
