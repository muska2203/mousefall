# Фаза 3. Пилот — текущий статус

> Реализация первого реального сценария через новую систему контентных правил.
> Дата последнего обновления: 2026-07-13.

---

## Общий прогресс

Фаза 3 выполнена на **100%** (5 из 5 шагов).

- ✅ Шаг 3.1 — Выбор пилотного сценария
- ✅ Шаг 3.2 — Включение `ContentRuleReaction` для пилота
- ✅ Шаг 3.3 — Включение модификатора на интенте для пилота
- ✅ Шаг 3.4 — Детерминированный рандом и защита от циклов
- ✅ Шаг 3.5 — Тесты пилотной цепочки

---

## ✅ Выполненные шаги

### Шаг 3.1. Выбор пилотного сценария

**Статус:** завершён.

**Что сделано:**

- Пилотный сценарий зафиксирован: **огненный урон → горение** + **огненный урон ×1,5**.
- Presentation/UI не затронуты.

**Решения:**

- Реакция реализована как глобальное мировое правило `fire_damage_ignites`.
- Модификатор `item_fire_damage_multiplier` проверяется через ручное добавление в `actor.activeRules`.

---

### Шаг 3.2. Включение `ContentRuleReaction` для пилота

**Статус:** завершён.

**Что сделано:**

- `fire_damage_ignites` перенесено из `CONTENT_RULES` в `WORLD_CONTENT_RULES`:
  - триггер `ENTITY_DAMAGED` + тег `damage.magical.fire`;
  - условие `chance` 30%;
  - эффект `applyStatus burning` длительностью 3 хода.
- Старое правило `world_global_fire_bonus` удалено, чтобы не дублировать пилот.
- Старая `fireDamageReaction` обходится при `contentRulesEnabled === true`.
- `fireballSkill` временно не накладывает горение напрямую при включённом флаге.

**Тесты:**

- `tests/unit/simulation/content-rules/execute-intent-integration.test.ts`
- `tests/unit/simulation/world-reactions/fire-damage-reaction.test.ts`
- `tests/unit/simulation/skills/fireball.test.ts`

---

### Шаг 3.3. Включение модификатора на интенте для пилота

**Статус:** завершён.

**Что сделано:**

- `item_fire_damage_multiplier` (`modifyDamage` ×1.5 на `DAMAGE` с тегом `damage.magical.fire`) остаётся в `CONTENT_RULES`.
- Точка врезки в `executeIntent` уже была реализована на фазе 2.
- Добавлены тесты, в которых правило вручную помещается в `activeRules` атакующего.

**Тесты:**

- `tests/unit/simulation/content-rules/execute-intent-integration.test.ts`

---

### Шаг 3.4. Детерминированный рандом и защита от циклов

**Статус:** завершён.

**Что сделано:**

- Добавлено поле `runtimeRng: RNGState` в `GameState`.
- `runtimeRng` инициализируется в `createNewGameState` и восстанавливается в `loadSavedGame` через `ensureRuntimeRng`.
- Условие `chance` в `runContentRuleReactions` использует `rngChance(ctx.state.runtimeRng, probability)`.
- Лимит глубины реакций в 1000 уже существовал в `executeIntent`.

**Тесты:**

- `tests/unit/simulation/content-rules/pilot-determinism.test.ts` — повторяемость результата.
- `tests/unit/simulation/content-rules/pilot-chain-limit.test.ts` — обрыв цикла на лимите.

---

### Шаг 3.5. Тесты пилотной цепочки

**Статус:** завершён.

**Что сделано:**

- Unit + интеграционные тесты покрывают:
  - модификатор огня ×1.5 с флагом и без;
  - реакцию огня → горение с шансом (успех/провал);
  - обход старой `fireDamageReaction` при включённом флаге;
  - отсутствие hardcoded-горения в `fireballSkill` при включённом флаге;
  - детерминизм шансов;
  - защиту от бесконечных цепочек.

**Тесты:**

- `tests/unit/simulation/content-rules/execute-intent-integration.test.ts`
- `tests/unit/simulation/content-rules/pilot-determinism.test.ts`
- `tests/unit/simulation/content-rules/pilot-chain-limit.test.ts`
- `tests/unit/simulation/world-reactions/fire-damage-reaction.test.ts`
- `tests/unit/simulation/skills/fireball.test.ts`

---

## Принятые архитектурные решения

См. раздел **2026-07-13. Фаза 3** в [`../decision-log.md`](../decision-log.md).

Кратко:

- `runtimeRng` отделён от `state.rng` и отвечает за детерминированные runtime-шансы.
- Пилотная реакция — глобальное мировое правило с шансом 30%.
- Старый `fireDamageReaction` и `fireballSkill` временно изолируются при включённом флаге.

---

## Проверки

| Проверка | Результат | Дата |
|---|---|---|
| `npm test` | ✅ 121 файл, 946 тестов | 2026-07-13 |
| `npx tsc --noEmit` | ✅ успешно | 2026-07-13 |
| `npm run build` | ✅ успешно | 2026-07-13 |

---

## Следующее действие

Перейти к **фазе 4 — Параллельный перенос**:

1. Перенести оставшиеся контентные мировые реакции (`collisionDamageReaction`, `collisionStunReaction`, `burningTickReaction`, `counterAttackReaction`) в декларативные правила.
2. Добавлять правила по одному, сохраняя работоспособность старой системы под флагом.
3. Продолжать покрывать каждый перенос тестами.
