/**
 * Круглый индикатор кулдауна с сегментами.
 *
 * Рисует max сегментов, из которых value первых заполнены,
 * остальные "отрезаны" (тёмные). По центру цифра value.
 */

interface Props {
  value: number;
  max: number;
  size?: number;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function CircularCooldown({ value, max, size = 34 }: Props) {
  if (max <= 0 || value <= 0) return null;

  const safeValue = Math.max(0, Math.min(value, max));
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const segmentAngle = 360 / max;
  const gap = 2; // зазор между сегментами в градусах
  const arcAngle = Math.max(1, segmentAngle - gap);

  return (
    <svg
      className="cm-circular-cooldown"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {Array.from({ length: max }).map((_, i) => {
        const startAngle = i * segmentAngle - 90;
        const filled = i < safeValue;
        const d = describeArc(center, center, radius, startAngle, startAngle + arcAngle);
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={filled ? '#ff9f43' : 'rgba(0, 0, 0, 0.55)'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      })}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="cm-circular-cooldown__text"
      >
        {safeValue}
      </text>
    </svg>
  );
}
