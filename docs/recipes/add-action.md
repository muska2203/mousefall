# Рецепт: добавление нового Action

## Когда применять

Нужно добавить новое высокоуровневое действие, которое игрок или враг может совершить (MOVE, ATTACK, END_TURN и т.п.).

---

## Проверь перед началом

- Убедись, что новый `Action` действительно нужен. Для объектных взаимодействий (двери, предметы на полу, лестницы, рычаги) не добавляется отдельный action type. Вместо этого целевой объект получает `interactionKind`, а единый action `INTERACT` через `resolveInteraction` выбирает конкретный intent (`OPEN_DOOR`, `CLOSE_DOOR`, `PICK_UP`, `FLOOR_TRANSITION`).

---

## Шаги

1. **Добавь тип в `src/simulation/core-types.ts`.**
   - Добавь новый вариант в union `GameAction`.
   - Определи поля действия.

2. **Создай `ActionHandler` в `src/simulation/systems/actions/`.**
   - Файл вида `<name>-action-handler.ts`.
   - Реализуй `validate`, `resolve`, `execute`.
   - `resolve` возвращает `Intent[]`.
   - `execute` мутирует состояние через `IntentExecutor` и привязывает узлы к `builder`.

3. **Зарегистрируй обработчик в `src/simulation/simulation.ts`.**

4. **Добавь события в `GameEvent` (если порождаются новые).**
   - `src/simulation/core-types.ts` — union `GameEvent`.
   - Реэкспорт в `src/simulation/types.ts`.

5. **Обнови `RuleContext` (если действие может быть триггером правил).**
   - `src/simulation/content-rules/rule-context.ts`.

6. **Обнови Presentation (если действие визуально значимо).**
   - `src/presentation/displayState/builder.ts` — `DisplayPatch` или `NO_OP`.
   - `src/presentation/animation/builders/` — animation builder при необходимости.
   - `src/presentation/animation/register.ts` — регистрация builder.
   - `src/presentation/logBuilder.ts` + i18n-ключи — строка в combat log.

7. **Добавь тесты.**
   - Unit: `tests/unit/simulation/actions/<name>-action-handler.test.ts`.
   - Presentation: патч, builder, log — если визуально значимо.

8. **Запусти проверки.**
   ```bash
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] Тип `GameAction` добавлен.
- [ ] Handler создан.
- [ ] Handler зарегистрирован в `src/simulation/simulation.ts`.
- [ ] События добавлены (если новые).
- [ ] `RuleContext` обновлён (если применимо).
- [ ] `DisplayPatch` добавлен (или `NO_OP` обоснован).
- [ ] Animation builder добавлен (если визуально значимо).
- [ ] Combat log + i18n добавлены (если значимо для игрока).
- [ ] Unit-тесты добавлены.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
