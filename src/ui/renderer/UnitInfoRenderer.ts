/**
 * Информационный виджет над сущностями: портрет, слоты эффектов, HP-бар.
 *
 * Рисуется над каждой сущностью с HP в мировых координатах.
 * Ширина виджета масштабируется под ширину спрайта объекта.
 */

import {Container, Graphics, Sprite, Texture} from 'pixi.js';
import type {RenderInput, StatusEffect} from '@presentation/types';
import {Tween, lerp, clamp01} from '@utils/tween';
import type {Animatable} from '@utils/tween';
import type {AnimationConfigEntry} from '@utils/animationConfig';
import {getStatusEffectSprite, getStatusOverflowSprite} from './spriteRegistry';
import {getTexture, getTextureSync} from './TextureCache';


const BASE_WIDTH = 80;
/** Начальная высота содержимого виджета до первого расчёта реальной высоты. */
const DEFAULT_CONTENT_HEIGHT = 74;
const PADDING = 6;
const CIRCLE_DIAMETER = 28;
const EFFECT_SIZE = 14;
const EFFECT_GAP = 4;
const HP_BAR_HEIGHT = 8;
const VERTICAL_OFFSET = 1;

const COLOR_SLOT_FILL = 0x222222;
const COLOR_HP_BG = 0x333333;
const COLOR_HP_FILL = 0xe74c3c;

const MAX_VISIBLE_STATUS_SLOTS = 4;
const OVERFLOW_SLOT_INDEX = 3;

type HpEntity = {hp: number; maxHp: number};

type UnitInfoWidget = {
  container: Container;
  circle: Graphics;
  effectSlots: Sprite[];
  hpBarBg: Graphics;
  hpBarFill: Graphics;
  lastHpRatio: number;
  /** Текущая высота содержимого виджета с учётом видимых слотов эффектов. */
  contentHeight: number;
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

      const effects = input.statusEffectsByEntity.get(id) ?? [];
      this.updateEffectSlots(widget, effects);

      // Если идёт анимация HP, не сбрасываем заполнение текущим значением —
      // иначе полоска будет мигать конечным HP во время tween.
      if (!this.hpChangeAnimations.has(id)) {
        this.updateHpBar(widget, entity.hp, entity.maxHp);
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
      this.updateHpBar(widget, fromHp, maxHp);

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
          this.updateHpBar(widget, hp, maxHp);
        },
        onComplete: () => {
          this.updateHpBar(widget, toHp, maxHp);
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
    const effectSlots: Sprite[] = [];
    for (let i = 0; i < MAX_VISIBLE_STATUS_SLOTS; i++) {
      const slot = new Sprite(Texture.EMPTY);
      slot.anchor.set(0, 0);
      effectSlots.push(slot);
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
      contentHeight: DEFAULT_CONTENT_HEIGHT,
    };
  }

  private updateHpBar(widget: UnitInfoWidget, hp: number, maxHp: number): void {
    widget.circle.clear();
    widget.hpBarBg.clear();
    widget.hpBarFill.clear();

    // Круг-иконка вверху по центру
    const circleY = PADDING;
    const circleX = BASE_WIDTH / 2;
    widget.circle.circle(circleX, circleY + CIRCLE_DIAMETER / 2, CIRCLE_DIAMETER / 2);
    widget.circle.fill({color: COLOR_SLOT_FILL});

    // HP-бар
    const hasVisibleSlots = widget.effectSlots.some((slot) => slot.visible);
    const slotY = hasVisibleSlots
      ? circleY + CIRCLE_DIAMETER + PADDING
      : circleY + CIRCLE_DIAMETER;
    const barY = hasVisibleSlots
      ? slotY + EFFECT_SIZE + PADDING
      : slotY + PADDING;
    const barWidth = BASE_WIDTH - 2 * PADDING;
    const hpRatio = maxHp > 0 ? clamp01(hp / maxHp) : 0;
    widget.lastHpRatio = hpRatio;
    widget.hpBarBg.rect(PADDING, barY, barWidth, HP_BAR_HEIGHT);
    widget.hpBarBg.fill({color: COLOR_HP_BG});
    widget.hpBarFill.rect(PADDING, barY, barWidth * hpRatio, HP_BAR_HEIGHT);
    widget.hpBarFill.fill({color: COLOR_HP_FILL});

    widget.contentHeight = barY + HP_BAR_HEIGHT + PADDING;
  }

  private updateEffectSlots(widget: UnitInfoWidget, effects: readonly StatusEffect[]): void {
    const hasEffects = effects.length > 0;
    const circleY = PADDING;
    const slotY = hasEffects
      ? circleY + CIRCLE_DIAMETER + PADDING
      : circleY + CIRCLE_DIAMETER;
    const totalSlotsWidth = MAX_VISIBLE_STATUS_SLOTS * EFFECT_SIZE + (MAX_VISIBLE_STATUS_SLOTS - 1) * EFFECT_GAP;
    let slotX = (BASE_WIDTH - totalSlotsWidth) / 2;

    // Сбрасываем все слоты
    for (const slot of widget.effectSlots) {
      slot.x = slotX;
      slot.y = slotY;
      slot.visible = false;
      slot.texture = Texture.EMPTY;
      slot.width = EFFECT_SIZE;
      slot.height = EFFECT_SIZE;
      slotX += EFFECT_SIZE + EFFECT_GAP;
    }

    // Первые слоты занимают реальные эффекты
    for (let i = 0; i < OVERFLOW_SLOT_INDEX && i < effects.length; i++) {
      const slot = widget.effectSlots[i];
      const effect = effects[i];
      if (!slot || !effect) continue;
      this.applyStatusTexture(slot, effect.type);
    }

    // Если эффектов больше, чем влезает — последний слот показывает "..."
    const overflowSlot = widget.effectSlots[OVERFLOW_SLOT_INDEX];
    if (!overflowSlot) return;
    if (effects.length > MAX_VISIBLE_STATUS_SLOTS) {
      this.applyTexture(overflowSlot, getStatusOverflowSprite());
    } else {
      const fourthEffect = effects[OVERFLOW_SLOT_INDEX];
      if (fourthEffect) {
        this.applyStatusTexture(overflowSlot, fourthEffect.type);
      }
    }
  }

  private applyStatusTexture(slot: Sprite, statusType: string): void {
    this.applyTexture(slot, getStatusEffectSprite(statusType));
  }

  private applyTexture(slot: Sprite, path: string): void {
    const texture = getTextureSync(path);

    if (texture) {
      slot.texture = texture;
      slot.visible = true;
    } else {
      // Текстура ещё не загружена — скрываем слот и подгружаем фоново.
      slot.texture = Texture.EMPTY;
      slot.visible = false;
      getTexture(path)
        .then((loaded) => {
          if (slot.destroyed) return;
          slot.texture = loaded;
          slot.visible = true;
          slot.width = EFFECT_SIZE;
          slot.height = EFFECT_SIZE;
        })
        .catch(() => {});
    }

    slot.width = EFFECT_SIZE;
    slot.height = EFFECT_SIZE;
  }

  private syncWidgetPosition(widget: UnitInfoWidget, sprite: Sprite): void {
    const scale = sprite.width / BASE_WIDTH;
    widget.container.scale.set(scale);

    const centerX = sprite.x + sprite.width * (0.5 - sprite.anchor.x);
    const topY = sprite.y - sprite.height * sprite.anchor.y;

    widget.container.x = centerX - (BASE_WIDTH * scale) / 2;
    widget.container.y = topY - widget.contentHeight * scale - VERTICAL_OFFSET;
    widget.container.visible = sprite.visible;
    widget.container.zIndex = (sprite.zIndex ?? 0) + 1;
  }
}

function hasHp(entity: unknown): entity is HpEntity {
  return typeof entity === 'object' && entity !== null && 'hp' in entity && 'maxHp' in entity;
}


