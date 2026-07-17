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
import type {AnimationNode} from '@presentation/types';
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
import {ToastContainer} from '@ui/components/ToastContainer';
import {DebugPanel, type SpawnType} from '@ui/components/DebugPanel';

interface Props {
  session: GameSession;
  onModeChange: (mode: SessionMode) => void;
}

/** Преобразует нажатую цифру в индекс слота хотбара (1→0, ..., 9→8, 0→9). */
function keyToHotbarIndex(key: string): number {
  if (key >= '1' && key <= '9') return Number(key) - 1;
  if (key === '0') return 9;
  return -1;
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
  const [tileHoverPos, setTileHoverPos] = useState<{x: number; y: number} | null>(null);
  const [pendingDebugSpawn, setPendingDebugSpawn] = useState<{spawnType: SpawnType; templateId: string} | null>(null);

  const performMoveOrAttack = useCallback(
    (dx: number, dy: number) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.moveOrAttack(dx, dy);
      onModeChange(session.getMode());
    },
    [session, onModeChange, isInputBlocked],
  );

  const handleEndTurn = useCallback(() => {
    if (session.getMode() !== 'playing') return;
    if (isInputBlocked) return;
    const playerId = session.getViewModel().renderInput?.state.player.id;
    if (!playerId) return;
    session.dispatch({type: 'END_TURN', entityId: playerId});
    onModeChange(session.getMode());
  }, [session, onModeChange, isInputBlocked]);

  const handleAnimationNodeComplete = useCallback(
    (node: AnimationNode) => {
      if (node.patch) {
        session.applyAnimationPatch(node.patch);
      }
      if (node.patches && node.patches.length > 0) {
        session.applyAnimationPatches(node.patches);
      }
    },
    [session],
  );

  const handleInteract = useCallback(() => {
    if (session.getMode() !== 'playing') return;
    if (isInputBlocked) return;
    session.performSelectedInteraction();
    onModeChange(session.getMode());
  }, [session, onModeChange, isInputBlocked]);

  const handleCycleInteraction = useCallback(() => {
    if (session.getMode() !== 'playing') return;
    if (isInputBlocked) return;
    session.cycleInteraction(1);
  }, [session, isInputBlocked]);

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

  const handleItemClick = useCallback(
    (itemInstanceId: string) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.interactWithItem(itemInstanceId);
    },
    [session, isInputBlocked],
  );

  const handleZoom = useCallback(
    (delta: number) => {
      session.setZoom(delta);
    },
    [session],
  );

  const handleDismissToast = useCallback(
    (id: string) => {
      session.dismissToast(id);
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

  const handleHotbarClick = useCallback(
    (index: number) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      session.activateHotbarSlot(index);
    },
    [session, isInputBlocked],
  );

  const handleMouseMove = useCallback(
    (pos: {x: number; y: number}) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;
      setTileHoverPos(pos);
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

  const handleCameraHoverMove = useCallback(
    (tile: {x: number; y: number}, screen: {screenX: number; screenY: number}) => {
      if (session.getMode() !== 'playing') return;
      setTileHoverPos(tile);
      session.setFieldHover(tile);
      setFieldHoverPos({x: screen.screenX, y: screen.screenY});
    },
    [session],
  );

  const handleMouseLeave = useCallback(() => {
    session.setFieldHover(null);
    setFieldHoverPos(null);
    setTileHoverPos(null);
  }, [session]);

  const handleMouseClick = useCallback(
    (pos: {x: number; y: number}) => {
      if (session.getMode() !== 'playing') return;
      if (isInputBlocked) return;

      if (pendingDebugSpawn && import.meta.env.DEV) {
        session.debugSpawnEntity(pendingDebugSpawn.spawnType, pendingDebugSpawn.templateId, pos);
        setPendingDebugSpawn(null);
        return;
      }

      if (session.isTargeting()) {
        session.submitTarget(pos);
      } else {
        session.handleFieldClick(pos);
      }
    },
    [session, isInputBlocked, pendingDebugSpawn],
  );

  // Нажатие мыши отменяет только зафиксированный автопуть.
  // Preview не трогаем, чтобы нажатия мыши не гасили превью.
  // Если отмена происходит во время анимации, передаём blockFollowingClick=true,
  // чтобы отпускание кнопки не начало новый автопуть. Если committed-пути нет,
  // передаём false — это сбрасывает защиту и позволяет текущему клику сработать.
  // Защита реализована в GameSession.handleFieldClick.
  const handleMouseDown = useCallback(
    (_pos: {x: number; y: number}, button: number) => {
      if (session.getMode() !== 'playing') return;
      // Средняя кнопка и прочие не обрабатываются.
      if (button !== 0 && button !== 2) return;

      const isCommitted = session.isAutoPathCommitted();

      // Правая кнопка отменяет только зафиксированный автопуть.
      // Preview не трогаем, чтобы случайный ПКМ не гасил превью.
      if (button === 2) {
        session.cancelAutoPath(isCommitted);
        return;
      }

      session.cancelAutoPath(isCommitted);
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
      if (e.key === 'Unidentified') return;
      const target = e.target as HTMLElement | null;
      if (target && INTERACTIVE_TAGS.has(target.tagName)) return;

      // Клавиши отменяют только зафиксированный автопуть.
      // Preview не трогаем, чтобы нажатия клавиш не гасили превью.
      if (session.isAutoPathCommitted()) {
        session.cancelAutoPath(false);
        // Направления продолжают обрабатываться как ручное движение,
        // остальные клавиши только отменяют автопуть.
        if (!KEY_MAP[e.key]) {
          return;
        }
      }

      // Отмена таргетинга или ожидания спавна
      if (e.key === 'Escape') {
        e.preventDefault();
        if (pendingDebugSpawn) {
          setPendingDebugSpawn(null);
          return;
        }
        session.cancelTargeting();
        return;
      }

      // F / А: выполнить текущее доступное взаимодействие.
      if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
        e.preventDefault();
        handleInteract();
        return;
      }

      // Tab: переключиться на следующее доступное взаимодействие.
      if (e.key === 'Tab') {
        e.preventDefault();
        handleCycleInteraction();
        return;
      }

      // Пробел: END_TURN (завершение хода игрока). В режиме таргетинга — отмена таргетинга.
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (session.isTargeting()) {
          session.cancelTargeting();
        } else {
          handleEndTurn();
        }
        return;
      }

      // Backquote: переключить debug-панель (только в dev-сборке)
      if (e.key === '`' || e.key === '~' || e.code === 'Backquote') {
        if (import.meta.env.DEV) {
          e.preventDefault();
          session.toggleDebug();
        }
        return;
      }

      // Цифры 1–9, 0: активация слотов хотбара.
      const hotbarIndex = keyToHotbarIndex(e.key);
      if (hotbarIndex !== -1) {
        e.preventDefault();
        handleHotbarClick(hotbarIndex);
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
  }, [performMoveOrAttack, handleInteract, handleCycleInteraction, handleEndTurn, session]);

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
        onEndTurn={handleEndTurn}
        onAnimationsComplete={() => session.onAnimationsComplete()}
        onAnimationNodeComplete={handleAnimationNodeComplete}
        onZoomDelta={handleZoom}
        onMouseMove={handleMouseMove}
        onMouseClick={handleMouseClick}
        onMouseDown={handleMouseDown}
        onMouseMoveScreen={handleMouseMoveScreen}
        onCameraHoverMove={handleCameraHoverMove}
        onMouseLeave={handleMouseLeave}
        hotbarItems={renderInput.hotbar}
        onHotbarClick={handleHotbarClick}
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
        onItemClick={handleItemClick}
      />
      <SkillsPanel
        skills={renderInput.playerSkills}
        onSkillClick={handleSkillClick}
      />

    </>
  );

  return (
    <>
      <ThreeColumnLayout
        variant="game"
        left={leftColumn}
        center={centerColumn}
        right={rightColumn}
      />
      <ToastContainer toasts={vm.toasts} onDismiss={handleDismissToast} />
      {import.meta.env.DEV && session.isDebug() && renderInput && (
        <DebugPanel
          session={session}
          hoveredTile={tileHoverPos}
          playerPosition={{x: renderInput.state.player.x, y: renderInput.state.player.y}}
          pendingSpawn={pendingDebugSpawn}
          onRequestSpawn={(spawnType, templateId) => setPendingDebugSpawn({spawnType, templateId})}
          onCancelSpawn={() => setPendingDebugSpawn(null)}
        />
      )}
    </>
  );
}
