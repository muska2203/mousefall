# Правила слоя Content

> Работая в `src/content/`, соблюдай эти правила. Они приоритетнее общих.

---

## Критически важно

- **Чистые данные и типы** — никакой игровой логики.
- **Read-only после инициализации**.
- **Не импортировать** `simulation/`, `presentation/`, `ui/`.
- **Fail fast** — невалидный контент должен падать с понятной ошибкой при загрузке.

---

## Структура

```
src/content/
  ids.ts             # Замкнутые наборы ID (EQUIPMENT_SUBTYPE_IDS, AI_STRATEGY_IDS, MAP_STRATEGY_IDS) — источник истины для z.enum и реестров simulation
  schemas.ts         # Zod-схемы и типы шаблонов; в конце — Input-типы для авторства
  validate-references.ts  # Валидация перекрёстных ссылок между шаблонами (equipment, lootTable, пулы карт и т.д.)
  registry.ts        # In-memory реестр загруженного контента
  templates/         # Шаблоны контента как TypeScript-модули
    index.ts         # buildContent(): парс через Zod (дефолты, инварианты, дубли id) → LoadedContent
    entities/        # Шаблоны врагов
    players/         # Шаблоны игрока
    items/           # Оружие, броня, амулеты, расходники (weapons/, armor/, amulet/, consumables/)
    abilities/       # Шаблоны способностей
    statuses/        # Шаблоны статусов
    tile-effects/    # Тайловые эффекты
    tile-effect-statuses/  # Статусы от тайловых эффектов
    terrains/        # Шаблоны террейнов (основа пола клетки)
    maps/            # Параметры генерации карт
    stairs/          # Лестницы
    doors/           # Двери
    props/           # Пропсы
    pois/            # POI
    traps/           # Ловушки
    relics/          # Реликвии (постоянные пассивные бонусы забега)
    modifiers/       # Модификаторы экипировки: stat/rule, аффиксы ролла и фирменные свойства (fixedModifiers)
  texts/             # Локализованные тексты врагов, предметов, способностей
    types.ts         # Типы игровых текстов
    ru/              # Русские тексты по категориям (items.ts, modifiers.ts, ...)
    en/              # Английские тексты по категориям
    ru.ts            # Реэкспорт русских текстов
    en.ts            # Реэкспорт английских текстов
    lookup.ts        # getContentText(category, id, locale)
```

---

## Частые задачи

| Задача | Куда идти |
|--------|-----------|
| Добавить новый шаблон сущности | `src/content/templates/entities/<id>.ts` + строка в `templates/entities/index.ts` |
| Добавить новый террейн | `docs/recipes/add-terrain.md` → `src/content/templates/terrains/`, `texts/{ru,en}/terrain.ts` |
| Добавить новую реликвию | `docs/recipes/add-relic.md` → `src/content/templates/relics/`, `texts/{ru,en}/relics.ts` |
| Добавить новый модификатор (аффикс) | `docs/recipes/add-modifier.md` → `src/content/templates/modifiers/`, `texts/{ru,en}/modifiers.ts` |
| Изменить схему валидации | `src/content/schemas.ts` |
| Добавить поле в реестр | `src/content/registry.ts` + `templates/index.ts` |
| Добавить/изменить текст врага/предмета/способности | `src/content/texts/{ru,en}.ts` |
| Добавить/изменить игровой тег | `src/content/schemas.ts` (`TagsSchema`) + `src/content/texts/{ru,en}.ts` |
| Добавить/изменить тип урона | `src/content/schemas.ts` (`WeaponStatsSchema` / `AbilityTemplateSchema`) + `src/simulation/systems/damage/damage-handlers.ts` + `src/simulation/systems/tags/weapon-tags.ts` |

---

## Добавление контента

1. Создать файл `src/content/templates/<категория>/<id>.ts` (имя файла = id в kebab-case, константа — camelCase):

   ```typescript
   import type {EntityTemplateInput} from '../../schemas';

   export const catBig = {
     id: 'cat_big',
     // ...
   } satisfies EntityTemplateInput;
   ```

   Input-типы (`EntityTemplateInput`, `ItemTemplateInput`, ...) определены в конце `src/content/schemas.ts` через `z.input<>` — поля с дефолтами в них опциональны.
2. Импортировать константу и добавить её в массив шаблонов в `index.ts` соответствующей категории (`entityTemplates`, `itemTemplates`, ...).
3. Добавить тексты в `src/content/texts/{ru,en}.ts`.
4. Прогнать `npm run validate:content` — собирает контент через `buildContent()` и проверяет `ruleIds`, семантику правил, перекрёстные ссылки между шаблонами (`validate-references.ts`) и переводы.

> Шаблоны содержат только механику (`tags`, `damageDistribution`, статы, пулы). Все `name` / `description` / `flavorText` живут в `src/content/texts/{ru,en}.ts` и мержатся через `getLocalizedItem()` / `getLocalizedEntity()`.
>
> Предпочтительный способ классифицировать урон и эффекты — иерархические теги (`damage.physical.slashing`, `damage.magical.fire`, `attack.melee` и т.д.).

### Террейны: `src/content/templates/terrains/`

Террейн — структурная основа клетки (стена — тоже террейн с `walkable: false`).
Шаблон (`TerrainTemplateSchema`): `walkable`, `moveCost` (≥ 1, default 1), `blocksLOS` (default false), `tags`, `ruleIds`.
Тег `ground` означает «на клетку можно ставить тайловые эффекты и спавнить объекты» — это не то же самое, что `walkable`.
Тексты террейнов — в `src/content/texts/{ru,en}/terrain.ts`. Рецепт: `docs/recipes/add-terrain.md`.

### Оружие: `damage`, `subtype`, `level` и `damageDistribution`

В `WeaponStatsSchema` (`src/content/schemas.ts`) урон оружия задаётся рейнжем `damage: {min, max}` (роллится при каждом ударе, смещение вверх от dex атакующего — `src/simulation/systems/stats/weapon-damage-roll.ts`), а распределение типов урона — массивом `damageDistribution`. У каждого шаблона экипировки обязательны `subtype` (подтип из `EQUIPMENT_SUBTYPE_IDS`, определяет пул аффиксов) и `level` (уровень ≥ 1, выбирает рейнж ролла аффиксов):

```typescript
{
  "type": "weapon",
  "subtype": "sword",
  "level": 1,
  "weapon": {
    "damage": { "min": 4, "max": 6 },
    "range": 1,
    "damageDistribution": [
      { "damageTag": "damage.physical.slashing", "weight": 1.0 }
    ],
    "tags": ["attack.melee", "target.single", "delivery.weapon"]
  }
}
```

- `damageTag` — полный тег типа урона (`damage.physical.slashing`, `damage.magical.fire` и т.д.).
- `weight` — неотрицательный множитель. Минимум одна запись должна иметь `weight > 0`.
- Веса не нормализуются; максимальный вес определяет основной тип оружия.
- Теги урона (`damage.*`) не должны дублироваться в `weapon.tags`; они описываются только через `damageDistribution`.
- Формулы урона оружия (`damageFormulaId`, `weapon-formulas.ts`) удалены 2026-08-08 — урон берётся только из рейнжа шаблона.

### Модификаторы экипировки: `fixedModifiers`, `poolEligible`, `scaling fixed`

Категория `modifiers` — единый источник свойств экипировки. Фирменные свойства предмета задаются полем `fixedModifiers: string[]` шаблона экипировки (ID модификаторов; поля `equipModifiers` и `ruleIds` предметов удалены 2026-08-09). У модификатора:

- `poolEligible` (default `true`) — участвует ли в случайном ролле аффиксов; `false` — только фирменное свойство конкретных предметов;
- `scaling` — `perLevel` (ролл из рейнжей по уровню предмета), `fixed` (детерминированное `value`, для фирменных stat-модификаторов) или `none` (без значения);
- `polarity` — default `positive`; для `poolEligible: false` не используется.

Валидация (`npm run validate:content`): stat-модификатор обязан иметь `scaling: perLevel` или `fixed`; модификатор в `fixedModifiers` не может быть `perLevel` (фирменные детерминированы), обязан существовать и включать `subtype` предмета в `applicableSubtypes`; `{value}` в описании допустим при `perLevel` или `fixed`. Рецепт: `docs/recipes/add-modifier.md`.

### Способности: `damageTag` и `requiredWeaponTags`

В `AbilityTemplateSchema` (`src/content/schemas.ts`) доступны два поля:

- `damageTag?: string` — тег урона способности. Используется для ability-based скиллов, урон которых не зависит от экипированного оружия.
- `requiredWeaponTags?: string[]` — требования к тегам экипированного оружия. Используется для weapon-based скиллов; скилл становится недоступен, если оружие не содержит все указанные теги.

Примеры:

```typescript
// Ability-based: урон от формулы + тег fire
{
  "id": "fireball",
  "damageTag": "damage.magical.fire",
  "tags": ["attack.ranged", "target.aoe", "delivery.projectile", "delivery.spell", "effect.burn"]
}

// Weapon-based: требует ближнего оружия
{
  "id": "cleave",
  "requiredWeaponTags": ["attack.melee"],
  "tags": ["attack.melee", "target.aoe", "delivery.weapon"]
}
```

---

## Полная документация

- [`docs/agents/CONTENT.md`](../../docs/agents/CONTENT.md) — контент-пайплайн
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
