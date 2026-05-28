/**
 * Панель экипировки (оружие, броня, амулет).
 *
 * Используется в GameScreen и EndingScreen.
 */

import {useState} from 'react';
import type {ItemDetailViewModel} from '@presentation/itemDetailMapper';
import {Panel} from './Panel';
import {EquipSlot} from './EquipSlot';
import {ItemDetailPopover} from './ItemDetailPopover';

export type EquipSlotData = {
  label: string;
  icon?: string;
  fallback?: string;
  rarity?: string;
  damage?: number | null;
  detail?: ItemDetailViewModel;
  slotType: 'weapon' | 'armor' | 'amulet';
  instanceId: string | null;
};

interface Props {
  title?: string;
  slots: EquipSlotData[];
  onUnequip?: (slot: 'weapon' | 'armor' | 'amulet') => void;
}

export function EquipmentPanel({title = 'Экипировка', slots, onUnequip}: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{x: number; y: number}>({x: 0, y: 0});

  const hoveredSlot = hoveredIndex !== null ? slots[hoveredIndex] : null;

  return (
    <Panel title={title}>
      <div className="cm-equip-slots">
        {slots.map((slot, i) => (
          <div
            key={`${slot.label}-${i}`}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseMove={(e) => setMousePos({x: e.clientX, y: e.clientY})}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <EquipSlot
              {...slot}
              onClick={() => onUnequip?.(slot.slotType)}
            />
          </div>
        ))}
      </div>
      {hoveredSlot?.detail && (
        <ItemDetailPopover
          item={hoveredSlot.detail}
          visible={true}
          x={mousePos.x}
          y={mousePos.y}
        />
      )}
    </Panel>
  );
}
