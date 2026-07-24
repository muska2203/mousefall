/**
 * Универсальный тултип с подробным описанием.
 *
 * Используется для характеристик, эффектов и прочего, где нужно
 * показать название, шуточное описание и список влияний.
 *
 * Позиционируется фиксированно относительно viewport — координаты передаются извне.
 *
 * Пример использования:
 * <DetailPopover
 *   title="Сила"
 *   icon="💪"
 *   flavorText="Чем больше мышцы, тем громче звук при ударе."
 *   details={["+1 к урону от оружия", "+5 к максимальному переносимому весу"]}
 *   visible={isVisible}
 *   x={mouseX}
 *   y={mouseY}
 * />
 */

import {createPortal} from 'react-dom';
import {useTranslation} from '@i18n/hooks';
import {usePopoverPosition} from './hooks/usePopoverPosition';

interface Props {
  /** Название описываемого элемента. */
  title: string;
  /** Иконка (эмодзи или символ). */
  icon?: string;
  /** Краткое шуточное описание. */
  flavorText: string;
  /** Список строк с подробностями влияния. */
  details: string[];
  /** Управляет видимостью тултипа. */
  visible: boolean;
  /** Координата X курсора в viewport (используется как опорная точка). */
  x?: number;
  /** Координата Y курсора в viewport (используется как опорная точка). */
  y?: number;
}

export function DetailPopover({ title, icon, flavorText, details, visible, x, y }: Props) {
  const { t } = useTranslation('components');
  const ref = usePopoverPosition<HTMLDivElement>({ x, y, enabled: visible });

  if (!visible) {
    return null;
  }

  return createPortal(
    <div ref={ref} className="detail-popover" role="tooltip">
      <div className="detail-popover-card">
        <div className="detail-popover-head">
          {icon && (
            <span className="detail-popover-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="detail-popover-title">{title}</span>
        </div>

        <p className="detail-popover-flavor">{flavorText}</p>

        {details.length > 0 && (
          <div className="detail-popover-section">
            <h4 className="detail-popover-section-title">{t('detailPopover.impactTitle')}</h4>
            <ul className="detail-popover-list">
              {details.map((line, index) => (
                <li key={index} className="detail-popover-list-item">
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
