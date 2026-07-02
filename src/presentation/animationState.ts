/**
 * Состояние анимаций (Presentation Layer).
 *
 * Ответственность: фаза отрисовки (idle / animating / gameOver)
 * и колбэк завершения анимаций.
 */

export class AnimationState {
  phase: 'idle' | 'animating' | 'gameOver' = 'idle';
  onAnimationsComplete: (() => void) | null = null;
}
