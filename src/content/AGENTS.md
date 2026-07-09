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
| Добавить/изменить тип урона | `src/content/schemas.ts` (`CombatSchema` / `WeaponStatsSchema`) + `src/simulation/core-types.ts` (`DamageType`) + `src/simulation/systems/damage/damage-type-handlers.ts` |

---

## Добавление контента

1. Создать JSON-файл по существующей схеме.
2. Добавить путь в `public/content/manifest.json`.
3. Пересборка не требуется.

> JSON-шаблоны содержат только механику (`tags`, `damageType`, статы, пулы). Все `name` / `description` / `flavorText` живут в `src/content/texts/{ru,en}.ts` и мержатся через `getLocalizedItem()` / `getLocalizedEntity()`.
>
> Предпочтительный способ классифицировать урон и эффекты — теги (`damage.physical.slashing`, `damage.magical.fire`, `attack.melee` и т.д.). Поле `damageType` сохраняется для совместимости с существующими интентами и событиями.

---

## Полная документация

- [`docs/agents/CONTENT.md`](../../docs/agents/CONTENT.md) — контент-пайплайн
- [`docs/agents/LAYERS.md`](../../docs/agents/LAYERS.md) — правила слоёв
