# Рецепт: добавление нового Intent

## Когда применять

Нужно добавить новый низкоуровневый игровой эффект, который мутирует состояние и порождает событие.

---

## Проверь перед началом

- Убедись, что новый `Intent` действительно нужен. Многие эффекты можно реализовать через существующие интенты + `ContentRule`.
- Если эффект логически следует из другого действия (например, урон от толчка в стену), скорее всего нужна не новая Intent, а `WorldReaction` или контентное правило.

---

## Шаги

1. **Добавь тип в `src/simulation/core-types.ts`.**
   - Добавь новый вариант в union `Intent`.
   - Определи поля интента.

2. **Создай `IntentExecutor` в `src/simulation/systems/intents/`.**
   - Файл вида `<name>-intent-executor.ts`.
   - Функция мутирует состояние и порождает ровно одно семантическое событие.
   - **Важно:** `IntentExecutor` не должен напрямую исполнять другие интенты. Если нужна цепочка — породи событие и дай реакциям сработать.

3. **Зарегистрируй исполнитель в `src/simulation/systems/intents/index.ts`.**

4. **Добавь событие в `GameEvent` (если новое).**
   - `src/simulation/core-types.ts` — union `GameEvent`.
   - Реэкспорт в `src/simulation/types.ts`.

5. **Обнови `RuleContext` (если событие может быть триггером правил).**
   - `src/simulation/content-rules/rule-context.ts`.

6. **Обнови Presentation (если событие визуально значимо).**
   - `src/presentation/displayState/builder.ts` — `DisplayPatch` или `NO_OP`.
   - `src/presentation/animation/builders/` — animation builder при необходимости.
   - `src/presentation/animation/register.ts` — регистрация builder.
   - `src/presentation/logBuilder.ts` + i18n-ключи — строка в combat log.

7. **Добавь тесты.**
   - Unit: `tests/unit/simulation/intents/<name>-intent-executor.test.ts`.
   - Presentation: патч, builder, log — если визуально значимо.

8. **Запусти проверки.**
   ```bash
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] Тип `Intent` добавлен.
- [ ] Исполнитель создан и зарегистрирован.
- [ ] Событие добавлено (если новое).
- [ ] `RuleContext` обновлён (если применимо).
- [ ] `DisplayPatch` добавлен (или `NO_OP` обоснован).
- [ ] Animation builder добавлен (если визуально значимо).
- [ ] Combat log + i18n добавлены (если значимо для игрока).
- [ ] Unit-тесты добавлены.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
