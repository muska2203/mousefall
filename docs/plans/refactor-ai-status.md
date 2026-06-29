# Рефакторинг: разделение AI-статусов и active effects

> Вариант 4 из плана: убираем `casting`/`activeCast`, переводим `prepared` в AI-режим, `stunned` остаётся только в active effects.

## Принятые решения

1. **Способности игрока с `castTime > 0`** → делаем мгновенными. Многоходовые касты у игрока уходят полностью.
2. **Отображение `prepared` над врагом** → иконка конкретного подготовленного скилла.
3. **Анимации скиллов** → сохраняем визуальную анимацию применения (огненный шар, взрыв), удаляем только события многоходового каста.
4. **Поле `castTime`** → удаляем полностью из схемы и всех JSON-шаблонов.

## Пункты доработок

### 1. Удаление `activeCast` и многоходовых кастов из Simulation

- [x] Удалить тип `ActiveCast` из `src/simulation/core-types.ts`.
- [x] Убрать поле `activeCast` из `PlayerEntity` и `EnemyEntity`.
- [x] Удалить события `CAST_STARTED`, `CAST_TICKED`, `CAST_RESOLVED`, `CAST_CANCELLED` из `GameEvent`.
- [x] Удалить интенты `BEGIN_CAST`, `TICK_CAST` и их исполнителей.
- [x] Убрать ветку `castTime > 0` из `use-ability-action.ts`.
- [x] Удалить метод `resolveActiveCast` и обработку `activeCast` в `simulation.ts`.
- [x] Обновить `apply-status-intent-executer.ts`: убрать прерывание `activeCast` при стане.
- [x] Проверить `skip-stunned-turn-intent-executor.ts` и `stun-helper.ts` на зависимости от `activeCast`.
- [x] Удалить `activeCast` из `die-intent-executer.ts`.
- [x] Удалить `activeCast` из `prepare-ability-action.ts`.
- [x] Удалить `getCastableAbilities` и `tryCastAbility` (были завязаны на `castTime`).
- [x] Удалить индикаторы каста из `EntityRenderer.ts`.
- [x] Убрать `activeCast`/`castTime` из `gameSession.ts`, `SkillDetailPopover.tsx`, `presentation/types.ts`.
- [x] Удалить `castTime` из `AbilityTemplateSchema`.
- [x] Удалить анимационные билдеры `castResolved`/`castCancelled` и их регистрацию.

**Итог:**
Многоходовые касты полностью удалены из Simulation и Presentation. `activeCast` убран из `PlayerEntity`/`EnemyEntity`, интенты `BEGIN_CAST`/`TICK_CAST` и события `CAST_*` удалены. `castTime` убран из схемы способностей. `use-ability-action.ts` теперь всегда применяет скилл мгновенно. UI больше не показывает счётчики каста. `src` проходит проверку `tsc --noEmit` без ошибок. Тесты ещё не обновлены — это пункт 6.

---

### 2. Перевод `prepared` в AI-режим

**Цель:** сделать `'prepared'` частью `AIMode`, удалить понятие `AIOverlay`, упростить логику AI-стратегий.

**Контекст после пункта 1:**
- В `src/simulation/ai/ai-state.ts` остались:
  ```ts
  export type AIMode = 'idle' | 'alert' | 'chase' | 'return';
  export type AIOverlay = 'prepared';
  export function getAIOverlay(enemy: EnemyEntity): AIOverlay | null { ... }
  ```
  `getAIOverlay` возвращает `'prepared'`, если `enemy.aiState.preparedIntent !== null`.
- `src/simulation/ai/hunter-strategy.ts` и `simple-boss-strategy.ts` используют `getAIOverlay(enemy)` для проверки: если overlay есть — враг делает `WAIT`.
- `src/simulation/systems/intents/prepare-ability-intent-executor.ts` записывает `preparedIntent` в `aiState`.
- `src/simulation/simulation.ts` в `runEnvironmentTurn` выполняет `preparedIntent` в начале хода врага.

**Выбранный подход (рекомендуемый):**
- `AIMode` расширяется значением `'prepared'`.
- Базовый FSM-режим (`idle`/`alert`/`chase`/`return`) сохраняется в `aiState.mode` даже при подготовке скилла.
- Для отображения и для проверок в AI `'prepared'` является **derived** значением: если `preparedIntent !== null`, то режим считается `'prepared'`, иначе используется `aiState.mode`.
- Это позволяет не терять информацию о базовом режиме (например, враг продолжает преследование после выполнения prepared-скилла).

**Затронутые файлы и действия:**

| Файл | Действие |
|------|----------|
| `src/simulation/ai/ai-state.ts` | 1. Добавить `'prepared'` в `AIMode`.<br>2. Удалить `AIOverlay` и `getAIOverlay`.<br>3. Обновить JSDoc: `prepared` — derived AI-режим из `preparedIntent`.<br>4. Добавить хелпер `getDerivedAIMode(enemy: EnemyEntity): AIMode`, который возвращает `'prepared'`, если `preparedIntent` есть, иначе `enemy.aiState.mode`. |
| `src/simulation/ai/hunter-strategy.ts` | 1. Убрать импорт `getAIOverlay`.<br>2. Импортировать `getDerivedAIMode`.<br>3. В `decideAction` заменить `if (getAIOverlay(enemy)) return wait(enemy);` на `if (enemy.aiState.preparedIntent) return wait(enemy);` или `if (getDerivedAIMode(enemy) === 'prepared') return wait(enemy);`.<br>4. В `updateHunterState` заменить `if (getAIOverlay(enemy)) return;` на `if (enemy.aiState.preparedIntent) return;`. |
| `src/simulation/ai/simple-boss-strategy.ts` | Аналогично `hunter-strategy.ts`: заменить `getAIOverlay` на проверку `preparedIntent`. |
| `src/simulation/ai/ai-helpers.ts` | Проверить, не используется ли `getAIOverlay`. Если да — заменить на `getDerivedAIMode` или проверку `preparedIntent`. |
| `src/simulation/simulation.ts` | В `runEnvironmentTurn`, при выполнении `preparedIntent`, базовый `aiState.mode` не меняется (он уже сохранён). Убедиться, что после выполнения `preparedIntent` режим остаётся корректным (например, `'chase'`). |

**Важный нюанс:**
- Если агент решит сделать `'prepared'` хранимым значением `mode`, потребуется дополнительное поле `baseMode` или логика восстановления режима после выполнения prepared-скилла. Это усложняет сериализацию и FSM. **Рекомендуется derived-подход.**

**Критерий выполнения:**
- `AIOverlay` и `getAIOverlay` удалены.
- `AIMode` включает `'prepared'`.
- AI-стратегии корректно ожидают при наличии `preparedIntent`.
- `tsc --noEmit` для `src` проходит без ошибок.

---

### 3. Обновление Content

**Цель:** зачистить `castTime` из JSON-шаблонов способностей и убедиться, что контент согласован с новой механикой.

**Контекст после пункта 1:**
- Поле `castTime` удалено из `AbilityTemplateSchema` в `src/content/schemas.ts`.
- В `public/content/abilities/*.json` поле `castTime` отсутствует (проверено).
- Враги используют `aiPreparable: true` для отложенных скиллов (например, `swoop`, `magic_slap`).

**Затронутые файлы и действия:**

| Файл | Действие |
|------|----------|
| `public/content/abilities/*.json` | 1. Проверить отсутствие поля `castTime` во всех JSON.<br>2. Проверить, что способности, которые раньше были многоходовыми у игрока (например, `fireball`), либо мгновенные (`aiPreparable: false`), либо вообще не доступны игроку.<br>3. Проверить, что у способностей врагов с `aiPreparable: true` нет конфликтующих флагов. |
| `src/content/schemas.ts` | Уже сделано в пункте 1. Убедиться, что нет остатков `castTime`. |

**Критерий выполнения:**
- `grep -R "castTime" public/content/` не находит совпадений.
- Все способности валидны по `AbilityTemplateSchema`.

---

### 4. Обновление Presentation

**Цель:** свести `PrimaryStatus` к чистому `AIMode`, убрать `PreparedStatus`, `'stunned'`, `'casting'`.

**Контекст после пунктов 1–2:**
- `src/presentation/primaryStatus.ts` сейчас:
  ```ts
  export type PrimaryStatus = AIMode | 'stunned' | 'casting' | PreparedStatus;
  ```
  `'stunned'` и `'casting'` уже не используются (после пункта 1), остались только `AIMode` и `PreparedStatus`.
- После пункта 2 `AIMode` будет включать `'prepared'`, и `PreparedStatus` станет не нужен.
- `RenderInput.aiPreparedIntents` продолжает содержать полную информацию о подготовленных скиллах (abilityId, name, icon, targets, intents).

**Затронутые файлы и действия:**

| Файл | Действие |
|------|----------|
| `src/presentation/primaryStatus.ts` | 1. `PrimaryStatus = AIMode` (после пункта 2 `AIMode` уже включает `'prepared'`).<br>2. Удалить `PreparedStatus`.<br>3. Упростить `resolvePrimaryStatus`:<br>   - Для врага: `return enemy.aiState.preparedIntent ? 'prepared' : enemy.aiState.mode;`<br>   - Для игрока: `return null;`<br>   - Убрать аргумент `resolvePreparedIcon`.<br>4. Обновить JSDoc. |
| `src/presentation/types.ts` | 1. `primaryStatusByEntity: Map<string, AIMode \| null>` (вместо `PrimaryStatus \| null`).<br>2. Убедиться, что `AIMode` импортирован из `@simulation/ai/ai-state`. |
| `src/presentation/gameSession.ts` | 1. Убрать `resolvePreparedIcon` резолвер из формирования `primaryStatusByEntity`.<br>2. Формировать `primaryStatusByEntity` через `resolvePrimaryStatus(entity)` (без второго аргумента).<br>3. `aiPreparedIntents` оставить без изменений — он нужен UI для иконки prepared-скилла. |
| `src/presentation/logBuilder.ts` | Проверить, нет ли текста combat log для `CAST_*` событий. Если есть — удалить. |

**Критерий выполнения:**
- `PrimaryStatus` и `PreparedStatus` удалены.
- `resolvePrimaryStatus` возвращает `AIMode | null`.
- `tsc --noEmit` для `src` проходит без ошибок.

---

### 5. Обновление UI

**Цель:** `UnitInfoRenderer` рисует только AI-режим; для `'prepared'` используется иконка подготовленного скилла.

**Контекст после пунктов 1–4:**
- `UnitInfoRenderer.ts` получает `RenderInput.primaryStatusByEntity: Map<string, AIMode | null>`.
- `RenderInput.aiPreparedIntents` содержит подготовленные намерения с иконками скиллов.
- `UnitInfoRenderer.updateStatusIcon` сейчас принимает `PrimaryStatus | null` и обрабатывает `PreparedStatus` с `abilityIcon`.

**Затронутые файлы и действия:**

| Файл | Действие |
|------|----------|
| `src/ui/renderer/UnitInfoRenderer.ts` | 1. Изменить тип параметра `updateStatusIcon` на `AIMode \| null`.<br>2. Для обычных AI-режимов (`idle`, `alert`, `chase`, `return`) использовать `getAIModeSprite(mode)`.<br>3. Для режима `'prepared'`:<br>   - Найти prepared-интент для текущей сущности в `input.aiPreparedIntents` по `entityId`.<br>   - Если найден и есть `icon` — использовать его.<br>   - Иначе использовать fallback-спрайт `'prepared'`.<br>4. Обновить JSDoc и комментарии внутри метода. |
| `src/ui/renderer/spriteRegistry.ts` | 1. Переименовать `getPrimaryStatusSprite` → `getAIModeSprite` (или оставить псевдоним для обратной совместимости).<br>2. Добавить функцию `getPreparedAbilityIcon(abilityId: string)` → `/assets/skills/{abilityId}.png` или использовать существующий `resolveAbilityIcon`. |

**Важный нюанс:**
- `UnitInfoRenderer` не должен импортировать из `simulation/`. Все данные должны приходить через `RenderInput`.
- Для получения иконки prepared-скилла лучше использовать `aiPreparedIntents.icon`, а не резолвить из контента напрямую.

**Критерий выполнения:**
- `UnitInfoRenderer` не использует `PrimaryStatus` / `PreparedStatus`.
- Для врага в режиме `'prepared'` рисуется иконка скилла (если есть) или fallback.
- `tsc --noEmit` для `src` проходит без ошибок.

---

### 6. Обновление тестов

**Цель:** удалить/переписать тесты, связанные с удалённой механикой `activeCast`/`castTime`/`CAST_*`, и адаптировать тесты под новую модель `AIMode`.

**Контекст:**
- После пунктов 1–5 много тестов не компилируется из-за ссылок на `activeCast`, `castTime`, `CAST_STARTED`, `CAST_TICKED`, `CAST_RESOLVED`, `CAST_CANCELLED`.
- Некоторые тесты нужно удалить полностью, некоторые — переписать.

**Затронутые файлы и действия:**

| Файл | Действие |
|------|----------|
| `tests/fixtures/gameState.ts` | Убрать `activeCast: null` из `makePlayer` и `makeEnemy`. |
| `tests/integration/casting.test.ts` | Удалить файл целиком: тестирует многоходовые касты, которые больше не существуют. |
| `tests/unit/simulation/casting-mechanics.test.ts` | Удалить файл целиком. |
| `tests/unit/simulation/intents/tick-cast-intent.test.ts` | Удалить файл целиком. |
| `tests/unit/simulation/actions/use-ability-action.test.ts` | 1. Убрать тесты, проверяющие `castTime` / `BEGIN_CAST` / `activeCast`.<br>2. Оставить тесты на мгновенное применение скиллов, кулдаун, таргетинг. |
| `tests/unit/simulation/ap-system.test.ts` | 1. Убрать `castTime` из `mockAbility`.<br>2. Убрать тест "каст fireball (apCost = 2, castTime = 2) работает при maxAp = 2" или переписать под мгновенное применение. |
| `tests/unit/presentation/primaryStatus.test.ts` | Переписать полностью:<br>1. Убрать `activeCast` из фикстур.<br>2. Убрать тесты на `'stunned'` / `'casting'` как PrimaryStatus.<br>3. Добавить тест: для врага с `preparedIntent` возвращается `'prepared'`.<br>4. Добавить тест: для врага без `preparedIntent` возвращается `aiState.mode`.<br>5. Для игрока всегда `null`. |
| `tests/unit/ui/renderer/UnitInfoRenderer.test.ts` | 1. Убрать тесты на `casting`.<br>2. Обновить тест на `prepared`: в `primaryStatusByEntity` устанавливать `'prepared'` (AIMode), а иконку скилла проверять через `aiPreparedIntents`.<br>3. Убрать `activeCast` из фикстур `RenderInput`. |
| `tests/unit/presentation/hotbar.test.ts` | Убрать `activeCast` из фикстур `PlayerEntity`. |
| `tests/unit/ui/renderer/TargetingRenderer.test.ts` | Убрать `activeCast` из фикстур `PlayerEntity`. |
| `tests/unit/ui/renderer/WorldRenderer.test.ts` | Убрать `activeCast` из фикстур `PlayerEntity`. |
| `tests/unit/ui/renderer/EntityRenderer.test.ts` | Убрать `activeCast` из фикстур. |
| `tests/unit/presentation/animation/builders.test.ts` | 1. Убрать импорт `castCancelledBuilder`.<br>2. Убрать тест на `CAST_CANCELLED`. |
| `tests/unit/presentation/animation/skills.test.ts` | Переписать тест: вместо `CAST_RESOLVED` использовать `ABILITY_USED` как триггер для анимации скилла. |
| `tests/integration/equipment-ability-cycle.test.ts` | Убрать `castTime` из фикстур способностей. |

**Критерий выполнения:**
- `npx tsc --noEmit` проходит без ошибок (включая тесты).
- `npm run test` проходит без ошибок.

---

### 7. Финальная проверка

**Цель:** убедиться, что рефакторинг не сломал игру и соответствует принятым решениям.

**Проверки:**

- [ ] Запустить `npm run test`.
- [ ] Запустить `npm run build`.
- [ ] Запустить `npm run lint` (если есть).
- [ ] Ручная проверка в браузере:
  - Игрок может использовать мгновенный скилл (`fireball`) — эффект применяется сразу.
  - Враг с `aiPreparable` скиллом показывает иконку скилла в большом круге при режиме `'prepared'`.
  - Враг в режимах `idle`/`alert`/`chase`/`return` показывает соответствующую иконку AI-режима.
  - `stunned` отображается только в слотах активных эффектов, не в большом круге.
  - Анимация применения скилла (огненный шар, взрыв) всё ещё работает.
- [ ] Проверить баланс: мгновенные скиллы игрока не слишком сильны после удаления каста.

**Итог:**
_Краткое описание результата после выполнения пункта._

---

## Зависимости между пунктами

```
Пункт 1 (activeCast) ──→ Пункт 2 (prepared в AIMode)
                              ↓
Пункт 3 (Content) ────────→ Пункт 4 (Presentation)
                              ↓
                         Пункт 5 (UI)
                              ↓
                         Пункт 6 (Tests)
                              ↓
                         Пункт 7 (Final check)
```

- **Пункт 1 уже выполнен.**
- **Пункт 2 и Пункт 4** можно делать последовательно: сначала пункт 2 (Simulation), потом пункт 4 (Presentation), потому что Presentation зависит от нового `AIMode`.
- **Пункт 3** независим от остальных, кроме общей схемы.
- **Пункт 5** зависит от пунктов 2 и 4.
- **Пункт 6** зависит от всех предыдущих.
- **Пункт 7** — финальный.

## Рекомендации по распределению между агентами

- **Агент A:** Пункт 2 (Simulation/AI).
- **Агент B:** Пункт 3 (Content) — можно делать параллельно с Агентом A.
- **Агент C:** Пункт 4 (Presentation) — после завершения Агента A.
- **Агент D:** Пункт 5 (UI) — после завершения Агентов A и C.
- **Агент E:** Пункт 6 (Tests) — после завершения Агентов A, C, D.
- **Агент F (или пользователь):** Пункт 7 (Final check).
