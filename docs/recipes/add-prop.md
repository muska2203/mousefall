# Рецепт: добавление разрушаемого объекта (пропа)

## Когда применять

Нужно добавить разрушаемый объект окружения: бочку, ящик, вазу и т.п.
Пропы не являются акторами (не ходят), но могут получать урон, блокировать движение и, опционально, линию видимости.

---

## Что понадобится

- JSON-шаблон пропа в `public/content/entities/props/`.
- Тексты в `src/content/texts/ru/environment.ts` и `src/content/texts/en/environment.ts`.
- Спрайт в `public/assets/objects/props/` (или placeholder через `scripts/gen-placeholder-sprite.py`).
- Запись в `public/content/manifest.json` в массиве `props`.

---

## Шаги

1. **Создай JSON-шаблон** в `public/content/entities/props/{id}.json`:

   ```json
   {
     "id": "oil_barel",
     "maxHp": 10,
     "armor": 0,
     "blocksMovement": true,
     "blocksLOS": false,
     "renderScale": 1.0,
     "propKind": "barrel",
     "tags": ["prop.barrel", "contains.oil"]
   }
   ```

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла.
   - `maxHp` — максимальное здоровье.
   - `armor` — плоское снижение физического урона.
   - `blocksMovement` — блокирует ли проход по клетке.
   - `blocksLOS` — блокирует ли линию видимости.
   - `renderScale` — масштаб спрайта относительно тайла.
   - `propKind` — вид пропа (`barrel`, `crate` и т.д.).
   - `tags` — игровые теги для классификации и будущих правил.

2. **Добавь тексты** в `src/content/texts/ru/environment.ts` и `en/environment.ts`:

   ```ts
   export const props: Record<string, ContentText> = {
     oil_barel: {
       name: 'Бочка с маслом',
       flavorText: '...',
     },
   };
   ```

3. **Добавь спрайт** в `public/assets/objects/props/{id}.png`.
   Для placeholder'а:
   ```bash
   py scripts/gen-placeholder-sprite.py --name oil_barel --dir public/assets/objects/props --size 64 --color "#6d4c41"
   ```

4. **Зарегистрируй в манифесте**. Добавь путь в массив `props` в `public/content/manifest.json`.

5. **Проверь валидацию**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] JSON-шаблон создан в `public/content/entities/props/`.
- [ ] `id` совпадает с именем файла.
- [ ] Тексты добавлены в `ru/environment.ts` и `en/environment.ts`.
- [ ] Спрайт добавлен в `public/assets/objects/props/`.
- [ ] Путь добавлен в `public/content/manifest.json`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
