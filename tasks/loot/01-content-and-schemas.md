# Задача 1: Обновление JSON-контента и Zod-схем

> **Статус:** ✅ выполнена  
> **Зависимости:** нет (можно делать первой)  
> **Сложность:** низкая

---

## Цель

Перевести `lootTable` врагов из массива строк в массив объектов с `templateId` + `weight`, добавить `lootDropCount`, обновить Zod-схему валидации.

---

## Архитектурный контекст

Согласно `AGENTS.md` и `CONTENT_PIPELINE.md`:
- Контент хранится в `public/content/` в виде JSON.
- Валидация при загрузке через Zod (`src/simulation/schemas/contentSchemas.ts`).
- Невалидный контент приводит к fail-fast с понятным сообщением.
- Пересборка после изменения JSON **не требуется**.

Согласно `LOOT_SYSTEM_PLAN.md`:
- Новый формат `lootTable`: массив `{ templateId: string, weight: number }`.
- Новое поле `lootDropCount: { min: number, max: number }` на уровне шаблона сущности.

---

## Что нужно сделать

### 1. Обновить JSON-файлы врагов

Файлы:
- `public/content/entities/enemies/cat_small.json`
- `public/content/entities/enemies/cat_mid.json`
- `public/content/entities/enemies/cat_big.json`

**Было:**
```json
"lootTable": ["health_potion"]
```

**Станет:**
```json
"lootTable": [
  { "templateId": "health_potion", "weight": 3 },
  { "templateId": "common_splinter_blade", "weight": 1 }
],
"lootDropCount": { "min": 1, "max": 1 }
```

> Подобрать веса и предметы под каждого врага по своему усмотрению. Главное — формат.

### 2. Обновить Zod-схему

Файл: `src/simulation/schemas/contentSchemas.ts`

Добавить подсхему:
```typescript
const LootEntrySchema = z.object({
  templateId: z.string().min(1).describe('ID шаблона предмета'),
  weight: z.number().int().nonnegative().describe('Вес выпадения'),
});

const LootDropCountSchema = z.object({
  min: z.number().int().nonnegative().describe('Минимум предметов за раз'),
  max: z.number().int().nonnegative().describe('Максимум предметов за раз'),
});
```

Обновить `EntityTemplateSchema`:
```typescript
lootTable: z.array(LootEntrySchema).default([]),
lootDropCount: LootDropCountSchema.default({ min: 1, max: 1 }),
```

### 3. Обновить фикстуры врагов (если есть)

Файлы: `tests/fixtures/...` (любые JSON-фикстуры врагов, используемые в тестах)

Привести к тому же формату, что и контент в `public/content/`.

---

## Критерии приёмки

- [ ] Все JSON-файлы врагов используют новый формат `lootTable` (массив объектов) и содержат `lootDropCount`.
- [ ] `npm run typecheck` проходит без ошибок.
- [ ] Запуск `npm test` не ломает существующие тесты (фикстуры обновлены).
- [ ] Загрузка контента через loader (`src/simulation/content/loader.ts`) не падает на валидации.

---

## Как проверить

```bash
npm run typecheck
npm test
```

Если `loader.ts` вызывается при старте тестов, он сам проверит Zod-схемы.
