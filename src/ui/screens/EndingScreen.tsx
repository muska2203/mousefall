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
import type {PlayerStatsSnapshot} from '@presentation/gameSession';

interface Props {
  result: 'defeat' | 'victory';
  onNewRun: () => void;
  onReturnToMenu?: () => void;
  portraitSrc?: string;
  playerStats?: PlayerStatsSnapshot;
}

const DEFEAT_BOSSES = [
  '🐈 Подвальный охотник',
  '👁 Слепой сторож',
  '🦴 Костяной мурчун',
  '👑 Кот-хозяин кладовки',
];

export function EndingScreen({result, onNewRun, onReturnToMenu, portraitSrc, playerStats}: Props) {
  const isVictory = result === 'victory';
  const ps = playerStats;

  const heroStats: HeroStat[] = ps
    ? [
        {type: 'readonly', icon: '💪', name: 'Сила', value: String(ps.effectiveStats.str)},
        {type: 'readonly', icon: '✨', name: 'Интеллект', value: String(ps.effectiveStats.int)},
        {type: 'readonly', icon: '🐾', name: 'Ловкость', value: String(ps.effectiveStats.dex)},
        {type: 'readonly', icon: '❤️', name: 'Выносливость', value: String(ps.effectiveStats.vit)},
      ]
    : [
        {type: 'readonly', icon: '💪', name: 'Сила', value: '0'},
        {type: 'readonly', icon: '✨', name: 'Интеллект', value: '0'},
        {type: 'readonly', icon: '🐾', name: 'Ловкость', value: '0'},
        {type: 'readonly', icon: '❤️', name: 'Выносливость', value: '0'},
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
      level={ps?.level ?? 1}
      hp={ps?.hp ?? 0}
      maxHp={ps?.maxHp ?? 100}
      mana={ps?.mp ?? 30}
      maxMana={ps?.maxMp ?? 30}
      xp={ps?.xp ?? 0}
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
