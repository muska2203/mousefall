/**
 * Слот хотбара (быстрый доступ к скиллам/предметам).
 */

interface Props {
  index: number;
  icon?: string;
  fallback?: string;
  active?: boolean;
  empty?: boolean;
  qty?: number;
  rarity?: string;
}

export function HotSlot({index, icon, fallback, active = false, empty = true, qty, rarity = 'common'}: Props) {
  return (
    <button
      type="button"
      className={`cm-hot-slot ${active ? 'active' : ''} ${empty ? 'cm-hot-slot--empty' : ''}`}
      data-slot-index={index}
      aria-label={empty ? `Слот быстрого доступа ${index + 1} (пусто)` : `Слот быстрого доступа ${index + 1}`}
      tabIndex={empty ? -1 : 0}
    >
      <span className="cm-hot-slot__key">{index + 1}</span>
      {!empty && icon && (
        <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
          <img className="cm-sprite-stack__frame" src={`/assets/items/loot_frame_${rarity}.png`} alt="" />
          <img className="cm-sprite-stack__body" src={icon} alt="" />
          <span className="cm-sprite-fallback">{fallback}</span>
        </span>
      )}
      {empty && <span className="cm-sprite-fallback">{fallback ?? ''}</span>}
      {qty != null && qty > 1 && <span className="cm-hot-slot__qty">{qty}</span>}
    </button>
  );
}
