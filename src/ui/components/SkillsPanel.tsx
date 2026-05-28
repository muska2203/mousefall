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

function sourceLabel(source: PlayerSkillViewModel['source']): string | null {
  switch (source) {
    case 'equipment':
      return '⚙';
    case 'levelup':
      return '⬆';
    case 'innate':
    default:
      return null;
  }
}

function sourceTooltip(source: PlayerSkillViewModel['source']): string | null {
  switch (source) {
    case 'equipment':
      return 'Скилл от экипировки';
    case 'levelup':
      return 'Скилл от прокачки';
    case 'innate':
    default:
      return null;
  }
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
            skills.map((s) => {
              const srcLabel = sourceLabel(s.source);
              const srcTip = sourceTooltip(s.source);
              return (
                <li
                  key={s.abilityId}
                  className="cm-skill"
                  onClick={() => {
                    onSkillClick?.(s.abilityId);
                  }}
                  style={{cursor: 'pointer'}}
                  title={srcTip ?? undefined}
                >
                  <span className="cm-skill__icon">
                    {s.icon?.startsWith('/') ? <img src={s.icon} alt="" className="cm-skill__icon-img" /> : (s.icon ?? '?')}
                  </span>
                  <span className="cm-skill__name">
                    {s.name}
                    {srcLabel && (
                      <span className="cm-skill__source" title={srcTip ?? undefined}>
                        {' '}{srcLabel}
                      </span>
                    )}
                  </span>
                  {s.cooldown != null && s.cooldown > 0 && (
                    <span className="cm-skill__cooldown">{s.cooldown}</span>
                  )}
                  {s.isCasting && (
                    <span className="cm-skill__cast-indicator">
                      Каст {s.remainingCastTurns}
                    </span>
                  )}
                </li>
              );
            })
          ) : (
            <SkillRow icon="—" name={emptyMessage} />
          )}
        </ul>
      </div>
    </Panel>
  );
}
