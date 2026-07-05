/**
 * Игровое поле: фаза хода, PixiJS-рендерер мира, хотбар.
 *
 * Используется в GameScreen (центральная колонка).
 * Получает RenderInput от Presentation, передаёт в renderer.
 * Управляет анимационной очередью через AnimationSequencer и сигнализирует о завершении.
 */

import {useRef, useEffect, useState} from 'react';
import { useTranslation } from '@i18n/hooks';
import type {RenderInput, TurnSide, HotbarItemViewModel} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {Panel} from './Panel';
import {Hotbar} from './Hotbar';
import {InteractionHint} from './InteractionHint';
import {PixiApp} from '@ui/renderer/PixiApp';
import {WorldRenderer} from '@ui/renderer/WorldRenderer';
import {AnimationSequencer} from '@ui/animation/sequencer';
import {SpriteAnimationExecutor} from '@ui/animation/spriteExecutor';
import {FogAnimationExecutor} from '@ui/animation/fogExecutor';
import {PixiFloatingTextExecutor} from '@ui/animation/pixiFloatingTextExecutor';
import {HpChangeAnimationExecutor} from '@ui/animation/hpChangeExecutor';
import {SkillAnimationExecutor} from '@ui/animation/skillExecutor';
import {ProjectileAnimationExecutor} from '@ui/animation/projectileExecutor';
import {ExplosionAnimationExecutor} from '@ui/animation/explosionExecutor';
import {StatusBurstAnimationExecutor} from '@ui/animation/statusBurstExecutor';
import {BounceAnimationExecutor} from '@ui/animation/bounceExecutor';
import {TileShakeExecutor} from '@ui/animation/tileShakeExecutor';
import type {AnimationContext} from '@ui/animation/types';


interface Props {
  floor: number;
  renderInput: RenderInput | null;
  onEndTurn: () => void;
  onAnimationsComplete: () => void;
  onZoomDelta: (delta: number) => void;
  onMouseMove?: (pos: {x: number; y: number}) => void;
  onMouseClick?: (pos: {x: number; y: number}) => void;
  onMouseDown?: (pos: {x: number; y: number}, button: number) => void;
  onMouseMoveScreen?: (pos: {screenX: number; screenY: number}) => void;
  onCameraHoverMove?: (tile: {x: number; y: number}, screen: {screenX: number; screenY: number}) => void;
  onMouseLeave?: () => void;
  hotbarSize?: number;
  hotbarItems?: HotbarItemViewModel[];
  onHotbarClick?: (index: number) => void;
}

export function GameField({
  floor,
  renderInput,
  onEndTurn,
  onAnimationsComplete,
  onZoomDelta,
  onMouseMove,
  onMouseClick,
  onMouseDown,
  onMouseMoveScreen,
  onCameraHoverMove,
  onMouseLeave,
  hotbarSize = 10,
  hotbarItems,
  onHotbarClick,
}: Props) {
  const { t } = useTranslation('components');
  const isInputBlocked = renderInput?.phase === 'animating';
  const [animationPhaseSide, setAnimationPhaseSide] = useState<TurnSide | null>(null);
  const [hintScreenPos, setHintScreenPos] = useState<{x: number; y: number} | null>(null);
  const activeSide = renderInput?.currentTurnSide ?? 'player';
  const displayedSide = isInputBlocked ? (animationPhaseSide ?? activeSide) : activeSide;
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<PixiApp | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const sequencerRef = useRef<AnimationSequencer | null>(null);
  const inputRef = useRef(renderInput);
  const onCompleteRef = useRef(onAnimationsComplete);
  const onMouseMoveRef = useRef(onMouseMove);
  const lastMouseRef = useRef<{x: number; y: number; over: boolean}>({x: 0, y: 0, over: false});
  const lastSentTileRef = useRef<{x: number; y: number} | null>(null);
  const removeHoverTickerRef = useRef<(() => void) | null>(null);

  // Синхронизируем ref callbacks для использования в ticker'е без пересоздания эффектов
  onMouseMoveRef.current = onMouseMove;

  // Синхронизируем ref'ы для использования в ResizeObserver и callbacks
  inputRef.current = renderInput;
  onCompleteRef.current = onAnimationsComplete;

  // Монтирование PixiJS и sequencer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    async function init() {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);

      const pixi = new PixiApp(w, h);
      if (!container) return;
      await pixi.mount(container);
      if (cancelled) {
        pixi.unmount();
        return;
      }

      const renderer = new WorldRenderer(w, h);
      renderer.setTicker(pixi.app.ticker);
      pixi.app.stage.addChild(renderer.root);
      pixi.app.stage.addChild(renderer.textLayer);

      // Пересчитываем ховер каждый кадр, пока мышь над полем. Если камера
      // сдвинулась (с анимацией или мгновенно), тайл под курсором в мировых
      // координатах изменится, и мы сообщим об этом UI. Сравнение с
      // lastSentTileRef предотвращает лишние вызовы, когда камера стоит на месте.
      const recomputeHoverOnTick = () => {
        if (!lastMouseRef.current.over) return;

        const { x: tileX, y: tileY } = renderer.screenToWorld(
          lastMouseRef.current.x,
          lastMouseRef.current.y,
        );
        const prev = lastSentTileRef.current;
        if (!prev || prev.x !== tileX || prev.y !== tileY) {
          lastSentTileRef.current = { x: tileX, y: tileY };
          onCameraHoverMove?.(
            { x: tileX, y: tileY },
            { screenX: lastMouseRef.current.x, screenY: lastMouseRef.current.y },
          );
        }
      };
      pixi.app.ticker.add(recomputeHoverOnTick);
      removeHoverTickerRef.current = () => pixi.app.ticker.remove(recomputeHoverOnTick);

      // Создаём AnimationSequencer
      const executors = [
        new SpriteAnimationExecutor(),
        new FogAnimationExecutor(),
        new PixiFloatingTextExecutor(),
        new HpChangeAnimationExecutor(),
        new SkillAnimationExecutor(),
        new ProjectileAnimationExecutor(),
        new ExplosionAnimationExecutor(),
        new StatusBurstAnimationExecutor(),
        new BounceAnimationExecutor(),
        new TileShakeExecutor(),
      ];
      const context: AnimationContext = {
        worldRenderer: renderer,
        ticker: pixi.app.ticker,
        playerId: inputRef.current?.state.player.id ?? 'player',
        zoom: inputRef.current?.zoom ?? 1,
        worldToScreen: (pos) => renderer.worldToScreen(pos),
      };
      sequencerRef.current = new AnimationSequencer(executors, context);

      pixiRef.current = pixi;
      rendererRef.current = renderer;

      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const cr = entry.contentRect;
        const nw = Math.max(1, Math.round(cr.width));
        const nh = Math.max(1, Math.round(cr.height));
        pixi.resize(nw, nh);
        renderer.resize(nw, nh);
        const currentInput = inputRef.current;
        if (currentInput && rendererRef.current) {
          rendererRef.current.render(currentInput);
        }
      });
      ro.observe(container);

      // Первый рендер, если input уже есть
      const currentInput = inputRef.current;
      if (currentInput) {
        renderer.render(currentInput);
      }
    }

    void init();

    return () => {
      cancelled = true;
      removeHoverTickerRef.current?.();
      removeHoverTickerRef.current = null;
      ro?.disconnect();
      sequencerRef.current?.cancelAll();
      if (rendererRef.current && pixiRef.current) {
        rendererRef.current.removeTicker(pixiRef.current.app.ticker);
      }
      rendererRef.current?.destroy();
      rendererRef.current = null;
      pixiRef.current?.unmount();
      pixiRef.current = null;
      sequencerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновление при изменении renderInput.
  // Сначала рендерим состояние, затем запускаем анимации через sequencer.
  // Анимации запускаются только при новой партии (animationBatchId изменился) —
  // чтобы не перезапускать их при обновлениях hover/таргетинга во время проигрывания.
  const lastBatchIdRef = useRef(0);
  useEffect(() => {
    if (renderInput && rendererRef.current) {
      rendererRef.current.render(renderInput);

      // Синхронизируем экранную позицию подсказки взаимодействия
      // (справа-снизу от целевой клетки). Показываем только после завершения анимаций.
      if (renderInput.interactionHint && renderInput.phase !== 'animating') {
        const pos = rendererRef.current.worldToScreen(renderInput.interactionHint.targetPosition);
        const tileScreenSize = TILE_SIZE * renderInput.zoom;
        setHintScreenPos({
          x: pos.x + tileScreenSize,
          y: pos.y + tileScreenSize / 4 * 3,
        });
      } else {
        setHintScreenPos(null);
      }

      const animations = renderInput.animations;
      const hasNewAnimations = animations && animations.length > 0 && renderInput.animationBatchId !== lastBatchIdRef.current;
      lastBatchIdRef.current = renderInput.animationBatchId;

      if (hasNewAnimations && sequencerRef.current && animations) {
        // Обновляем mutable context перед запуском
        sequencerRef.current.updateContext({
          playerId: renderInput.state.player.id,
          zoom: renderInput.zoom,
          worldToScreen: (pos) => rendererRef.current!.worldToScreen(pos),
          ticker: pixiRef.current!.app.ticker,
        });

        setAnimationPhaseSide(animations[0]?.side ?? null);
        const result = sequencerRef.current.run(animations, {
          onPhaseStart: (side) => setAnimationPhaseSide(side),
        });
        result.blockingDone.then(() => {
          setAnimationPhaseSide(null);
          onCompleteRef.current();
        });
      }
    }
  }, [renderInput]);

  // Масштабирование колесиком мыши
  const isInputBlockedRef = useRef(isInputBlocked);
  isInputBlockedRef.current = isInputBlocked;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (isInputBlockedRef.current) return;
      e.preventDefault();
      const step = 0.1;
      const delta = e.deltaY < 0 ? step : -step;
      onZoomDelta(delta);
    };

    container.addEventListener('wheel', handleWheel, {passive: false});
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [onZoomDelta]);

  // Mouse input для таргетинга
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!rendererRef.current) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      lastMouseRef.current = { x: mouseX, y: mouseY, over: true };

      const { x: tileX, y: tileY } = rendererRef.current.screenToWorld(mouseX, mouseY);
      lastSentTileRef.current = { x: tileX, y: tileY };
      onMouseMove?.({ x: tileX, y: tileY });
      onMouseMoveScreen?.({ screenX: e.clientX, screenY: e.clientY });
    };

    const handleMouseLeave = () => {
      lastMouseRef.current.over = false;
      lastSentTileRef.current = null;
      onMouseLeave?.();
    };

    const handleClick = (e: MouseEvent) => {
      if (isInputBlockedRef.current) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (!rendererRef.current) return;
      const { x: tileX, y: tileY } = rendererRef.current.screenToWorld(mouseX, mouseY);
      onMouseClick?.({ x: tileX, y: tileY });
    };

    // Отмена автопути по любому нажатию мыши должна срабатывать даже во время
    // анимаций, чтобы игрок мог прервать committed-путь.
    const handleMouseDown = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (!rendererRef.current) return;
      const { x: tileX, y: tileY } = rendererRef.current.screenToWorld(mouseX, mouseY);
      onMouseDown?.({ x: tileX, y: tileY }, e.button);
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Правая кнопка отменяет автопуть и не открывает контекстное меню браузера.
      e.preventDefault();
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [onMouseMove, onMouseClick, onMouseDown]);

  return (
    <Panel title={t('gameField.floorTitle', { floor })} fill>
      {/* Оверлей кнопки пропуска хода — вне canvas-контейнера, чтобы не конфликтовать с PixiJS */}
      <div className="cm-field-wrap">
        <PhaseButton
          side={displayedSide}
          onEndTurn={onEndTurn}
        />

        <div className="cm-field" aria-label={t('gameField.gameFieldAriaLabel')} ref={containerRef}>
          {hintScreenPos && renderInput?.interactionHint && (
            <InteractionHint
              screenX={hintScreenPos.x}
              screenY={hintScreenPos.y}
              label={renderInput.interactionHint.label}
              hasMultiple={renderInput.interactionHint.hasMultiple}
            />
          )}
          <Hotbar
            items={hotbarItems ?? []}
            size={hotbarSize}
            disabled={isInputBlocked}
            onSlotClick={onHotbarClick}
          />
        </div>
      </div>
    </Panel>
  );
}

interface PhaseButtonProps {
  side: TurnSide;
  onEndTurn: () => void;
}

/** Локализованная метка для текущей фазы хода. */
function getPhaseLabel(side: TurnSide, t: (key: string) => string): string {
  switch (side) {
    case 'player':
      return t('gameField.playerPhaseLabel');
    case 'enemies':
      return t('gameField.enemiesPhaseLabel');
    case 'allies':
      return t('gameField.alliesPhaseLabel');
    case 'neutrals':
      return t('gameField.neutralsPhaseLabel');
    case 'status_tick':
      return t('gameField.statusTickPhaseLabel');
    case 'round_recovery':
      return t('gameField.roundRecoveryPhaseLabel');
    default:
      return t('gameField.statusTickPhaseLabel');
  }
}

/** Плашка текущей фазы хода. Во время анимаций отображает сторону
 *  проигрываемой анимационной фазы; в idle — активную сторону из состояния. */
function PhaseButton({ side, onEndTurn }: PhaseButtonProps) {
  const { t } = useTranslation('components');

  const isPlayerTurn = side === 'player';
  const label = getPhaseLabel(side, t);

  return (
    <button
      type="button"
      className="cm-phase cm-phase--field cm-phase--skip-turn"
      onClick={onEndTurn}
      disabled={!isPlayerTurn}
      aria-label={label}
    >
      <span className="cm-phase__default">{label}</span>
      {isPlayerTurn && (
        <span className="cm-phase__hover" aria-hidden="true">
          {t('gameField.skipTurnHoverLabel')}
        </span>
      )}
    </button>
  );
}
