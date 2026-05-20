/**
 * Игровое поле: фаза хода, PixiJS-рендерер мира, хотбар.
 *
 * Используется в GameScreen (центральная колонка).
 */

import {useRef, useEffect} from 'react';
import type {GameState, SimulationResult} from '@simulation/types';
import {Panel} from './Panel';
import {HotSlot} from './HotSlot';
import {PixiApp} from '@renderer/PixiApp';
import {WorldRenderer} from '@renderer/WorldRenderer';

interface Props {
  level: number;
  state: Readonly<GameState> | null;
  portraitId: string | null;
  lastResult: SimulationResult | null;
  onWait: () => void;
  hotbarSize?: number;
}

export function GameField({level, state, portraitId, lastResult, onWait, hotbarSize = 8}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<PixiApp | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const stateRef = useRef(state);
  const portraitIdRef = useRef(portraitId);

  // Синхронизируем ref'ы для использования в ResizeObserver
  stateRef.current = state;
  portraitIdRef.current = portraitId;

  // Монтирование PixiJS
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
      pixi.app.stage.addChild(renderer.root);

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
        if (stateRef.current && rendererRef.current) {
          void rendererRef.current.render(stateRef.current as GameState, portraitIdRef.current);
        }
      });
      ro.observe(container);

      // Первый рендер, если state уже есть
      if (stateRef.current) {
        await renderer.render(stateRef.current as GameState, portraitIdRef.current);
      }
    }

    void init();

    return () => {
      cancelled = true;
      ro?.disconnect();
      pixiRef.current?.unmount();
      pixiRef.current = null;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновление при изменении state или lastResult.
  // lastResult в deps нужен, т.к. state мутируется напрямую в simulation,
  // и React не видит изменения объекта без новой ссылки на результат.
  useEffect(() => {
    if (state && rendererRef.current) {
      void rendererRef.current.render(state as GameState, portraitId);
    }
  }, [state, portraitId, lastResult]);

  // Масштабирование колесиком мыши
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const renderer = rendererRef.current;
      if (!renderer) return;
      const step = 0.1;
      const delta = e.deltaY < 0 ? step : -step;
      renderer.zoom(delta);
      if (state) {
        void renderer.render(state as GameState, portraitId);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [state, portraitId]);

  return (
    <Panel title={`Уровень ${level}`} fill className="cm-center-panel">
      <div className="cm-field" aria-label="Игровое поле" ref={containerRef}>
        <button
          type="button"
          className="cm-phase cm-phase--field cm-phase--skip-turn"
          onClick={onWait}
          aria-label="Пропустить ход"
        >
          <span className="cm-phase__default">Ход игрока</span>
          <span className="cm-phase__hover" aria-hidden="true">Пропустить ход</span>
        </button>

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
    </Panel>
  );
}
