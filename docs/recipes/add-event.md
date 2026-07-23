# Рецепт: добавление нового Event

## Когда применять

Нужно добавить новую запись о произошедшем в игре, которую Presentation отрисовывает или на которую реагируют правила.

---

## Проверь перед началом

- Убедись, что событие действительно нужно как отдельный `GameEvent`. Часто можно переиспользовать существующее событие с разными полями.
- Если событие нужно только для внутренней логики и не выходит за пределы симуляции, возможно, достаточно нового `Intent`.

---

## Шаги

1. **Добавь тип в `src/simulation/core-types.ts`.**
   - Добавь новый вариант в union `GameEvent`.
   - Определи поля события.
   - Обнови реэкспорт в `src/simulation/types.ts`.

2. **Эмитируй событие из `IntentExecutor`.**
   - Найди соответствующий исполнитель в `src/simulation/systems/intents/`.
   - Создай узел через `ExecutionBuilder.addChild`.

3. **Обнови `RuleContext` (если событие может быть триггером правил).**
   - `src/simulation/content-rules/rule-context.ts`.

4. **Обнови Presentation.**
   - `src/presentation/displayState/builder.ts` — `DisplayPatch` или `NO_OP`.
   - `src/presentation/animation/builders/` — animation builder, если событие визуально значимо.
   - `src/presentation/animation/register.ts` — регистрация builder.
   - `src/presentation/logBuilder.ts` + i18n-ключи — строка в combat log.

5. **Добавь тесты.**
   - Unit: `tests/unit/simulation/intents/<name>-intent-executor.test.ts` или отдельный тест события.
   - Presentation: патч, builder, log — если визуально значимо.

6. **Запусти проверки.**
   ```bash
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] Тип `GameEvent` добавлен.
- [ ] Эмиссия добавлена в `IntentExecutor`.
- [ ] `RuleContext` обновлён (если применимо).
- [ ] `DisplayPatch` добавлен (или `NO_OP` обоснован).
- [ ] Animation builder добавлен (если визуально значимо).
- [ ] Combat log + i18n добавлены (если значимо для игрока).
- [ ] Unit-тесты добавлены.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
