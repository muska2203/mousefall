/**
 * Игровой экран.
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel, EffectsPanel, LogPanel.
 * Центральная: GameField.
 * Правая: EquipmentPanel, InventoryPanel, SkillsPanel.
 */

import {useCallback, useEffect, useSyncExternalStore, useState} from 'react';
import { useTranslation } from '@i18n/hooks';
import {GameSession, type SessionMode} from '@presentation/gameSession';

import {KEY_MAP, INTERACTIVE_TAGS} from '@ui/input/keyboardMap';
import {ThreeColumnLayout} from '@ui/components/ThreeColumnLayout';
import {HeroPanel} from '@ui/components/HeroPanel';
import {EquipmentPanel} from '@ui/components/EquipmentPanel';
import {GameField} from '@ui/components/GameField';
import {EffectsPanel} from '@ui/components/EffectsPanel';
import {LogPanel} from '@ui/components/LogPanel';
import {InventoryPanel} from '@ui/components/InventoryPanel';
import {SkillsPanel} from '@ui/components/SkillsPanel';
import {FieldObjectPopover} from '@ui/components/FieldObjectPopover';

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
  const [fieldHoverPos, setFieldHoverPos] = useState<{x: number; y: number} | null>(null);

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
    session.dispatch({type: 'WAIT', entityId: 'player'});
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

  const handlePickup = useCallback(() => {
    if (session.getMode() !== 'playing') return;
    if (isInputBlocked) return;
    session.dispatch({type: 'PICKUP', entityId: 'player'});
    onModeChange(session.getMode());
  }, [session, onModeChange, isInputBlocked]);

  const handleEquipItem = useCallback(
    (itemInstanceId: string) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.dispatch({type: 'EQUIP', entityId: 'player', itemInstanceId});
      onModeChange(session.getMode());
    },
    [session, onModeChange, isInputBlocked],
  );

  const handleUnequip = useCallback(
    (slot: 'weapon' | 'armor' | 'amulet') => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.dispatch({type: 'UNEQUIP', entityId: 'player', slot});
      onModeChange(session.getMode());
    },
    [session, onModeChange, isInputBlocked],
  );

  const handleUseItem = useCallback(
    (itemInstanceId: string) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.dispatch({type: 'USE_ITEM', entityId: 'player', itemInstanceId});
      onModeChange(session.getMode());
    },
    [session, onModeChange, isInputBlocked],
  );

  const handleZoom = useCallback(
    (delta: number) => {
      session.setZoom(delta);
    },
    [session],
  );

  const handleSkillClick = useCallback(
    (abilityId: string) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.beginTargeting(abilityId);
    },
    [session, isInputBlocked],
  );

  const handleMouseMove = useCallback(
    (pos: {x: number; y: number}) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.previewTarget(pos);
      session.setFieldHover(pos);
    },
    [session, isInputBlocked],
  );

  const handleMouseMoveScreen = useCallback(
    (pos: {screenX: number; screenY: number}) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      if (session.isTargeting()) return;
      setFieldHoverPos({x: pos.screenX, y: pos.screenY});
    },
    [session, isInputBlocked],
  );

  const handleMouseLeave = useCallback(() => {
    session.setFieldHover(null);
    setFieldHoverPos(null);
  }, [session]);

  const handleMouseClick = useCallback(
    (pos: {x: number; y: number}) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.submitTarget(pos);
    },
    [session, isInputBlocked],
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
      if (e.key === 'Unidentified') return;
      const target = e.target as HTMLElement | null;
      if (target && INTERACTIVE_TAGS.has(target.tagName)) return;

      // Отмена таргетинга
      if (e.key === 'Escape') {
        e.preventDefault();
        session.cancelTargeting();
        return;
      }

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

      // Пробел: WAIT (пропуск хода). В режиме таргетинга — отмена таргетинга.
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (session.isTargeting()) {
          session.cancelTargeting();
        } else {
          handleWait();
        }
        return;
      }

      // G: поднять предмет
      if (e.key === 'g' || e.key === 'G' || e.key === 'п' || e.key === 'П') {
        e.preventDefault();
        handlePickup();
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
  }, [performMoveOrAttack, handlePickup, handleDescend, handleAscend, session]);

  const { t } = useTranslation('screens');

  if (!renderInput) {
    return (
      <ThreeColumnLayout variant="game" left={null} center={<div>{t('game.loading')}</div>} right={null} />
    );
  }

  const ps = renderInput.playerStats;
  const portraitImg = GameSession.getPlayerPortraitSrc(renderInput.state.player.templateId) ?? '/assets/portraits/witcher-ready.png';



  const leftColumn = (
    <>
      <HeroPanel
        portraitSrc={portraitImg}
        level={ps.level}
        hp={ps.hp}
        maxHp={ps.maxHp}
        ap={ps.ap}
        maxAp={ps.maxAp}
        xp={ps.xp}
        stats={renderInput.heroStats}
      />
      <EffectsPanel effects={renderInput.activeEffects} />
      <LogPanel entries={vm.logs} />
    </>
  );

  const centerColumn = (
    <>
      <GameField
        floor={renderInput.state.floor}
        renderInput={renderInput}
        onWait={handleWait}
        onAnimationsComplete={() => session.onAnimationsComplete()}
        onZoomDelta={handleZoom}
        onMouseMove={handleMouseMove}
        onMouseClick={handleMouseClick}
        onMouseMoveScreen={handleMouseMoveScreen}
        onMouseLeave={handleMouseLeave}
      />
      {renderInput.fieldObjectPopover && fieldHoverPos && (
        <FieldObjectPopover
          popover={renderInput.fieldObjectPopover}
          visible={true}
          x={fieldHoverPos.x + 16}
          y={fieldHoverPos.y + 16}
        />
      )}
    </>
  );

  const rightColumn = (
    <>
      <EquipmentPanel
        slots={renderInput.equipSlots}
        onUnequip={handleUnequip}
      />
      <InventoryPanel
        items={renderInput.inventory}
        onItemClick={(instanceId) => session.interactWithItem(instanceId)}
      />
      <SkillsPanel
        skills={renderInput.playerSkills}
        onSkillClick={(abilityId) => {
          session.beginTargeting(abilityId);
        }}
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
