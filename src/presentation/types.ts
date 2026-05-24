/**
 * Типы Presentation Layer для UI и Renderer.
 *
 * Правила:
 * - UI и renderer импортируют типы только отсюда, не из simulation/
 * - RenderInput — readonly снимок состояния + метаданные для отрисовки
 * - AnimationStep — декларативное описание одного шага анимации
 * - AnimationNode — дерево шагов, изоморфное ExecutionNode
 */

import type { GameState, PlayerStatsSnapshot } from '@simulation/types';
import type { AnimationConfigKey } from '@utils/animationConfig';

// Реэкспорт типов, необходимых renderer'у, чтобы UI не импортировал из simulation/
export type { TileType } from '@simulation/types';
export type { AnimationConfigKey } from '@utils/animationConfig';

export type Position = { x: number; y: number };

/** Один конкретный шаг анимации.
 *  Длительность, blocking и easing живут в ANIMATION_CONFIG — здесь только параметры шага. */
export type AnimationStep =
  | {
      type: 'MOVE';
      entityId: string;
      from: Position;
      to: Position;
    }
  | {
      type: 'ATTACK';
      attackerId: string;
      dx: number;
      dy: number;
    }
  | {
      type: 'DAMAGE';
      targetId: string;
      amount: number;
      position: Position;
    }
  | {
      type: 'DEATH';
      entityId: string;
    }
  | {
      type: 'FOG_UPDATE';
      newlyVisible: Position[];
    }
  | {
      type: 'PARTICLE_BURST';
      x: number;
      y: number;
      color: number;
      count: number;
    }
  | {
      type: 'UI_FLOATING_TEXT';
      text: string;
      x: number;
      y: number;
      styleKey: string;
    };

/** Узел дерева анимаций.
 *  Сиблинги (дети одного родителя) выполняются параллельно.
 *  Parent → child — последовательно: дети стартуют после завершения родителя. */
export type AnimationNode = {
  step: AnimationStep;
  children: AnimationNode[];
};

/** Readonly псевдоним GameState для renderer и UI. */
export type RenderState = Readonly<GameState>;

/** Полный вход renderer'а: состояние + анимации + метаданные. */
export type RenderInput = {
  /** Readonly снимок игрового состояния от Simulation. */
  state: RenderState;
  /** ID портрета игрока для выбора спрайта. */
  portraitId: string | null;
  /** Подсвеченный автопуть (если есть). */
  highlightedPath: Position[] | null;
  /** Очередь анимаций в виде дерева. null = нет новых анимаций. */
  animations: AnimationNode[] | null;
  /** Фаза отрисовки: idle — можно вводить, animating — идут анимации. */
  phase: 'idle' | 'animating' | 'gameOver';
  /** Масштаб камеры (1 = 100%). */
  zoom: number;
  /** Рассчитанные характеристики игрока для отображения. */
  playerStats: PlayerStatsSnapshot;
};
