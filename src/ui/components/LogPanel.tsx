/**
 * Панель журнала событий / combat log.
 *
 * Используется в GameScreen (левая колонка).
 */

import {useEffect, useRef} from 'react';
import {useTranslation} from '@i18n/hooks';
import type {LogItem} from '@presentation/gameSession';
import {Panel} from './Panel';
import {LogEntry} from './LogEntry';

interface Props {
  title?: string;
  entries: LogItem[];
  emptyMessage?: string;
}

export function LogPanel({title, entries, emptyMessage}: Props) {
  const { t } = useTranslation('components');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  const resolvedTitle = title ?? t('logPanel.title');
  const resolvedEmpty = emptyMessage ?? t('logPanel.emptyMessage');
  const titleNode = (
    <>
      {resolvedTitle}
    </>
  );
  return (
    <Panel title={titleNode}>
      <div ref={logRef} className="cm-log cm-scroll-wood" role="log" aria-live="polite" aria-label={resolvedTitle}>
        {entries.length === 0 && <LogEntry text={resolvedEmpty} />}
        {entries.map((entry) => (
          <LogEntry key={entry.id} text={entry.text} variant={entry.variant} />
        ))}
      </div>
    </Panel>
  );
}
