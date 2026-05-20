/**
 * Игровой экран.
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel, EffectsPanel, LogPanel.
 * Центральная: GameField.
 * Правая: EquipmentPanel, InventoryPanel, ConsumablesPanel, SkillsPanel.
 */

import {useCallback, useState, useEffect, useRef, useSyncExternalStore} from 'react';
import type {GameSession, SessionMode} from '@presentation/gameSession';
import {ThreeColumnLayout} from '@ui/components/ThreeColumnLayout';
import {HeroPanel} from '@ui/components/HeroPanel';
import type {HeroStat} from '@ui/components/HeroPanel';
import {EquipmentPanel} from '@ui/components/EquipmentPanel';
import type {EquipSlotData} from '@ui/components/EquipmentPanel';
import {GameField} from '@ui/components/GameField';
import {EffectsPanel} from '@ui/components/EffectsPanel';
import {LogPanel} from '@ui/components/LogPanel';
import type {LogItem} from '@ui/components/LogPanel';
import {InventoryPanel} from '@ui/components/InventoryPanel';
import {ConsumablesPanel} from '@ui/components/ConsumablesPanel';
import {SkillsPanel} from '@ui/components/SkillsPanel';
import {StatRowReadonly} from '@ui/components/StatRow';
import {Panel} from '@ui/components/Panel';

interface Props {
  session: GameSession;
  onModeChange: (mode: SessionMode) => void;
}

const KEY_MAP: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  w: [0, -1],
  W: [0, -1],
  ц: [0, -1],
  Ц: [0, -1],
  ArrowDown: [0, 1],
  s: [0, 1],
  S: [0, 1],
  ы: [0, 1],
  Ы: [0, 1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  A: [-1, 0],
  ф: [-1, 0],
  Ф: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
  D: [1, 0],
  в: [1, 0],
  В: [1, 0],
};

const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function getSnapshot(session: GameSession) {
  return session.getViewModel();
}

function subscribe(session: GameSession, callback: () => void) {
  return session.subscribe(callback);
}

export function GameScreen({session, onModeChange}: Props) {
  const vm = useSyncExternalStore(
    (cb) => subscribe(session, cb),
    () => getSnapshot(session),
  );
  const state = vm.state;
  const [log, setLog] = useState<LogItem[]>([]);
  const nextLogId = useRef(1);

  const addLog = useCallback((message: string) => {
    setLog((prev) => {
      const next = [...prev.slice(-19), {id: nextLogId.current++, text: message}];
      return next;
    });
  }, []);

  const performMoveOrAttack = useCallback(
    (dx: number, dy: number) => {
      if (session.getMode() !== 'playing') return;
      session.moveOrAttack(dx, dy);
      onModeChange(session.getMode());
      addLog(`Действие: (${dx}, ${dy})`);
    },
    [session, onModeChange, addLog],
  );

  const handleWait = useCallback(() => {
    if (session.getMode() !== 'playing') return;
    session.dispatch({type: 'WAIT'});
    onModeChange(session.getMode());
    addLog('Ожидание');
  }, [session, onModeChange, addLog]);

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && INTERACTIVE_TAGS.has(target.tagName)) return;

      const delta = KEY_MAP[e.key];
      if (!delta) return;
      e.preventDefault();
      performMoveOrAttack(delta[0], delta[1]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performMoveOrAttack]);

  if (!state) {
    return (
      <ThreeColumnLayout variant="game" left={null} center={<div>Загрузка...</div>} right={null} />
    );
  }

  const player = state.player;
  const portraitImg = vm.portraitId
    ? `/assets/portraits/${vm.portraitId}-ready.png`
    : '/assets/portraits/witcher-ready.png';

  // Заглушки для данных, которых пока нет в симуляции
  const xp = (player as unknown as Record<string, number>).xp ?? 0;
  const xpToNext = 25;
  const level = (player as unknown as Record<string, number>).level ?? 1;
  const mana = (player as unknown as Record<string, number>).mana ?? 30;
  const maxMana = (player as unknown as Record<string, number>).maxMana ?? 30;

  const heroStats: HeroStat[] = [
    {type: 'readonly', icon: '💪', name: 'Сила', value: '0'},
    {type: 'readonly', icon: '✨', name: 'Интеллект', value: '0'},
    {type: 'readonly', icon: '🐾', name: 'Ловкость', value: '0'},
    {type: 'readonly', icon: '🍀', name: 'Удача', value: '0'},
    {type: 'readonly', icon: '🎯', name: 'Крит шанс', value: '5%'},
    {type: 'readonly', icon: '💥', name: 'Крит x', value: '1.5x'},
  ];

  const equipSlots: EquipSlotData[] = [
    {
      label: 'Оружие',
      icon: player.equippedWeaponId
        ? `/assets/items/${player.equippedWeaponId}.png`
        : undefined,
      fallback: '⚔',
      damage: player.equippedWeaponId ? 6 : null,
    },
    {
      label: 'Броня',
      icon: player.equippedArmorId
        ? `/assets/items/${player.equippedArmorId}.png`
        : undefined,
      fallback: '🛡',
    },
    {
      label: 'Амулет',
      fallback: '📿',
    },
  ];

  const leftColumn = (
    <>
      <HeroPanel
        portraitSrc={portraitImg}
        level={level}
        hp={player.hp}
        maxHp={player.maxHp}
        mana={mana}
        maxMana={maxMana}
        xp={xp}
        maxXp={xpToNext}
        stats={heroStats}
      />
      <Panel title="Характеристики">
        <ul className="cm-stats">
          <StatRowReadonly icon="💪" name="Сила" value="0" />
          <StatRowReadonly icon="✨" name="Интеллект" value="0" />
          <StatRowReadonly icon="🐾" name="Ловкость" value="0" />
          <StatRowReadonly icon="🍀" name="Удача" value="0" />
          <StatRowReadonly icon="🎯" name="Крит шанс" value="5%" />
          <StatRowReadonly icon="💥" name="Крит x" value="1.5x" />
        </ul>
      </Panel>
      <EffectsPanel />
      <LogPanel entries={log} />
    </>
  );

  const centerColumn = <GameField level={level} state={state} portraitId={vm.portraitId} lastResult={vm.lastResult} onWait={handleWait} />;

  const rightColumn = (
    <>
      <EquipmentPanel slots={equipSlots} />
      <InventoryPanel />
      <ConsumablesPanel />
      <SkillsPanel
        skills={[
          {icon: '/assets/skills/lunge.png', name: 'Выпад', mana: 8},
          {icon: '/assets/skills/cleave.png', name: 'Рассекающий удар', mana: 12},
          {icon: '/assets/skills/whirlwind.png', name: 'Вихрь', mana: 15},
          {icon: '/assets/skills/steel_stance.png', name: 'Стальная стойка', mana: 10},
          {icon: '/assets/skills/fireball.png', name: 'Огненный шар', mana: 14},
          {icon: '/assets/skills/ice_spike.png', name: 'Ледяной шип', mana: 12},
          {icon: '/assets/skills/chain_lightning.png', name: 'Цепная молния', mana: 18},
          {icon: '/assets/skills/shock_wave.png', name: 'Ударная волна', mana: 10},
          {icon: '/assets/skills/magic_slap.png', name: 'Волшебный хлёст', mana: 6},
          {icon: '/assets/skills/stone_wall.png', name: 'Каменная стена', mana: 16},
          {icon: '/assets/skills/supremacy.png', name: 'Верховенство', mana: 20},
        ]}
      />
    </>
  );

  return (
    <ThreeColumnLayout
      variant="game"
      left={leftColumn}
      center={centerColumn}
      right={rightColumn}
    />
  );
}
