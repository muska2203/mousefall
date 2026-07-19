/**
 * Экран окончания забега (поражение или победа).
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel.
 * Центральная: EndingMetricsPanel.
 * Правая: EquipmentPanel, BossListPanel, EndingActionsPanel.
 */

import {useTranslation} from '@i18n/hooks';
import {ThreeColumnLayout} from '@ui/components/ThreeColumnLayout';
import type {HeroStat} from '@ui/components/HeroPanel';
import {HeroPanel} from '@ui/components/HeroPanel';
import type {EquipSlotData} from '@ui/components/EquipmentPanel';
import {EquipmentPanel} from '@ui/components/EquipmentPanel';
import type {MetricItem} from '@ui/components/EndingMetricsPanel';
import {EndingMetricsPanel} from '@ui/components/EndingMetricsPanel';
import {BossListPanel} from '@ui/components/BossListPanel';
import {EndingActionsPanel} from '@ui/components/EndingActionsPanel';
import type {EquipmentSnapshot, PlayerStatsSnapshot, RunStats} from '@presentation/gameSession';

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
  const { t } = useTranslation('screens');
  const isVictory = result === 'victory';
  const ps = playerStats;

  const heroStats: HeroStat[] = ps
    ? [
        {type: 'readonly', icon: '💪', name: t('ending.statStrength'), value: String(ps.effectiveStats.str)},
        {type: 'readonly', icon: '✨', name: t('ending.statIntelligence'), value: String(ps.effectiveStats.int)},
        {type: 'readonly', icon: '🐾', name: t('ending.statDexterity'), value: String(ps.effectiveStats.dex)},
        {type: 'readonly', icon: '❤️', name: t('ending.statVitality'), value: String(ps.effectiveStats.vit)},
      ]
    : [
        {type: 'readonly', icon: '💪', name: t('ending.statStrength'), value: '0'},
        {type: 'readonly', icon: '✨', name: t('ending.statIntelligence'), value: '0'},
        {type: 'readonly', icon: '🐾', name: t('ending.statDexterity'), value: '0'},
        {type: 'readonly', icon: '❤️', name: t('ending.statVitality'), value: '0'},
      ];

  const equipSlots: EquipSlotData[] = equipment
    ? [
        {label: t('ending.slotWeapon'), icon: equipment.weaponId ? `/assets/items/${equipment.weaponId}.png` : undefined, fallback: '⚔', damage: equipment.weaponDamage, slotType: 'weapon', instanceId: equipment.weaponInstanceId},
        {label: t('ending.slotArmor'), icon: equipment.armorId ? `/assets/items/${equipment.armorId}.png` : undefined, fallback: '🛡', slotType: 'armor', instanceId: equipment.armorInstanceId},
        {label: t('ending.slotAmulet'), icon: equipment.amuletId ? `/assets/items/${equipment.amuletId}.png` : undefined, fallback: '📿', slotType: 'amulet', instanceId: equipment.amuletInstanceId},
      ]
    : [
        {label: t('ending.slotWeapon'), fallback: '⚔', slotType: 'weapon', instanceId: null},
        {label: t('ending.slotArmor'), fallback: '🛡', slotType: 'armor', instanceId: null},
        {label: t('ending.slotAmulet'), fallback: '📿', slotType: 'amulet', instanceId: null},
      ];

  const duration = runStats ? formatDuration(Date.now() - runStats.startTime) : '00:00';

  const metrics: MetricItem[] = [
    {label: t('ending.duration'), value: duration},
    {label: t('ending.turns'), value: String(turnRound ?? 0)},
    {label: t('ending.enemiesKilled'), value: String(runStats?.enemiesKilled ?? 0)},
    {label: t('ending.maxFloorReached'), value: String(floor ?? 1)},
    {label: t('ending.chestsOpened'), value: String(runStats?.chestsOpened ?? 0)},
    {label: t('ending.itemsCollected'), value: String(runStats?.itemsPickedUp ?? 0)},
  ];

  const leftColumn = (
    <HeroPanel
      title={t('ending.heroCardTitle')}
      portraitSrc={portraitSrc ?? '/assets/portraits/witcher-ready.png'}
      level={ps?.level ?? 1}
      hp={ps?.hp ?? 0}
      maxHp={ps?.maxHp ?? 100}
      ap={ps?.ap}
      maxAp={ps?.maxAp}
      xp={ps?.xp ?? 0}
      stats={heroStats}
    />
  );

  const centerColumn = (
    <EndingMetricsPanel
      status={result}
      subtitle={
        isVictory
          ? t('ending.victorySubtitle')
          : t('ending.defeatSubtitle')
      }
      metrics={metrics}
    />
  );

  const rightColumn = (
    <>
      <EquipmentPanel title={t('ending.equipmentTitle')} slots={equipSlots} />
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
