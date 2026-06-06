/**
 * Игровое поле: фаза хода, PixiJS-рендерер мира, хотбар.
 *
 * Используется в GameScreen (центральная колонка).
 * Получает RenderInput от Presentation, передаёт в renderer.
 * Управляет анимационной очередью через AnimationSequencer и сигнализирует о завершении.
 */

import {useRef, useEffect} from 'react';
import { useTranslation } from '@i18n/hooks';
import type {RenderInput} from '@presentation/types';
import {Panel} from './Panel';
import {HotSlot} from './HotSlot';
import {PixiApp} from '@ui/renderer/PixiApp';
import {WorldRenderer} from '@ui/renderer/WorldRenderer';
import {AnimationSequencer} from '@ui/animation/sequencer';
import {SpriteAnimationExecutor} from '@ui/animation/spriteExecutor';
import {FogAnimationExecutor} from '@ui/animation/fogExecutor';
import {PixiFloatingTextExecutor} from '@ui/animation/pixiFloatingTextExecutor';
import {SkillAnimationExecutor} from '@ui/animation/skillExecutor';
import {ProjectileAnimationExecutor} from '@ui/animation/projectileExecutor';
import {ExplosionAnimationExecutor} from '@ui/animation/explosionExecutor';
import {StatusBurstAnimationExecutor} from '@ui/animation/statusBurstExecutor';
import type {AnimationContext} from '@ui/animation/types';
import {TILE_SIZE} from '@utils/constants';

interface Props {
  floor: number;
  renderInput: RenderInput | null;
  onWait: () => void;
  onAnimationsComplete: () => void;
  onZoomDelta: (delta: number) => void;
  onMouseMove?: (pos: {x: number; y: number}) => void;
  onMouseClick?: (pos: {x: number; y: number}) => void;
  onMouseMoveScreen?: (pos: {screenX: number; screenY: number}) => void;
  onMouseLeave?: () => void;
  hotbarSize?: number;
}

export function GameField({
  floor,
  renderInput,
  onWait,
  onAnimationsComplete,
  onZoomDelta,
  onMouseMove,
  onMouseClick,
  onMouseMoveScreen,
  onMouseLeave,
  hotbarSize = 8,
}: Props) {
  const { t } = useTranslation('components');
  const isInputBlocked = renderInput?.phase === 'animating';
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<PixiApp | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const sequencerRef = useRef<AnimationSequencer | null>(null);
  const inputRef = useRef(renderInput);
  const onCompleteRef = useRef(onAnimationsComplete);

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

      // Создаём AnimationSequencer
      const executors = [
        new SpriteAnimationExecutor(),
        new FogAnimationExecutor(),
        new PixiFloatingTextExecutor(),
        new SkillAnimationExecutor(),
        new ProjectileAnimationExecutor(),
        new ExplosionAnimationExecutor(),
        new StatusBurstAnimationExecutor(),
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

        const result = sequencerRef.current.run(animations);
        result.blockingDone.then(() => {
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

      const { x: tileX, y: tileY } = rendererRef.current.screenToWorld(mouseX, mouseY);
      onMouseMove?.({ x: tileX, y: tileY });
      onMouseMoveScreen?.({ screenX: e.clientX, screenY: e.clientY });
    };

    const handleMouseLeave = () => {
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

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [onMouseMove, onMouseClick]);

  return (
    <Panel title={t('gameField.floorTitle', { floor })} fill>
      {/* Оверлей кнопки пропуска хода — вне canvas-контейнера, чтобы не конфликтовать с PixiJS */}
      <div className="cm-field-wrap">
        <button
          type="button"
          className="cm-phase cm-phase--field cm-phase--skip-turn"
          onClick={onWait}
          disabled={isInputBlocked}
          aria-label={t('gameField.skipTurnAriaLabel')}
        >
          <span className="cm-phase__default">{t('gameField.playerPhaseLabel')}</span>
          <span className="cm-phase__hover" aria-hidden="true">
            {t('gameField.skipTurnHoverLabel')}
          </span>
        </button>

        <div className="cm-field" aria-label={t('gameField.gameFieldAriaLabel')} ref={containerRef}>
          <div className="cm-hotbar-wrap cm-panel cm-hotbar-wrap--in-field cm-hotbar-wrap--recessed">
            <span className="cm-rivet cm-rivet--tl" />
            <span className="cm-rivet cm-rivet--tr" />
            <span className="cm-rivet cm-rivet--bl" />
            <span className="cm-rivet cm-rivet--br" />
            <div className="cm-hotbar">
              {Array.from({length: hotbarSize}).map((_, i) => (
                <HotSlot key={`hot-${i}`} index={i} empty />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
