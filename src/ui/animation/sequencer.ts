/**
 * AnimationSequencer — оркестратор деревьев анимаций.
 *
 * Правила:
 * - Сиблинги (дети одного родителя) запускаются параллельно (Promise.all).
 * - Parent → child: дети стартуют только после завершения родителя.
 * - blockingDone резолвится, когда завершены ВСЕ blocking-узлы во всём дереве.
 * - Если в дереве нет blocking-узлов — blockingDone резолвится мгновенно.
 */

import type { AnimationNode, AnimationPhase, TurnSide } from '@presentation/types';
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

function countBlockingInPhases(phases: AnimationPhase[]): number {
  let count = 0;
  for (const phase of phases) {
    count += countBlockingNodes(phase.nodes);
  }
  return count;
}

export class AnimationSequencer {
  private remainingBlocking = 0;
  private blockingResolve: ((value?: void | PromiseLike<void>) => void) | null = null;
  private blockingPromise: Promise<void> | null = null;
  private cancelled = false;

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

  run(
    phases: AnimationPhase[],
    callbacks?: { onPhaseStart?: (side: TurnSide) => void; onNodeComplete?: (node: AnimationNode) => void },
  ): AnimationRunResult {
    this.cancelled = false;

    this.remainingBlocking = countBlockingInPhases(phases);

    this.blockingPromise = new Promise<void>((resolve) => {
      this.blockingResolve = resolve;
    });

    if (this.remainingBlocking === 0) {
      this.blockingResolve?.();
    }

    const allPromise = (async () => {
      for (const phase of phases) {
        if (this.cancelled) break;
        callbacks?.onPhaseStart?.(phase.side);
        if (phase.sequential) {
          for (const node of phase.nodes) {
            if (this.cancelled) break;
            await this.runNode(node, callbacks);
          }
        } else {
          await Promise.all(phase.nodes.map((node) => this.runNode(node, callbacks)));
        }
      }
      if (!this.cancelled && this.remainingBlocking === 0 && this.blockingResolve) {
        (this.blockingResolve as (() => void))();
      }
    })();

    return {
      blockingDone: this.blockingPromise,
      allDone: allPromise,
    };
  }

  /** Прервать все активные и будущие анимации в этом прогоне.
   *  Немедленно разблокирует ввод и останавливает запуск новых узлов. */
  cancelAll(): void {
    this.cancelled = true;
    this.remainingBlocking = 0;
    this.blockingResolve?.();
  }

  private async runNode(
    node: AnimationNode,
    callbacks?: { onNodeComplete?: (node: AnimationNode) => void },
  ): Promise<void> {
    if (this.cancelled) return;

    const step = node.step;
    const configKey = step.type as AnimationConfigKey;
    const config = ANIMATION_CONFIG[configKey];

    const finishBlocking = () => {
      if (this.cancelled) return;
      if (config?.blocking) {
        this.remainingBlocking--;
        if (this.remainingBlocking === 0 && this.blockingResolve) {
          this.blockingResolve();
        }
      }
    };

    const onNodeComplete = () => {
      callbacks?.onNodeComplete?.(node);
    };

    if (!config) {
      console.error(
        `[AnimationSequencer] Нет конфигурации для шага "${step.type}". Добавьте его в ANIMATION_CONFIG.`,
      );
      try {
        onNodeComplete();
        await Promise.all(node.children.map((child) => this.runNode(child, callbacks)));
      } finally {
        finishBlocking();
      }
      return;
    }

    const executor = this.executors.find((e) => e.canExecute(step));

    if (!executor) {
      try {
        onNodeComplete();
        await Promise.all(node.children.map((child) => this.runNode(child, callbacks)));
      } finally {
        finishBlocking();
      }
      return;
    }

    if (this.cancelled) {
      finishBlocking();
      return;
    }

    try {
      await executor.execute(step, this.context);
    } catch (err) {
      console.error(`[AnimationSequencer] Ошибка в executor для "${step.type}":`, err);
    } finally {
      onNodeComplete();
      finishBlocking();
    }

    if (this.cancelled) return;

    // После завершения родителя запускаем детей параллельно
    if (node.children.length > 0) {
      await Promise.all(node.children.map((child) => this.runNode(child, callbacks)));
    }
  }
}
