/**
 * Круглый портрет персонажа.
 */

interface Props {
  src: string;
  alt: string;
  size?: number;
}

export function Portrait({src, alt, size = 112}: Props) {
  return (
    <div className="cm-hero-portrait">
      <div className="cm-portrait-ring" style={{'--portrait-size': `${size}px`} as React.CSSProperties}>
        <div className="cm-portrait-inner">
          <img src={src} width={size} height={size} alt={alt} />
        </div>
      </div>
    </div>
  );
}
