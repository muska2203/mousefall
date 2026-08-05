/**
 * Панель героя: портрет, бары ресурсов, список характеристик.
 *
 * Используется в GameScreen (readonly) и CharacterCreationScreen (с распределением очков).
 * EndingScreen использует ту же структуру.
 */

import {type ReactNode} from 'react';
import {useTranslation} from '@i18n/hooks';
import {Panel} from './Panel';
import {Portrait} from './Portrait';
import {ResourceBar} from './ResourceBar';
import {StatRow, StatRowReadonly} from './StatRow';

export type HeroStat =
  | {
      type: 'alloc';
      icon: string;
      name: string;
      value: number;
      onChange: (v: number) => void;
      canIncrease: boolean;
      /** Минимально допустимое значение характеристики. */
      min?: number;
      /** Краткое шуточное описание для тултипа. */
      flavorText?: string;
      /** Строки с подробным описанием влияния для тултипа. */
      detailLines?: string[];
    }
  | {
      type: 'readonly';
      icon: string;
      name: string;
      value: string;
      /** Краткое шуточное описание для тултипа. */
      flavorText?: string;
      /** Строки с подробным описанием влияния для тултипа. */
      detailLines?: string[];
    };

interface Props {
  title?: string;
  portraitSrc: string;
  portraitAlt?: string;
  hp: number;
  maxHp: number;
  ap?: number;
  maxAp?: number;
  stats: HeroStat[];
  children?: ReactNode;
  fill?: boolean;
}

export function HeroPanel({
  title,
  portraitSrc,
  portraitAlt,
  hp,
  maxHp,
  ap,
  maxAp,
  stats,
  children,
  fill = true,
}: Props) {
  const { t } = useTranslation('components');
  const { t: tc } = useTranslation('common');
  const hasAlloc = stats.some((s) => s.type === 'alloc');

  return (
    <Panel title={title ?? t('heroPanel.title')} titleId="hero-title" fill={fill} className="cm-panel--hero">
      <Portrait src={portraitSrc} alt={portraitAlt ?? t('heroPanel.portraitAlt')} size={112} />
      {ap != null && maxAp != null && maxAp > 0 && (
        <ResourceBar type="ap" icon="/assets/icons/ap.svg" label={tc('game.ap')} current={ap} max={maxAp} />
      )}
      <ResourceBar type="hp" icon="/assets/icons/hp.svg" label={tc('game.hp')} current={hp} max={maxHp} />
      {children}
      <ul className={`cm-stats ${hasAlloc ? 'cm-stats--alloc' : ''}`}>
        {stats.map((stat, i) =>
          stat.type === 'alloc' ? (
            <StatRow
              key={`${stat.name}-${i}`}
              icon={stat.icon}
              name={stat.name}
              value={stat.value}
              onChange={stat.onChange}
              canIncrease={stat.canIncrease}
              min={stat.min}
              flavorText={stat.flavorText}
              detailLines={stat.detailLines}
            />
          ) : (
            <StatRowReadonly
              key={`${stat.name}-${i}`}
              icon={stat.icon}
              name={stat.name}
              value={stat.value}
              flavorText={stat.flavorText}
              detailLines={stat.detailLines}
            />
          ),
        )}
      </ul>
    </Panel>
  );
}
