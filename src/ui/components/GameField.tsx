/**
 * Игровое поле: фаза хода, PixiJS-рендерер мира, хотбар.
 *
 * Используется в GameScreen (центральная колонка).
 * Получает RenderInput от Presentation, передаёт в renderer.
 * Управляет анимационной очередью через AnimationSequencer и сигнализирует о завершении.
 */

import {useRef, useEffect} from 'react';
import type {RenderInput} from '@presentation/types';
import {Panel} from './Panel';
import {HotSlot} from './HotSlot';
import {PixiApp} from '@ui/renderer/PixiApp';
import {WorldRenderer} from '@ui/renderer/WorldRenderer';
import {AnimationSequencer} from '@ui/animation/sequencer';
import {SpriteAnimationExecutor} from '@ui/animation/spriteExecutor';
import {FogAnimationExecutor} from '@ui/animation/fogExecutor';
import {PixiFloatingTextExecutor} from '@ui/animation/pixiFloatingTextExecutor';
import type {AnimationContext} from '@ui/animation/types';

interface Props {
  level: number;
  renderInput: RenderInput | null;
  onWait: () => void;
  onAnimationsComplete: () => void;
  onZoomDelta: (delta: number) => void;
  hotbarSize?: number;
}

export function GameField({
  level,
  renderInput,
  onWait,
  onAnimationsComplete,
  onZoomDelta,
  hotbarSize = 8,
}: Props) {
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

      // Создаём AnimationSequencer
      const executors = [
        new SpriteAnimationExecutor(),
        new FogAnimationExecutor(),
        new PixiFloatingTextExecutor(),
      ];
      const context: AnimationContext = {
        worldRenderer: renderer,
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
          void rendererRef.current.render(currentInput);
        }
      });
      ro.observe(container);

      // Первый рендер, если input уже есть
      const currentInput = inputRef.current;
      if (currentInput) {
        await renderer.render(currentInput);
      }
    }

    void init();

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (rendererRef.current && pixiRef.current) {
        rendererRef.current.removeTicker(pixiRef.current.app.ticker);
      }
      pixiRef.current?.unmount();
      pixiRef.current = null;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      sequencerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновление при изменении renderInput.
  // Сначала рендерим состояние, затем запускаем анимации через sequencer.
  useEffect(() => {
    if (renderInput && rendererRef.current) {
      void rendererRef.current.render(renderInput);

      if (renderInput.animations && renderInput.animations.length > 0 && sequencerRef.current) {
        // Обновляем mutable context перед запуском
        sequencerRef.current.updateContext({
          playerId: renderInput.state.player.id,
          zoom: renderInput.zoom,
          worldToScreen: (pos) => rendererRef.current!.worldToScreen(pos),
        });

        const result = sequencerRef.current.run(renderInput.animations);
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

  return (
    <Panel title={`Уровень ${level}`} fill>
      {/* Оверлей кнопки пропуска хода — вне canvas-контейнера, чтобы не конфликтовать с PixiJS */}
      <div className="cm-field-wrap">
        <button
          type="button"
          className="cm-phase cm-phase--field cm-phase--skip-turn"
          onClick={onWait}
          disabled={isInputBlocked}
          aria-label="Пропустить ход"
        >
          <span className="cm-phase__default">Ход игрока</span>
          <span className="cm-phase__hover" aria-hidden="true">
            Пропустить ход
          </span>
        </button>

        <div className="cm-field" aria-label="Игровое поле" ref={containerRef}>
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
