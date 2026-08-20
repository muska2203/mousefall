/**
 * Рендерер оверлеев таргетинга и превью интентов.
 *
 * Ответственность:
 * - Подсветка клеток: рамка толщиной 2 экранных пикселя с отступом 3 пикселя
 *   внутрь клетки + полупрозрачная заливка тем же цветом
 *   (валидные — белые, выбранные — синие, под мышью — жёлтые, AoE — красные,
 *   подготовленные AI-скиллы — оранжевые)
 * - Пунктирные линии (автопуть, линия к цели каста или к врагу под курсором —
 *   от персонажа либо от последнего шага автопути до атакующей клетки)
 * - Отображение preview-интентов: урон (число), движение (стрелка), смерть
 *
 * Толщина всех рамок и линий задана в экранных пикселях и не масштабируется
 * zoom'ом камеры (мировые значения делятся на zoom).
 */

import {Container, Graphics, Text, TextStyle} from 'pixi.js';
import {FONT_PANEL_TITLE} from './fonts';
import type {Position, RenderInput} from '@presentation/types';
import {TILE_HEIGHT, TILE_SIZE} from '@utils/constants';
import {cellCenter, cellRect, type ScreenPoint} from './spritePlacement';

const COLORS = {
  valid: 0xffffff,
  selected: 0x4488ff,
  hover: 0xffff44,
  affected: 0xff4444,
  aiPrepared: 0xff8800,
  pathPreview: 0xffffff,  // белый — hover
  pathMove: 0x44ff88,     // зелёный — движение / interactable
  pathEnemy: 0xff4444,    // красный — враг
};

/** Толщина рамок и линий в экранных пикселях. */
const STROKE_WIDTH_PX = 1;
/** Отступ рамки подсветки внутрь клетки в экранных пикселях. */
const CELL_INSET_PX = 2;
/** Длина штриха и промежутка пунктирной линии в экранных пикселях. */
const DASH_PX = 6;
const DASH_GAP_PX = 4;
/** Прозрачность заливки подсветки клеток — одинакова для всех видов подсветки. */
const CELL_FILL_ALPHA = 0.15;
/** Прозрачность рамки подсветки клеток. */
const CELL_FRAME_ALPHA = 0.7;
/** Прозрачность заливки и рамки паттерна прицеливания (тусклая подсветка под валидными целями). */
const PATTERN_FILL_ALPHA = 0.06;
const PATTERN_FRAME_ALPHA = 0.35;
/** Прозрачность линий и штрихов: пунктирные линии, отметки концов ходов, стрелки превью. */
const LINE_ALPHA = 0.8;

export class TargetingRenderer {
  /** Оверлеи клеток — рисуются под сущностями. */
  public readonly overlayContainer = new Container();
  /** Превью интентов — рисуются поверх сущностей (графика: стрелки). */
  public readonly previewContainer = new Container();
  /** Текстовые превью — выносится в отдельный слой для чёткого рендеринга. */
  public readonly previewTextContainer = new Container();

  /** Мировые координаты текстовых элементов превью (для syncTextLayer в WorldRenderer). */
  public readonly textWorldCoords = new WeakMap<any, { worldX: number; worldY: number }>();

  /**
   * Состояние линии автопути для покадрового обновления стартовой точки
   * (линия следует за спрайтом персонажа во время анимации перемещения).
   */
  private pathLine: {
    g: Graphics;
    path: Position[];
    color: number;
    zoom: number;
    start: ScreenPoint;
  } | null = null;

  constructor() {
    // контейнеры управляются извне (WorldRenderer)
  }

  update(input: RenderInput, playerVisualCenter?: ScreenPoint): void {
    this.clearOverlays();
    this.clearPreviews();
    this.clearPreviewTexts();

    const overlay = input.targetingOverlay;
    const zoom = input.zoom;
    // Стартовая точка линий от персонажа: визуальная позиция спрайта
    // (следует за анимацией перемещения), в покое совпадает с центром клетки.
    const player = input.displayState.player;
    const playerCenter = playerVisualCenter ?? cellCenter(player.x, player.y);

    if (overlay) {
      // Оверлеи клеток
      // Порядок наложения: radiusCells → valid → affected → selected → hover
      // Паттерн прицеливания (radiusCells) рисуется тускло, валидные цели —
      // поверх, ярко.
      for (const pos of overlay.radiusCells ?? []) {
        this.drawCellHighlight(pos, COLORS.valid, zoom, PATTERN_FILL_ALPHA, PATTERN_FRAME_ALPHA);
      }
      for (const pos of overlay.valid) {
        this.drawCellHighlight(pos, COLORS.valid, zoom);
      }
      for (const pos of overlay.affected) {
        this.drawCellHighlight(pos, COLORS.affected, zoom);
      }
      for (const pos of overlay.selected) {
        this.drawCellHighlight(pos, COLORS.selected, zoom);
      }
      if (overlay.hover) {
        this.drawCellHighlight(overlay.hover, COLORS.hover, zoom);
      }

      // Пунктирная линия от персонажа до цели при наведении скиллом
      // на валидную для каста клетку.
      const hover = overlay.hover;
      if (hover && overlay.valid.some((p) => p.x === hover.x && p.y === hover.y)) {
        this.drawDashedLine(
          [playerCenter, cellCenter(hover.x, hover.y)],
          COLORS.hover,
          zoom,
        );
      }
    }

    // Оверлей прицеливания по врагу под курсором (обычный режим, не таргетинг):
    // тусклая зона досягаемости оружия (стиль radiusCells), подсветка клетки
    // цели и пунктирная линия к цели. Если цель вне зоны поражения и построен
    // автопуть до атакующей клетки, линия идёт от последнего шага пути —
    // оттуда будет выполнена атака. Иначе — от визуального центра игрока.
    const enemyHover = input.enemyHoverOverlay;
    if (enemyHover) {
      for (const pos of enemyHover.rangeCells) {
        this.drawCellHighlight(pos, COLORS.valid, zoom, PATTERN_FILL_ALPHA, PATTERN_FRAME_ALPHA);
      }
      this.drawCellHighlight(enemyHover.target, COLORS.affected, zoom);
      const path = input.highlightedPath;
      const lastStep =
        !enemyHover.inRange && path && path.length > 0
          ? path[path.length - 1]!
          : null;
      // В fallback-режиме автопуть ведёт в клетку самого врага — линия от неё
      // выродилась бы в точку, поэтому остаётся линия от игрока.
      const lineStart =
        lastStep && (lastStep.x !== enemyHover.target.x || lastStep.y !== enemyHover.target.y)
          ? cellCenter(lastStep.x, lastStep.y)
          : playerCenter;
      this.drawDashedLine(
        [lineStart, cellCenter(enemyHover.target.x, enemyHover.target.y)],
        COLORS.pathEnemy,
        zoom,
      );
    }

    // Подсветка автопути: подсветка целевой клетки + пунктирная линия пути +
    // отметки концов ходов. Промежуточные клетки не подсвечиваются.
    // Preview (не зафиксирован) — белый; committed к врагу — красный;
    // committed к интерактивному объекту или пустому тайлу — зелёный.
    if (input.highlightedPath && input.highlightedPath.length > 0) {
      const isPreview = !input.highlightedPathCommitted || input.highlightedPathTargetKind === 'none';
      const color = isPreview
        ? COLORS.pathPreview
        : input.highlightedPathTargetKind === 'enemy'
          ? COLORS.pathEnemy
          : COLORS.pathMove;

      const lastPos = input.highlightedPath[input.highlightedPath.length - 1]!;
      this.drawCellHighlight(lastPos, color, zoom);
      this.drawPathLine(input.highlightedPath, color, playerCenter, zoom);

      // Отметки тайлов, на которых закончится ход персонажа.
      const turnEndIndices = input.highlightedPathTurnEndIndices;
      for (const idx of turnEndIndices) {
        const pos = input.highlightedPath[idx]!;
        const prev = idx === 0
          ? { x: input.displayState.player.x, y: input.displayState.player.y }
          : input.highlightedPath[idx - 1]!;
        const next = idx < input.highlightedPath.length - 1
          ? input.highlightedPath[idx + 1] ?? null
          : null;
        this.drawTurnEndMarker(pos, prev, next, color, zoom);
      }
    }

    // Подсветка зон подготовленных AI-скиллов — всегда, независимо от режима таргетинга игрока
    for (const intent of input.aiPreparedIntents) {
      for (const pos of intent.affectedPositions) {
        this.drawCellHighlight(pos, COLORS.aiPrepared, zoom);
      }
    }

    // Агрегируем и рисуем preview-интенты: как пользовательские, так и подготовленные AI
    const previewIntents = [
      ...(overlay?.previewIntents ?? []),
      ...input.aiPreparedIntents.flatMap((intent) => intent.intents),
    ];

    const damageByPos = new Map<string, number>();
    const moves: Array<{ from: Position; to: Position }> = [];
    const pushes: Array<{ from: Position; to: Position }> = [];
    const deaths: Position[] = [];

    for (const intent of previewIntents) {
      switch (intent.type) {
        case 'DAMAGE': {
          const key = `${intent.position.x},${intent.position.y}`;
          damageByPos.set(key, (damageByPos.get(key) ?? 0) + intent.damage);
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
        case 'HEAL':
          // Лечение пока не визуализируется в превью таргетинга.
          break;
      }
    }

    for (const [key, damage] of damageByPos) {
      const parts = key.split(',');
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      this.drawDamageNumber({ x, y }, damage, zoom);
    }
    for (const move of moves) {
      this.drawArrow(move.from, move.to, 0xffffff, zoom);
    }
    for (const push of pushes) {
      this.drawArrow(push.from, push.to, 0xffaa00, zoom);
    }
    for (const pos of deaths) {
      this.drawDeathMarker(pos, zoom);
    }
  }

  /**
   * Подсветка клетки: рамка толщиной STROKE_WIDTH_PX с отступом CELL_INSET_PX
   * внутрь клетки + полупрозрачная заливка тем же цветом.
   * Размеры рамки заданы в экранных пикселях и не масштабируются zoom'ом.
   * Прозрачности можно переопределить (тусклая подсветка паттерна прицеливания).
   */
  private drawCellHighlight(
    pos: Position,
    color: number,
    zoom: number,
    fillAlpha: number = CELL_FILL_ALPHA,
    frameAlpha: number = CELL_FRAME_ALPHA,
  ): void {
    const g = new Graphics();
    const {x, y, width, height} = cellRect(pos.x, pos.y);
    const inset = CELL_INSET_PX / zoom;
    g.rect(x + inset, y + inset, width - inset * 2, height - inset * 2);
    g.fill({ color, alpha: fillAlpha });
    g.stroke({ width: STROKE_WIDTH_PX / zoom, color, alpha: frameAlpha });
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
    text.y = pos.y * TILE_HEIGHT + TILE_HEIGHT;
    this.textWorldCoords.set(text, { worldX: text.x, worldY: text.y });
    this.previewTextContainer.addChild(text);
  }

  private drawArrow(from: Position, to: Position, color: number, zoom: number): void {
    const g = new Graphics();
    const {x: fromX, y: fromY} = cellCenter(from.x, from.y);
    const {x: toX, y: toY} = cellCenter(to.x, to.y);

    const strokeWidth = STROKE_WIDTH_PX / zoom;
    g.moveTo(fromX, fromY);
    g.lineTo(toX, toY);
    g.stroke({ width: strokeWidth, color, alpha: LINE_ALPHA });

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
    g.stroke({ width: strokeWidth, color, alpha: LINE_ALPHA });

    this.previewContainer.addChild(g);
  }

  /** Пунктирная линия автопути от стартовой точки через все клетки пути. */
  private drawPathLine(path: Position[], color: number, start: ScreenPoint, zoom: number): void {
    if (path.length === 0) return;

    const g = new Graphics();
    this.overlayContainer.addChild(g);
    this.pathLine = { g, path, color, zoom, start };
    this.strokePathLine();
  }

  /**
   * Обновить стартовую точку линии автопути (вызывается покадрово из тикера,
   * чтобы линия следовала за спрайтом персонажа во время анимации перемещения).
   */
  updatePathStart(center: ScreenPoint): void {
    if (!this.pathLine) return;
    if (this.pathLine.start.x === center.x && this.pathLine.start.y === center.y) return;
    this.pathLine.start = center;
    this.strokePathLine();
  }

  /** Перерисовать линию автопути от текущей стартовой точки. */
  private strokePathLine(): void {
    const pl = this.pathLine;
    if (!pl) return;
    const points: ScreenPoint[] = [pl.start];
    for (const pos of pl.path) {
      points.push(cellCenter(pos.x, pos.y));
    }
    pl.g.clear();
    this.strokeDashed(pl.g, points, pl.color, pl.zoom);
  }

  /**
   * Нарисовать пунктирную ломаную по точкам в overlayContainer.
   * Толщина линии, длина штриха и промежутка — в экранных пикселях,
   * не масштабируются zoom'ом. Паттерн пунктира не сбрасывается на изломах.
   */
  private drawDashedLine(points: ScreenPoint[], color: number, zoom: number): void {
    if (points.length < 2) return;

    const g = new Graphics();
    this.strokeDashed(g, points, color, zoom);
    this.overlayContainer.addChild(g);
  }

  /** Отрисовать пунктирную ломаную в существующий Graphics (без добавления в контейнер). */
  private strokeDashed(g: Graphics, points: ScreenPoint[], color: number, zoom: number): void {
    if (points.length < 2) return;

    const dash = DASH_PX / zoom;
    const gap = DASH_GAP_PX / zoom;

    let cur = points[0]!;
    let penDown = true;
    let phaseLeft = dash;
    g.moveTo(cur.x, cur.y);

    for (let i = 1; i < points.length; i++) {
      const end = points[i]!;
      const dx = end.x - cur.x;
      const dy = end.y - cur.y;
      let dist = Math.hypot(dx, dy);
      if (dist === 0) continue;
      // Единичный вектор направления сегмента — вычисляется один раз,
      // до того как dist начнёт уменьшаться в цикле.
      const ux = dx / dist;
      const uy = dy / dist;
      while (dist > 0) {
        const step = Math.min(dist, phaseLeft);
        const nx = cur.x + ux * step;
        const ny = cur.y + uy * step;
        if (penDown) {
          g.lineTo(nx, ny);
        } else {
          g.moveTo(nx, ny);
        }
        cur = { x: nx, y: ny };
        phaseLeft -= step;
        dist -= step;
        if (phaseLeft <= 0) {
          penDown = !penDown;
          phaseLeft = penDown ? dash : gap;
        }
      }
    }

    g.stroke({ width: STROKE_WIDTH_PX / zoom, color, alpha: LINE_ALPHA });
  }

  /** Нарисовать отметку конца хода — короткий перпендикулярный штрих на тайле. */
  private drawTurnEndMarker(
    pos: Position,
    prev: Position,
    next: Position | null,
    color: number,
    zoom: number,
  ): void {
    const {x: cx, y: cy} = cellCenter(pos.x, pos.y);

    let dirX = 0;
    let dirY = 0;
    let count = 0;

    const addDir = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        dirX += dx / len;
        dirY += dy / len;
        count++;
      }
    };

    addDir(pos.x - prev.x, pos.y - prev.y);
    if (next) {
      addDir(next.x - pos.x, next.y - pos.y);
    }

    if (count === 0) return;

    const len = Math.hypot(dirX, dirY);
    if (len === 0) return;
    dirX /= len;
    dirY /= len;

    // Перпендикуляр к направлению пути (биссектрисе угла на тайле).
    const perpX = -dirY;
    const perpY = dirX;

    const markerLen = 4;
    const g = new Graphics();
    g.moveTo(cx - perpX * markerLen, cy - perpY * markerLen);
    g.lineTo(cx + perpX * markerLen, cy + perpY * markerLen);
    g.stroke({ width: STROKE_WIDTH_PX / zoom, color, alpha: LINE_ALPHA });

    this.overlayContainer.addChild(g);
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
    const center = cellCenter(pos.x, pos.y);
    text.x = center.x;
    text.y = center.y;
    this.textWorldCoords.set(text, { worldX: text.x, worldY: text.y });
    this.previewTextContainer.addChild(text);
  }

  private clearOverlays(): void {
    for (let i = this.overlayContainer.children.length - 1; i >= 0; i--) {
      this.overlayContainer.children[i]!.destroy();
    }
    this.pathLine = null;
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
