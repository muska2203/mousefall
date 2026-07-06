# Декомпозиция: добавление скила «Рассечение»

> Исходный план: `C:\Users\PC\.kimi\plans\squirrel-girl-jean-grey-falcon.md`

## Цель
Реализовать скил `cleave` — ближнюю атаку по дуге на 3 соседние клетки. Урон равен effective damage оружия кастующего. Стоимость 1 AP, кулдаун 2 хода. Контратака не срабатывает.

## Общие правила для всех агентов
- Все комментарии и текстовые пояснения в коде — на русском (см. `AGENTS.md`).
- Не добавлять скилл ни одному персонажу/предмету — только шаблон и реестр.
- Не менять существующую логику, кроме явно указанных расширений.
- После изменений запустить `npm run typecheck` и `npm test cleave` в своей зоне ответственности (если применимо).

---

## Этап 1. Контент, локализация и placeholder-иконка

**Агент:** `cleave-content-agent`

### Задачи
1. Создать `public/content/abilities/cleave.json`:
   ```json
   {
     "id": "cleave",
     "spriteId": "cleave",
     "cooldown": 2,
     "apCost": 1
   }
   ```
2. Добавить `"/content/abilities/cleave.json"` в массив `abilities` файла `public/content/manifest.json`.
3. Добавить локализацию в `src/content/texts/ru.ts`:
   ```ts
   cleave: {
     name: 'Рассечение',
     description: 'Удар по дуге рядом с героем. Наносит урон выбранной цели и врагам по соседним клеткам.',
   },
   ```
4. Добавить локализацию в `src/content/texts/en.ts`:
   ```ts
   cleave: {
     name: 'Cleave',
     description: 'A sweeping melee slash that damages the target and adjacent enemies.',
   },
   ```
5. Сгенерировать placeholder-иконку:
   ```bash
   python scripts/gen-placeholder-sprite.py --name cleave --dir public/assets/skills --size 32 --color "#e74c3c"
   ```

### Критерии приёмки
- `npm run typecheck` проходит.
- Иконка `public/assets/skills/cleave.png` существует.

---

## Этап 2. Simulation: логика скила и тесты

**Агент:** `cleave-simulation-agent`

### Задачи
1. Создать `src/simulation/skills/executors/cleaveSkill.ts`:
   - `id: 'cleave'`.
   - `getTargetMode()` → `{ type: 'single', range: 1 }`.
   - `getValidTargets(state, caster)` → все 8 соседних клеток в пределах карты.
   - `getAffectedPositions(state, caster, _selected, hoveredTarget)` → центральная клетка + 2 боковые (см. правило геометрии ниже).
   - `preview(state, caster, _selected, hoveredTarget)` → делегировать в `resolve`.
   - `resolve(state, caster, targets)`:
     - Найти 3 клетки зоны поражения.
     - Для каждой клетки найти все `damageable` сущности (враги, двери; исключить `floor_item_container`, `stairs`).
     - Для каждой цели и каждой записи из `getEffectiveDamageEntries(caster)` создать `DAMAGE`-интент.
     - Не добавлять `SET_COOLDOWN` и `COUNTER_ATTACK`.
2. Зарегистрировать скилл в `src/simulation/skills/index.ts`.
3. Создать `tests/unit/simulation/skills/cleave.test.ts`:
   - Проверить `getValidTargets` (8 клеток, границы карты).
   - Проверить `getAffectedPositions` для всех 8 направлений.
   - Проверить `resolve` для пустой клетки (0 интентов).
   - Проверить урон по 1, 2, 3 целям.
   - Проверить `damageType` и отсутствие `COUNTER_ATTACK`.
   - Проверить регистрацию в реестре.

### Правило геометрии боковых клеток
Боковые клетки — это соседи целевой клетки, которые одновременно являются соседями кастующего, исключая самого кастующего и целевую клетку. Универсальный способ: перебрать 8 соседей кастующего `(ox, oy)` и оставить те, для которых `max(|ox - dx|, |oy - dy|) <= 1`, где `(dx, dy)` — направление от кастующего к цели.

Примеры:
- `(1, 0)` → боковые `(1, 1)`, `(1, -1)`.
- `(1, -1)` → боковые `(1, 0)`, `(0, -1)`.
- `(0, -1)` → боковые `(1, -1)`, `(-1, -1)`.

### Критерии приёмки
- `npm test cleave` проходит.
- `npm run typecheck` проходит.

---

## Этап 3. Presentation + UI: анимация SLASH_ARC

**Агент:** `cleave-animation-agent`

### Задачи
1. Добавить новый `AnimationStep` в `src/presentation/types.ts`:
   ```ts
   | {
       type: 'SLASH_ARC';
       from: Position;
       positions: Position[];
     }
   ```
2. Добавить функцию `slashArcNode(event, positions, children)` в `src/presentation/animation/core/primitives.ts`.
3. Создать `src/presentation/animation/skills/cleave.ts`:
   - Composer для `cleave`.
   - Возвращает дерево: `ABILITY_CAST → SLASH_ARC → [дети из параметра children]`.
4. Импортировать `./skills/cleave` в `src/presentation/animation/index.ts`.
5. Добавить конфиг в `src/utils/animationConfig.ts`:
   ```ts
   SLASH_ARC: { duration: 250, blocking: true, easing: Easing.easeOutQuad }
   ```
6. Добавить метод `animateSlashArc(from, positions, config, ticker)` в `src/ui/renderer/WorldRenderer.ts`:
   - Цвет `#e74c3c` (0xe74c3c).
   - Три ярких луча от центра кастующего к центрам 3 клеток.
   - Анимация: `alpha 0.9 → 0`, масштаб/длина `0 → 1`, длительность 250 мс.
7. Создать `src/ui/animation/slashArcExecutor.ts`:
   - `canExecute` для `SLASH_ARC`.
   - `execute` вызывает `worldRenderer.animateSlashArc`.
8. Зарегистрировать `SlashArcExecutor` в `src/ui/components/GameField.tsx` в массиве `executors`.

### Критерии приёмки
- `npm run typecheck` проходит.
- Игра собирается (`npm run build` или `npm run dev` без ошибок типов).

---

## Порядок и зависимости
- Этап 1, 2 и 3 можно выполнять параллельно — они не пересекаются по файлам.
- После завершения всех этапов запустить полный набор проверок: `npm run typecheck`, `npm test cleave`, `npm run test:coverage`.

## Итоговый чек-лист
- [ ] `public/content/abilities/cleave.json` создан.
- [ ] `public/content/manifest.json` обновлён.
- [ ] `src/content/texts/ru.ts` и `en.ts` обновлены.
- [ ] `public/assets/skills/cleave.png` сгенерирован.
- [ ] `src/simulation/skills/executors/cleaveSkill.ts` создан и зарегистрирован.
- [ ] `tests/unit/simulation/skills/cleave.test.ts` создан.
- [ ] `SLASH_ARC` добавлен в типы, конфиг, primitives, composer, WorldRenderer, executor, GameField.
- [ ] Все проверки (`typecheck`, `test cleave`, `test:coverage`) проходят.
