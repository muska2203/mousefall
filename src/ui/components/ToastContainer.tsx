/**
 * Контейнер всплывающих уведомлений.
 *
 * Рендерится через портал поверх всего UI в верхнем центре viewport.
 */

import { createPortal } from 'react-dom';
import type { ToastItem } from '@presentation/types';
import { Toast } from './Toast';

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="cm-toast-container" role="region" aria-live="polite" aria-label="Уведомления">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}
