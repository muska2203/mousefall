/**
 * Карточка активного эффекта/баффа.
 */

interface Props {
  icon: string;
  name: string;
  desc: string;
  turns: number;
}

function EffectIcon({ icon }: { icon: string }) {
  if (icon.startsWith('/')) {
    return <img src={icon} alt="" className="cm-effect__icon" />;
  }

  return <div className="cm-effect__icon">{icon}</div>;
}

export function EffectCard({ icon, name, desc, turns }: Props) {
  return (
    <li className="cm-effect" role="listitem">
      <EffectIcon icon={icon} />
      <div className="cm-effect__main">
        <div className="cm-effect__name">{name}</div>
        <div className="cm-effect__desc">{desc}</div>
      </div>
      <div className="cm-effect__turns">{turns}</div>
    </li>
  );
}
