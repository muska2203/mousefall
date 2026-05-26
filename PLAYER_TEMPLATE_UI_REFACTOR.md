# План рефакторинга: шаблоны игрока и выбор внешности через Content Pipeline

## Текущее состояние

Сейчас выбор внешности персонажа при создании персонажа полностью захардкожен в UI-слое:

- **`src/ui/screens/CharacterCreationScreen.tsx`** содержит константу `PORTRAITS` — массив объектов с `id`, `name`, `desc`, `img`.
- **`src/simulation/characterCreation.ts`** принимает `CharacterConfig` с полями `portraitId` и `classId`. `classId` практически не используется (void), а `portraitId` используется только для:
  - Установки `player.templateId = config.portraitId` (после недавнего рефакторинга).
  - `GameSession.portraitId` — для отображения портрета в HeroPanel и EndingScreen.
- **`src/ui/renderer/spriteRegistry.ts`** хардкодит путь к спрайту игрока: `/assets/actors/player_${portraitId}.png`.
- **JSON-шаблон** `public/content/entities/player/player.json` удалён. Все шаблоны игрока теперь полноценные классовые файлы в `public/content/entities/player/`.

Проблемы:
1. Добавление новой внешности требует правки **исходного кода** (`PORTRAITS` + `spriteRegistry.ts`).
2. Характеристики, способности и стартовое снаряжение привязаны к UI, а не к контенту.
3. Нет централизованного места, где описан игровой объект "класс/внешность игрока".

## Цель

Сделать так, чтобы каждая внешность/класс игрока был полноценным JSON-шаблоном в `public/content/entities/player/`, а UI только отображал список доступных шаблонов и передавал выбранный `templateId` в симуляцию.

## Желаемая структура JSON-шаблона игрока

```json
{
  "id": "witcher",
  "name": "Белый Хвост",
  "description": "Охотник на чудовищ и мечник-алхимик.",
  "symbol": "@",
  "portraitImg": "/assets/portraits/witcher-ready.png",
  "spriteId": "witcher",
  "renderScale": 1.5,
  "baseStats": { "str": 10, "dex": 10, "int": 10, "vit": 10 },
  "startingEquipment": ["common_splinter_blade", "common_tin_plate", "common_knotted_fang"],
  "abilities": ["fireball", "magic_slap"]
}
```

Поля:
- `id` — templateId, который будет храниться в `PlayerEntity.templateId`.
- `name`, `description` — для отображения в UI (CharacterCreationScreen).
- `portraitImg` — путь к картинке портрета (заменяет хардкод в `PORTRAITS`).
- `spriteId` — ключ спрайта для `spriteRegistry` (заменяет `portraitId` в `getPlayerSprite`).
- `renderScale` — масштаб отрисовки.
- `baseStats` — базовые характеристики, от которых начинается распределение очков.
- `startingEquipment` — стартовое снаряжение (заменяет хардкод `STARTER_SLOTS`).
- `abilities` — начальные способности.

## Архитектурные решения

### 1. Отдельная Zod-схема для шаблона игрока

Создать `PlayerTemplateSchema` в `src/simulation/schemas/contentSchemas.ts`, отдельную от `EntityTemplateSchema` (которая заточена под врагов).

```ts
export const PlayerTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  symbol: z.string().length(1),
  portraitImg: z.string(),
  spriteId: z.string(),
  renderScale: z.number().min(0).optional().default(1.5),
  baseStats: z.object({ str: z.number(), dex: z.number(), int: z.number(), vit: z.number() }),
  startingEquipment: z.array(z.string()).default([]),
  abilities: z.array(z.string()).default([]),
});
```

### 2. Загрузка через Content Pipeline

- Добавить категорию `players` в `manifest.json`.
- `loader.ts` загружает категорию `players` через `PlayerTemplateSchema`.
- `registry.ts` получает методы `getPlayerTemplate(id)` / `tryGetPlayerTemplate(id)` / `getAllPlayerTemplates()`.

### 3. CharacterCreationScreen.tsx

- Убрать хардкод `PORTRAITS`.
- Убрать хардкод `STARTER_SLOTS` (или оставить как fallback, если реестр не загружен).
- Получать список шаблонов через `getAllPlayerTemplates()` (или через Presentation, чтобы UI не обращался к `simulation/content/` напрямую).
- Строить `PortraitItem[]` динамически из шаблонов.
- При выборе — хранить `selectedTemplateId` вместо `portraitId`.
- Передавать в `CharacterConfig` только `templateId` и распределение очков. `startingEquipment` больше не нужно в `CharacterConfig`, если оно берётся из шаблона.

**Важно:** UI не должен напрямую импортировать `simulation/content/registry`. Presentation должен предоставлять метод `getAvailablePlayerTemplates()` или похожий. Это соответствует архитектуре: `ui/ → presentation/`, а не `ui/ → simulation/`.

### 4. CharacterConfig

```ts
export type CharacterConfig = {
  templateId: string;
  attributes: CharacterAttributes;
};
```

Убрать:
- `portraitId` — заменяется на `templateId`.
- `classId` — заменяется на `templateId`.
- `startingEquipment` — берётся из шаблона.

### 5. applyCharacterConfig

```ts
export function applyCharacterConfig(player: PlayerEntity, config: CharacterConfig): void {
  const template = getPlayerTemplate(config.templateId);
  player.templateId = config.templateId;
  player.baseStats = { ...template.baseStats };
  // ...применение распределённых очков...
  // ...экипировка startingEquipment из template...
  // ...способности из template.abilities...
}
```

### 6. GameSession

- Убрать поле `portraitId` — оно больше не нужно. Портрет всегда можно получить из `state.player.templateId` → `tryGetPlayerTemplate()`.
- `getViewModel` должен строить путь к портрету динамически через шаблон, а не через захардкоженное поле.

### 7. SpriteRegistry

```ts
export function getPlayerSprite(templateId: string): string {
  return `/assets/actors/player_${templateId}.png`;
}
```

Или, ещё лучше, читать `spriteId` из шаблона игрока. Но для простоты можно оставить соглашение `player_${templateId}.png`.

### 8. HeroPanel / Portrait / EndingScreen

- Все компоненты, которым нужен портрет, должны получать его через `templateId`:
  ```ts
  const template = tryGetPlayerTemplate(player.templateId);
  const portraitSrc = template?.portraitImg ?? '/assets/portraits/witcher-ready.png';
  ```

## Пошаговый план реализации

### Шаг 1. Подготовка контента
1. Создать JSON-файлы для каждой внешности в `public/content/entities/player/`:
   - `witcher.json`, `paladin.json`, `halfling-mage.json`, `elven-ranger.json`, `orc-barbarian.json`, `samurai.json`, `necromancer.json`.
2. Заполнить их полями: `id`, `name`, `description`, `portraitImg`, `spriteId`, `renderScale`, `baseStats`, `startingEquipment`, `abilities`.
3. Обновить `public/content/manifest.json` — добавить массив `players`.

### Шаг 2. Content Pipeline
1. `src/simulation/schemas/contentSchemas.ts` — добавить `PlayerTemplateSchema` и `PlayerTemplate` тип.
2. `src/simulation/content/loader.ts` — добавить загрузку категории `players`.
3. `src/simulation/content/registry.ts` — добавить `getPlayerTemplate` / `tryGetPlayerTemplate` / `getAllPlayerTemplates`.

### Шаг 3. Симуляция
1. `src/simulation/characterCreation.ts`:
   - Обновить `CharacterConfig`: убрать `portraitId`, `classId`, `startingEquipment`. Оставить `templateId` и `attributes`.
   - Обновить `applyCharacterConfig`: читать `startingEquipment`, `baseStats`, `abilities` из шаблона.
2. `src/simulation/state.ts` — `createInitialPlayer` может получать `templateId` как параметр или использовать `'player'` по умолчанию.

### Шаг 4. Presentation
1. `src/presentation/gameSession.ts`:
   - Убрать поле `portraitId`.
   - Добавить метод `getAvailablePlayerTemplates()` (обёртка над `getAllPlayerTemplates` из registry).
   - Обновить `buildRenderInput` — портрет строить через `tryGetPlayerTemplate(state.player.templateId)?.portraitImg`.
2. `src/presentation/types.ts` — если нужно, добавить `PlayerTemplateViewModel`.

### Шаг 5. UI
1. `src/ui/screens/CharacterCreationScreen.tsx`:
   - Убрать `PORTRAITS` и `STARTER_SLOTS`.
   - Получать список шаблонов через `session.getAvailablePlayerTemplates()`.
   - Хранить `selectedTemplateId`.
   - Отображать превью статов через `GameSession.previewCharacterStats({ templateId, attributes })`.
   - При старте передавать `{ templateId, attributes }`.
2. `src/ui/components/HeroPanel.tsx` / `Portrait.tsx` / `EndingScreen.tsx`:
   - Заменить `portraitSrc` на чтение из шаблона по `templateId`.

### Шаг 6. Рендерер
1. `src/ui/renderer/spriteRegistry.ts` — `getPlayerSprite` принимает `templateId`.
2. `src/ui/renderer/EntityRenderer.ts` — уже использует `state.player.templateId`, но убедиться, что `getPlayerSprite` вызывается корректно.

### Шаг 7. Тесты
1. Обновить `tests/unit/simulation/characterCreation.test.ts` (если есть).
2. Обновить `tests/unit/presentation/targeting.test.ts` и другие тесты, где создаётся `CharacterConfig`.
3. Обновить `tests/fixtures/gameState.ts` — `makePlayer` должен содержать `templateId`.
4. Убедиться, что `initRegistry` во всех тестах содержит `players: new Map()`.

## Риски и нюансы

1. **Стартовое снаряжение в UI**: сейчас `STARTER_SLOTS` содержит иконки и fallback-символы для UI. Если убрать хардкод, UI должен получать эти данные из шаблонов предметов (`ItemTemplate`). Это требует, чтобы `ItemTemplate` содержал `icon` и `fallback` (или `spriteId`).
   - **Решение**: добавить `icon: string` и `fallback: string` в `ItemTemplateSchema`. Или пока оставить `STARTER_SLOTS` как UI-only конфиг, а `startingEquipment` — как список ID из шаблона игрока.

2. **Base stats и распределение очков**: `baseStats` из шаблона — это "нулевая точка", а `attributes` из `CharacterConfig` — распределённые очки. Нужно определить, как они складываются.

3. **Обратная совместимость сохранений**: `SaveFileSchema` уже содержит `PlayerEntitySchema` с `templateId`. Это хорошо. Но старые сохранения без `templateId` сломаются. Можно добавить миграцию в `SAVE_VERSION = 2`.

4. **UI → Simulation зависимость**: `CharacterCreationScreen` не должен напрямую импортировать `simulation/content/registry`. Нужно предоставить API через `GameSession`.

## Соглашения по именованию

- Шаблоны игрока лежат в `public/content/entities/player/*.json`.
- `id` шаблона совпадает с именем файла (без расширения).
- Спрайт игрока: `/assets/actors/player_${templateId}.png`.
- Портрет: путь указывается явно в `portraitImg`.
