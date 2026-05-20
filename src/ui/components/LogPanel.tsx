/**
 * Панель журнала событий / combat log.
 *
 * Используется в GameScreen (левая колонка).
 */

import {useRef, useEffect} from 'react';
import type {LogItem} from '@presentation/gameSession';
import {Panel} from './Panel';
import {LogEntry} from './LogEntry';

interface Props {
  title?: string;
  entries: LogItem[];
  emptyMessage?: string;
}

export function LogPanel({title = 'Журнал', entries, emptyMessage = 'Начало забега. Удачи!'}: Props) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  const titleNode = (
    <>
      <img src="/assets/icons/log.svg" alt="" className="cm-panel__title-icon" aria-hidden="true" />
      {' '}
      {title}
    </>
  );
  return (
    <Panel title={titleNode}>
      <div ref={logRef} className="cm-log cm-scroll-wood" role="log" aria-live="polite" aria-label={title}>
        {entries.length === 0 && <LogEntry text={emptyMessage} />}
        {entries.map((entry) => (
          <LogEntry key={entry.id} text={entry.text} variant={entry.variant} />
        ))}
      </div>
    </Panel>
  );
}
