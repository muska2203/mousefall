/**
 * Строка распределяемой характеристики с кнопками +/-.
 */

interface Props {
  icon: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
  canIncrease: boolean;
}

export function StatRow({icon, name, value, onChange, canIncrease}: Props) {
  const canDecrease = value > 0;

  return (
    <li className="cm-stat-row cm-stat-row--alloc">
      <span className="cm-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="cm-stat-name">{name}</span>
      <button
        type="button"
        className="cm-stat-btn"
        onClick={() => canDecrease && onChange(value - 1)}
        disabled={!canDecrease}
        aria-label={`Уменьшить ${name}`}
      >
        −
      </button>
      <span className="cm-stat-value">{value}</span>
      <button
        type="button"
        className="cm-stat-btn"
        onClick={() => canIncrease && onChange(value + 1)}
        disabled={!canIncrease}
        aria-label={`Увеличить ${name}`}
      >
        +
      </button>
    </li>
  );
}

/**
 * Строка только для чтения (производная характеристика).
 */
export function StatRowReadonly({icon, name, value}: {icon: string; name: string; value: string}) {
  return (
    <li className="cm-stat-row cm-stat-row--readonly">
      <span className="cm-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="cm-stat-name">{name}</span>
      <span className="cm-stat-value">{value}</span>
    </li>
  );
}
