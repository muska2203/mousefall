/**
 * Тултип с детальной информацией о скилле в хотбаре.
 *
 * Позиционируется фиксированно относительно viewport — координаты передаются извне.
 * Потребляет готовый ViewModel от Presentation.
 */

import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@i18n/hooks';
import type { HotbarSkillTooltip } from '@presentation/types';

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

const POPOVER_OFFSET = 16;
const VIEWPORT_PADDING = 8;

export function SkillDetailPopover({ skill, visible, x, y }: Props) {
  const { t } = useTranslation('components');
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || x === undefined || y === undefined) return;

    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + POPOVER_OFFSET;
    let top = y + POPOVER_OFFSET;

    // Если карточка не влезает справа — отображаем слева от курсора
    if (left + rect.width > viewportWidth - VIEWPORT_PADDING) {
      left = x - rect.width - POPOVER_OFFSET;
    }
    // Если карточка не влезает снизу — отображаем сверху от курсора
    if (top + rect.height > viewportHeight - VIEWPORT_PADDING) {
      top = y - rect.height - POPOVER_OFFSET;
    }

    // Не даём уйти за левый/верхний край viewport
    left = Math.max(VIEWPORT_PADDING, left);
    top = Math.max(VIEWPORT_PADDING, top);

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y, visible, skill]);

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

        {skill.description && <p className="skill-detail-desc">{skill.description}</p>}

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
      </div>
    </div>,
    document.body,
  );
}
