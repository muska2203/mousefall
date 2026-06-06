/**
 * Карточка предмета без позиционирования и портала.
 *
 * Используется внутри ItemDetailPopover и FieldObjectPopover.
 * Принимает готовый ItemDetailViewModel от Presentation.
 */

import { useTranslation } from '@i18n/hooks';
import type { ItemDetailViewModel } from '@presentation/itemDetailMapper';

interface Props {
  item: ItemDetailViewModel;
}

export function ItemDetailCard({ item }: Props) {
  const { t } = useTranslation('components');
  const abilities = item.grantedAbilities;

  return (
    <div className={`item-detail-card item-detail-rarity-${item.rarity}`}>
      <header className="item-detail-head">
        <span className="item-detail-rarity">{item.rarityLabel}</span>
        <span className="item-detail-type">{item.typeLabel}</span>
        {item.stackCount !== undefined && item.stackCount > 1 && (
          <span className="item-detail-stack-pill">{item.stackCount}</span>
        )}
      </header>

      <div className="item-detail-title-row">
        <span
          className={`item-detail-icon cm-inv-cell item-rarity-${item.rarity}`}
          aria-hidden="true"
        >
          <span className="cm-sprite-stack cm-sprite-stack--item" aria-hidden="true">
            <img
              className="cm-sprite-stack__frame"
              src={item.frameUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <img
              className="cm-sprite-stack__body"
              src={item.icon}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className="cm-sprite-fallback">
              {item.fallbackIcon ?? '—'}
            </span>
          </span>
        </span>
        <span className="item-detail-name">{item.name}</span>
      </div>

      {abilities && abilities.length > 0 && (
        <div className="item-detail-section">
          <h4 className="item-detail-section-title">{t('itemDetail.itemSkillsTitle')}</h4>
          {abilities.map((ability) => (
            <div className="item-detail-ability" key={ability.templateId}>
              {ability.icon && (
                <img
                  className="item-detail-ability__icon"
                  src={ability.icon}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="item-detail-ability__name">{ability.name}</span>
              <span className="item-detail-ability__level">{t('itemDetail.abilityLevelPrefix')}{ability.level}</span>
            </div>
          ))}
        </div>
      )}

      {item.abilityPool && item.abilityPool.length > 0 && (
        <div className="item-detail-section">
          <h4 className="item-detail-section-title">{t('itemDetail.possibleSkillsTitle')}</h4>
          <ul className="item-detail-list item-detail-list-plain">
            {item.abilityPool.map((ability) => (
              <li key={ability.abilityId} className="item-detail-ability item-detail-ability--pool">
                {ability.icon && (
                  <img
                    className="item-detail-ability__icon"
                    src={ability.icon}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="item-detail-ability__info">
                  <span className="item-detail-ability__name">{ability.name}</span>
                  {ability.description && (
                    <span className="item-detail-ability__desc">{ability.description}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.sections.map((section, index) => {
        if (section.kind === 'stat-list') {
          return (
            <div className="item-detail-section" key={index}>
              <h4 className="item-detail-section-title">{section.title}</h4>
              <ul className="item-detail-list item-detail-list-plain">
                {section.stats.map((stat, sIndex) => (
                  <li key={sIndex}>
                    {stat.label}: <strong>{stat.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (section.kind === 'description') {
          return (
            <div className="item-detail-section" key={index}>
              <h4 className="item-detail-section-title">{t('itemDetail.descriptionTitle')}</h4>
              <p className="item-detail-desc">{section.text}</p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
