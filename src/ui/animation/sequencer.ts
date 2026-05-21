/**
 * AnimationSequencer — оркестратор деревьев анимаций.
 *
 * Правила:
 * - Сиблинги (дети одного родителя) запускаются параллельно (Promise.all).
 * - Parent → child: дети стартуют только после завершения родителя.
 * - blockingDone резолвится, когда счётчик активных blocking-узлов падает до 0.
 * - Если в дереве нет blocking-узлов — blockingDone резолвится мгновенно.
 */

import type { AnimationNode } from '@presentation/types';
import { ANIMATION_CONFIG } from '@utils/animationConfig';
import type { AnimationConfigKey } from '@utils/animationConfig';
import type { AnimationExecutor, AnimationContext, AnimationRunResult } from './types';

function countBlockingNodes(nodes: AnimationNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (ANIMATION_CONFIG[node.step.type as AnimationConfigKey].blocking) {
      count++;
    }
    count += countBlockingNodes(node.children);
  }
  return count;
}

export class AnimationSequencer {
  private blockingCounter = 0;
  private blockingResolve: ((value?: void | PromiseLike<void>) => void) | null = null;
  private blockingPromise: Promise<void> | null = null;

  constructor(
    private readonly executors: AnimationExecutor[],
    private readonly context: AnimationContext,
  ) {}

  /** Запустить лес анимационных деревьев.
   *  Каждый корневой узел — отдельное дерево; корневые узлы между собой параллельны. */
  /** Обновить поля mutable-контекста перед запуском нового дерева. */
  updateContext(partial: Partial<AnimationContext>): void {
    Object.assign(this.context, partial);
  }

  run(nodes: AnimationNode[]): AnimationRunResult {
    this.blockingCounter = 0;

    this.blockingPromise = new Promise<void>((resolve) => {
      this.blockingResolve = resolve;
    });

    const totalBlocking = countBlockingNodes(nodes);
    if (totalBlocking === 0) {
      this.blockingResolve?.();
    }

    const allPromise = Promise.all(nodes.map((node) => this.runNode(node))).then(() => {
      if (this.blockingCounter === 0 && this.blockingResolve) {
        (this.blockingResolve as (() => void))();
      }
    });

    return {
      blockingDone: this.blockingPromise,
      allDone: allPromise,
    };
  }

  private async runNode(node: AnimationNode): Promise<void> {
    const step = node.step;
    const config = ANIMATION_CONFIG[step.type as AnimationConfigKey];
    const executor = this.executors.find((e) => e.canExecute(step));

    if (!executor) {
      console.warn(`[AnimationSequencer] Нет executor для шага "${step.type}"`);
      // Без executor дети всё равно должны выполниться после "родителя"
      await Promise.all(node.children.map((child) => this.runNode(child)));
      return;
    }

    const isBlocking = config.blocking;

    if (isBlocking) {
      this.blockingCounter++;
    }

    try {
      await executor.execute(step, this.context);
    } catch (err) {
      console.error(`[AnimationSequencer] Ошибка в executor для "${step.type}":`, err);
    }

    if (isBlocking) {
      this.blockingCounter--;
      if (this.blockingCounter === 0 && this.blockingResolve) {
        this.blockingResolve();
      }
    }

    // После завершения родителя запускаем детей параллельно
    if (node.children.length > 0) {
      await Promise.all(node.children.map((child) => this.runNode(child)));
    }
  }
}
