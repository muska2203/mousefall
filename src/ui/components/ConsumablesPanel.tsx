/**
 * Панель расходников (горизонтальный скролл ячеек).
 *
 * Используется в GameScreen (правая колонка).
 */

import {Panel} from './Panel';

interface Props {
  title?: string;
}

export function ConsumablesPanel({title = 'Расходники'}: Props) {
  return (
    <Panel title={title} className="cm-panel--consumables">
      <div className="cm-cons-wrap cm-scroll-wood">
        <div className="cm-cons-row">
          <div className="cm-inv-cell cm-inv-cell--empty" />
        </div>
      </div>
    </Panel>
  );
}
