/**
 * Состояние анимаций (Presentation Layer).
 *
 * Ответственность: фаза отрисовки (idle / animating / gameOver),
 * отложенные автопереходы и колбэк завершения анимаций.
 */

export class AnimationState {
  phase: 'idle' | 'animating' | 'gameOver' = 'idle';
  pendingAutoTransition: { direction: 'down' | 'up' } | null = null;
  onAnimationsComplete: (() => void) | null = null;
}
