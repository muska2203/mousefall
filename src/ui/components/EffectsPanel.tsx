/**
 * Панель активных эффектов / баффов.
 *
 * Используется в GameScreen (левая колонка).
 */

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

export function EffectsPanel({title = 'Активные эффекты', effects}: Props) {
  return (
    <Panel title={title}>
      <div className="cm-effects-viewport cm-scroll-wood">
        <ul className="cm-effects" role="list" aria-label={title}>
          {effects && effects.length > 0 ? (
            effects.map((e, i) => (
              <EffectCard key={`effect-${e.name}-${i}`} {...e} />
            ))
          ) : (
            <EffectCard icon="—" name="Эффекты" desc="Нет активных эффектов." turns={0} />
          )}
        </ul>
      </div>
    </Panel>
  );
}
