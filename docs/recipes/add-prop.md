# Рецепт: добавление разрушаемого объекта (пропа)

## Когда применять

Нужно добавить разрушаемый объект окружения: бочку, ящик, вазу и т.п.
Пропы не являются акторами (не ходят), но могут получать урон, блокировать движение и, опционально, линию видимости.

---

## Что понадобится

- TS-шаблон пропа в `src/content/templates/props/`.
- Тексты в `src/content/texts/ru/environment.ts` и `src/content/texts/en/environment.ts`.
- Спрайт в `public/assets/objects/props/` (или placeholder через `scripts/gen-placeholder-sprite.py`).
- Регистрация в `src/content/templates/props/index.ts`.

---

## Шаги

1. **Создай TS-шаблон** в `src/content/templates/props/oil-barel.ts`. Имя файла — `id` в kebab-case (`oil_barel` → `oil-barel.ts`), константа — camelCase:

   ```ts
   import type {PropTemplateInput} from '../../schemas';

   export const oilBarel = {
     id: 'oil_barel',
     maxHp: 10,
     armor: 0,
     blocksMovement: true,
     blocksLOS: false,
     propKind: 'barrel',
     tags: ['prop.barrel', 'contains.oil'],
   } satisfies PropTemplateInput;
   ```

   Поля с дефолтами опциональны — Zod заполнит их при сборке.

   Поля:
   - `id` — уникальный идентификатор, совпадает с именем файла в kebab-case.
   - `maxHp` — максимальное здоровье.
   - `armor` — плоское снижение физического урона.
   - `blocksMovement` — блокирует ли проход по клетке.
   - `blocksLOS` — блокирует ли линию видимости.
   - `placement` — опциональное переопределение размещения спрайта в клетке
     (`scale`/`anchorX`/`anchorY`/`flattenY`; дефолт масштаба — 1.0).
     Дефолты — по категории, см. `src/presentation/spritePlacementResolver.ts`.
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

4. **Зарегистрируй шаблон** в `src/content/templates/props/index.ts` — добавь импорт и строку в массив `propTemplates`:

   ```ts
   import {oilBarel} from './oil-barel';
   // ...
   export const propTemplates: PropTemplateInput[] = [
     // ...
     oilBarel,
   ];
   ```

5. **Проверь валидацию**:
   ```bash
   npm run validate:content
   npm run typecheck
   npm test
   ```

---

## Чеклист

- [ ] TS-шаблон создан в `src/content/templates/props/`.
- [ ] `id` совпадает с именем файла в kebab-case.
- [ ] Тексты добавлены в `ru/environment.ts` и `en/environment.ts`.
- [ ] Спрайт добавлен в `public/assets/objects/props/`.
- [ ] Шаблон зарегистрирован в `src/content/templates/props/index.ts`.
- [ ] `npm run validate:content` проходит.
- [ ] `npm run typecheck` проходит.
- [ ] `npm test` проходит.
