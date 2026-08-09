/**
 * Тултип с детальной информацией о реликвии (панель коллекции, окно выбора алтаря).
 *
 * Показывает имя, иконку в рамке редкости, список эффектов (правил и
 * модификаторов, описания — через RichDescription с тег-ссылками),
 * атмосферный текст и размер стака (при count > 1).
 * Позиционируется фиксированно относительно viewport — координаты передаются извне.
 * Потребляет готовый ViewModel от Presentation.
 */

import {createPortal} from 'react-dom';
import {useTranslation} from '@i18n/hooks';
import type {RelicViewModel} from '@presentation/types';
import {RichDescription} from './RichDescription';
import {usePopoverPosition} from './hooks/usePopoverPosition';

interface Props {
  /** Данные реликвии для отображения (готовый ViewModel). */
  relic: RelicViewModel;
  /** Управляет видимостью тултипа. */
  visible: boolean;
  /** Координата X курсора в viewport (используется как опорная точка). */
  x?: number;
  /** Координата Y курсора в viewport (используется как опорная точка). */
  y?: number;
}

export function RelicDetailPopover({ relic, visible, x, y }: Props) {
  const { t } = useTranslation('components');
  const ref = usePopoverPosition<HTMLDivElement>({ x, y, enabled: visible });

  if (!visible) {
    return null;
  }

  return createPortal(
    <div ref={ref} className="field-object-popover" role="tooltip">
      <div className="field-popover-card">
        <div className="field-popover-head">
          <span
            className={`item-detail-icon cm-inv-cell item-rarity-${relic.rarity}`}
            aria-hidden="true"
          >
            <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
              <img
                className="cm-sprite-stack__frame"
                src={relic.frameUrl}
                alt=""
                loading="lazy"
                decoding="async"
              />
              {relic.icon && (
                <img
                  className="cm-sprite-stack__body"
                  src={relic.icon}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="cm-sprite-fallback">
                {relic.fallback ?? '—'}
              </span>
            </span>
          </span>
          <span className="field-popover-name">{relic.name}</span>
        </div>

        {relic.effects.length > 0 && (
          <ul className="field-popover-effects">
            {relic.effects.map((effect) => (
              <li
                key={effect.key}
                className={`field-popover-effect field-popover-effect--${effect.polarity}`}
              >
                <RichDescription text={effect.text} />
              </li>
            ))}
          </ul>
        )}

        {relic.flavorText && (
          <p className="field-popover-flavor">{relic.flavorText}</p>
        )}

        {relic.count > 1 && (
          <div className="field-popover-stats">
            <span className="field-popover-stat">
              {t('relicsPanel.stackCount', { count: relic.count })}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
