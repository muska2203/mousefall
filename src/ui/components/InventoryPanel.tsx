/**
 * Панель инвентаря (сетка ячеек).
 *
 * Используется в GameScreen (правая колонка).
 */

import {Panel} from './Panel';

interface Props {
  title?: string;
  fill?: boolean;
}

export function InventoryPanel({title = 'Инвентарь', fill = true}: Props) {
  return (
    <Panel title={title} className="cm-panel--inventory" fill={fill}>
      <div className="cm-inv-wrap cm-scroll-wood">
        <div className="cm-inv-grid">
          <div className="cm-inv-cell cm-inv-cell--empty" />
        </div>
      </div>
    </Panel>
  );
}
