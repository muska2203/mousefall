/**
 * Строка скилла в списке.
 */

interface Props {
  icon: string | null;
  name: string;
  mana?: number | null;
  cooldown?: number;
  disabled?: boolean;
  onClick?: () => void;
}

export function SkillRow({icon, name, mana, cooldown, disabled, onClick}: Props) {
  const isImage = icon?.startsWith('/');
  return (
    <li className={`cm-skill ${disabled ? 'cm-skill--disabled' : ''} ${cooldown ? 'cm-skill--cooldown' : ''}`}>
      <button
        type="button"
        className="cm-skill__btn"
        onClick={() => {
          onClick?.();
        }}
        disabled={false}
        aria-label={name}
      >
        <span className="cm-skill__icon">
          {isImage ? <img src={icon!} alt="" className="cm-skill__icon-img" /> : (icon ?? '?')}
        </span>
        <span className="cm-skill__name">{name}</span>
        {mana != null && (
          <span className="cm-skill__mana">
            <span>{mana}</span>
          </span>
        )}
        {cooldown != null && cooldown > 0 && (
          <span className="cm-skill__cooldown">{cooldown}</span>
        )}
      </button>
    </li>
  );
}
