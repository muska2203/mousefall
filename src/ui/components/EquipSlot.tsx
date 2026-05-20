/**
 * Слот экипировки (оружие, броня, амулет).
 */

interface Props {
  label: string;
  icon?: string;
  fallback?: string;
  rarity?: string;
  damage?: number | null;
}

export function EquipSlot({label, icon, fallback = '—', rarity = 'common', damage}: Props) {
  return (
    <div className="cm-equip-slot">
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
