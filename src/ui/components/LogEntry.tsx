/**
 * Запись в журнале боя/событий.
 */

interface Props {
  text: string;
  variant?: 'loot' | 'good' | 'bad' | 'info';
}

export function LogEntry({text, variant}: Props) {
  const variantClass = variant ? `cm-log__line--${variant}` : '';
  return (
    <p className={`cm-log__line cm-log__line--with-icon ${variantClass}`}>
      <span className="cm-log__mark" aria-hidden="true">
        📜
      </span>
      <span className="cm-log__text">{text}</span>
    </p>
  );
}
