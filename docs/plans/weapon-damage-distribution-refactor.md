# План рефакторинга системы урона: единые теги и распределение типов у оружия

## Статус выполнения

| Фаза | Статус |
|------|--------|
| 1. Типы и схемы | ✅ выполнено |
| 2. Формулы и статы | ✅ выполнено |
| 3. Выполнение урона | ✅ выполнено |
| 4. Действия, скиллы, реакции | ✅ выполнено |
| 5. Контент | ✅ выполнено |
| 6. Presentation и UI | ✅ выполнено |
| 7. Public API Simulation | ✅ выполнено |
| 8. Тесты | ✅ выполнено |
| 9. Документация | ✅ выполнено |
| 10. Документация агентов | ✅ выполнено |

## 1. Контекст и цель

В проекте сейчас одновременно существуют две системы типизации урона:
- устаревшее поле `damageType: DamageType` в `DamageIntent`, `EntityDamagedEvent`, `EnemyEntity`, `CombatSchema` и Presentation-типах;
- иерархические теги `damage.physical.slashing`, `damage.magical.fire` и т.д.

Это создаёт дублирование и рассогласования: например, `cleave` в JSON имеет тег `damage.physical.blunt`, а в `DamageIntent` уходит `damageType`, вычисленный из оружия.

Цель рефакторинга:
1. Удалить `DamageType` из доменных событий и интентов. Единственный источник типа урона в симуляции — теги.
2. Ввести у оружия распределение типов урона с весами (`damageDistribution`).
3. Дать способностям явный `damageTag` (для ability-based) и требования к оружию `requiredWeaponTags`.
4. Сделать так, чтобы weapon-based скиллы масштабировались от оружия по своему типу урона.
5. Поддержать единообразно физический и магический урон.
6. Добавить Presentation-слою производное поле `damageFamily` для цветов и подписей, вычисляемое из тегов.

## 2. Принятые решения

| Вопрос | Решение |
|---|---|
| Удалить ли `DamageType`? | Да, из `DamageIntent`, `EntityDamagedEvent`, `EnemyEntity`, `CombatSchema`, `core-types.ts`. В Presentation остаётся только производное поле `damageFamily`. |
| Что делает скилл без `damageTag`? | Если скилл наносит урон, он сам формирует интент. Для weapon-based скиллов тип берётся от оружия. |
| Что если у оружия нет нужного скиллу типа (weight = 0)? | Итоговый урон от оружия для этого скилла равен 0. Скилл сам решает, как поступить. |
| Смешанный урон? | Один `DAMAGE`-интент — один тип урона. Смешанный урон — несколько последовательных интентов. |
| `damageDistribution` у врагов? | Нет. Враги бьют через оружие. `EnemyEntity.damageType` и `CombatSchema.damageType` удаляются. |
| Безоружная атака? | Создаётся фиктивное оружие `unarmed.json` с `damage.physical.blunt`. |
| Ограничения `requiredWeaponTags`? | Работают для всех акторов. Проверяются в `validate`/`getValidTargets` скилла. |
| Веса больше 1? | Нормально. Нормализация не нужна. |
| Цвет floating text? | По `damageFamily`, вычисляемой Presentation из тегов. |
| UI оружия/врага? | Показывать итоговый урон максимального типа. Presentation получает базовый и итоговый урон по всем типам. |
| `damageTypeLabel`? | Удалить. Использовать локализацию тегов `src/content/texts/{ru,en}/tags.ts`. |
| Обработчики урона? | Расширяемая система по предикату: `registerDamageHandler((tags) => hasTag(tags, 'damage.magical.fire'), handler)`. |

## 3. Новая архитектура

### 3.1. Теги урона

```ts
// Физический
'damage.physical.slashing'
'damage.physical.piercing'
'damage.physical.blunt'

// Магический
'damage.magical.fire'
'damage.magical.electric'
'damage.magical.poison'
'damage.magical.frost'
```

Проверки брони, сопротивлений и реакций работают через `hasTag(tags, 'damage.physical')` или `hasTag(tags, 'damage.magical.fire')`.

### 3.2. Оружие

```ts
type WeaponDamageDistributionEntry = {
  damageTag: GameplayTag; // 'damage.physical.slashing'
  weight: number;          // 0..∞, множитель для скиллов данного типа
};

type WeaponStats = {
  baseDamage: number;
  damageFormulaId: string;
  range: number;
  damageDistribution: WeaponDamageDistributionEntry[];
  tags: GameplayTag[]; // без damage-тегов
};
```

Пример:

```json
{
  "weapon": {
    "baseDamage": 20,
    "damageFormulaId": "sword",
    "range": 1,
    "damageDistribution": [
      { "damageTag": "damage.physical.slashing", "weight": 1.0 }
    ],
    "tags": ["attack.melee", "target.single", "delivery.weapon"]
  }
}
```

Zod-constraint: `damageDistribution` должен содержать хотя бы одну запись с `weight > 0`.

### 3.3. Способности

```ts
type AbilityTemplate = {
  id: string;
  damageTag?: GameplayTag;            // для ability-based скиллов
  requiredWeaponTags?: GameplayTag[]; // для weapon-based скиллов
  tags: GameplayTag[];                // форма: attack.melee, target.aoe, delivery.weapon
};
```

Примеры:

```json
// cleave.json (weapon-based, тип задаётся кодом executor)
{
  "id": "cleave",
  "requiredWeaponTags": ["attack.melee"],
  "tags": ["attack.melee", "target.aoe", "delivery.weapon"]
}

// fireball.json (ability-based)
{
  "id": "fireball",
  "damageTag": "damage.magical.fire",
  "tags": ["attack.ranged", "target.aoe", "delivery.projectile", "delivery.spell", "effect.burn"]
}

// counterattack.json (weapon-based, только ближний бой)
{
  "id": "counterattack",
  "requiredWeaponTags": ["attack.melee"],
  "tags": ["attack.melee", "target.single", "delivery.weapon", "reaction.counter"]
}
```

### 3.4. DamageIntent и EntityDamagedEvent

```ts
type DamageIntent = {
  type: 'DAMAGE';
  entityId: EntityId;
  sourceEntityId: EntityId | null;
  damage: number;
  tags: GameplayTag[];
};

type EntityDamagedEvent = {
  type: 'ENTITY_DAMAGED';
  targetId: EntityId;
  sourceEntityId: EntityId | null;
  damage: number;
  position: Position;
  tags: GameplayTag[];
};
```

Поле `damageType` удаляется.

### 3.5. Presentation

Presentation получает доменное событие с `tags` и сам выводит:
- `damageFamily` — для цвета floating text и категорий подписей;
- primary тип урона — для отображения в карточке оружия/врага;
- базовый и итоговый урон по всем типам — для будущего детального UI.

```ts
function getDamageFamily(tags: GameplayTag[]): DamageFamily {
  if (hasTag(tags, 'damage.magical.fire')) return 'fire';
  if (hasTag(tags, 'damage.magical.electric')) return 'electric';
  if (hasTag(tags, 'damage.magical.poison')) return 'poison';
  if (hasTag(tags, 'damage.magical.frost')) return 'frost';
  if (hasTag(tags, 'damage.physical.slashing')) return 'slashing';
  if (hasTag(tags, 'damage.physical.piercing')) return 'piercing';
  if (hasTag(tags, 'damage.physical.blunt')) return 'blunt';
  return 'physical'; // fallback
}
```

### 3.6. Расчёт урона

#### Обычная атака

```ts
const damage = getEffectiveWeaponDamage(caster);
const primaryTag = getPrimaryDamageTag(caster);
const tags = mergeTags([primaryTag], getWeaponTags(caster));
```

#### Weapon-based скилл с фиксированным типом (cleave)

```ts
const baseDamage = getEffectiveWeaponDamage(caster);
const skillTag = 'damage.physical.slashing'; // в коде executor
const weight = getWeaponWeightForTag(caster, skillTag);
const damage = Math.round(baseDamage * weight);
const tags = mergeTags([skillTag], ability.tags, getWeaponTags(caster));
```

#### Weapon-based скилл с наследованием (sudden_strike, counterattack)

```ts
const damage = getEffectiveWeaponDamage(caster);
const primaryTag = getPrimaryDamageTag(caster);
const tags = mergeTags([primaryTag], ability.tags, getWeaponTags(caster));
```

#### Ability-based скилл (fireball, magic_slap, swoop, dash)

```ts
const result = damageFormulas[formulaId]({ caster, target, skillLevel, baseDamage });
// result: { damage: number; tags: GameplayTag[] }
const tags = mergeTags(result.tags, ability.tags);
```

## 4. Изменения по файлам

### 4.1. Типы и схемы

#### `src/simulation/core-types.ts`

- Удалить тип `DamageType`.
- Убрать поле `damageType` из `DamageIntent` и `EntityDamagedEvent`.

#### `src/simulation/types.ts`

- Убрать `damageType` из `EnemyEntity`.
- Убрать импорт и использование `DamageType`.
- Заменить `Simulation.getWeaponDamageEntries` на `Simulation.getWeaponDamage` (+ при необходимости `getWeaponDamageDistribution`).

#### `src/content/schemas.ts`

- В `WeaponStatsSchema` заменить `damageType` на:
  ```ts
  damageDistribution: z.array(z.object({
    damageTag: z.string().min(1),
    weight: z.number().min(0),
  }))
  .refine(arr => arr.some(e => e.weight > 0), {
    message: 'Как минимум один вес должен быть > 0',
  })
  .default([{ damageTag: 'damage.physical.blunt', weight: 1.0 }])
  ```
- В `AbilityTemplateSchema` добавить:
  ```ts
  damageTag: z.string().min(1).optional(),
  requiredWeaponTags: z.array(z.string().min(1)).default([]),
  ```
- В `CombatSchema` убрать `damageType`.

### 4.2. Формулы и статы

#### `src/simulation/systems/stats/weapon-formulas.ts`

- Удалить `WeaponDamageEntry` и `DamageType`.
- `WeaponFormula` возвращает `number` (total base damage).
- Все формулы (`club`, `dagger`, `staff`, `sword`, `unarmed`) возвращают одно число.
- Добавить `getWeaponDamage(owner, weapon): number`.

#### `src/simulation/systems/stats/base-resolver.ts`

- `getBaseDamage` использует `getWeaponDamage`.
- Удалить `getBaseDamageEntries`.

#### `src/simulation/systems/stats/effective-stats.ts`

- Удалить `getEffectiveDamageEntries`.
- Добавить:
  ```ts
  getEffectiveWeaponDamage(entity: Entity): number
  getWeaponDamageDistribution(entity: Entity): WeaponDamageDistributionEntry[]
  getPrimaryDamageTag(entity: Entity): GameplayTag
  getWeaponWeightForTag(entity: Entity, tag: GameplayTag): number
  ```

#### `src/simulation/systems/tags/weapon-tags.ts`

- Убедиться, что `UNARMED_TAGS` не содержит дублирующих damage-тегов.
- Добавить хелпер `getPrimaryDamageTag` и `getWeaponWeightForTag` (или оставить в `effective-stats.ts`).

### 4.3. Действия и интенты

#### `src/simulation/systems/actions/attack-action.ts`

- Использовать `getEffectiveWeaponDamage` + `getPrimaryDamageTag`.
- Формировать `DAMAGE`-интент без `damageType`.

#### `src/simulation/systems/actions/use-ability-action.ts`

- Добавить проверку `requiredWeaponTags` в `validate`/`getValidTargets`.

#### `src/simulation/systems/intents/attack-intent-executer.ts`

- Убрать `damageType` из разбора интента.
- Передавать `tags` в обработчик урона.

#### `src/simulation/systems/damage/damage-type-handlers.ts`

- Удалить `DamageType` из `DamageCalculationContext`.
- Удалить реестр `damageTypeHandlers` по enum.
- Добавить предикатный реестр:
  ```ts
  type DamageHandler = (ctx: DamageCalculationContext) => number;
  const damageHandlers: Array<{ predicate: (tags: GameplayTag[]) => boolean; handler: DamageHandler }> = [];
  export function registerDamageHandler(predicate, handler) { ... }
  ```
- Дефолтный обработчик: броня для `damage.physical`.
- Зарегистрировать обработчики для `damage.magical.*` по необходимости.

### 4.4. Скиллы

#### `src/simulation/skills/damageFormula.ts`

- Заменить `SkillDamageEntry` на `{ damage: number; tags: GameplayTag[] }`.
- Все формулы возвращают объект с `tags`, включающим `damage.magical.X`.

#### `src/simulation/skills/executors/cleaveSkill.ts`

- Weapon-based с фиксированным `damageTag: 'damage.physical.slashing'`.
- Урон: `getEffectiveWeaponDamage(caster) * getWeaponWeightForTag(caster, 'damage.physical.slashing')`.
- Теги: мерж `damageTag`, `ability.tags`, `getWeaponTags(caster)`.

#### `src/simulation/skills/executors/suddenStrikeSkill.ts`

- Weapon-based с наследованием primary типа оружия.
- Урон: `getEffectiveWeaponDamage(caster)`.
- Теги: мерж primary damage tag, `ability.tags`, `getWeaponTags(caster)`.

#### `src/simulation/skills/executors/swoopSkill.ts`

- Ability-based (фиксированный урон + `damage.physical.blunt`).
- Использовать `damageFormulas['swoop_slam']`, возвращающий `{ damage, tags: ['damage.physical.blunt'] }`.

#### `src/simulation/skills/executors/dashSkill.ts`

- Ability-based (фиксированный урон + `damage.physical.blunt`).
- Использовать `damageFormulas['dash_bump']`, возвращающий `{ damage, tags: ['damage.physical.blunt'] }`.

#### `src/simulation/skills/executors/fireballSkill.ts`, `magicSlapSkill.ts`

- Ability-based, обновить использование `damageFormulas` на новый тип `{ damage, tags }`.

### 4.5. World reactions

#### `src/simulation/systems/world-reactions/burning-tick-reaction.ts`

- Убрать `damageType`.
- Оставить/добавить `tags: ['damage.magical.fire']`.

#### `src/simulation/systems/world-reactions/collision-damage-reaction.ts`

- Убрать `PUSH_DAMAGE_TYPE` и `DamageType`.
- Оставить `PUSH_DAMAGE_TAGS = ['damage.physical.blunt']`.

#### `src/simulation/systems/world-reactions/counter-attack-reaction.ts`

- Использовать `getEffectiveWeaponDamage(counterAttacker)` + `getPrimaryDamageTag(counterAttacker)`.
- Теги: `mergeTags([primaryTag], getWeaponTags(counterAttacker), ['reaction.counter'])`.

### 4.6. Presentation и UI

#### `src/presentation/types.ts`

- Убрать `damageType` из `DamageAnimationStep` и `PresentationIntent.DAMAGE`.
- Добавить `damageFamily?: DamageFamily` (или вычислять на лету).

#### `src/presentation/localizationHelpers.ts`

- Удалить `damageTypeLabel`.

#### `src/presentation/enemyDetailMapper.ts`, `itemDetailMapper.ts`, `gameSession.ts`

- Перейти на теги и `getEffectiveWeaponDamage`/`getWeaponDamageDistribution`.
- В `itemDetailMapper.ts` убрать мёртвый код `damageEntries`.
- Показывать итоговый урон максимального типа.

#### `src/ui/animation/pixiFloatingTextExecutor.ts`

- Заменить `DAMAGE_COLORS[damageType]` на выбор по `damageFamily`, вычисляемой из тегов.

### 4.7. Public API Simulation

#### `src/simulation/simulation.ts`

- Заменить/добавить `getWeaponDamage(player, weapon): number`.
- Добавить `getWeaponDamageDistribution(weapon)` при необходимости для Presentation.

### 4.8. Контент (JSON)

#### `public/content/items/weapons/*.json`

- 6 файлов оружия: заменить `damageType` на `damageDistribution` с одним типом (`weight: 1.0`).
- Убрать damage-теги из `weapon.tags`.
- Создать `public/content/items/weapons/unarmed.json`:
  ```json
  {
    "id": "unarmed",
    "type": "weapon",
    "weapon": {
      "baseDamage": 0,
      "damageFormulaId": "unarmed",
      "range": 1,
      "damageDistribution": [
        { "damageTag": "damage.physical.blunt", "weight": 1.0 }
      ],
      "tags": ["attack.melee", "target.single", "delivery.weapon", "delivery.unarmed"]
    }
  }
  ```

#### `public/content/abilities/*.json`

- 7 файлов способностей.
- Ability-based (`fireball`, `magic_slap`, `swoop`, `dash`): добавить `damageTag`, убрать damage-тег из `tags`.
- Weapon-based (`cleave`, `sudden_strike`, `counterattack`): добавить `requiredWeaponTags`, убрать damage-тег из `tags`.

### 4.9. Тесты

#### Обновить существующие

- `tests/unit/simulation/intent-executors.test.ts`
- `tests/unit/simulation/skills/cleave.test.ts`
- `tests/unit/simulation/skills/suddenStrike.test.ts`
- `tests/unit/simulation/skills/swoop.test.ts`
- `tests/unit/simulation/skills/fireball.test.ts`
- `tests/unit/simulation/skills/magicSlap.test.ts`
- `tests/unit/simulation/skills/dash.test.ts`
- `tests/unit/simulation/world-reactions/fire-damage-reaction.test.ts`
- `tests/unit/presentation/animation/*.test.ts`
- `tests/unit/presentation/fogFilter.test.ts`
- `tests/unit/simulation/deferred-deletion.test.ts`
- `tests/unit/simulation/status-effects/burning.test.ts`
- `tests/fixtures/gameState.ts`

#### Добавить новые

- `tests/unit/simulation/stats/effective-weapon-damage.test.ts`:
  - `getEffectiveWeaponDamage` с модификаторами.
  - `getPrimaryDamageTag` выбирает max weight.
  - `getWeaponWeightForTag` возвращает 0 для отсутствующего типа.
- `tests/unit/simulation/tags/tag-merge.test.ts`:
  - `mergeTags` не дублирует damage-теги.
  - приоритет `damageTag` способности.
- `tests/unit/simulation/abilities/required-weapon-tags.test.ts`:
  - скилл с `requiredWeaponTags: ['attack.melee']` недоступен с луком.
  - доступен с мечом.

### 4.10. Документация агентов

#### `src/simulation/AGENTS.md` и `src/content/AGENTS.md`

- Убрать упоминания `DamageType` как актуального механизма.
- Описать `damageDistribution`, `damageTag`, `requiredWeaponTags`.
- Обновить таблицу «Добавить/изменить тип урона».

## 5. Порядок выполнения

### Фаза 1. Типы и схемы

1. Изменить `core-types.ts`, `types.ts`, `schemas.ts`.
2. Добавить `unarmed.json`.
3. Запустить валидацию контента (JSON) и `npm run typecheck`.

### Фаза 2. Формулы и статы

1. Переписать `weapon-formulas.ts`.
2. Обновить `effective-stats.ts` и `base-resolver.ts`.
3. Добавить хелперы `getPrimaryDamageTag`, `getWeaponWeightForTag`.

### Фаза 3. Выполнение урона

1. Обновить `damage-type-handlers.ts` на предикатную систему.
2. Обновить `attack-intent-executer.ts`.

### Фаза 4. Действия, скиллы, реакции

1. Обновить `attack-action.ts` и `use-ability-action.ts`.
2. Обновить `damageFormula.ts`.
3. Обновить исполнители скиллов.
4. Обновить world-reactions.

### Фаза 5. Контент

1. Переписать JSON оружий и способностей.
2. Проверить валидацию контента.

### Фаза 6. Presentation и UI

1. Обновить `presentation/types.ts`.
2. Удалить `damageTypeLabel`.
3. Обновить `itemDetailMapper.ts`, `enemyDetailMapper.ts`, `gameSession.ts`.
4. Обновить `pixiFloatingTextExecutor.ts`.
5. Добавить `damageFamily` из тегов.

### Фаза 7. Public API Simulation

1. Обновить `simulation.ts`.

### Фаза 8. Тесты

1. Обновить существующие тесты.
2. Добавить новые unit-тесты.
3. Запустить `npm test`.

### Фаза 9. Документация

1. Обновить `src/simulation/AGENTS.md` и `src/content/AGENTS.md`.
2. При необходимости обновить `docs/agents/CONTENT.md`.

## 6. Тестирование

- `npm run typecheck` — должен проходить без ошибок.
- Валидация контента (JSON) — все файлы проходят.
- `npm test` — все существующие и новые тесты проходят.
- Ручная проверка:
  - Обычная атака мечом наносит `damage.physical.slashing`.
  - `cleave` с мечом наносит `damage.physical.slashing`.
  - `cleave` с луком недоступен (`requiredWeaponTags`).
  - `fireball` наносит `damage.magical.fire`.
  - Броня применяется к любому `damage.physical.*`.
  - Урон от горения имеет тег `damage.magical.fire`.

## 7. Риски

| Риск | Митигация |
|---|---|
| Скилл становится слишком слабым на неподходящем оружии | Для swoop/dash оставлен ability-based урон. Для cleave — `requiredWeaponTags` не гарантирует наличие slashing, но на текущем контенте всё оружие ближнего боя имеет slashing/blunt/piercing. |
| UI сломается из-за удаления `DamageType` | Presentation вычисляет `damageFamily` из тегов. |
| Старые тесты используют `damageType` | Обновляются в рамках рефакторинга. |
| JSON-контент не валидируется `typecheck` | Отдельная валидация контента перед запуском. |
| Дублирование `damageTag` в JSON и коде | Для weapon-based скиллов `damageTag` не хранится в JSON, тип задаётся кодом executor. |

## 8. Примеры до/после

### Обычная атака мечом

До:
```ts
{
  type: 'DAMAGE',
  damage: 20,
  damageType: 'slashing',
  tags: ['attack.melee', 'target.single', 'delivery.weapon', 'damage.physical.slashing']
}
```

После:
```ts
{
  type: 'DAMAGE',
  damage: 20,
  tags: ['damage.physical.slashing', 'attack.melee', 'target.single', 'delivery.weapon']
}
```

### cleave с мечом

До:
```ts
{
  type: 'DAMAGE',
  damage: 20,
  damageType: 'slashing',
  tags: ['attack.melee', 'target.aoe', 'delivery.weapon', 'damage.physical.blunt']
}
```

После:
```ts
{
  type: 'DAMAGE',
  damage: 20,
  tags: ['damage.physical.slashing', 'attack.melee', 'target.aoe', 'delivery.weapon']
}
```

### fireball

До:
```ts
{
  type: 'DAMAGE',
  damage: 25,
  damageType: 'fire',
  tags: ['attack.ranged', 'target.aoe', 'delivery.projectile', 'delivery.spell', 'effect.burn', 'damage.magical.fire']
}
```

После:
```ts
{
  type: 'DAMAGE',
  damage: 25,
  tags: ['damage.magical.fire', 'attack.ranged', 'target.aoe', 'delivery.projectile', 'delivery.spell', 'effect.burn']
}
```
