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
import {Tween, Easing} from '@utils/tween';
import type {Animatable} from '@utils/tween';

type ActiveFloatingText = {
  text: Text;
  tween: Animatable;
};

export class FloatingTextRenderer {
  public readonly container = new Container();
  private activeTexts: ActiveFloatingText[] = [];

  /** Показать всплывающий текст в мировых координатах.
   *  worldX/worldY — мировые пиксели (не тайлы). */
  show(text: string, worldX: number, worldY: number, color: string, duration: number): void {
    const textObj = new Text({
      text,
      style: new TextStyle({
        fontSize: 14,
        fill: color,
        fontWeight: 'bold',
      }),
    });

    // Центр по X, низ по Y: текст "растёт" вверх от точки (worldX, worldY)
    textObj.anchor.set(0.5, 1);
    textObj.x = worldX;
    textObj.y = worldY;

    this.container.addChild(textObj);

    const tween = new Tween({
      duration,
      easing: Easing.easeOutQuad,
      onUpdate: (p) => {
        textObj.y = worldY - 24 * p;
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
