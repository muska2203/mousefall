# Аудит stub-данных в UI

> **Дата:** 2026-05-22
> **Область:** `src/ui/screens/`, `src/ui/components/`
> **Цель:** выявить захардкоженные данные и заглушки, которые должны замениться реальными данными из Presentation / Simulation / Content.

---

## Легенда

| Приоритет | Значение |
|-----------|----------|
| 🔴 | Данные уже есть в Simulation/Presentation, но не прокинуты в UI. Блокирует полноценный игровой цикл. |
| 🟡 | Часть данных есть, часть требует доработки Presentation или Content. Нужен mapper. |
| 🟢 | UI-контент или фичи в разработке. Не блокирует, но создаёт технический долг. |

---

## 🔴 Критично

### `src/ui/screens/GameScreen.tsx`

| Строки | Проблема | Что сейчас | Что должно быть |
|--------|----------|------------|-----------------|
| 146–151 | Поля `PlayerEntity` не типизированы; доступ через `as unknown` | `xp`, `level`, `mana`, `maxMana` кастуются из `player` | Добавить поля в `PlayerEntity` (`simulation/types.ts`) или в `RenderInput` (`presentation/types.ts`) |
| 148 | `xpToNext` hardcoded | `const xpToNext = 25` | Рассчитываться по формуле уровня в Presentation |
| 153–160 | Характеристики героя — полный хардкод | Все статы = `'0'`, крит = `'5%'`, `'1.5x'` | Приходить из `player.attributes` / `GameState` через Presentation ViewModel |
| 162–182 | Экипировка: урон оружия hardcoded | `damage: player.equippedWeaponId ? 6 : null` | Читать `damage` из `ItemTemplate.weapon` через Content Registry + `itemDetailMapper` |
| 197 | EffectsPanel без props | `<EffectsPanel />` — всегда "Нет активных эффектов" | Передавать `effects` из `player.statusEffects` (маппить в `EffectItem[]`) |
| 215 | InventoryPanel без props | `<InventoryPanel />` — одна пустая ячейка | Передавать `items` из `state.entities` + Content Registry |
| 216 | ConsumablesPanel без props | `<ConsumablesPanel />` — одна пустая ячейка | Передавать `consumables` из инвентаря |
| 217–231 | SkillsPanel — хардкод списка скиллов | 11 скиллов с фиксированными именами/маной | Приходить из `player.abilities` (когда появится в симуляции) или пока скрыть панель |

### `src/ui/screens/EndingScreen.tsx`

| Строки | Проблема | Что сейчас | Что должно быть |
|--------|----------|------------|-----------------|
| 37–44 | Характеристики героя — полный хардкод | Все `'0'`, `'5%'`, `'1.5x'` | Приходить из финального `GameState` через Props (как `GameScreen`) |
| 46–50 | Экипировка — пустые слоты | Без иконок и данных | Приходить из финального `GameState` |
| 52–59 | Метрики забега — полный хардкод | `'00:00'`, `'0'`, `'1'` | Presentation должна считать: время, ходы, убийства, этаж, предметы |

---

## 🟡 Средняя критичность

### `src/ui/screens/GameScreen.tsx`

| Строки | Проблема | Что сейчас | Что должно быть |
|--------|----------|------------|-----------------|
| 165–167 | Иконка оружия/брони формируется inline | `` `/assets/items/${player.equippedWeaponId}.png` `` | Использовать `resolveItemIcon()` из `utils/assetResolver.ts` |
| 188–196 | Portrait, HP, Mana, XP — прокинуты, но `mana`/`xp` берутся из `as unknown` | Работает через костыль | Добавить поля в `PlayerEntity` или `RenderInput` |

### `src/ui/screens/CharacterCreationScreen.tsx`

| Строки | Проблема | Что сейчас | Что должно быть |
|--------|----------|------------|-----------------|
| 27–70 | `PORTRAITS` — хардкод массива | 7 портретов inline | Можно оставить как UI-контент (это не игровой контент), но желательно вынести в `public/content/portraits.json` и загружать через `loader.ts` |
| 72–126 | `STARTER_SLOTS` — хардкод стартовой экипировки | 3 слота × 2 предмета inline | Должны приходить из `CharacterConfig` + Content Registry. `ItemTemplate` уже содержит `name`, `icon` (spriteId), `damage` |
| 169–170 | Крит-шанс и крит-множитель — хардкод | `'5%'`, `'1.5x'` | Рассчитываться из базовых атрибутов в Presentation |

### `src/ui/components/GameField.tsx`

| Строки | Проблема | Что сейчас | Что должно быть |
|--------|----------|------------|-----------------|
| 199–201 | Хотбар — 8 пустых слотов | `Array.from({length: hotbarSize}).map(...empty)` | Передавать `hotbarItems` из Props (из `player.equippedWeaponId` + скиллы/расходники) |

### `src/ui/components/EquipSlot.tsx`

| Строки | Проблема | Что сейчас | Что должно быть |
|--------|----------|------------|-----------------|
| 22 | Путь к рамке захардкожен | `` `/assets/items/loot_frame_${rarity}.png` `` | `resolveItemFrame(rarity)` из `utils/assetResolver.ts` |

### `src/ui/components/HotSlot.tsx`

| Строки | Проблема | Что сейчас | Что должно быть |
|--------|----------|------------|-----------------|
| 27 | Путь к рамке захардкожен | `` `/assets/items/loot_frame_${rarity}.png` `` | `resolveItemFrame(rarity)` из `utils/assetResolver.ts` |

### `src/ui/components/ItemButton.tsx`

| Строки | Проблема | Что сейчас | Что должно быть |
|--------|----------|------------|-----------------|
| 25 | Путь к рамке захардкожен | `` `/assets/items/loot_frame_${rarity}.png` `` | `resolveItemFrame(rarity)` из `utils/assetResolver.ts` |

---

## 🟢 Низкая критичность (фичи в разработке / UI-контент)

### `src/ui/screens/CharacterCreationScreen.tsx`

| Строки | Проблема | Комментарий |
|--------|----------|-------------|
| 232–236 | Кнопки "Подсказки" и "Devlog" вызывают `alert('...в разработке')` | Ожидаемо, фичи не реализованы |

### `src/ui/screens/EndingScreen.tsx`

| Строки | Проблема | Комментарий |
|--------|----------|-------------|
| 27–32 | `DEFEAT_BOSSES` — хардкод списка боссов | До реализации босс-файтов — нормальная заглушка |

### `src/ui/components/EndingActionsPanel.tsx`

| Строки | Проблема | Комментарий |
|--------|----------|-------------|
| 29 | Кнопка "Devlog" вызывает `alert` | Фича не реализована |

---

## Вывод

**Главный блокер:** `GameScreen` использует хардкод практически для всего HUD (характеристики, скиллы, инвентарь, расходники, эффекты). При этом `GameState` уже содержит `player.hp`, `player.maxHp`, `player.inventory`, `player.statusEffects`. Presentation (`gameSession.ts`) отдаёт `RenderInput` с состоянием, но `GameScreen` не маппит эти данные в панели.

**Рекомендуемый порядок закрытия:**
1. **HeroPanel** — добавить `xp`, `level`, `mana`, `attributes` в `PlayerEntity` / `RenderInput` (или временный маппер в Presentation).
2. **EquipmentPanel** — использовать `itemDetailMapper` для отображения экипировки (`equippedWeaponId` / `equippedArmorId`).
3. **EffectsPanel** — пробросить `statusEffects` из `player`.
4. **InventoryPanel / ConsumablesPanel** — пробросить `inventory` из `player`, сгруппировать по типам.
5. **SkillsPanel** — пока скрыть или оставить пустым (скиллов в симуляции нет).
6. **EndingScreen** — прокинуть финальный `GameState` вместо hardcoded метрик.
7. **AssetResolver** — заменить inline-пути в `EquipSlot`, `HotSlot`, `ItemButton`.
