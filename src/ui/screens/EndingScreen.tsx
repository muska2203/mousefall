/**
 * Экран окончания забега (поражение или победа).
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel.
 * Центральная: EndingMetricsPanel.
 * Правая: EquipmentPanel, BossListPanel, EndingActionsPanel.
 */

import {ThreeColumnLayout} from '@ui/components/ThreeColumnLayout';
import {HeroPanel} from '@ui/components/HeroPanel';
import type {HeroStat} from '@ui/components/HeroPanel';
import {EquipmentPanel} from '@ui/components/EquipmentPanel';
import type {EquipSlotData} from '@ui/components/EquipmentPanel';
import {EndingMetricsPanel} from '@ui/components/EndingMetricsPanel';
import type {MetricItem} from '@ui/components/EndingMetricsPanel';
import {BossListPanel} from '@ui/components/BossListPanel';
import {EndingActionsPanel} from '@ui/components/EndingActionsPanel';

interface Props {
  result: 'defeat' | 'victory';
  onNewRun: () => void;
  onReturnToMenu?: () => void;
  portraitSrc?: string;
}

const DEFEAT_BOSSES = [
  '🐈 Подвальный охотник',
  '👁 Слепой сторож',
  '🦴 Костяной мурчун',
  '👑 Кот-хозяин кладовки',
];

export function EndingScreen({result, onNewRun, onReturnToMenu, portraitSrc}: Props) {
  const isVictory = result === 'victory';

  const heroStats: HeroStat[] = [
    {type: 'readonly', icon: '💪', name: 'Сила', value: '0'},
    {type: 'readonly', icon: '✨', name: 'Интеллект', value: '0'},
    {type: 'readonly', icon: '🐾', name: 'Ловкость', value: '0'},
    {type: 'readonly', icon: '🍀', name: 'Удача', value: '0'},
    {type: 'readonly', icon: '🎯', name: 'Крит шанс', value: '5%'},
    {type: 'readonly', icon: '💥', name: 'Крит x', value: '1.5x'},
  ];

  const equipSlots: EquipSlotData[] = [
    {label: 'Оружие', fallback: '⚔'},
    {label: 'Броня', fallback: '🛡'},
    {label: 'Амулет', fallback: '📿'},
  ];

  const metrics: MetricItem[] = [
    {label: 'Длительность', value: '00:00'},
    {label: 'Ходов', value: '0'},
    {label: 'Убито противников', value: '0'},
    {label: 'Достигнут уровень лабиринта', value: '1'},
    {label: 'Открыто сундуков', value: '0'},
    {label: 'Подобрано предметов', value: '0'},
  ];

  const leftColumn = (
    <HeroPanel
      title="Карточка героя"
      portraitSrc={portraitSrc ?? '/assets/portraits/witcher-ready.png'}
      level={1}
      hp={0}
      maxHp={100}
      mana={30}
      maxMana={30}
      xp={0}
      maxXp={25}
      stats={heroStats}
    />
  );

  const centerColumn = (
    <EndingMetricsPanel
      status={result}
      subtitle={
        isVictory
          ? 'Все противники повержены, забег завершен успешно.'
          : 'HP опустилось до нуля, забег завершен.'
      }
      metrics={metrics}
    />
  );

  const rightColumn = (
    <>
      <EquipmentPanel title="Снаряжение" slots={equipSlots} />
      <BossListPanel bosses={DEFEAT_BOSSES} />
      <EndingActionsPanel onNewRun={onNewRun} onReturnToMenu={onReturnToMenu} />
    </>
  );

  return (
    <ThreeColumnLayout
      variant="ending"
      left={leftColumn}
      center={centerColumn}
      right={rightColumn}
    />
  );
}
