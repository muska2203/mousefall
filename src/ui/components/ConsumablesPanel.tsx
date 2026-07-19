/**
 * Панель расходников (горизонтальный скролл ячеек).
 *
 * Используется в GameScreen (правая колонка).
 */

import {useTranslation} from '@i18n/hooks';
import {Panel} from './Panel';

interface Props {
  title?: string;
}

export function ConsumablesPanel({title}: Props) {
  const { t } = useTranslation('components');
  return (
    <Panel title={title ?? t('consumables.title')} className="cm-panel--consumables">
      <div className="cm-cons-wrap cm-scroll-wood">
        <div className="cm-cons-row">
          <div className="cm-inv-cell cm-inv-cell--empty" />
        </div>
      </div>
    </Panel>
  );
}
