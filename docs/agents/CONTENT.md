# CONTENT — Контент-пайплайн

> **Статус:** `[STABLE]` — контент-пайплайн (JSON + Zod + `ruleIds`) устаканился.
> **Источник правды:** этот файл.

> Контент — это данные, не код. JSON-файлы читаются при старте и валидируются через Zod.

---

## Где лежит контент

```
public/content/           # JSON-шаблоны: только механика (статы, пулы, ID)
├── entities/
│   ├── enemies/
│   ├── player/
│   ├── doors/
│   └── stairs/
├── items/
│   ├── weapons/
│   ├── armor/
│   ├── amulet/
│   └── consumables/
├── abilities/
├── statuses/             # Шаблоны статусов (длительность, категория, ruleIds)
├── tile-effects/         # Шаблоны тайловых эффектов (лужи, ловушки)
├── tile-effect-statuses/ # Шаблоны статусов, висящих на тайловых эффектах
└── maps/

src/content/texts/        # Пользовательские тексты: name, description, flavorText
├── ru.ts                 # Реэкспорт русских текстов из ru/
├── en.ts                 # Реэкспорт английских текстов из en/
├── ru/                   # Русские тексты по категориям
│   ├── statuses.ts       # Локализованные описания эффектов статусов
│   └── ...
├── en/                   # Английские тексты по категориям
│   ├── statuses.ts
│   └── ...
└── lookup.ts             # getContentText(category, id, locale)
```

> **Важно:** JSON-шаблоны НЕ содержат `name`, `description`, `flavorText`. Все тексты живут в `src/content/texts/{ru,en}.ts` и мержатся с шаблоном через `getLocalizedItem()` / `getLocalizedEntity()`.

---

## Добавление контента

1. Создайте JSON-файл по существующей схеме.
2. Добавьте путь в `public/content/manifest.json`.
3. Пересборка не требуется.

Контент валидируется при загрузке через Zod. Невалидный контент приводит к fail-fast с понятным сообщением об ошибке.

---

## Реестр контента

- `loadAllContent(fetchJson)` — асинхронная загрузка всех JSON-файлов (`src/content/loader.ts`).
- `getEntity(id)` / `getLocalizedEntity(id, locale)` — получить шаблон сущности / локализованный шаблон сущности.
- `getItem(id)` / `getLocalizedItem(id, locale)` — получить шаблон предмета / локализованный шаблон предмета.
- `getAbility(id)` / `getLocalizedAbility(id, locale)` — получить шаблон способности / локализованный шаблон способности.
- `getTileEffect(id)` / `getLocalizedTileEffect(id, locale)` — получить шаблон тайлового эффекта / локализованный шаблон.

Реализация: `src/content/loader.ts`, `src/content/registry.ts`.

## Реестр статусов

- `getStatusTemplate(statusType)` — получить шаблон статуса. Реализация: `src/simulation/systems/statuses/status-template.ts` (обёртка над реестром контента).
- Шаблоны статусов хранятся в `public/content/statuses/` и ссылаются на `ruleIds` в `src/simulation/content-rules/`.
- Локализованные описания эффектов статусов живут в `src/content/texts/ru/statuses.ts` и `src/content/texts/en/statuses.ts`.

---

## Контентные правила (content rules)

Контентные правила — это data-driven декларативные реакции на игровые события и интенты. Вместо того чтобы хардкодить эффекты внутри логики оружия или статусов, JSON-шаблоны просто ссылаются на `ruleIds`, а сами правила описываются в TypeScript и регистрируются в общем реестре.

### Где живут правила

- **Source-bound правила** (привязанные к предмету, способности или статусу) — массив `CONTENT_RULES` в `src/simulation/content-rules/rules.ts`.
- **Мировые правила** (не привязаны к конкретной сущности, срабатывают от событий в мире) — массив `GLOBAL_WORLD_CONTENT_RULES` в `src/simulation/content-rules/world-rules/global-rules.ts`, реэкспортируемый как `WORLD_CONTENT_RULES` в `src/simulation/content-rules/rules.ts`.

Оба массива попадают в реестр `src/simulation/content-rules/registry.ts`, который проверяет уникальность `id` и выбрасывает ошибку при дублировании.

### Как шаблоны ссылаются на правила

Шаблоны предметов, способностей, статусов, тайловых эффектов и статусов тайловых эффектов содержат поле `ruleIds` — массив строк с идентификаторами правил. При загрузке контента `src/simulation/content-rules/validation.ts` проверяет, что каждый `ruleId` существует в реестре, а внутри одного шаблона нет повторов.

### Жизненный цикл: `activeRules`

У каждого актора есть кэш `activeRules` — **производный** набор правил, собранный из экипированных предметов, активных статусов и других источников. Когда предмет снимается или статус заканчивается, правило автоматически пропадает из кэша. Подробнее о жизненном цикле, mid-chain статусах и self-эффектах см. `docs/agents/CONTENT_RULES_EDGE_CASES.md`.

### Пример шаблона с `ruleIds`

```json
{
  "id": "common_flaming_sword",
  "type": "weapon",
  "ruleIds": ["item_fire_damage_multiplier"],
  "weapon": {
    "baseDamage": 5,
    "damageFormulaId": "sword",
    "range": 1,
    "damageDistribution": [
      { "damageTag": "damage.magical.fire", "weight": 1.0 }
    ],
    "tags": ["attack.melee", "target.single", "delivery.weapon"]
  }
}
```

Здесь оружие ссылается на правило `item_fire_damage_multiplier`, которое умножает огненный урон на 1.5. Такой же подход работает для статусов и способностей: шаблон указывает `ruleIds`, а реестр разрешает их в объекты правил.

### Связанная документация

- [`docs/agents/CONTENT_RULES_EDGE_CASES.md`](./CONTENT_RULES_EDGE_CASES.md) — крайние случаи, порядок слоёв и жизненный цикл `activeRules`.
- [`src/simulation/content-rules/AGENTS.md`](../../src/simulation/content-rules/AGENTS.md) — локальные правила слоя content-rules: как добавить новое правило, шаблоны, чек-лист.

---

## Что контент контролирует (и не контролирует)

**Контролирует:**
- data values (статы, названия, пулы спавна);
- декларативные ссылки на `ruleIds` (правила интерпретирует Simulation, но шаблон выбирает, какие правила активны).

**НЕ контролирует:**
- ❌ Игровую логику (как считается урон, как AI ведёт себя)
- ❌ Рендеринг (как рисуются спрайты)
- ❌ UI layout
- ❌ Формат сохранений

---

## Моддинг

Замена или добавление файлов в `public/content/` работает без изменения кода.

Ограничения:
- Должен проходить Zod-валидацию
- ID должны быть уникальны
- Нельзя переопределить core game logic
