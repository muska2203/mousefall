/**
 * Универсальный трёхколоночный лейаут для всех экранов игры.
 *
 * Используется в:
 * - CharacterCreationScreen (variant: 'default')
 * - GameScreen (variant: 'game')
 * - EndingScreen (variant: 'ending')
 */

import {type ReactNode} from 'react';
import {MetaFooter} from './MetaFooter';

interface Props {
  /** Вариант лейаута: влияет на CSS-классы контейнера */
  variant?: 'default' | 'game' | 'ending';
  /** Содержимое левой колонки */
  left: ReactNode;
  /** Содержимое центральной колонки */
  center: ReactNode;
  /** Содержимое правой колонки */
  right: ReactNode;
  /** Показывать ли футер (по умолчанию — да) */
  showFooter?: boolean;
}

export function ThreeColumnLayout({
  variant = 'default',
  left,
  center,
  right,
  showFooter = true,
}: Props) {
  const appClass =
    variant === 'game'
      ? 'cm-app cm-app--game'
      : variant === 'ending'
        ? 'cm-app cm-ending-app'
        : 'cm-app';

  const mainClass =
    variant === 'ending'
      ? 'cm-main cm-ending-main'
      : variant === 'game'
        ? 'cm-main cm-main--game'
        : 'cm-main';

  return (
    <div className={appClass}>
      <div className={mainClass}>
        <aside className="cm-col cm-col--left">{left}</aside>
        <main className="cm-col cm-col--center">{center}</main>
        <aside className="cm-col cm-col--right">{right}</aside>
      </div>
      {showFooter && <MetaFooter />}
    </div>
  );
}
