# Фаза 4. Параллельный перенос — текущий статус

> Актуальный статус реализации фазы 4. Обновляется по мере прохождения шагов.
> Дата последнего обновления: 2026-07-13.

---

## Общий прогресс

Фаза 4 выполнена на **14%** (1 из 7 шагов).

- ✅ Шаг 4.1 — Перенос физики столкновений
- ⬜ Шаг 4.2 — Перенос тиковых эффектов
- ⬜ Шаг 4.3 — Подключение тайловых эффектов
- ⬜ Шаг 4.4 — Расширение `RuleContext` на остальные события
- ⬜ Шаг 4.5 — Подключение источников правил: экипировка, статусы, таланты
- ⬜ Шаг 4.6 — Модуль глобальных мировых контентных правил
- ⬜ Шаг 4.7 — Поддержка мультитаргетных селекторов

---

## ✅ Выполненные шаги

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

---

## Принятые архитектурные решения

- **Мировые правила столкновений — глобальные правила слоя `world` (`worldLayer: 'global'`).**
- **Actor-on-actor реализован через два отдельных правила** с селекторами `eventTarget` и `collisionTarget`, чтобы не расширять движок правил на этом шаге.
- **Тег `displacement.push` ставит исполнитель `PUSH`, а не скилл.** Это упрощает миграцию: старые скиллы (`dash`, `swoop`, тесты) продолжают работать без изменений, но при необходимости скиллы могут передать свои теги через `PushIntent.tags`.
- **`dazed` применяет штраф к AP при восстановлении**, а не через отдельный `CONSUME_AP`. Для этого изменён порядок фазы установки: AP восстанавливаются до тика статусов.

---

## Проверки

| Проверка | Результат | Дата |
|---|---|---|
| `npm test` | ✅ 121 файл, 952 теста | 2026-07-13 |
| `npm run typecheck` | ✅ успешно | 2026-07-13 |

---

## Следующее действие

Перейти к **шагу 4.2 — Перенос тиковых эффектов**:

1. Создать мировое правило `burning_tick_damage` на `STATUS_TICKED` + `burning`.
2. Сохранить поведение старой `burningTickReaction` при выключенном флаге.
3. Покрыть перенос тестами с включённым `contentRulesEnabled`.
