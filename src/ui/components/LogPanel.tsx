/**
 * Панель журнала событий / combat log.
 *
 * Используется в GameScreen (левая колонка).
 */

import {Panel} from './Panel';
import {LogEntry} from './LogEntry';

export type LogItem = {
  id: number;
  text: string;
  variant?: 'loot' | 'good' | 'bad' | 'info';
};

interface Props {
  title?: string;
  entries: LogItem[];
  emptyMessage?: string;
}

export function LogPanel({title = 'Журнал', entries, emptyMessage = 'Начало забега. Удачи!'}: Props) {
  const titleNode = (
    <>
      <img src="/assets/icons/log.svg" alt="" className="cm-panel__title-icon" aria-hidden="true" />
      {' '}
      {title}
    </>
  );
  return (
    <Panel title={titleNode}>
      <div className="cm-log" role="log" aria-live="polite" aria-label={title}>
        {entries.length === 0 && <LogEntry text={emptyMessage} />}
        {entries.map((entry) => (
          <LogEntry key={entry.id} text={entry.text} variant={entry.variant} />
        ))}
      </div>
    </Panel>
  );
}
