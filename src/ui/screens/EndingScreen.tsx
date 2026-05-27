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
import type {PlayerStatsSnapshot, EquipmentSnapshot} from '@presentation/gameSession';
import type {RunStats} from '@simulation/types';

interface Props {
  result: 'defeat' | 'victory';
  onNewRun: () => void;
  onReturnToMenu?: () => void;
  portraitSrc?: string;
  playerStats?: PlayerStatsSnapshot;
  equipment?: EquipmentSnapshot;
  runStats?: RunStats;
  floor?: number;
  turnRound?: number;
}

const DEFEAT_BOSSES = [
  '🐈 Подвальный охотник',
  '👁 Слепой сторож',
  '🦴 Костяной мурчун',
  '👑 Кот-хозяин кладовки',
];

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function EndingScreen({result, onNewRun, onReturnToMenu, portraitSrc, playerStats, equipment, runStats, floor, turnRound}: Props) {
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

  const equipSlots: EquipSlotData[] = equipment
    ? [
        {label: 'Оружие', icon: equipment.weaponId ? `/assets/items/${equipment.weaponId}.png` : undefined, fallback: '⚔', damage: equipment.weaponDamage},
        {label: 'Броня', icon: equipment.armorId ? `/assets/items/${equipment.armorId}.png` : undefined, fallback: '🛡'},
        {label: 'Амулет', icon: equipment.amuletId ? `/assets/items/${equipment.amuletId}.png` : undefined, fallback: '📿'},
      ]
    : [
        {label: 'Оружие', fallback: '⚔'},
        {label: 'Броня', fallback: '🛡'},
        {label: 'Амулет', fallback: '📿'},
      ];

  const duration = runStats ? formatDuration(Date.now() - runStats.startTime) : '00:00';

  const metrics: MetricItem[] = [
    {label: 'Длительность', value: duration},
    {label: 'Ходов', value: String(turnRound ?? 0)},
    {label: 'Убито противников', value: String(runStats?.enemiesKilled ?? 0)},
    {label: 'Достигнут уровень лабиринта', value: String(floor ?? 1)},
    {label: 'Открыто сундуков', value: String(runStats?.chestsOpened ?? 0)},
    {label: 'Подобрано предметов', value: String(runStats?.itemsPickedUp ?? 0)},
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
