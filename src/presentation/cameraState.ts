/**
 * Состояние камеры (Presentation Layer).
 *
 * Ответственность: масштаб и ограничения зума.
 * Не зависит от Simulation или UI.
 */

export class CameraState {
  zoom = 1;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 3;

  setZoom(delta: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
  }

  multiplyZoom(factor: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
  }

  resetZoom(): void {
    this.zoom = 1;
  }
}
