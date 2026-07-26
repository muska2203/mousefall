/**
 * Панель действий после окончания забега.
 *
 * Используется в EndingScreen (правая колонка).
 */

import {useCallback, useState} from 'react';
import {useTranslation} from '@i18n/hooks';
import type {ToastItem} from '@presentation/types';
import {Panel} from './Panel';
import {ToastContainer} from './ToastContainer';

interface Props {
  onNewRun: () => void;
  onReturnToMenu?: () => void;
}

export function EndingActionsPanel({onNewRun, onReturnToMenu}: Props) {
  const { t } = useTranslation('components');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showDevlogToast = useCallback(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [
      ...prev,
      {id, kind: 'info', title: t('endingActions.title'), message: t('endingActions.devlogAlert'), duration: 3000},
    ]);
  }, [t]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <>
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
            onClick={showDevlogToast}
          >
            {t('endingActions.devlogButton')}
          </button>
        </div>
      </Panel>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
