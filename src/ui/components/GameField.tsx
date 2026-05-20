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

const VIEWPORT_W = 480;
const VIEWPORT_H = 352;

export function GameField({level, state, portraitId, lastResult, onWait, hotbarSize = 8}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<PixiApp | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);

  // Монтирование PixiJS
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    async function init() {
      const pixi = new PixiApp(VIEWPORT_W, VIEWPORT_H);
      if (!container) return;
      await pixi.mount(container);
      if (cancelled) {
        pixi.unmount();
        return;
      }

      const renderer = new WorldRenderer(VIEWPORT_W, VIEWPORT_H);
      pixi.app.stage.addChild(renderer.root);

      pixiRef.current = pixi;
      rendererRef.current = renderer;

      // Первый рендер, если state уже есть
      if (state) {
        await renderer.render(state as GameState, portraitId);
      }
    }

    void init();

    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      pixiRef.current?.unmount();
      pixiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновление при изменении state или lastResult
  useEffect(() => {
    if (state && rendererRef.current) {
      void rendererRef.current.render(state as GameState, portraitId);
    }
  }, [state, portraitId, lastResult]);

  return (
    <Panel title={`Уровень ${level}`} fill className="cm-center-panel">
      <div className="cm-field" aria-label="Игровое поле">
        <button
          type="button"
          className="cm-phase cm-phase--field cm-phase--skip-turn"
          onClick={onWait}
          aria-label="Пропустить ход"
        >
          <span className="cm-phase__default">Ход игрока</span>
          <span className="cm-phase__hover" aria-hidden="true">Пропустить ход</span>
        </button>

        <div className="cm-field__main cm-field__main--pixi" ref={containerRef} />

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
