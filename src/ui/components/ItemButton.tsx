/**
 * Кнопка предмета для выбора стартовой экипировки.
 */

interface Props {
  icon: string;
  fallback: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  damage?: number | null;
  rarity?: string;
  onMouseEnter?: () => void;
  onMouseMove?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: () => void;
}

export function ItemButton({icon, fallback, label, selected, onClick, damage, rarity = 'common', onMouseEnter, onMouseMove, onMouseLeave}: Props) {
  return (
    <button
      type="button"
      className={`cm-welcome-item item-rarity-${rarity} ${selected ? 'active' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      aria-label={label}
      title={label}
    >
      <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
        <img className="cm-sprite-stack__frame" src={`/assets/items/loot_frame_${rarity}.png`} alt="" decoding="async" />
        <img className="cm-sprite-stack__body" src={icon} alt="" decoding="async" />
        <span className="cm-sprite-fallback">{fallback}</span>
      </span>
      {damage != null && <span className="cm-item-weapon-damage">{damage}</span>}
    </button>
  );
}
