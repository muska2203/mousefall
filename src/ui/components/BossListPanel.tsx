/**
 * Панель списка побежденных боссов.
 *
 * Используется в EndingScreen (правая колонка).
 */

import { useTranslation } from '@i18n/hooks';
import {Panel} from './Panel';

interface Props {
  title?: string;
  bosses: string[];
}

export function BossListPanel({title, bosses}: Props) {
  const { t } = useTranslation('components');
  return (
    <Panel title={title ?? t('bossList.title')}>
      <ul className="cm-ending-loot">
        {bosses.map((name, i) => (
          <li key={i} className="cm-ending-loot__item">
            {name}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
