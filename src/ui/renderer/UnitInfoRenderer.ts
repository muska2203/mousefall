/**
 * Информационный виджет над сущностями: портрет, слоты эффектов, HP-бар.
 *
 * Рисуется над каждой сущностью с HP в мировых координатах.
 * Ширина виджета масштабируется под ширину спрайта объекта.
 */

import {Container, Graphics, Sprite} from 'pixi.js';
import type {RenderInput} from '@presentation/types';
import {Tween, lerp, clamp01} from '@utils/tween';
import type {Animatable} from '@utils/tween';
import type {AnimationConfigEntry} from '@utils/animationConfig';

const BASE_WIDTH = 80;
const BASE_HEIGHT = 74;
const PADDING = 6;
const CIRCLE_DIAMETER = 28;
const EFFECT_SIZE = 14;
const EFFECT_GAP = 4;
const HP_BAR_HEIGHT = 8;
const VERTICAL_OFFSET = 1;

const COLOR_SLOT_FILL = 0x222222;
const COLOR_HP_BG = 0x333333;
const COLOR_HP_FILL = 0xe74c3c;

type HpEntity = {hp: number; maxHp: number};

type UnitInfoWidget = {
  container: Container;
  circle: Graphics;
  effectSlots: Graphics[];
  hpBarBg: Graphics;
  hpBarFill: Graphics;
  lastHpRatio: number;
};

type ActiveAnimation = {
  tween: Animatable;
  onComplete: () => void;
};

export class UnitInfoRenderer {
  public readonly container = new Container();
  private widgets = new Map<string, UnitInfoWidget>();
  private hpChangeAnimations = new Map<string, ActiveAnimation>();

  constructor() {
    this.container.sortableChildren = true;
  }

  /** Обновить виджеты для всех сущностей с HP. */
  update(input: RenderInput, getSprite: (id: string) => Sprite | undefined): void {
    const state = input.state;
    const seen = new Set<string>();

    const processEntity = (id: string, entity: unknown) => {
      if (!hasHp(entity)) return;
      seen.add(id);

      const sprite = getSprite(id);
      if (!sprite) return;

      let widget = this.widgets.get(id);
      if (!widget) {
        widget = this.createWidget();
        this.widgets.set(id, widget);
        this.container.addChild(widget.container);
      }

      // Если идёт анимация HP, не сбрасываем заполнение текущим значением —
      // иначе полоска будет мигать конечным HP во время tween.
      if (!this.hpChangeAnimations.has(id)) {
        this.updateWidget(widget, entity.hp, entity.maxHp);
      }
      this.syncWidgetPosition(widget, sprite);
    };

    processEntity(state.player.id, state.player);
    for (const entity of state.entities.values()) {
      processEntity(entity.id, entity);
    }

    // Удаляем виджеты для исчезнувших сущностей
    for (const [id, widget] of this.widgets) {
      if (!seen.has(id)) {
        widget.container.destroy();
        this.widgets.delete(id);
      }
    }
  }

  /** Синхронизировать позиции виджетов со спрайтами (для анимаций). */
  syncPositions(getSprite: (id: string) => Sprite | undefined): void {
    for (const [id, widget] of this.widgets) {
      const sprite = getSprite(id);
      if (!sprite) continue;
      this.syncWidgetPosition(widget, sprite);
    }
  }

  /** Анимация изменения HP: плавное изменение заполнения полоски. */
  animateHpChange(entityId: string, fromHp: number, toHp: number, maxHp: number, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const widget = this.widgets.get(entityId);
      if (!widget) {
        resolve();
        return;
      }

      // Устанавливаем начальное заполнение до старта tween, чтобы избежать мигания.
      this.updateWidget(widget, fromHp, maxHp);

      // Прерываем предыдущую анимацию полоски для этой сущности, если есть.
      const prev = this.hpChangeAnimations.get(entityId);
      if (prev) {
        prev.tween.cancel();
        prev.onComplete();
        this.hpChangeAnimations.delete(entityId);
      }

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          const hp = lerp(fromHp, toHp, p);
          this.updateWidget(widget, hp, maxHp);
        },
        onComplete: () => {
          this.updateWidget(widget, toHp, maxHp);
          this.hpChangeAnimations.delete(entityId);
          resolve();
        },
      });

      const anim: ActiveAnimation = { tween, onComplete: resolve };
      this.hpChangeAnimations.set(entityId, anim);
      tween.start(performance.now());
    });
  }

  /** Обновить все активные tween'ы. Вызывается из PixiJS ticker. */
  updateAnimations(now: number): void {
    for (const [entityId, anim] of this.hpChangeAnimations) {
      const finished = anim.tween.update(now);
      if (finished) {
        this.hpChangeAnimations.delete(entityId);
        anim.onComplete();
      }
    }
  }

  /** Прервать все активные анимации. */
  cancelAnimations(): void {
    for (const anim of this.hpChangeAnimations.values()) {
      anim.tween.cancel();
      anim.onComplete();
    }
    this.hpChangeAnimations.clear();
  }

  /** Освободить ресурсы. */
  destroy(): void {
    this.cancelAnimations();
    for (const widget of this.widgets.values()) {
      widget.container.destroy();
    }
    this.widgets.clear();
    this.container.destroy({children: true});
  }

  private createWidget(): UnitInfoWidget {
    const container = new Container();

    const circle = new Graphics();
    const effectSlots: Graphics[] = [];
    for (let i = 0; i < 4; i++) {
      effectSlots.push(new Graphics());
    }
    const hpBarBg = new Graphics();
    const hpBarFill = new Graphics();

    container.addChild(circle, ...effectSlots, hpBarBg, hpBarFill);

    return {
      container,
      circle,
      effectSlots,
      hpBarBg,
      hpBarFill,
      lastHpRatio: 1,
    };
  }

  private updateWidget(widget: UnitInfoWidget, hp: number, maxHp: number): void {
    widget.circle.clear();
    widget.hpBarBg.clear();
    widget.hpBarFill.clear();
    for (const slot of widget.effectSlots) {
      slot.clear();
    }

    // Круг-иконка вверху по центру
    const circleY = PADDING;
    const circleX = BASE_WIDTH / 2;
    widget.circle.circle(circleX, circleY + CIRCLE_DIAMETER / 2, CIRCLE_DIAMETER / 2);
    widget.circle.fill({color: COLOR_SLOT_FILL});

    // Слоты эффектов в ряд
    const totalSlotsWidth = 4 * EFFECT_SIZE + 3 * EFFECT_GAP;
    let slotX = (BASE_WIDTH - totalSlotsWidth) / 2;
    const slotY = circleY + CIRCLE_DIAMETER + PADDING;
    for (const slot of widget.effectSlots) {
      slot.rect(slotX, slotY, EFFECT_SIZE, EFFECT_SIZE);
      slot.fill({color: COLOR_SLOT_FILL});
      slotX += EFFECT_SIZE + EFFECT_GAP;
    }

    // HP-бар
    const barY = slotY + EFFECT_SIZE + PADDING;
    const barWidth = BASE_WIDTH - 2 * PADDING;
    const hpRatio = maxHp > 0 ? clamp01(hp / maxHp) : 0;
    widget.lastHpRatio = hpRatio;
    widget.hpBarBg.rect(PADDING, barY, barWidth, HP_BAR_HEIGHT);
    widget.hpBarBg.fill({color: COLOR_HP_BG});
    widget.hpBarFill.rect(PADDING, barY, barWidth * hpRatio, HP_BAR_HEIGHT);
    widget.hpBarFill.fill({color: COLOR_HP_FILL});
  }

  private syncWidgetPosition(widget: UnitInfoWidget, sprite: Sprite): void {
    const scale = sprite.width / BASE_WIDTH;
    widget.container.scale.set(scale);

    const centerX = sprite.x + sprite.width * (0.5 - sprite.anchor.x);
    const topY = sprite.y - sprite.height * sprite.anchor.y;

    widget.container.x = centerX - (BASE_WIDTH * scale) / 2;
    widget.container.y = topY - BASE_HEIGHT * scale - VERTICAL_OFFSET;
    widget.container.visible = sprite.visible;
    widget.container.zIndex = (sprite.zIndex ?? 0) + 1;
  }
}

function hasHp(entity: unknown): entity is HpEntity {
  return typeof entity === 'object' && entity !== null && 'hp' in entity && 'maxHp' in entity;
}
