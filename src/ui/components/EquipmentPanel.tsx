/**
 * Панель экипировки (оружие, броня, амулет).
 *
 * Используется в GameScreen и EndingScreen.
 */

import {Panel} from './Panel';
import {EquipSlot} from './EquipSlot';

export type EquipSlotData = {
  label: string;
  icon?: string;
  fallback?: string;
  rarity?: string;
  damage?: number | null;
};

interface Props {
  title?: string;
  slots: EquipSlotData[];
}

export function EquipmentPanel({title = 'Экипировка', slots}: Props) {
  return (
    <Panel title={title}>
      <div className="cm-equip-slots">
        {slots.map((slot, i) => (
          <EquipSlot key={`${slot.label}-${i}`} {...slot} />
        ))}
      </div>
    </Panel>
  );
}
