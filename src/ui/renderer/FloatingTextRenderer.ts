/**
 * Рендерер всплывающего текста через PixiJS.
 *
 * Использует PixiJS Text (не DOM), поэтому автоматически масштабируется
 * и двигается вместе с камерой через WorldRenderer.root.scale / position.
 *
 * Правила:
 * - Координаты передаются в мировых пикселях (как у спрайтов).
 * - Анимация подъёма + fade-out через Tween.
 * - Не blocking — запускается и забывается.
 */

import {Container, Text, TextStyle} from 'pixi.js';
import {FONT_PANEL_TITLE} from './fonts';
import type {Animatable} from '@utils/tween';
import {Easing, Tween} from '@utils/tween';

type ActiveFloatingText = {
  text: Text;
  tween: Animatable;
};

export class FloatingTextRenderer {
  public readonly container = new Container();
  /** Мировые координаты текстовых элементов (для syncTextLayer в WorldRenderer). */
  public readonly textWorldCoords = new WeakMap<any, { worldX: number; worldY: number }>();
  private activeTexts: ActiveFloatingText[] = [];

  /** Показать всплывающий текст в мировых координатах.
   *  worldX/worldY — мировые пиксели (не тайлы). */
  show(text: string, worldX: number, worldY: number, color: string, duration: number, zoom: number): void {
    const textObj = new Text({
      text,
      style: new TextStyle({
        fontFamily: FONT_PANEL_TITLE,
        fontSize: Math.round(14 * zoom),
        fill: color,
        fontWeight: 'bold',
      }),
      resolution: window.devicePixelRatio || 1,
    });
    textObj.roundPixels = true;

    // Центр по X, низ по Y: текст "растёт" вверх от точки (worldX, worldY)
    textObj.anchor.set(0.5, 1);
    // Позиция будет установлена syncTextLayer() через textWorldCoords
    this.textWorldCoords.set(textObj, { worldX, worldY });

    this.container.addChild(textObj);

    const tween = new Tween({
      duration,
      easing: Easing.easeOutQuad,
      onUpdate: (p) => {
        this.textWorldCoords.set(textObj, { worldX, worldY: worldY - 24 * p });
        textObj.alpha = 1 - p;
      },
      onComplete: () => {
        this.removeText(textObj);
      },
    });

    tween.start(performance.now());
    this.activeTexts.push({text: textObj, tween});
  }

  /** Обновить активные тексты. Вызывается из WorldRenderer.onTick. */
  update(now: number): void {
    for (let i = this.activeTexts.length - 1; i >= 0; i--) {
      const active = this.activeTexts[i]!;
      const finished = active.tween.update(now);
      if (finished) {
        this.activeTexts.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const active of this.activeTexts) {
      active.text.destroy();
    }
    this.activeTexts = [];
    this.container.removeChildren();
  }

  private removeText(text: Text): void {
    this.container.removeChild(text);
    text.destroy();
  }
}
