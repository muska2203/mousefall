/**
 * Информационный виджет над сущностями: портрет, слоты эффектов, HP-бар.
 *
 * Рисуется над каждой сущностью с HP в мировых координатах.
 * Ширина виджета фиксирована относительно размера тайла и не зависит
 * от масштаба спрайта объекта.
 */

import {Container, Graphics, Sprite, Texture} from 'pixi.js';
import type {RenderInput, StatusEffect, AnimationPhase, AnimationNode, AIPreparedIntentViewModel, AIMode} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {Tween, lerp, clamp01} from '@utils/tween';
import {ACTOR_OFFSET_Y_FACTOR} from './EntityRenderer';
import type {Animatable} from '@utils/tween';
import type {AnimationConfigEntry} from '@utils/animationConfig';
import {getStatusEffectSprite, getStatusOverflowSprite, getAIModeSprite} from './spriteRegistry';
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
  /** Иконка главного статуса (AI-режим или overlay). */
  statusIcon: Sprite;
  effectSlots: Sprite[];
  hpBarBg: Graphics;
  hpBarFill: Graphics;
  lastHpRatio: number;
  /** Есть ли хотя бы один слот эффекта, независимо от загрузки текстуры. */
  hasEffects: boolean;
  /** Текущая высота содержимого виджета с учётом слотов эффектов. */
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

  /** Обновить виджеты для всех сущностей с HP на основе DisplayState. */
  update(input: RenderInput, getSprite: (id: string) => Sprite | undefined): void {
    const displayState = input.displayState;
    const seen = new Set<string>();

    const processEntity = (id: string, entity: HpEntity) => {
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

      const aiMode = input.aiModeByEntity.get(id) ?? null;
      const preparedAbility = aiMode === 'prepared'
        ? (input.aiPreparedIntents.find((intent) => intent.entityId === id) ?? null)
        : null;
      this.updateStatusIcon(widget, aiMode, preparedAbility);

      // Не перезаписываем полоску текущим HP, если для сущности уже идёт
      // анимация изменения HP или она запланирована в текущем кадре.
      // Иначе полоска сначала резко падёт на итоговый уровень,
      // а затем animateHpChange вернёт её к начальному значению.
      const hasPlannedHpChange = this.hasPendingHpChange(input.animations, id);
      if (!this.hpChangeAnimations.has(id) && !hasPlannedHpChange) {
        this.updateHpBar(widget, entity.hp, entity.maxHp);
      }
      this.syncWidgetPosition(widget, sprite);
    };

    const player = displayState.player;
    if (hasHp(player)) {
      processEntity(player.id, player);
    }
    for (const entity of displayState.entities.values()) {
      if (hasHp(entity)) {
        processEntity(entity.id, entity);
      }
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

  /** Анимация изменения HP: плавное изменение заполнения полоски.
   *  Несколько вызовов для одной сущности не выстраиваются в очередь:
   *  каждый новый запрос прерывает текущую анимацию и стартует от текущего
   *  визуального значения. Это предотвращает рывки и «перепрыгивание» полоски
   *  при нескольких damage-нодах, попадающих в одну сущность. */
  animateHpChange(entityId: string, fromHp: number, toHp: number, maxHp: number, config: AnimationConfigEntry): Promise<void> {
    return new Promise((resolve) => {
      const widget = this.widgets.get(entityId);
      if (!widget) {
        resolve();
        return;
      }

      // Прерываем предыдущую анимацию полоски для этой сущности, если есть.
      // Делаем это до расчёта стартовой точки, чтобы взять актуальное
      // визуальное значение, а не зафиксированное в состоянии fromHp.
      const prev = this.hpChangeAnimations.get(entityId);
      if (prev) {
        prev.tween.cancel();
        prev.onComplete();
        this.hpChangeAnimations.delete(entityId);
      }

      // Начинаем tween от текущего отображаемого HP, а не от fromHp.
      // Если несколько анимаций урона идут подряд, fromHp из шага
      // отражает состояние до конкретного удара, но полоска в этот
      // момент ещё догоняет предыдущую анимацию. Старт от визуального
      // значения избавляет от рывка и «лишнего» уменьшения полоски.
      const visualFromHp = widget.lastHpRatio * maxHp;

      const tween = new Tween({
        duration: config.duration,
        easing: config.easing,
        onUpdate: (p) => {
          const hp = lerp(visualFromHp, toHp, p);
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

  /** Проверить, есть ли в запланированных анимациях шаг HP_CHANGE для сущности. */
  private hasPendingHpChange(phases: readonly AnimationPhase[] | null, entityId: string): boolean {
    if (!phases) return false;
    for (const phase of phases) {
      for (const node of phase.nodes) {
        if (this.findHpChangeInNode(node, entityId)) return true;
      }
    }
    return false;
  }

  private findHpChangeInNode(node: AnimationNode, entityId: string): boolean {
    if (node.step.type === 'HP_CHANGE' && node.step.entityId === entityId) {
      return true;
    }
    for (const child of node.children) {
      if (this.findHpChangeInNode(child, entityId)) return true;
    }
    return false;
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

    const statusIcon = new Sprite(Texture.EMPTY);
    statusIcon.anchor.set(0.5, 0.5);
    const effectSlots: Sprite[] = [];
    for (let i = 0; i < MAX_VISIBLE_STATUS_SLOTS; i++) {
      const slot = new Sprite(Texture.EMPTY);
      slot.anchor.set(0, 0);
      effectSlots.push(slot);
    }
    const hpBarBg = new Graphics();
    const hpBarFill = new Graphics();

    container.addChild(statusIcon, ...effectSlots, hpBarBg, hpBarFill);

    return {
      container,
      statusIcon,
      effectSlots,
      hpBarBg,
      hpBarFill,
      lastHpRatio: 1,
      hasEffects: false,
      contentHeight: DEFAULT_CONTENT_HEIGHT,
    };
  }

  private updateStatusIcon(
    widget: UnitInfoWidget,
    status: AIMode | null,
    preparedAbility: AIPreparedIntentViewModel | null,
  ): void {
    const iconY = PADDING;
    const iconX = BASE_WIDTH / 2;

    if (status) {
      widget.statusIcon.visible = false;
      let spritePath: string;
      if (status === 'prepared' && preparedAbility?.icon) {
        // Для подготовленного скилла показываем иконку самого скилла.
        spritePath = preparedAbility.icon;
      } else {
        // Для обычных AI-режимов используем спрайт режима.
        spritePath = getAIModeSprite(status);
      }
      this.applyTexture(widget.statusIcon, spritePath, CIRCLE_DIAMETER);
      widget.statusIcon.x = iconX;
      widget.statusIcon.y = iconY + CIRCLE_DIAMETER / 2;
    } else {
      widget.statusIcon.texture = Texture.EMPTY;
      widget.statusIcon.visible = false;
    }
  }

  private updateHpBar(widget: UnitInfoWidget, hp: number, maxHp: number): void {
    widget.hpBarBg.clear();
    widget.hpBarFill.clear();

    const hpRatio = maxHp > 0 ? clamp01(hp / maxHp) : 0;
    widget.lastHpRatio = hpRatio;

    const isFull = hpRatio >= 1;
    const hasEffectSlots = widget.hasEffects;
    const iconBottomY = PADDING + CIRCLE_DIAMETER;
    const slotY = hasEffectSlots
      ? iconBottomY + PADDING
      : iconBottomY;

    // HP-бар показываем только при неполном HP.
    widget.hpBarBg.visible = !isFull;
    widget.hpBarFill.visible = !isFull;

    if (!isFull) {
      const barY = hasEffectSlots
        ? slotY + EFFECT_SIZE + PADDING
        : slotY + PADDING;
      const barWidth = BASE_WIDTH - 2 * PADDING;
      widget.hpBarBg.rect(PADDING, barY, barWidth, HP_BAR_HEIGHT);
      widget.hpBarBg.fill({color: COLOR_HP_BG});
      widget.hpBarFill.rect(PADDING, barY, barWidth * hpRatio, HP_BAR_HEIGHT);
      widget.hpBarFill.fill({color: COLOR_HP_FILL});

      widget.contentHeight = barY + HP_BAR_HEIGHT + PADDING;
    } else {
      // При полном HP бар скрыт, высота виджета заканчивается на слотах эффектов
      // (или сразу под иконкой, если эффектов нет).
      const contentBottomY = hasEffectSlots
        ? slotY + EFFECT_SIZE
        : slotY;
      widget.contentHeight = contentBottomY + PADDING;
    }
  }

  private updateEffectSlots(widget: UnitInfoWidget, effects: readonly StatusEffect[]): void {
    const hasEffects = effects.length > 0;
    widget.hasEffects = hasEffects;
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

  private applyTexture(slot: Sprite, path: string, size: number = EFFECT_SIZE): void {
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
          slot.width = size;
          slot.height = size;
        })
        .catch(() => {});
    }

    slot.width = size;
    slot.height = size;
  }

  private syncWidgetPosition(widget: UnitInfoWidget, sprite: Sprite): void {
    const scale = TILE_SIZE / BASE_WIDTH;
    widget.container.scale.set(scale);

    const isActor = sprite.anchor.x === 0.5 && sprite.anchor.y === 1;
    const tileX = isActor
      ? (sprite.x - TILE_SIZE / 2) / TILE_SIZE
      : sprite.x / TILE_SIZE;
    const tileY = isActor
      ? (sprite.y - TILE_SIZE * ACTOR_OFFSET_Y_FACTOR) / TILE_SIZE
      : sprite.y / TILE_SIZE;

    widget.container.x = tileX * TILE_SIZE;
    widget.container.y = tileY * TILE_SIZE - widget.contentHeight * scale - VERTICAL_OFFSET;
    widget.container.visible = sprite.visible;
    widget.container.zIndex = (sprite.zIndex ?? 0) + 1;
  }
}

function hasHp(entity: unknown): entity is HpEntity {
  return typeof entity === 'object' && entity !== null && 'hp' in entity && 'maxHp' in entity;
}


