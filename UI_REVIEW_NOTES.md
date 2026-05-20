# Замечания ревью UI — блокеры перед продолжением реализации

> **Важно:** Эти пункты нужно закрыть до добавления новых экранов, анимаций или PixiJS-рендерера. Иначе техдолг накопится и потребует массового переписывания.

---

## 🔴 Критичные (закрыть в первую очередь)

### 1. `DEFAULT_MAP_PARAMS` в UI — нарушение границ слоёв
**Где:** `src/ui/screens/CharacterCreationScreen.tsx`

**Проблема:** UI знает о внутренней игровой логике — `enemyPool`, `enemyDensity`, `minRooms`, `maxRoomSize`. При добавлении 20 этажей придётся менять React-компонент.

**Что сделать:**
- Убрать `MapParams` из пропсов `onStartGame`.
- Передавать из UI только `floorId: string` (или номер этажа).
- `GameSession.startNewGame(config, seed, floorId)` сама ищет `MapParams` в `ContentRegistry`.
- UI вообще не должен импортировать `MapParams`.

---

### 2. UI сам строит ASCII-карту — логика отрисовки вне Presentation
**Где:** `src/ui/screens/GameScreen.tsx` → `AsciiMap`

**Проблема:** UI знает, что `enemy` рисуется как `E`, `item` как `*`, стена как `#`. При добавлении нового типа сущности (`npc`, `trap`, `door`) придётся лезть в React-компонент. При переходе на PixiJS эта логика станет мёртвым грузом.

**Что сделать:**
- `GameViewModel` должен содержать готовую `renderGrid: string[][]` или `renderCommands: RenderCommand[]`.
- Presentation (`GameSession`) строит их из `GameState` + `EntityTemplate.symbol` (из ContentRegistry).
- UI (`AsciiMap`) только отображает готовое — не принимает решений о символах.

---

### 3. `forceRender` — антипаттерн обхода React
**Где:** `src/ui/screens/GameScreen.tsx`

**Проблема:** `useReducer(() => x + 1, 0)` толкает React на полный ре-рендер вручную, потому что `GameSession` не уведомляет подписчиков. Ломает оптимизации, приводит к перерисовке ASCII-карты на каждый чих.

**Что сделать:**
- Добавить в `GameSession` механизм подписки:
  ```ts
  class GameSession {
    private listeners = new Set<() => void>();
    subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    private notify() { this.listeners.forEach(fn => fn()); }
  }
  ```
- В `App.tsx` использовать `useSyncExternalStore` (React 18+) или `useState` + `useEffect` с подпиской.
- Удалить `forceRender` из `GameScreen`.

---

### 4. Combat log живёт в локальном `useState` UI
**Где:** `src/ui/screens/GameScreen.tsx`

**Проблема:**
- Лог теряется при размонтировании `GameScreen` (переход в `gameOver`/`victory`).
- Строки формируются UI (`addLog('Ход: (1,0)')`), а не Presentation. Согласно архитектуре, combat log должен строиться из дерева `ExecutionNode`.

**Что сделать:**
- `GameViewModel` должен содержать `combatLog: string[]`.
- `GameSession.dispatch` обходит `result.phases` → `ExecutionNode` → формирует строки лога.
- UI читает готовый массив из `getViewModel()` и только отображает.

---

## 🟡 Средние (техдолг, который быстро превратится в боль)

### 5. Хардкод классов и предметов в CharacterCreationScreen
**Где:** `src/ui/screens/CharacterCreationScreen.tsx`

**Проблема:** `<option value='warrior'>Воин</option>` — при добавлении класса/оружия править JSX.

**Что сделать:**
- `GameSession` предоставляет методы:
  ```ts
  getAvailableClasses(): {id: string; name: string}[]
  getAvailableWeapons(): {id: string; name: string}[]
  getAvailableArmor(): {id: string; name: string}[]
  ```
- UI рендерит списки динамически.
- Данные читаются из загруженного `ContentRegistry` (через Presentation).

---

### 6. `GameViewModel` отдаёт сырой `GameState`
**Где:** `src/presentation/gameSession.ts`

**Проблема:** UI получает весь `Readonly<GameState>` — `rng`, `nextEntityCounter`, внутренние счётчики. UI зависит от деталей, которые его не касаются.

**Что сделать:**
- `GameViewModel` должен быть плоским и содержать только данные для отрисовки:
  ```ts
  type GameViewModel = {
    mode: SessionMode;
    playerHp: number;
    playerMaxHp: number;
    playerAp: number;
    playerMaxAp: number;
    round: number;
    entities: Array<{id: string; x: number; y: number; symbol: string}>;
    mapWidth: number;
    mapHeight: number;
    mapTiles: TileType[][];
    combatLog: string[];
    lastResult: SimulationResult | null;
  };
  ```

---

### 7. O(H × W × E) в ASCII-рендере
**Где:** `src/ui/screens/GameScreen.tsx` → `AsciiMap`

**Проблема:** Тройной цикл. На карте 100×100 с 100 сущностями — 1 000 000 операций на кадр.

**Что сделать:**
- Presentation строит `Map<string, Entity>` по ключу `${x},${y}` один раз за ход.
- Или сразу строит `renderGrid: string[][]`.
- UI делает O(1) lookup или просто отрисовывает готовый массив.

---

### 8. Presentation импортирует из `simulation/systems/`
**Где:** `src/presentation/gameSession.ts`

**Проблема:** `import type {GameAction} from '@simulation/systems/actions/types'` — Presentation знает о внутренней структуре `systems/actions/`.

**Что сделать:**
- Реэкспортировать `GameAction` из `src/simulation/types.ts`.
- Presentation импортирует только из `simulation/types.ts`.

---

### 9. Нет защиты от спам-кликов
**Где:** `src/ui/screens/GameScreen.tsx`

**Проблема:** Быстрое нажатие кнопки → несколько `dispatch` подряд. Нет флага `isProcessing`.

**Что сделать:**
- Добавить в `GameSession`:
  ```ts
  private processing = false;
  dispatch(action) {
    if (this.processing) return;
    this.processing = true;
    // ... dispatch ...
    this.processing = false;
  }
  ```
- Или возвращать `boolean` (успех/отклонено), чтобы UI блокировал кнопки.

---

### 10. `GameSession.dispatch` возвращает `void`
**Где:** `src/presentation/gameSession.ts`

**Проблема:** UI не получает `SimulationResult`. Не может узнать, успешен ли ход, какие фазы были, какие события произошли.

**Что сделать:**
- Пусть `dispatch` возвращает `SimulationResult`.
- UI сможет принимать решения об анимациях на основе `result.phases`.

---

## 🟢 Мелочи (можно отложить, но лучше сразу)

### 11. Нет обработки ошибок
- `session.dispatch` бросает `Error` при неинициализированной симуляции или неправильном режиме.
- UI нигде не обёрнут в `try/catch`.

### 12. `key={i}` в combat log
```tsx
{log.map((entry, i) => <div key={i}>{entry}</div>)}
```
При добавлении фильтрации/очистки сломается. Использовать `key={entry.id}` или timestamp.

### 13. Нет keyboard input
Только кнопки мыши. Для roguelike критично управление стрелками/WASD. Нужен `useEffect` с `addEventListener('keydown')` в `GameScreen`.

### 14. `applyCharacterConfig` — экипировка без инвентаря
```ts
player.equippedWeaponId = templateId;
player.inventory = [];
```
Если в будущем инвентарь станет единственным источником истины для экипировки — сломается.

### 15. `resolveModeFromPhase` — нет runtime-защиты
Добавить `default: throw new Error('Unknown phase: ' + phase)` для защиты от рассинхронизации.

### 16. `App.tsx` — `session` singleton вне React
При HMR создаётся новый `GameSession`, старый остаётся в памяти. Для dev-режима не критично, но стоит иметь в виду.

---

## Порядок работы (рекомендация)

1. Подписка в `GameSession` + `useSyncExternalStore` в `App.tsx` (п. 3).
2. Combat log в `GameViewModel` (п. 4).
3. ASCII-рендер в Presentation (п. 2).
4. Убрать `MapParams` из UI, передавать `floorId` (п. 1).
5. Плоский `GameViewModel` (п. 6).
6. Динамические списки в CharacterCreationScreen (п. 5).
7. Остальные мелочи (п. 8–16).
