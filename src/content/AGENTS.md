# Правила слоя Content

> Работая в `src/content/` или `public/content/`, соблюдай эти правила. Они приоритетнее общих.

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
  schemas.ts         # Zod-схемы и типы шаблонов
  registry.ts        # In-memory реестр загруженного контента
  loader.ts          # Async fetch + валидация JSON-контента
  texts/             # Локализованные тексты врагов, предметов, способностей
    types.ts         # Типы игровых текстов
    ru.ts            # Русские тексты
    en.ts            # Английские тексты
    lookup.ts        # getContentText(category, id, locale)

public/content/
  entities/          # Шаблоны врагов и игрока
  items/             # Оружие, броня, расходники
  abilities/         # Шаблоны способностей
  maps/              # Параметры генерации карт
```

---

## Частые задачи

| Задача | Куда идти |
|--------|-----------|
| Добавить новый шаблон сущности | `public/content/entities/...` + `manifest.json` |
| Изменить схему валидации | `src/content/schemas.ts` |
| Добавить поле в реестр | `src/content/registry.ts` + `loader.ts` |
| Добавить/изменить текст врага/предмета/способности | `src/content/texts/{ru,en}.ts` |
| Добавить/изменить игровой тег | `src/content/schemas.ts` (`TagsSchema`) + `src/content/texts/{ru,en}.ts` |
| Добавить/изменить тип урона | `src/content/schemas.ts` (`WeaponStatsSchema` / `AbilityTemplateSchema`) + `src/simulation/systems/damage/damage-handlers.ts` + `src/simulation/systems/tags/weapon-tags.ts` |

---

## Добавление контента

1. Создать JSON-файл по существующей схеме.
2. Добавить путь в `public/content/manifest.json`.
3. Пересборка не требуется.

> JSON-шаблоны содержат только механику (`tags`, `damageDistribution`, статы, пулы). Все `name` / `description` / `flavorText` живут в `src/content/texts/{ru,en}.ts` и мержатся через `getLocalizedItem()` / `getLocalizedEntity()`.
>
> Предпочтительный способ классифицировать урон и эффекты — иерархические теги (`damage.physical.slashing`, `damage.magical.fire`, `attack.melee` и т.д.).

### Оружие: `damageDistribution`

В `WeaponStatsSchema` (`src/content/schemas.ts`) урон оружия задаётся полем `damageDistribution` — массивом записей:

```json
{
  "weapon": {
    "baseDamage": 4,
    "damageFormulaId": "sword",
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

### Способности: `damageTag` и `requiredWeaponTags`

В `AbilityTemplateSchema` (`src/content/schemas.ts`) доступны два поля:

- `damageTag?: string` — тег урона способности. Используется для ability-based скиллов, урон которых не зависит от экипированного оружия.
- `requiredWeaponTags?: string[]` — требования к тегам экипированного оружия. Используется для weapon-based скиллов; скилл становится недоступен, если оружие не содержит все указанные теги.

Примеры:

```json
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
