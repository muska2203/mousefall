# Протокол: content_addition

## Когда применять

Добавление врагов, предметов, способностей, статусов, карт.

---

## Последовательность действий

1. **Определи подтип контента** и открой соответствующий рецепт:
   - интент → [`docs/recipes/add-intent.md`](../../recipes/add-intent.md)
   - враг → [`docs/recipes/add-enemy.md`](../../recipes/add-enemy.md)
   - оружие → [`docs/recipes/add-weapon.md`](../../recipes/add-weapon.md)
   - статус → [`docs/recipes/add-status.md`](../../recipes/add-status.md)
   - контентное правило → [`docs/recipes/add-content-rule.md`](../../recipes/add-content-rule.md)
   - другие типы — см. [`docs/recipes/README.md`](../../recipes/README.md)

2. **Возьми образец**: скопируй существующий JSON из `public/content/` или `public/content/examples/`.

3. **Заполни данные** по шаблону. Не меняй игровую логику.

4. **Добавь путь** в `public/content/manifest.json`.

5. **Проверь валидацию**:
   ```bash
   npm run validate:content
   ```

6. **Добавь тесты**, если рецепт требует.

7. **Сообщи результат**: что добавлено, прошла ли валидация.
