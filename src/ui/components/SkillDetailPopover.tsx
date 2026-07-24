/**
 * Тултип с детальной информацией о скилле в хотбаре.
 *
 * Позиционируется фиксированно относительно viewport — координаты передаются извне.
 * Потребляет готовый ViewModel от Presentation.
 */

import {createPortal} from 'react-dom';
import {useTranslation} from '@i18n/hooks';
import type {HotbarSkillTooltip} from '@presentation/types';
import {TagList} from './TagList';
import {RichDescription} from './RichDescription';
import {usePopoverPosition} from './hooks/usePopoverPosition';

interface Props {
  /** Данные скилла для отображения (готовый ViewModel). */
  skill: HotbarSkillTooltip;
  /** Управляет видимостью тултипа. */
  visible: boolean;
  /** Координата X курсора в viewport (используется как опорная точка). */
  x?: number;
  /** Координата Y курсора в viewport (используется как опорная точка). */
  y?: number;
}

export function SkillDetailPopover({ skill, visible, x, y }: Props) {
  const { t } = useTranslation('components');
  const ref = usePopoverPosition<HTMLDivElement>({ x, y, enabled: visible });

  if (!visible) {
    return null;
  }

  const details: string[] = [];
  details.push(
    t('hotbar.skillTooltipApCost', {
      ap: skill.apCost === 'all' ? '∞' : String(skill.apCost),
    }),
  );
  if (skill.maxCooldown > 0) {
    details.push(
      t('hotbar.skillTooltipCooldown', {
        current: skill.cooldown,
        max: skill.maxCooldown,
      }),
    );
  }
  return createPortal(
    <div ref={ref} className="skill-detail-popover" role="tooltip">
      <div className="skill-detail-card">
        <div className="skill-detail-head">
          {skill.icon && (
            <img
              className="skill-detail-icon"
              src={skill.icon}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
          <span className="skill-detail-title">{skill.name}</span>
        </div>

        {skill.description && (
          <p className="skill-detail-desc">
            <RichDescription text={skill.description} />
          </p>
        )}

        {details.length > 0 && (
          <div className="skill-detail-section">
            <ul className="skill-detail-list">
              {details.map((line, index) => (
                <li key={index} className="skill-detail-list-item">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {skill.tags.length > 0 && (
          <div className="skill-detail-tags">
            <TagList
              items={skill.tags.map((tag, i) => ({ tag, label: skill.tagLabels[i]! }))}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
