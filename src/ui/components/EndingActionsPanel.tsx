/**
 * Панель действий после окончания забега.
 *
 * Используется в EndingScreen (правая колонка).
 */

import { useTranslation } from '@i18n/hooks';
import {Panel} from './Panel';

interface Props {
  onNewRun: () => void;
  onReturnToMenu?: () => void;
}

export function EndingActionsPanel({onNewRun, onReturnToMenu}: Props) {
  const { t } = useTranslation('components');
  return (
    <Panel title={t('endingActions.title')}>
      <div className="cm-ending-actions">
        <button className="cm-btn cm-btn--primary" type="button" onClick={onNewRun}>
          {t('endingActions.newRun')}
        </button>
        {onReturnToMenu && (
          <button className="cm-btn cm-btn--secondary" type="button" onClick={onReturnToMenu}>
            {t('endingActions.toMenu')}
          </button>
        )}
        <button
          className="cm-btn cm-btn--secondary"
          type="button"
          onClick={() => alert(t('endingActions.devlogAlert'))}
        >
          Devlog
        </button>
      </div>
    </Panel>
  );
}
