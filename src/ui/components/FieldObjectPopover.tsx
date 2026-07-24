/**
 * Popover объекта на игровом поле.
 *
 * Показывается при наведении на клетку с врагом, предметом или лестницей
 * в обычном режиме (фаза хода игрока, без таргетинга и анимаций).
 *
 * Позиционируется фиксированно относительно viewport — координаты передаются извне.
 * Внутри переключает карточку в зависимости от типа объекта.
 */

import {createPortal} from 'react-dom';
import {useTranslation} from '@i18n/hooks';
import type {FieldObjectPopoverViewModel} from '@presentation/types';
import {ItemDetailCard} from './ItemDetailCard';
import {usePopoverPosition} from './hooks/usePopoverPosition';

interface Props {
  popover: FieldObjectPopoverViewModel;
  visible: boolean;
  x?: number;
  y?: number;
}

export function FieldObjectPopover({ popover, visible, x, y }: Props) {
  const { t } = useTranslation('components');
  const ref = usePopoverPosition<HTMLDivElement>({ x, y, enabled: visible });

  if (!visible) {
    return null;
  }

  return createPortal(
    <div ref={ref} className="field-object-popover" role="tooltip">
      {popover.kind === 'enemy' && (
        <div className="field-popover-card">
          <div className="field-popover-head">
            <img
              className="field-popover-sprite"
              src={popover.data.sprite}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className="field-popover-name">{popover.data.name}</span>
          </div>

          {popover.data.flavorText && (
            <p className="field-popover-flavor">{popover.data.flavorText}</p>
          )}

          <div className="field-popover-stats">
            <span className="field-popover-stat">
              {t('fieldObjectPopover.damageLabel')}<strong>{popover.data.damage}</strong>
            </span>
            <span className="field-popover-stat">
              {t('fieldObjectPopover.hpLabel')}<strong>{popover.data.hp}</strong> / {popover.data.maxHp}
            </span>
          </div>

          {popover.data.skills.length > 0 && (
            <div className="field-popover-section">
              <h4 className="field-popover-section-title">{t('fieldObjectPopover.skillsTitle')}</h4>
              <ul className="field-popover-list field-popover-list-plain">
                {popover.data.skills.map((skill, i) => (
                  <li key={i} className="field-popover-skill">
                    {skill.icon && (
                      <img
                        className="field-popover-skill__icon"
                        src={skill.icon}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <span className="field-popover-skill__name">{skill.name}</span>
                    {skill.maxCooldown > 0 && (
                      <span className="field-popover-skill__cooldown">
                        {skill.cooldown > 0 ? `${skill.cooldown}${t('fieldObjectPopover.cooldownSuffix')}` : t('fieldObjectPopover.cooldownReady')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {popover.data.preparingAbility && (
            <div className="field-popover-section">
              <h4 className="field-popover-section-title">{t('fieldObjectPopover.preparingTitle')}</h4>
              <div className="field-popover-skill">
                {popover.data.preparingAbility.icon && (
                  <img
                    className="field-popover-skill__icon"
                    src={popover.data.preparingAbility.icon}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span className="field-popover-skill__name">{popover.data.preparingAbility.name}</span>
              </div>
            </div>
          )}

          {popover.data.loot.length > 0 && (
            <div className="field-popover-section">
              <h4 className="field-popover-section-title">{t('fieldObjectPopover.possibleLootTitle')}</h4>
              <ul className="field-popover-list field-popover-list-plain">
                {popover.data.loot.map((lootItem, i) => (
                  <li key={i} className="field-popover-loot">
                    {lootItem.icon && (
                      <img
                        className="field-popover-loot__icon"
                        src={lootItem.icon}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <span className="field-popover-loot__name">{lootItem.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {popover.kind === 'item' && <ItemDetailCard item={popover.data} />}

      {popover.kind === 'door' && (
        <div className="field-popover-card">
          <div className="field-popover-head">
            <img
              className="field-popover-sprite"
              src={popover.data.sprite}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className="field-popover-name">{popover.data.name}</span>
          </div>

          {popover.data.flavorText && (
            <p className="field-popover-flavor">{popover.data.flavorText}</p>
          )}

          <div className="field-popover-stats">
            <span className="field-popover-stat">
              {t('fieldObjectPopover.hpLabel')}<strong>{popover.data.hp}</strong> / {popover.data.maxHp}
            </span>
            <span className="field-popover-stat">
              {t('fieldObjectPopover.armorLabel')}<strong>{popover.data.armor}</strong>
            </span>
          </div>
        </div>
      )}

      {popover.kind === 'stairs' && (
        <div className="field-popover-card">
          <div className="field-popover-head">
            <img
              className="field-popover-sprite"
              src={popover.data.sprite}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className="field-popover-name">{popover.data.name}</span>
          </div>

          {popover.data.flavorText && (
            <p className="field-popover-flavor">{popover.data.flavorText}</p>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
