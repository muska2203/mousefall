/**
 * Панель выбора стартовой экипировки (оружие, броня, амулет).
 *
 * Используется в CharacterCreationScreen.
 */

import {Panel} from './Panel';
import {ItemButton} from './ItemButton';

export type StarterItem = {
  id: string;
  name: string;
  icon: string;
  fallback: string;
  damage?: number;
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

export function StarterEquipmentPanel({title = 'Стартовая экипировка', slots}: Props) {
  return (
    <Panel title={title} titleId="equip-title" fill className="cm-panel--welcome-equip">
      {slots.map((slot) => (
        <div key={slot.label} className="cm-welcome-equip-slot">
          <div className="cm-welcome-equip-header">
            <span className="cm-welcome-equip-label">{slot.label}</span>
            <span className="cm-welcome-equip-desc">
              Выбрано: {slot.items.find((i) => i.id === slot.selectedId)?.name ?? '—'}
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
              />
            ))}
          </div>
        </div>
      ))}
    </Panel>
  );
}
