/**
 * Инициализация и управление PixiJS Application.
 *
 * Создаёт canvas, монтирует его в DOM-элемент, управляет resize.
 */

import {Application} from 'pixi.js';

export class PixiApp {
  public readonly app: Application;
  private mounted = false;

  constructor(width: number, height: number) {
    this.app = new Application();
    // Инициализация отложена до mount — нужен DOM-элемент
    this.width = width;
    this.height = height;
  }

  private width: number;
  private height: number;

  async mount(container: HTMLElement): Promise<void> {
    if (this.mounted) return;
    await this.app.init({
      width: this.width,
      height: this.height,
      backgroundColor: 0x1a120b,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    container.appendChild(this.app.canvas);
    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted) return;
    this.app.destroy(true, {children: true, texture: true});
    this.mounted = false;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.mounted) {
      this.app.renderer.resize(width, height);
    }
  }
}
