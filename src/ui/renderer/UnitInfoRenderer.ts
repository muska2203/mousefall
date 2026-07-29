/**
 * Информационный виджет над сущностями: портрет и слоты эффектов.
 *
 * Рисуется над итоговым спрайтом сущности с HP, учитывая его текущие
 * размеры и якорь. Ширина виджета фиксирована относительно размера тайла
 * и не зависит от масштаба спрайта объекта.
 */

import {Container, Sprite, Texture} from 'pixi.js';
import type {
    AIMode,
    AIPreparedIntentViewModel,
    RenderInput,
    StatusEffect
} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';
import {getAIModeSprite, getStatusEffectSprite, getStatusOverflowSprite} from './spriteRegistry';
import {getTexture, getTextureSync} from './TextureCache';


const BASE_WIDTH = 80;
/** Начальная высота содержимого виджета до первого расчёта реальной высоты. */
const DEFAULT_CONTENT_HEIGHT = 40;
const PADDING = 6;
const CIRCLE_DIAMETER = 28;
const EFFECT_SIZE = 14;
const EFFECT_GAP = 4;
const VERTICAL_OFFSET = 1;

const MAX_VISIBLE_STATUS_SLOTS = 4;
const OVERFLOW_SLOT_INDEX = 3;

type HpEntity = {hp: number; maxHp: number; isAlive?: boolean};

type UnitInfoWidget = {
  container: Container;
  /** Иконка главного статуса (AI-режим или overlay). */
  statusIcon: Sprite;
  effectSlots: Sprite[];
  /** Есть ли хотя бы один слот эффекта, независимо от загрузки текстуры. */
  hasEffects: boolean;
  /** Текущая высота содержимого виджета с учётом слотов эффектов. */
  contentHeight: number;
};

export class UnitInfoRenderer {
  public readonly container = new Container();
  private widgets = new Map<string, UnitInfoWidget>();

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

      this.syncWidgetPosition(widget, sprite);
    };

    const player = displayState.player;
    // Не рисуем виджет для мёртвого игрока, даже если он ещё не удалён из DisplayState.
    if (hasHp(player) && player.isAlive !== false) {
      processEntity(player.id, player);
    }
    for (const entity of displayState.entities.values()) {
      // Мёртвые сущности пропускаются: виджет удалится в конце update(),
      // а не будет висеть до события DEAD_ENTITIES_CLEANED.
      if (hasHp(entity) && entity.isAlive !== false) {
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

  /** Освободить ресурсы. */
  destroy(): void {
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

    container.addChild(statusIcon, ...effectSlots);

    return {
      container,
      statusIcon,
      effectSlots,
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

    widget.contentHeight = hasEffects
      ? slotY + EFFECT_SIZE + PADDING
      : slotY + PADDING;
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

    // Верхняя граница спрайта в координатах родителя (entityRenderer.container).
    const spriteTop = sprite.y - sprite.height * sprite.anchor.y;
    // Горизонтальный центр спрайта, чтобы центрировать виджет независимо
    // от его ширины и якоря.
    const spriteCenterX = sprite.x + sprite.width * (0.5 - sprite.anchor.x);

    widget.container.x = spriteCenterX - (BASE_WIDTH * scale) / 2;
    widget.container.y = spriteTop - widget.contentHeight * scale - VERTICAL_OFFSET;
    widget.container.visible = sprite.visible;
    widget.container.zIndex = (sprite.zIndex ?? 0) + 1;
  }
}

function hasHp(entity: unknown): entity is HpEntity {
  return typeof entity === 'object' && entity !== null && 'hp' in entity && 'maxHp' in entity;
}


