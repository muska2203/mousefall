/**
 * Полоса ресурса (HP, Мана, XP).
 */

interface Props {
  type: 'hp' | 'xp';
  icon: string;
  label: string;
  current: number;
  max: number;
}

export function ResourceBar({type, icon, label, current, max}: Props) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;

  return (
    <div
      className={`cm-bar cm-bar--${type}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={current}
      aria-label={label}
    >
      <div className="cm-bar__row">
        <span className="cm-bar__icon-wrap" aria-hidden="true">
          <img className="cm-bar__icon" src={icon} width={22} height={22} alt="" />
        </span>
        <div className="cm-bar__content">
          <div className="cm-bar__label">
            <span>{label}</span>
            <span>
              {current} / {max}
            </span>
          </div>
          <div className="cm-bar__track">
            <div className="cm-bar__fill" style={{width: `${pct}%`}} />
          </div>
        </div>
      </div>
    </div>
  );
}
