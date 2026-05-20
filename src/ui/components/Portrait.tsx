/**
 * Круглый портрет персонажа с бейджем уровня.
 */

interface Props {
  src: string;
  alt: string;
  level?: number;
  size?: number;
}

export function Portrait({src, alt, level = 1, size = 112}: Props) {
  return (
    <div className="cm-hero-portrait">
      <div className="cm-portrait-ring" style={{'--portrait-size': `${size}px`} as React.CSSProperties}>
        <div className="cm-portrait-inner">
          <img src={src} width={size} height={size} alt={alt} />
        </div>
      </div>
      {level > 0 && (
        <div className="cm-level-badge" aria-label={`Уровень ${level}`} title={`Уровень ${level}`}>
          {level}
        </div>
      )}
    </div>
  );
}
