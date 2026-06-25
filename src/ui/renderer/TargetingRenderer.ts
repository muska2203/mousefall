/**
 * Рендерер оверлеев таргетинга и превью интентов.
 *
 * Ответственность:
 * - Подсветка валидных клеток (зелёный)
 * - Подсветка выбранных клеток (синий)
 * - Подсветка клетки под мышью (жёлтый)
 * - Подсветка зоны AoE (красный)
 * - Отображение preview-интентов: урон (число), движение (стрелка), статус, смерть
 */

import {Container, Graphics, Text, TextStyle} from 'pixi.js';
import { FONT_PANEL_TITLE } from './fonts';
import type {RenderInput, Position, PresentationIntent} from '@presentation/types';
import {TILE_SIZE} from '@utils/constants';

const COLORS = {
  valid: 0xffffff,
  selected: 0x4488ff,
  hover: 0xffff44,
  affected: 0xff4444,
};

const ALPHAS = {
  valid: 0.15,
  selected: 0.15,
  hover: 0.15,
  affected: 0.15,
};

export class TargetingRenderer {
  /** Оверлеи клеток — рисуются под сущностями. */
  public readonly overlayContainer = new Container();
  /** Превью интентов — рисуются поверх сущностей (графика: стрелки). */
  public readonly previewContainer = new Container();
  /** Текстовые превью — выносится в отдельный слой для чёткого рендеринга. */
  public readonly previewTextContainer = new Container();

  /** Мировые координаты текстовых элементов превью (для syncTextLayer в WorldRenderer). */
  public readonly textWorldCoords = new WeakMap<any, { worldX: number; worldY: number }>();

  constructor() {
    // контейнеры управляются извне (WorldRenderer)
  }

  update(input: RenderInput): void {
    this.clearOverlays();
    this.clearPreviews();
    this.clearPreviewTexts();

    const overlay = input.targetingOverlay;
    const zoom = input.zoom;
    if (!overlay) return;

    // Оверлеи клеток
    // Порядок наложения: valid → affected → selected → hover
    for (const pos of overlay.valid) {
      this.drawOverlay(pos, COLORS.valid, ALPHAS.valid);
    }
    for (const pos of overlay.affected) {
      this.drawOverlay(pos, COLORS.affected, ALPHAS.affected);
    }
    for (const pos of overlay.selected) {
      this.drawOverlay(pos, COLORS.selected, ALPHAS.selected);
    }
    if (overlay.hover) {
      this.drawOverlay(overlay.hover, COLORS.hover, ALPHAS.hover);
    }

    // Агрегируем и рисуем preview-интенты
    const damageByPos = new Map<string, number>();
    const statusesByPos = new Map<string, Array<{ type: string; duration: number; value: number }>>();
    const moves: Array<{ from: Position; to: Position }> = [];
    const pushes: Array<{ from: Position; to: Position }> = [];
    const deaths: Position[] = [];

    for (const intent of overlay.previewIntents) {
      switch (intent.type) {
        case 'DAMAGE': {
          const key = `${intent.position.x},${intent.position.y}`;
          damageByPos.set(key, (damageByPos.get(key) ?? 0) + intent.damage);
          break;
        }
        case 'APPLY_STATUS': {
          const key = `${intent.position.x},${intent.position.y}`;
          const list = statusesByPos.get(key) ?? [];
          list.push({ type: intent.statusType, duration: intent.duration, value: intent.value });
          statusesByPos.set(key, list);
          break;
        }
        case 'MOVE':
        case 'JUMP':
          moves.push({ from: intent.from, to: intent.to });
          break;
        case 'PUSH':
          pushes.push({ from: intent.from, to: intent.to });
          break;
        case 'DIE':
          deaths.push(intent.position);
          break;
      }
    }

    for (const [key, damage] of damageByPos) {
      const parts = key.split(',');
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      this.drawDamageNumber({ x, y }, damage, zoom);
    }
    for (const [key, statuses] of statusesByPos) {
      const parts = key.split(',');
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      for (const s of statuses) {
        this.drawStatusIcon({ x, y }, s.type, s.duration, zoom);
      }
    }
    for (const move of moves) {
      this.drawArrow(move.from, move.to, 0xffffff);
    }
    for (const push of pushes) {
      this.drawArrow(push.from, push.to, 0xffaa00);
    }
    for (const pos of deaths) {
      this.drawDeathMarker(pos, zoom);
    }
  }

  private drawOverlay(pos: Position, color: number, alpha: number): void {
    const g = new Graphics();
    g.rect(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    g.fill({ color, alpha });
    g.stroke({ width: 1, color, alpha: 0.2 });
    this.overlayContainer.addChild(g);
  }

  private drawDamageNumber(pos: Position, damage: number, zoom: number): void {
    const text = new Text({
      text: String(damage),
      style: new TextStyle({
        fontFamily: FONT_PANEL_TITLE,
        fontSize: Math.round(14 * zoom),
        fill: '#ff4444',
        fontWeight: 'bold',
        stroke: { width: Math.max(1, Math.round(2 * zoom)), color: '#000000' },
      }),
      resolution: window.devicePixelRatio || 1,
    });
    text.roundPixels = true;
    text.anchor.set(0.5, 1);
    text.x = pos.x * TILE_SIZE + TILE_SIZE / 2;
    text.y = pos.y * TILE_SIZE + TILE_SIZE;
    this.textWorldCoords.set(text, { worldX: text.x, worldY: text.y });
    this.previewTextContainer.addChild(text);
  }

  private drawArrow(from: Position, to: Position, color: number): void {
    const g = new Graphics();
    const fromX = from.x * TILE_SIZE + TILE_SIZE / 2;
    const fromY = from.y * TILE_SIZE + TILE_SIZE / 2;
    const toX = to.x * TILE_SIZE + TILE_SIZE / 2;
    const toY = to.y * TILE_SIZE + TILE_SIZE / 2;

    g.moveTo(fromX, fromY);
    g.lineTo(toX, toY);
    g.stroke({ width: 2, color, alpha: 0.8 });

    // Стрелочка
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowLen = 8;
    const arrowAngle = Math.PI / 6;
    g.moveTo(toX, toY);
    g.lineTo(
      toX - arrowLen * Math.cos(angle - arrowAngle),
      toY - arrowLen * Math.sin(angle - arrowAngle),
    );
    g.moveTo(toX, toY);
    g.lineTo(
      toX - arrowLen * Math.cos(angle + arrowAngle),
      toY - arrowLen * Math.sin(angle + arrowAngle),
    );
    g.stroke({ width: 2, color, alpha: 0.8 });

    this.previewContainer.addChild(g);
  }

  private drawStatusIcon(pos: Position, statusType: string, duration: number, zoom: number): void {
    const icon = statusType === 'burning' ? '🔥' : statusType === 'poisoned' ? '☠' : statusType === 'frozen' ? '❄' : '✨';
    const text = new Text({
      text: `${icon}${duration}`,
      style: new TextStyle({
        fontFamily: FONT_PANEL_TITLE,
        fontSize: Math.round(12 * zoom),
        fill: '#ffaa00',
        fontWeight: 'bold',
        stroke: { width: Math.max(1, Math.round(2 * zoom)), color: '#000000' },
      }),
      resolution: window.devicePixelRatio || 1,
    });
    text.roundPixels = true;
    text.anchor.set(0.5, 0);
    text.x = pos.x * TILE_SIZE + TILE_SIZE / 2;
    text.y = pos.y * TILE_SIZE + 2;
    this.textWorldCoords.set(text, { worldX: text.x, worldY: text.y });
    this.previewTextContainer.addChild(text);
  }

  private drawDeathMarker(pos: Position, zoom: number): void {
    const text = new Text({
      text: '💀',
      style: new TextStyle({
        fontFamily: FONT_PANEL_TITLE,
        fontSize: Math.round(16 * zoom),
      }),
      resolution: window.devicePixelRatio || 1,
    });
    text.roundPixels = true;
    text.anchor.set(0.5, 0.5);
    text.x = pos.x * TILE_SIZE + TILE_SIZE / 2;
    text.y = pos.y * TILE_SIZE + TILE_SIZE / 2;
    this.textWorldCoords.set(text, { worldX: text.x, worldY: text.y });
    this.previewTextContainer.addChild(text);
  }

  private clearOverlays(): void {
    for (let i = this.overlayContainer.children.length - 1; i >= 0; i--) {
      this.overlayContainer.children[i]!.destroy();
    }
  }

  private clearPreviews(): void {
    for (let i = this.previewContainer.children.length - 1; i >= 0; i--) {
      this.previewContainer.children[i]!.destroy();
    }
  }

  private clearPreviewTexts(): void {
    for (let i = this.previewTextContainer.children.length - 1; i >= 0; i--) {
      this.previewTextContainer.children[i]!.destroy();
    }
  }

  clear(): void {
    this.clearOverlays();
    this.clearPreviews();
  }
}
