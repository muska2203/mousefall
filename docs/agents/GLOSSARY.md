# GLOSSARY — Глоссарий терминов

| Термин | Определение |
|--------|-------------|
| **Action (`GameAction`)** | Высокоуровневое намерение (MOVE, ATTACK, END_TURN). Что хотел сделать актёр. |
| **Intent** | Низкоуровневая операция после разрешения Action (MOVE, DAMAGE, DIE). Что реально произойдёт. |
| **Event (`GameEvent`)** | Неизменяемая запись о произошедшем. Организована в дерево `ExecutionNode`. |
| **ExecutionNode** | Узел дерева событий. Содержит `GameEvent` + массив дочерних узлов. |
| **ExecutionBuilder** | Помощник для построения дерева событий внутри Simulation. |
| **Simulation** | Headless, детерминированный игровой движок. Мутирует состояние и возвращает события. |
| **Presentation** | Единственный мост между UI и Simulation. Оркестрирует ход игры, анимации, сохранения. |
| **ViewModel** | Данные, которые Presentation отдаёт UI для отрисовки (позиции, HP, анимации, лог). |
| **AnimationPhase** | Одна фаза анимации, соответствующая стороне хода (`TurnSide`). Содержит деревья `AnimationNode`. |
| **AnimationNode** | Узел дерева анимаций. Содержит `AnimationStep` + дочерние узлы. Сиблинги выполняются параллельно. |
| **Combat Log** | Массив строк, сформированных Presentation на основе дерева событий. |
| **Content Registry** | In-memory хранилище загруженных JSON-шаблонов. Read-only после инициализации. |
| **RNG (`utils/rng.ts`)** | Seeded PRNG. Единственный источник случайности в Simulation. |
| **GameState** | Единственный источник истины. Все поля JSON-serializable. |
| **Phase** | Фаза игры в `GameState`: `playing` \| `dead` \| `victory`. В Presentation/UI фаза отрисовки: `idle` \| `animating` \| `gameOver`. |
| **Turn / Round** | `turn.activeSide` — активная фракция или фаза (`player` \| `allies` \| `enemies` \| `neutrals` \| `round_recovery`). `turn.round` — номер раунда. |
| **AP (Action Points)** | Очки действия. У игрока и у AI. Ход продолжается пока AP > 0. |
| **World Reaction** | Реакция мира на событие (например, смерть при получении урона). Динамически регистрируется. |
| **Faction Turn** | Ход всех акторов одной фракции в раунде (`player`, `allies`, `enemies`, `neutrals`). |
| **Autosave** | Запланировано, но не реализовано (сохранения не реализованы). |
| **Fail Fast** | Если контент невалиден или сохранение повреждено — игра немедленно падает с понятной ошибкой. |
