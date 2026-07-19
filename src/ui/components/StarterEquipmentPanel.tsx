/**
 * Панель выбора стартовой экипировки (оружие, броня, амулет).
 *
 * Используется в CharacterCreationScreen.
 */

import {useState} from 'react';
import {useTranslation} from '@i18n/hooks';
import type {ItemDetailViewModel} from '@presentation/types';
import {Panel} from './Panel';
import {ItemButton} from './ItemButton';
import {ItemDetailPopover} from './ItemDetailPopover';

export type StarterItem = {
  id: string;
  name: string;
  icon: string;
  fallback: string;
  damage?: number;
  detail?: ItemDetailViewModel;
};

export type StarterSlot = {
  label: string;
  items: StarterItem[];
  selectedId: string;
  onSelect: (id: string) => void;
};

interface Props {
  title?: string;
  slots: StarterSlot[];
}

export function StarterEquipmentPanel({title, slots}: Props) {
  const { t } = useTranslation('components');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{x: number; y: number}>({x: 0, y: 0});

  let hoveredItem: StarterItem | null = null;
  for (const slot of slots) {
    const item = slot.items.find((i) => i.id === hoveredItemId);
    if (item) {
      hoveredItem = item;
      break;
    }
  }

  return (
    <Panel title={title ?? t('starterEquipmentPanel.title')} titleId="equip-title" fill className="cm-panel--welcome-equip">
      {slots.map((slot) => (
        <div key={slot.label} className="cm-welcome-equip-slot">
          <div className="cm-welcome-equip-header">
            <span className="cm-welcome-equip-label">{slot.label}</span>
            <span className="cm-welcome-equip-desc">
              {t('starterEquipmentPanel.selectedPrefix')}{slot.items.find((i) => i.id === slot.selectedId)?.name ?? '—'}
            </span>
          </div>
          <div className="cm-welcome-options">
            {slot.items.map((item) => (
              <ItemButton
                key={item.id}
                icon={item.icon}
                fallback={item.fallback}
                label={item.name}
                selected={slot.selectedId === item.id}
                onClick={() => slot.onSelect(item.id)}
                damage={item.damage ?? null}
                onMouseEnter={() => setHoveredItemId(item.id)}
                onMouseMove={(e) => setMousePos({x: e.clientX, y: e.clientY})}
                onMouseLeave={() => setHoveredItemId(null)}
              />
            ))}
          </div>
        </div>
      ))}

      {hoveredItem?.detail && (
        <ItemDetailPopover
          item={hoveredItem.detail}
          visible={true}
          x={mousePos.x}
          y={mousePos.y}
        />
      )}
    </Panel>
  );
}
