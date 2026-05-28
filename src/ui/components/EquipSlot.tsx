/**
 * Слот экипировки (оружие, броня, амулет).
 *
 * Клик по занятому слоту снимает предмет.
 */

interface Props {
  label: string;
  icon?: string;
  fallback?: string;
  rarity?: string;
  damage?: number | null;
  instanceId?: string | null;
  onClick?: () => void;
}

export function EquipSlot({
  label,
  icon,
  fallback = '—',
  rarity = 'common',
  damage,
  instanceId,
  onClick,
}: Props) {
  const isOccupied = !!instanceId;

  return (
    <div
      className={`cm-equip-slot ${isOccupied ? 'cm-equip-slot--occupied' : ''}`}
      onClick={() => {
        if (isOccupied) {
          onClick?.();
        }
      }}
      style={{ cursor: isOccupied ? 'pointer' : 'default' }}
    >
      <span className="cm-equip-slot__label">{label}</span>
      <div className={`cm-equip-slot__box item-rarity-${rarity}`}>
        <span className="cm-equip-slot__icon">
          <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
            {icon && (
              <>
                <img className="cm-sprite-stack__frame" src={`/assets/items/loot_frame_${rarity}.png`} alt="" decoding="async" />
                <img className="cm-sprite-stack__body" src={icon} alt="" decoding="async" />
              </>
            )}
            <span className="cm-sprite-fallback">{fallback}</span>
          </span>
        </span>
        {damage != null && <span className="cm-item-weapon-damage">{damage}</span>}
      </div>
    </div>
  );
}
