# Фаза 4. Параллельный перенос — текущий статус

> Актуальный статус реализации фазы 4. Обновляется по мере прохождения шагов.
> Дата последнего обновления: 2026-07-14.

---

## Общий прогресс

Фаза 4 выполнена на **50%** (3 из 6 шагов).

> **Примечание:** шаг «Подключение тайловых эффектов» вынесен из фазы 4 и из MVP. Он будет реализован отдельно — после окончательного перехода на новый концепт (фаза 7 «Тайловые эффекты и окружение»).

- ✅ Шаг 4.1 — Перенос физики столкновений
- ✅ Шаг 4.2 — Перенос тиковых эффектов
- ✅ Шаг 4.3 — Расширение `RuleContext` на остальные события
- ⬜ Шаг 4.4 — Подключение источников правил: экипировка, статусы, таланты
- ⬜ Шаг 4.5 — Модуль глобальных мировых контентных правил
- ⬜ Шаг 4.6 — Поддержка мультитаргетных селекторов

---

## ✅ Выполненные шаги

### Шаг 4.3. Расширение `RuleContext` на остальные события

**Статус:** завершён.

**Что сделано:**

- `RuleContext` теперь разрешает следующие события MVP:
  - `STATUS_REMOVED` → `targetEntityId`;
  - `STATUS_STACKS_ADJUSTED` → `targetEntityId`, `eventStacks`;
  - `RESOURCE_CONSUMED` → `sourceEntityId`, `eventAmount`;
  - `ENTITY_DISPLACED` → `sourceEntityId`, `targetEntityId`, `eventPosition` = `to`;
  - `COUNTER_ATTACK_APPLIED` → `sourceEntityId` (атакующий), `targetEntityId`;
  - `ENTITY_MOVED` → `sourceEntityId`, `eventPosition` = `to`.
- Добавлено обязательное поле `sourceEntityId: EntityId | null` в `ApplyStatusIntent` и `StatusAppliedEvent`.
- `executeApplyStatusIntent` передаёт `sourceEntityId` из интента в событие `STATUS_APPLIED`.
- `buildRuleContext` для `STATUS_APPLIED` и `APPLY_STATUS` заполняет `sourceEntityId`.
- Все места создания интента `APPLY_STATUS` в `src/` обновлены с указанием `sourceEntityId` (скиллы, мировые реакции, использование предмета, контентные правила).

**Тесты:**

- `tests/unit/simulation/content-rules/rule-context.test.ts` — новые тесты для `STATUS_REMOVED`, `STATUS_STACKS_ADJUSTED`, `RESOURCE_CONSUMED`, `ENTITY_DISPLACED`, `COUNTER_ATTACK_APPLIED`, `ENTITY_MOVED`; обновлены `STATUS_APPLIED` и `APPLY_STATUS` на проверку `sourceEntityId`.
- `tests/unit/simulation/intents/apply-status-intent.test.ts` — добавлен `sourceEntityId` в интенты и события.
- `tests/unit/simulation/content-rules/reaction/content-rule-reaction.test.ts` — обновлено ожидание `sourceEntityId` в `APPLY_STATUS` от правил.
- `tests/unit/simulation/rules/active-rule-lifecycle.test.ts` — добавлен `sourceEntityId` в `APPLY_STATUS`.
- `tests/unit/presentation/animation/builders.test.ts` — добавлен `sourceEntityId` в `STATUS_APPLIED`.

### Шаг 4.1. Перенос физики столкновений

**Статус:** завершён.

**Что сделано:**

- Старые реакции `collisionDamageReaction` и `collisionStunReaction` теперь отключаются при `contentRulesEnabled === true`.
- Добавлены 4 мировых контентных правила в `WORLD_CONTENT_RULES`:
  - `collision_damage` — урон 5 отталкиваемому актору;
  - `collision_damage_actor` — урон 5 второму актору при actor-on-actor;
  - `collision_daze` — статус `dazed` на отталкиваемом акторе;
  - `collision_daze_actor` — статус `dazed` на втором акторе при actor-on-actor.
- `ENTITY_COLLIDED` теперь несёт теги: `displacement.push` + `collision.wall` / `collision.actor` / `collision.blocking-object`.
- `PushIntent` получил опциональное поле `tags`; `push-intent-executer` автоматически добавляет `displacement.push`.
- В `content-rule-reaction` добавлен fallback `sourceEntityId = selfId ?? ctx.sourceEntityId`, чтобы мировые правила сохраняли источника урона.
- Добавлен новый статус `dazed`:
  - включён в `StatusEffectType`;
  - снижает восстановление AP на 1 (но не ниже 0) в `executeRestoreApIntent`;
  - для корректной работы в `runFactionSetup` порядок изменён: сначала `RESTORE_AP`, затем `TICK_STATUS_EFFECTS`.
- Тестовые правила (`slashing_weapon_bleed`, `item_slashing_damage_add`, `world_global_damage_multiply`, `world_global_damage_add_tag`) вынесены из production-реестра в `tests/fixtures/content-rules.ts` и подключаются через `setWorldContentRulesOverride`.

**Тесты:**

- `tests/unit/simulation/world-reactions/collision-reactions.test.ts` — параметризованные тесты с флагом и без, actor-on-actor, свободная клетка, теги столкновения, механика `dazed`.
- `tests/unit/simulation/content-rules/reaction/content-rule-reaction.test.ts` — unit-тесты мировых правил столкновений и проверка `sourceEntityId`.
- `tests/unit/simulation/content-rules/rule-context.test.ts` — обязательные `tags` в `ENTITY_COLLIDED`.
- `tests/unit/simulation/content-rules/execute-intent-integration.test.ts`
- `tests/unit/simulation/content-rules/modifiers/apply-intent-modifiers.test.ts`
- `tests/unit/simulation/rules/active-rule-lifecycle.test.ts`

### Шаг 4.2. Перенос тиковых эффектов

**Статус:** завершён.

**Что сделано:**

- `StatusTickedEvent` теперь требует обязательное поле `tags: GameplayTag[]`.
- Добавлено глобальное мировое правило `burning_tick_damage`:
  - срабатывает на `STATUS_TICKED` с тегом `status.burning`;
  - наносит `round(maxHp * 0.1)` огненного урона (минимум 1);
  - теги интента: `damage.magical.fire`;
  - источник урона (`sourceEntityId`) равен `null`.
- Старая реакция `burningTickReaction` отключается при `contentRulesEnabled === true`.
- Исполнитель `TICK_STATUS_EFFECTS` заполняет `tags` события `STATUS_TICKED` как `status.<тип>` для каждого затикавшего эффекта.
- `RuleContext` для `STATUS_TICKED` предоставляет `targetEntityId`, `eventPosition`, `eventMaxHp` и `eventTags`.

**Тесты:**

- `tests/unit/simulation/world-reactions/burning-tick-reaction.test.ts` — параметризованы по `contentRulesEnabled`; проверка урона 10% maxHp, тега `damage.magical.fire` и `tags: ['status.burning']` в новой системе.
- `tests/unit/simulation/content-rules/reaction/content-rule-reaction.test.ts` — раздел «мировое правило тика горения»; исправлено ожидание `dazed.duration: 2`.
- `tests/unit/simulation/content-rules/rule-context.test.ts` — тест контекста `STATUS_TICKED`.
- `tests/unit/presentation/animation/animation.test.ts` — добавлены `tags` в `STATUS_TICKED`.
- `tests/unit/presentation/animation/builders.test.ts` — добавлены `tags` в `STATUS_TICKED`.
- `tests/unit/simulation/status-effects/burning.test.ts` — добавлены `tags` в `STATUS_TICKED`.
- `tests/unit/simulation/status-effects/tick-phases.test.ts` — добавлены `tags` в `STATUS_TICKED`.

---

## Принятые архитектурные решения

- **Мировые правила столкновений — глобальные правила слоя `world` (`worldLayer: 'global'`).**
- **Actor-on-actor реализован через два отдельных правила** с селекторами `eventTarget` и `collisionTarget`, чтобы не расширять движок правил на этом шаге.
- **Тег `displacement.push` ставит исполнитель `PUSH`, а не скилл.** Это упрощает миграцию: старые скиллы (`dash`, `swoop`, тесты) продолжают работать без изменений, но при необходимости скиллы могут передать свои теги через `PushIntent.tags`.
- **`dazed` применяет штраф к AP при восстановлении**, а не через отдельный `CONSUME_AP`. Для этого изменён порядок фазы установки: AP восстанавливаются до тика статусов.
- **Тайловые эффекты (`water`, `oil`, `fog`) и правила окружения вынесены из фазы 4 и из MVP.** Они будут реализованы отдельно после окончательного перехода на новый концепт.

---

## Проверки

| Проверка | Результат | Дата |
|---|---|---|
| `npm test` | ✅ 121 файл, 963 теста | 2026-07-14 |
| `npm run typecheck` | ✅ успешно | 2026-07-14 |

---

## Следующее действие

Перейти к **шагу 4.4 — Подключение источников правил: экипировка, статусы, таланты**.
