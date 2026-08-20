/**
 * Тултип слота базовой атаки (оружия) в хотбаре.
 *
 * Позиционируется фиксированно относительно viewport — координаты передаются извне.
 * Потребляет готовый ViewModel от Presentation.
 */

import {createPortal} from 'react-dom';
import {useTranslation} from '@i18n/hooks';
import type {HotbarWeaponTooltip} from '@presentation/types';
import {usePopoverPosition} from './hooks/usePopoverPosition';

interface Props {
  /** Данные слота оружия для отображения (готовый ViewModel). */
  data: HotbarWeaponTooltip;
  /** Управляет видимостью тултипа. */
  visible: boolean;
  /** Координата X курсора в viewport (используется как опорная точка). */
  x?: number;
  /** Координата Y курсора в viewport (используется как опорная точка). */
  y?: number;
}

export function WeaponSlotPopover({ data, visible, x, y }: Props) {
  const { t } = useTranslation('components');
  const ref = usePopoverPosition<HTMLDivElement>({ x, y, enabled: visible });

  if (!visible) {
    return null;
  }

  return createPortal(
    <div ref={ref} className="skill-detail-popover" role="tooltip">
      <div className="skill-detail-card">
        <div className="skill-detail-head">
          {data.icon && (
            <img
              className="skill-detail-icon"
              src={data.icon}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
          <span className="skill-detail-title">{data.name}</span>
        </div>

        <p className="skill-detail-desc">{data.weaponName}</p>

        <div className="skill-detail-section">
          <ul className="skill-detail-list">
            <li className="skill-detail-list-item">
              {t('hotbar.skillTooltipApCost', { ap: String(data.apCost) })}
            </li>
            <li className="skill-detail-list-item">{data.hint}</li>
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
