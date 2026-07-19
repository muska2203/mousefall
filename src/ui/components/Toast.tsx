/**
 * Карточка всплывающего уведомления.
 *
 * Отображает заголовок, описание и кнопку закрытия.
 * Автоматически закрывается по таймауту, если задан duration.
 * Перед удалением проигрывается анимация исчезновения.
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import type {ToastItem} from '@presentation/types';
import {useTranslation} from '@i18n/hooks';

interface Props {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const KIND_ICONS: Record<ToastItem['kind'], string> = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
  success: '✔',
};

/** Длительность CSS-анимации исчезновения (мс). Должна совпадать со значением в CSS. */
const EXIT_DURATION_MS = 250;

export function Toast({ toast, onDismiss }: Props) {
  const { t } = useTranslation('components');
  const { id, kind, title, message, duration } = toast;
  const [isExiting, setIsExiting] = useState(false);

  // Храним актуальный callback, чтобы таймер не перезапускался
  // при изменении onDismiss из родителя.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const completeDismiss = useCallback(() => {
    onDismissRef.current(id);
  }, [id]);

  const startExit = useCallback(() => {
    setIsExiting(true);
  }, []);

  // Таймер автоматического закрытия начинает отсчёт с момента монтирования
  // и не перезапускается при изменении callback'а родителя.
  useEffect(() => {
    if (duration === undefined || duration <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(startExit, duration);
    return () => {
      window.clearTimeout(timer);
    };
  }, [duration, startExit]);

  // После начала исчезновения ждём окончания CSS-анимации и удаляем toast.
  useEffect(() => {
    if (!isExiting) {
      return undefined;
    }

    const timer = window.setTimeout(completeDismiss, EXIT_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isExiting, completeDismiss]);

  const handleCloseClick = useCallback(() => {
    startExit();
  }, [startExit]);

  return (
    <div
      className={`cm-toast cm-toast--${kind} ${isExiting ? 'cm-toast--exiting' : ''}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="cm-toast__accent" aria-hidden="true" />
      <span className="cm-toast__icon" aria-hidden="true">
        {KIND_ICONS[kind]}
      </span>
      <div className="cm-toast__content">
        <div className="cm-toast__title">{title}</div>
        <div className="cm-toast__message">{message}</div>
      </div>
      <button
        type="button"
        className="cm-toast__close"
        onClick={handleCloseClick}
        aria-label={t('toast.closeLabel')}
      >
        ×
      </button>
    </div>
  );
}
