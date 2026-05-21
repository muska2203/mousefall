/**
 * Игровой экран.
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel, EffectsPanel, LogPanel.
 * Центральная: GameField.
 * Правая: EquipmentPanel, InventoryPanel, ConsumablesPanel, SkillsPanel.
 */

import {useCallback, useEffect, useSyncExternalStore} from 'react';
import type {GameSession, SessionMode} from '@presentation/gameSession';
import {KEY_MAP, INTERACTIVE_TAGS} from '@ui/input/keyboardMap';
import {ThreeColumnLayout} from '@ui/components/ThreeColumnLayout';
import {HeroPanel} from '@ui/components/HeroPanel';
import type {HeroStat} from '@ui/components/HeroPanel';
import {EquipmentPanel} from '@ui/components/EquipmentPanel';
import type {EquipSlotData} from '@ui/components/EquipmentPanel';
import {GameField} from '@ui/components/GameField';
import {EffectsPanel} from '@ui/components/EffectsPanel';
import {LogPanel} from '@ui/components/LogPanel';
import {InventoryPanel} from '@ui/components/InventoryPanel';
import {ConsumablesPanel} from '@ui/components/ConsumablesPanel';
import {SkillsPanel} from '@ui/components/SkillsPanel';

interface Props {
  session: GameSession;
  onModeChange: (mode: SessionMode) => void;
}



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
  const renderInput = vm.renderInput;

  const isInputBlocked = renderInput?.phase === 'animating';

  const performMoveOrAttack = useCallback(
    (dx: number, dy: number) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.moveOrAttack(dx, dy);
      onModeChange(session.getMode());
    },
    [session, onModeChange, isInputBlocked],
  );

  const handleWait = useCallback(() => {
    if (session.getMode() !== 'playing') return;
    if (isInputBlocked) return;
    session.dispatch({type: 'WAIT'});
    onModeChange(session.getMode());
  }, [session, onModeChange, isInputBlocked]);

  const handleDescend = useCallback(() => {
    if (session.getMode() !== 'playing') return;
    if (isInputBlocked) return;
    session.dispatch({type: 'DESCEND', entityId: 'player'});
    onModeChange(session.getMode());
  }, [session, onModeChange, isInputBlocked]);

  const handleAscend = useCallback(() => {
    if (session.getMode() !== 'playing') return;
    if (isInputBlocked) return;
    session.dispatch({type: 'ASCEND', entityId: 'player'});
    onModeChange(session.getMode());
  }, [session, onModeChange, isInputBlocked]);

  const handleZoom = useCallback(
    (delta: number) => {
      session.setZoom(delta);
    },
    [session],
  );

  // Синхронизация режима с App.tsx (важно при автоходе и смерти)
  const currentMode = session.getMode();
  useEffect(() => {
    if (currentMode !== 'playing') {
      onModeChange(currentMode);
    }
  }, [currentMode, onModeChange]);

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && INTERACTIVE_TAGS.has(target.tagName)) return;

      // Спуск / подъём по лестнице (ручное управление)
      if (e.key === '>' || e.key === '.') {
        e.preventDefault();
        handleDescend();
        return;
      }
      if (e.key === '<' || e.key === ',') {
        e.preventDefault();
        handleAscend();
        return;
      }

      const delta = KEY_MAP[e.key];
      if (!delta) return;
      e.preventDefault();
      session.setHeldDirection(delta[0], delta[1]);
      performMoveOrAttack(delta[0], delta[1]);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const delta = KEY_MAP[e.key];
      if (!delta) return;
      session.clearHeldDirection();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [performMoveOrAttack]);

  if (!renderInput) {
    return (
      <ThreeColumnLayout variant="game" left={null} center={<div>Загрузка...</div>} right={null} />
    );
  }

  const player = renderInput.state.player;
  const portraitImg = renderInput.portraitId
    ? `/assets/portraits/${renderInput.portraitId}-ready.png`
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
      <EffectsPanel />
      <LogPanel entries={vm.logs} />
    </>
  );

  const centerColumn = (
    <GameField
      level={level}
      renderInput={renderInput}
      onWait={handleWait}
      onAnimationsComplete={() => session.onAnimationsComplete()}
      onZoomDelta={handleZoom}
    />
  );

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
