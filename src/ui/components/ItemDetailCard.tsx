/**
 * Карточка предмета без позиционирования и портала.
 *
 * Используется внутри ItemDetailPopover и FieldObjectPopover.
 * Принимает готовый ItemDetailViewModel от Presentation.
 *
 * Порядок категорий: статы → уникальные свойства → случайные свойства →
 * скиллы → флейвор-описание → теги. Заголовков нет, категории разделяются
 * горизонтальной полосой.
 */

import {Fragment} from 'react';
import type {ReactNode} from 'react';
import {useTranslation} from '@i18n/hooks';
import type {ItemDetailViewModel} from '@presentation/types';
import {TagList} from './TagList';
import {RichDescription} from './RichDescription';

interface Props {
  item: ItemDetailViewModel;
}

export function ItemDetailCard({ item }: Props) {
  const { t } = useTranslation('components');
  const abilities = item.grantedAbilities;
  const poolAbilities = item.isTemplate ? item.abilityPool : null;
  const fixedProperties = item.properties?.filter((p) => p.origin === 'fixed') ?? [];
  const rolledProperties = item.properties?.filter((p) => p.origin === 'rolled') ?? [];

  // Категории в порядке отображения; пустые пропускаются.
  const categories: ReactNode[] = [];

  // 1. Основные параметры (урон/броня/эффект расходника) — значения жирным.
  const stats = item.sections.flatMap((section) => section.stats);
  if (stats.length > 0) {
    categories.push(
      <ul key="stats" className="item-detail-list item-detail-list-plain">
        {stats.map((stat, index) => (
          <li key={index}>
            {stat.label}: <strong>{stat.value}</strong>
          </li>
        ))}
      </ul>,
    );
  }

  // 2. Уникальные (фирменные) свойства шаблона.
  if (fixedProperties.length > 0) {
    categories.push(
      <ul key="fixed" className="item-detail-list item-detail-list-plain">
        {fixedProperties.map((property) => (
          <li key={property.key} className="item-detail-property item-detail-property--unique">
            <span className="item-detail-property__name">{property.name}</span>
            <span className="item-detail-property__desc">
              <RichDescription text={property.description} />
            </span>
          </li>
        ))}
      </ul>,
    );
  }

  // 3. Случайные свойства экземпляра — подсветка по полярности.
  if (rolledProperties.length > 0) {
    categories.push(
      <ul key="rolled" className="item-detail-list item-detail-list-plain">
        {rolledProperties.map((property) => (
          <li
            key={property.key}
            className={`item-detail-property item-detail-property--${property.polarity}`}
          >
            <span className="item-detail-property__name">{property.name}</span>
            <span className="item-detail-property__desc">
              <RichDescription text={property.description} />
            </span>
          </li>
        ))}
      </ul>,
    );
  }

  // 4. Скиллы: установленные на предмет, затем пул возможных (для карточки шаблона).
  const hasAbilities = abilities !== null && abilities !== undefined && abilities.length > 0;
  const hasPool = poolAbilities !== null && poolAbilities !== undefined && poolAbilities.length > 0;
  if (hasAbilities || hasPool) {
    categories.push(
      <div key="skills">
        {hasAbilities &&
          abilities!.map((ability) => (
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
        {hasPool && (
          <ul className="item-detail-list item-detail-list-plain">
            {poolAbilities!.map((ability) => (
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
                  <span className="item-detail-ability__name">
                    {ability.name}
                    <span className="item-detail-ability__pool-hint">{t('itemDetail.possibleSkillHint')}</span>
                  </span>
                  {ability.description && (
                    <span className="item-detail-ability__desc">
                      <RichDescription text={ability.description} />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>,
    );
  }

  // 5. Флейвор-описание предмета.
  if (item.description) {
    categories.push(
      <p key="flavor" className="item-detail-flavor">
        {item.description}
      </p>,
    );
  }

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

      {categories.map((category, index) => (
        <Fragment key={index}>
          {index > 0 && <hr className="item-detail-divider" />}
          {category}
        </Fragment>
      ))}

      {item.tags.length > 0 && (
        <div className="item-detail-tags">
          <TagList
            items={item.tags.map((tag, i) => ({ tag, label: item.tagLabels[i]! }))}
          />
        </div>
      )}
    </div>
  );
}
