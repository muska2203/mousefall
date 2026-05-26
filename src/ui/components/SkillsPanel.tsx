/**
 * Панель скиллов (список с иконками и маной).
 *
 * Используется в GameScreen (правая колонка).
 * Максимальная высота — 3 строки, далее скролл (аналогично журналу).
 */

import {Panel} from './Panel';
import {SkillRow} from './SkillRow';
import type { PlayerSkillViewModel } from '@presentation/types';

interface Props {
  title?: string;
  skills?: PlayerSkillViewModel[];
  emptyMessage?: string;
  onSkillClick?: (abilityId: string) => void;
}

export function SkillsPanel({
  title = 'Скиллы',
  skills,
  emptyMessage = 'Нет скиллов',
  onSkillClick,
}: Props) {
  const titleNode = (
    <>
      {title}
    </>
  );

  return (
    <Panel title={titleNode} className="cm-panel--skills">
      <div className="cm-skills-viewport cm-scroll-wood">
        <ul className="cm-skills">
          {skills && skills.length > 0 ? (
            skills.map((s) => (
              <li
                key={s.abilityId}
                className="cm-skill"
                onClick={() => {
                  onSkillClick?.(s.abilityId);
                }}
                style={{cursor: 'pointer'}}
              >
                <span className="cm-skill__icon">
                  {s.icon?.startsWith('/') ? <img src={s.icon} alt="" className="cm-skill__icon-img" /> : (s.icon ?? '?')}
                </span>
                <span className="cm-skill__name">{s.name}</span>
                {s.mpCost != null && (
                  <span className="cm-skill__mana">
                    <span>{s.mpCost}</span>
                  </span>
                )}
                {s.cooldown != null && s.cooldown > 0 && (
                  <span className="cm-skill__cooldown">{s.cooldown}</span>
                )}
              </li>
            ))
          ) : (
            <SkillRow icon="—" name={emptyMessage} />
          )}
        </ul>
      </div>
    </Panel>
  );
}
