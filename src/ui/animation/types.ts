/**
 * Контракты анимационного sequencer и исполнителей (executors).
 *
 * Правила:
 * - Executor не знает о дереве AnimationNode, только о своём AnimationStep.
 * - Sequencer отвечает за оркестрацию: параллельность сиблингов, последовательность parent→child.
 */

import type { WorldRenderer } from '@ui/renderer/WorldRenderer';
import type { AnimationStep, Position } from '@presentation/types';

export interface AnimationExecutor {
  /** Возвращает true, если этот executor умеет исполнять данный шаг. */
  canExecute(step: AnimationStep): boolean;

  /** Исполнить шаг анимации.
   *  Должен вернуть Promise, который резолвится по завершении визуального эффекта. */
  execute(step: AnimationStep, ctx: AnimationContext): Promise<void>;
}

/** Контекст, передаваемый каждому executor'у при запуске. */
export type AnimationContext = {
  /** Главный рендерер мира (PixiJS). */
  worldRenderer: WorldRenderer;
  /** ID игрока для определения followCamera. */
  playerId: string;
  /** Текущий масштаб камеры (zoom). */
  zoom: number;
  /** Преобразовать мировые координаты тайла в экранные координаты относительно viewport. */
  worldToScreen: (pos: Position) => { x: number; y: number };
};

/** Результат запуска дерева анимаций. */
export type AnimationRunResult = {
  /** Резолвится, когда все blocking-узлы дерева завершены.
   *  По этому Promise UI разблокирует ввод. */
  blockingDone: Promise<void>;
  /** Резолвится, когда завершены абсолютно все узлы (включая non-blocking). */
  allDone: Promise<void>;
};
