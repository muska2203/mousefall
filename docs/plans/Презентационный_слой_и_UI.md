# Презентационный слой и UI: отображение цепочек реакций

> Описание того, как Presentation Layer и UI отображают длинные цепочки реакций,
> порождённые боевой системой Mousefall.
>
> Этот документ выделен из общего концепта боевой системы, так как решаемая здесь
> задача относится к Presentation/UI и не влияет непосредственно на правила
> и механику боя.

---

## 1. Статус

✅ **Решено.**

- Для отображения цепочек реакций Presentation использует собственное лёгкое
  состояние отображения — `DisplayState`.
- `DisplayState` строится последовательным применением событий из дерева
  `ExecutionNode`, начиная с состояния до вызова `dispatch`.
- UI получает промежуточные состояния по ходу анимаций, а не только финальный
  результат.

---

## 2. Основная идея

Simulation после `dispatch(action)` отдаёт:

- финальное состояние мира `GameState`;
- дерево доменных событий `ExecutionNode`, описывающее, как именно мир
  пришёл к этому состоянию.

Presentation не рисует финальное состояние сразу. Вместо этого она:

1. Запоминает состояние **до** действия (`preActionState`).
2. Создаёт лёгкую копию видимой части этого состояния — `DisplayState`.
3. Обходит дерево `ExecutionNode` и для каждого события вычисляет
   `DisplayPatch` — минимальное изменение `DisplayState`.
4. Проигрывает анимации, параллельно применяя патчи к `DisplayState`.
5. После завершения всех анимаций `DisplayState` совпадает с проекцией
   финального `GameState`, и `DisplayState` выбрасывается.

Таким образом, игрок видит, как цепочка реакций разворачивается шаг за шагом:
рубящий урон → кровотечение → восстановление ОД → смерть врага.

---

## 3. DisplayState

`DisplayState` — это не клон `GameState`, а минимальная модель, необходимая UI.

```text
DisplayState {
  player: {
    position: Position
    hp: number
    maxHp: number
    ap: number
    maxAp: number
    statusEffects: StatusEffect[]
  }
  entities: Map<EntityId, {
    position: Position
    hp: number
    maxHp: number
    statusEffects: StatusEffect[]
    isAlive: boolean
  }>
  tileEffects: Map<"x,y", TileEffect[]>
  visible: boolean[][]
  explored: boolean[][]
}
```

Поля, не нужные для отображения во время анимации (AI-состояние, кулдауны
врагов, полный инвентарь и т.д.), в `DisplayState` не попадают. Они берутся
из финального `GameState` после завершения анимаций.

---

## 4. Жизненный цикл вызова dispatch

### 4.1. Сохранение preActionState

Перед вызовом `simulation.dispatch(action)` `GameSession` запоминает снимок:

```text
preActionState := simulation.getState()
```

### 4.2. Выполнение действия

```text
result       := simulation.dispatch(action)
finalState   := simulation.getState()
```

Simulation мутирует мир и строит дерево `ExecutionNode` со всеми событиями,
включая порождённые реакциями.

### 4.3. Построение DisplayState и дерева презентации

```text
displayState      := projectToDisplay(preActionState)
presentationTree  := buildPresentationTree(result.phases, preActionState)
```

`buildPresentationTree` обходит дерево `ExecutionNode` и для каждого события
создаёт `PresentationNode`:

```text
PresentationNode {
  event: GameEvent
  patch: DisplayPatch
  animation: AnimationStep | null
  children: PresentationNode[]
}
```

### 4.4. Рендеринг и анимация

`GameField` получает `RenderInput` с `displayState` и `presentationTree`.
Первый кадр показывает мир **до** действия.

`AnimationSequencer` обходит дерево:

1. Применяет `patch` к `DisplayState`.
2. Помечает соответствующие рендереры как «грязные».
3. Если `animation !== null` — запускает анимацию.
4. Рекурсивно обрабатывает детей после завершения родителя.
   Сиблинги выполняются параллельно.

### 4.5. Финальная синхронизация

После прохождения всего дерева:

```text
assert projectToDisplay(finalState) equals displayState   // dev-режим
displayState := null
```

`DisplayState` выбрасывается. UI снова рисует `finalState` напрямую.
Следующий `dispatch` захватывает новый `preActionState`.

---

## 5. Пример: огненный шар в масло

### Исходное состояние

```text
player:    (2,5), ap: 6
enemy-1:   (3,5), hp: 20/20, без статусов
tile(3,5): oil
tile(4,5): oil
```

Действие: `USE_ABILITY fireball` на `(3,5)`.

### Дерево ExecutionNode от Simulation

```text
ACTION_APPLIED(USE_ABILITY fireball)
└── ABILITY_USED(player, fireball, [(3,5)])
    ├── ENTITY_DAMAGED(enemy-1, damage: 12, position: (3,5), tags: [damage.magical.fire])
    │   ├── STATUS_APPLIED(enemy-1, burning, duration: 3)   // кольцо "огненный урон → горение"
    │   └── (анимация HP_CHANGE выводится из события)
    ├── TILE_EFFECT_SPAWNED((3,5), fire)
    │   ├── TILE_EFFECT_SPAWNED((4,5), fire)                // масло в радиусе 1 загорелось
    │   └── STATUS_APPLIED(enemy-1, burning, duration: 3)   // горение от стояния в огне
    └── COOLDOWN_SET(player, fireball, turns: 3)
```

### Дерево PresentationNode

```text
PresentationNode {
  event: ABILITY_USED
  patch: { player.ap: 6 → 2, fireball.cooldown: 0 → 3 }
  animation: ABILITY_CAST(player, fireball)
}
└── PresentationNode {
     event: ENTITY_DAMAGED(enemy-1, 12)
     patch: { entities.enemy-1.hp: 20 → 8 }
     animation: DAMAGE(enemy-1, 12) + HP_CHANGE(enemy-1, 20→8)
   }
   └── PresentationNode {
        event: STATUS_APPLIED(enemy-1, burning)
        patch: { entities.enemy-1.statusEffects: add burning }
        animation: STATUS_BURST(enemy-1, burning)
      }
└── PresentationNode {
     event: TILE_EFFECT_SPAWNED((3,5), fire)
     patch: { tileEffects.(3,5): add fire }
     animation: TILE_EFFECT_APPEAR((3,5), fire)
   }
   └── PresentationNode {
        event: TILE_EFFECT_SPAWNED((4,5), fire)
        patch: { tileEffects.(4,5): add fire }
        animation: TILE_EFFECT_APPEAR((4,5), fire)
      }
   └── PresentationNode {
        event: STATUS_APPLIED(enemy-1, burning)
        patch: { entities.enemy-1.statusEffects: refresh burning }
        animation: STATUS_BURST(enemy-1, burning)
      }
```

### Что видит игрока

| Время | DisplayState | Визуализация |
|---|---|---|
| T0 | AP 6, враг 20/20, масло | Обычное поле |
| T1 | AP 2, кулдаун fireball | Игрок кастует огненный шар |
| T2 | Враг 8/20 | Всплывает `-12`, полоска HP падает |
| T3 | Враг горит | Партиклы огня, иконка burning |
| T4 | (3,5) и (4,5) в огне | Плавное появление огня на клетках |
| T5 | Горение обновлено | Второй STATUS_BURST или refresh |

Важно: игрок видит **последовательность**, а не мгновенный финал.

---

## 6. Какие ExecutionNode попадают в вывод?

### Все события доступны Presentation

Simulation не обрезает дерево. Presentation получает полный `ExecutionNode`
и сама решает, что визуализировать.

### Три слоя фильтрации

#### 6.1. DisplayPatchBuilder — что меняет DisplayState

Почти все события дают патч:

- `ENTITY_DAMAGED` → HP цели.
- `STATUS_APPLIED` / `STATUS_REMOVED` → статусы.
- `ENTITY_MOVED` / `ENTITY_DISPLACED` → позиция.
- `TILE_EFFECT_SPAWNED` / `TILE_EFFECT_CHANGED` → tile-эффекты.
- `FOG_UPDATED` → видимость и исследованность.
- `COOLDOWN_SET`, `RESOURCE_CONSUMED` → HUD.

Некоторые события не дают визуального патча и служат только структурой дерева
(`ACTION_APPLIED`) или логом (`TURN_BEGAN`, `TURN_ENDED`).

#### 6.2. filterByFOV — какие события анимируются на поле

Анимации на поле показываются только для видимого:

```text
if event.position is visible
   OR event.targetId === player
   OR event.entityId === player:
    show field animation
else:
    no field animation, but patch still applies to DisplayState
```

Пример: враг вне поля зрения получает урон. Его HP в `DisplayState` обновляется,
но всплывающий урон не показывается. Когда враг снова войдёт в зону видимости,
он отрисуется с правильным HP.

#### 6.3. logBuilder — что попадает в combat log

Отдельная фильтрация: в лог идут значимые для игрока события
(урон игроку, смерть врага, подбор предмета и т.д.).

---

## 7. Кто решает, что показать?

| Слой | Ответственность |
|---|---|
| **Simulation** | Что произошло. Порождает все события. Не знает о видимости и UI. |
| **Presentation** | Что из произошедшего видно/важно игроку. Фильтрует анимации по FOV, строит лог, выбирает анимации, управляет `DisplayState`. |
| **UI / Renderers** | Как нарисовать текущее `DisplayState`. Не решает семантику. |

Ключевой принцип: **Simulation не знает про Presentation**.
Presentation получает всё дерево и сама решает, что визуализировать.

---

## 8. Синхронизация Simulation State и DisplayState

### Инвариант

```text
preActionState --(events)--> DisplayState --(end)--> finalState
```

В любой момент `DisplayState` отражает состояние мира на том этапе цепочки,
который сейчас анимируется.

### Механизм

#### 8.1. Начальная синхронизация

```text
DisplayState := projectToDisplay(preActionState)
```

`projectToDisplay` извлекает только нужное UI: позиции, HP, статусы,
tile-эффекты, видимость, позицию игрока.

#### 8.2. Инкрементальная синхронизация

Каждый `PresentationNode` применяет патч:

```text
DisplayState := applyPatch(DisplayState, patch)
```

Примеры патчей:

```text
{ type: "HP_CHANGE", entityId: "enemy-1", delta: -12 }
{ type: "ADD_STATUS", entityId: "enemy-1", status: "burning", duration: 3 }
{ type: "MOVE_ENTITY", entityId: "enemy-1", from: (2,3), to: (3,3) }
{ type: "SPAWN_TILE_EFFECT", position: (3,5), effect: "fire" }
{ type: "CONSUME_AP", entityId: "player", amount: 4 }
{ type: "UPDATE_FOG", newlyVisible: [...] }
```

#### 8.3. Финальная синхронизация

После прохождения всего дерева в dev-режиме проверяется:

```text
assert projectToDisplay(finalState) equals DisplayState
```

В production `DisplayState` просто выбрасывается, и UI возвращается
к рисованию `finalState`.

#### 8.4. Между ходами

Когда анимаций нет, `DisplayState` не существует. UI рисует `finalState`
напрямую. Два состояния поддерживаются только во время анимации.

---

## 9. Крайние случаи

### 9.1. Пропуск анимаций

Если игрок нажимает «пропустить»:

```text
DisplayState := projectToDisplay(finalState)
sequencer.cancelAll()
```

UI мгновенно показывает финал.

### 9.2. Новый dispatch во время анимации

Сейчас ввод блокируется на `phase === 'animating'`. Если в будущем разрешить
ввод во время анимации, нужно либо дождаться конца, либо форсировать
финальную синхронизацию перед новым `dispatch`.

### 9.3. Невидимые сущности

`DisplayState` знает реальные позиции всех сущностей, но `EntityRenderer`
не рисует тех, что вне `visible`. Это стандартно для roguelike: ты не видишь
врага, но когда он снова попадает в поле зрения — он на правильном месте.

### 9.4. Появление статусов и tile-эффектов

`DisplayPatch` добавляет статус/tile-эффект сразу. Рендереры могут анимировать
появление иконки (fade-in) или tile-эффекта (fade-in/scale-up). Глобальные
эффекты вроде `STATUS_BURST` — отдельные визуальные оверлеи.

То есть timing такой: **состояние обновляется дискретно, а рендерер добавляет
плавные переходы**.

### 9.5. Параллельные события над одной сущностью

Если два сиблинг-узла наносят урон одной цели:

```text
ENTITY_DAMAGED(enemy-1, 5)
ENTITY_DAMAGED(enemy-1, 7)
```

Они выполняются параллельно. `DisplayState` последовательно применит оба патча:

```text
hp: 20 → 15 → 8
```

Анимации HP_CHANGE не должны конфликтовать. Решение: анимация стартует
от текущего визуального HP, а не от фиксированного `fromHp` события.
Тогда полоска плавно догоняет актуальное значение.

---

## 10. Изменения в модели данных

Сейчас `AnimationNode` выглядит так:

```text
AnimationNode {
  step: AnimationStep
  children: AnimationNode[]
}
```

В Variant 2+ он становится `PresentationNode`:

```text
PresentationNode {
  event: GameEvent
  patch: DisplayPatch
  step: AnimationStep | null
  children: PresentationNode[]
}
```

`buildAnimationTree` превращается в `buildPresentationTree`. Она всё ещё
решает, какие анимации показать, но дополнительно вычисляет патчи
для `DisplayState`.

---

## 11. Связь с боевой системой

Этот документ не меняет правил боя. Он описывает, **как UI показывает**
то, что решила боевая система.

Боевая система остаётся ответственной за:

- порождение интентов скиллами;
- модификаторы на интентах;
- контентные и системные реакции;
- порядок выполнения;
- защиту от циклов.

Presentation отвечает только за:

- отображение дерева событий;
- промежуточные состояния во время анимаций;
- фильтрацию по видимости;
- combat log.

---

## 12. Открытые вопросы

В рамках этого документа остаются открытыми следующие детали:

- Нужно ли обогащать события display-контекстом (например, `position`
  в `STATUS_APPLIED`) или достаточно данных, уже есть в `GameEvent`?
- Как именно анимировать появление tile-эффектов (`fire`, `water`, `oil`,
  `fog`)? Нужен ли отдельный `TILE_EFFECT_SPAWNED`/`TILE_EFFECT_CHANGED`
  тип события?
- Как показывать изменения HUD (HP/AP/кулдауны) — мгновенно по патчу
  или с небольшой анимацией?
- Нужна ли возможность перемотки/повтора анимаций для отладки?

Эти вопросы решаются при реализации и не блокируют концепт.
