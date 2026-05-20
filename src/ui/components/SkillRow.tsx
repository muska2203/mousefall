/**
 * Строка скилла в списке.
 */

interface Props {
  icon: string;
  name: string;
  mana?: number | null;
}

export function SkillRow({icon, name, mana}: Props) {
  const isImage = icon.startsWith('/');
  return (
    <li className="cm-skill">
      <span className="cm-skill__icon">
        {isImage ? <img src={icon} alt="" className="cm-skill__icon-img" /> : icon}
      </span>
      <span className="cm-skill__name">{name}</span>
      {mana != null && (
        <span className="cm-skill__mana">
          <span>{mana}</span>
        </span>
      )}
    </li>
  );
}
