/**
 * Низкоуровневый примитив: привязка PixiJS-объекта к позиции камеры.
 *
 * Полезен для эффектов, которые должны оставаться в фиксированной точке
 * экрана (например, снаряд, падающий с неба, стартует за верхней границей
 * viewport и движется к мировой цели).
 */

import type {Container} from 'pixi.js';

export interface FollowCameraOptions {
  /** Функция, возвращающая текущую мировую позицию камеры. */
  getCameraWorldPos: () => {x: number; y: number};
  /** Объект, который должен следовать за камерой. */
  object: Container;
  /** Смещение относительно камеры по X. */
  offsetX?: number;
  /** Смещение относительно камеры по Y. */
  offsetY?: number;
}

/**
 * Утилита привязки объекта к камере.
 *
 * При вызове update() устанавливает позицию object в
 * cameraWorldPos + offset. Не подписывается на тикер самостоятельно,
 * чтобы потребитель мог управлять частотой обновления.
 */
export class FollowCamera {
  private readonly getCameraWorldPos: () => {x: number; y: number};
  private readonly object: Container;
  private readonly offsetX: number;
  private readonly offsetY: number;

  constructor(opts: FollowCameraOptions) {
    this.getCameraWorldPos = opts.getCameraWorldPos;
    this.object = opts.object;
    this.offsetX = opts.offsetX ?? 0;
    this.offsetY = opts.offsetY ?? 0;
    this.update();
  }

  /** Обновить позицию объекта в соответствии с текущей позицией камеры. */
  update(): void {
    const camera = this.getCameraWorldPos();
    this.object.x = camera.x + this.offsetX;
    this.object.y = camera.y + this.offsetY;
  }
}
