/**
 * Главное меню.
 *
 * Ответственность:
 * - Отображение заголовка и кнопок навигации.
 * - Не содержит логики создания игры.
 */

interface Props {
  onNewGame: () => void;
}

export function MainMenuScreen({onNewGame}: Props) {
  return (
    <div className="cm-main-menu">
      <h1 className="cm-main-menu__title">Mousefall</h1>
      <button className="cm-btn cm-btn--primary cm-main-menu__cta" type="button" onClick={onNewGame}>
        Новая игра
      </button>
    </div>
  );
}
