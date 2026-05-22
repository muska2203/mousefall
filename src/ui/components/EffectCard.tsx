/**
 * Карточка активного эффекта/баффа.
 */

interface Props {
  icon: string;
  name: string;
  desc: string;
  turns: number;
}

export function EffectCard({icon, name, desc, turns}: Props) {
  return (
    <li className="cm-effect" role="listitem">
      <div className="cm-effect__icon">{icon}</div>
      <div className="cm-effect__main">
        <div className="cm-effect__name">{name}</div>
        <div className="cm-effect__desc">{desc}</div>
      </div>
      <div className="cm-effect__turns">{turns}</div>
    </li>
  );
}
