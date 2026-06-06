/**
 * Панель активных эффектов / баффов.
 *
 * Используется в GameScreen (левая колонка).
 */

import { useTranslation } from '@i18n/hooks';
import {Panel} from './Panel';
import {EffectCard} from './EffectCard';

export type EffectItem = {
  icon: string;
  name: string;
  desc: string;
  turns: number;
};

interface Props {
  title?: string;
  effects?: EffectItem[];
}

export function EffectsPanel({title, effects}: Props) {
  const { t } = useTranslation('components');
  const resolvedTitle = title ?? t('effectsPanel.title');

  return (
    <Panel title={resolvedTitle}>
      <div className="cm-effects-viewport cm-scroll-wood">
        <ul className="cm-effects" role="list" aria-label={resolvedTitle}>
          {effects && effects.length > 0 ? (
            effects.map((e, i) => (
              <EffectCard key={`effect-${e.name}-${i}`} {...e} />
            ))
          ) : (
            <EffectCard icon="—" name={t('effectsPanel.noEffectsName')} desc={t('effectsPanel.noEffectsDesc')} turns={0} />
          )}
        </ul>
      </div>
    </Panel>
  );
}
