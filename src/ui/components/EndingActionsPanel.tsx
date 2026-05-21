/**
 * Панель действий после окончания забега.
 *
 * Используется в EndingScreen (правая колонка).
 */

import {Panel} from './Panel';

interface Props {
  onNewRun: () => void;
  onReturnToMenu?: () => void;
}

export function EndingActionsPanel({onNewRun, onReturnToMenu}: Props) {
  return (
    <Panel title="Дальше">
      <div className="cm-ending-actions">
        <button className="cm-btn cm-btn--primary" type="button" onClick={onNewRun}>
          Новый забег
        </button>
        {onReturnToMenu && (
          <button className="cm-btn cm-btn--secondary" type="button" onClick={onReturnToMenu}>
            В меню
          </button>
        )}
        <button
          className="cm-btn cm-btn--secondary"
          type="button"
          onClick={() => alert('Devlog — в разработке')}
        >
          Devlog
        </button>
      </div>
    </Panel>
  );
}
