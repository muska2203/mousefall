/**
 * Оркестратор игровой сессии (Presentation Layer).
 *
 * Ответственность:
 * - Управление жизненным циклом симуляции: создание, загрузка, сброс.
 * - Перевод фазы игры (playing → gameOver / victory) в UI-режимы.
 * - Единственная точка входа для UI во взаимодействие с Simulation.
 *
 * Правила:
 * - Не содержит игровой логики (урон, движение, генерация — это Simulation).
 * - Не использует browser API (DOM, localStorage, fetch).
 * - Не импортирует UI.
 * - Все мутации GameState только через simulation.dispatch() или фабрики Simulation.
 */

import type {GameState, Simulation, SimulationResult, GameEvent, PlayerStatsSnapshot, Position, ActionPreview} from '@simulation/types';

import type {ExecutionNode} from '@simulation/systems/actions/types';
import type {GameAction} from '@simulation/systems/actions/types';
import {GameSimulation, findFirstAttackableEntityAt} from '@simulation/simulation';
import type {CharacterConfig} from '@simulation/characterCreation';
import type {MapParams} from '@content/schemas';
import type {AnimationNode, RenderInput, EquipmentSnapshot, PlayerSkillViewModel, PresentationActionPreview, InventoryItemViewModel} from './types';
import {getAllPlayerTemplates, tryGetPlayerTemplate, tryGetItem} from '@content/registry';

import {buildAnimationTree} from './animationPlanner';
import {extractEvents, gameEventToLog} from './logBuilder';
import {mapItemTemplateToDetail} from './itemDetailMapper';
import {CameraState} from './cameraState';
import {LogBuffer, type LogItem} from './logBuffer';
import {AnimationState} from './animationState';
import {TargetingController} from './targetingController';

// Реэкспорт типов для UI-слоя, чтобы UI не импортировал из simulation/ напрямую
export type {CharacterConfig} from '@simulation/characterCreation';
export type {MapParams} from '@content/schemas';
export type {AnimationNode, RenderInput, EquipmentSnapshot} from './types';
export type {RenderState} from './types';
export type {PlayerStatsSnapshot} from '@simulation/types';

export type SessionMode =
  | 'mainMenu'
  | 'characterCreation'
  | 'playing'
  | 'gameOver'
  | 'victory';

export type {LogItem} from './logBuffer';

export type GameViewModel = {
  /** Текущий режим экрана */
  mode: SessionMode;
  /** Входные данные для renderer и HUD (null, если игра не начата) */
  renderInput: RenderInput | null;
  /** Журнал событий текущей сессии */
  logs: LogItem[];
};

/** Порядок слотов экипировки для сортировки инвентаря. */
const SLOT_ORDER: Record<string, number> = {
  weapon: 0,
  armor: 1,
  amulet: 2,
};

/** Порядок редкости для сортировки инвентаря (по убыванию). */
const RARITY_ORDER: Record<string, number> = {
  common: 0,
  rare: 1,
  unique: 2,
};

/**
 * Компаратор для сортировки инвентаря.
 *
 * Приоритет:
 * 1. Не-расходуемые предметы первыми.
 * 2. По слоту: оружие → броня → амулет.
 * 3. По подтипу (если задан).
 * 4. По редкости (уникальные → редкие → обычные).
 * 5. По instanceId для стабильного порядка.
 */
function compareInventoryItems(a: InventoryItemViewModel, b: InventoryItemViewModel): number {
  // 1. Расходуемые идут в конец.
  const aConsumable = a.detail.type === 'consumable' ? 1 : 0;
  const bConsumable = b.detail.type === 'consumable' ? 1 : 0;
  if (aConsumable !== bConsumable) return aConsumable - bConsumable;

  // 2. Слоты экипировки: оружие → броня → амулет.
  const aSlot = SLOT_ORDER[a.detail.type] ?? 3;
  const bSlot = SLOT_ORDER[b.detail.type] ?? 3;
  if (aSlot !== bSlot) return aSlot - bSlot;

  // 3. Редкость: уникальные → редкие → обычные.
  const aRarity = RARITY_ORDER[a.detail.rarity] ?? 0;
  const bRarity = RARITY_ORDER[b.detail.rarity] ?? 0;
  if (aRarity !== bRarity) return bRarity - aRarity;

  // 5. Стабильный порядок по instanceId.
  return a.instanceId.localeCompare(b.instanceId);
}

export class GameSession {
  private simulation: Simulation | null = null;
  private mode: SessionMode = 'mainMenu';
  private lastResult: SimulationResult | null = null;
  private camera = new CameraState();
  private logs = new LogBuffer();
  private animation = new AnimationState();
  private targeting = new TargetingController();
  private listeners = new Set<() => void>();
  private viewModelCache: GameViewModel | null = null;
  /** Монотонный счётчик партий анимаций. Инкрементируется при каждом dispatch, порождающем анимации. */
  private animationBatchId = 0;
  /** Клетка под мышью в режиме таргетинга. */
  private targetingHover: Position | null = null;
  /** Удерживаемое направление движения (для автохода при зажатой клавише). */
  private heldDirection: {dx: number; dy: number} | null = null;

  /** Подписаться на изменения сессии. Вызывается после любого mutate-метода. */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    this.viewModelCache = null;
    for (const cb of this.listeners) {
      cb();
    }
  }

  /** Текущий ViewModel для отрисовки UI. Кешируется между нотификациями для useSyncExternalStore. */
  getViewModel(): GameViewModel {
    if (!this.viewModelCache) {
      const state = this.simulation?.getState() ?? null;
      this.viewModelCache = {
        mode: this.mode,
        renderInput: state ? this.buildRenderInput(state) : null,
        logs: this.logs.logs,
      };
    }
    return this.viewModelCache;
  }

  private buildRenderInput(state: Readonly<GameState>): RenderInput {
    const player = state.player;
    const equipment: EquipmentSnapshot = {
      weaponId: player.equippedWeaponId,
      armorId: player.equippedArmorId,
      amuletId: player.equippedAmuletId,
      weaponInstanceId: player.equippedWeaponInstanceId,
      armorInstanceId: player.equippedArmorInstanceId,
      amuletInstanceId: player.equippedAmuletInstanceId,
      weaponDamage: player.equippedWeaponId ? player.damage : null,
    };

    const playerSkills: PlayerSkillViewModel[] = player.abilities.map(ability => {
      const template = this.getAbilityTemplate(ability.templateId);
      const isCasting = player.activeCast?.abilityId === ability.templateId;
      return {
        abilityId: ability.templateId,
        name: template?.name ?? ability.templateId,
        icon: template?.spriteId ? `/assets/skills/${template.spriteId}.png` : null,
        mpCost: template?.mpCost ?? 0,
        cooldown: ability.currentCooldown,
        maxCooldown: template?.cooldown ?? 0,
        isAvailable: ability.currentCooldown === 0 && player.mp >= (template?.mpCost ?? 0) && !isCasting,
        source: ability.source,
        isCasting,
        remainingCastTurns: isCasting ? player.activeCast!.remainingTurns : 0,
      };
    });

    const ps = this.simulation!.getPlayerStats();
    const eq = equipment;

    const heroStats = [
      {type: 'readonly' as const, icon: '💪', name: 'Сила', value: String(ps.effectiveStats.str)},
      {type: 'readonly' as const, icon: '✨', name: 'Интеллект', value: String(ps.effectiveStats.int)},
      {type: 'readonly' as const, icon: '🐾', name: 'Ловкость', value: String(ps.effectiveStats.dex)},
      {type: 'readonly' as const, icon: '❤️', name: 'Выносливость', value: String(ps.effectiveStats.vit)},
    ];

    const weaponTemplate = eq.weaponId ? tryGetItem(eq.weaponId) : null;
    const armorTemplate = eq.armorId ? tryGetItem(eq.armorId) : null;
    const amuletTemplate = eq.amuletId ? tryGetItem(eq.amuletId) : null;

    const weaponDetail = weaponTemplate ? mapItemTemplateToDetail(weaponTemplate) : undefined;
    const armorDetail = armorTemplate ? mapItemTemplateToDetail(armorTemplate) : undefined;
    const amuletDetail = amuletTemplate ? mapItemTemplateToDetail(amuletTemplate) : undefined;

    const equippedIds = new Set([
      player.equippedWeaponInstanceId,
      player.equippedArmorInstanceId,
      player.equippedAmuletInstanceId,
    ].filter(Boolean) as string[]);

    const buildItemDetail = (invItem: typeof player.inventory[0]) => {
      const template = tryGetItem(invItem.templateId);
      const detail = template
        ? mapItemTemplateToDetail(template, {
            stackCount: invItem.quantity,
            rarity: template.rarity,
          })
        : {
            name: invItem.templateId,
            description: '',
            rarity: 'common' as const,
            rarityLabel: 'Обычный',
            typeLabel: 'Неизвестно',
            type: 'unknown',
            icon: '',
            fallbackIcon: '?',
            stackCount: invItem.quantity,
            sections: [],
          };
      const abilityTemplate = invItem.grantedAbility
        ? this.getAbilityTemplate(invItem.grantedAbility.templateId)
        : null;
      return {
        ...detail,
        grantedAbility: invItem.grantedAbility
          ? {
              templateId: invItem.grantedAbility.templateId,
              name: abilityTemplate?.name ?? invItem.grantedAbility.templateId,
              level: invItem.grantedAbility.level,
              icon: abilityTemplate?.spriteId ? `/assets/skills/${abilityTemplate.spriteId}.png` : null,
            }
          : null,
      };
    };

    const findEquippedItem = (instanceId: string | null) =>
      instanceId ? player.inventory.find(i => i.instanceId === instanceId) ?? null : null;

    const weaponItem = findEquippedItem(player.equippedWeaponInstanceId);
    const armorItem = findEquippedItem(player.equippedArmorInstanceId);
    const amuletItem = findEquippedItem(player.equippedAmuletInstanceId);

    const weaponDetailVm = weaponItem ? buildItemDetail(weaponItem) : null;
    const armorDetailVm = armorItem ? buildItemDetail(armorItem) : null;
    const amuletDetailVm = amuletItem ? buildItemDetail(amuletItem) : null;

    const equipSlots = [
      {
        label: 'Оружие',
        icon: weaponItem ? `/assets/items/${weaponItem.templateId}.png` : undefined,
        fallback: '⚔',
        damage: player.equippedWeaponId ? player.damage : null,
        rarity: weaponDetailVm?.rarity ?? 'common',
        detail: weaponDetailVm ?? undefined,
        slotType: 'weapon' as const,
        instanceId: player.equippedWeaponInstanceId,
      },
      {
        label: 'Броня',
        icon: armorItem ? `/assets/items/${armorItem.templateId}.png` : undefined,
        fallback: '🛡',
        rarity: armorDetailVm?.rarity ?? 'common',
        detail: armorDetailVm ?? undefined,
        slotType: 'armor' as const,
        instanceId: player.equippedArmorInstanceId,
      },
      {
        label: 'Амулет',
        icon: amuletItem ? `/assets/items/${amuletItem.templateId}.png` : undefined,
        fallback: '📿',
        rarity: amuletDetailVm?.rarity ?? 'common',
        detail: amuletDetailVm ?? undefined,
        slotType: 'amulet' as const,
        instanceId: player.equippedAmuletInstanceId,
      },
    ];

    const itemsOnFloor = Array.from(state.entities.values())
      .filter(e => e.type === 'item')
      .map(e => ({
        id: e.id,
        x: e.x,
        y: e.y,
        templateId: e.templateId,
      }));

    const inventory = state.player.inventory
      .filter(invItem => !equippedIds.has(invItem.instanceId))
      .map(invItem => {
        const detail = buildItemDetail(invItem);
        const grantedAbility = invItem.grantedAbility
          ? {
              templateId: invItem.grantedAbility.templateId,
              name: detail.grantedAbility?.name ?? invItem.grantedAbility.templateId,
              level: invItem.grantedAbility.level,
            }
          : null;
        return {
          instanceId: invItem.instanceId,
          templateId: invItem.templateId,
          quantity: invItem.quantity,
          detail,
          grantedAbility,
        };
      })
      .sort(compareInventoryItems);

    return {
      state,
      highlightedPath: null,
      animations: this.lastResult ? buildAnimationTree(this.lastResult, state) : null,
      animationBatchId: this.animationBatchId,
      phase: this.animation.phase,
      zoom: this.camera.zoom,
      playerStats: ps,
      equipment,
      targetingOverlay: this.buildTargetingOverlay(state),
      playerSkills,
      heroStats,
      equipSlots,
      itemsOnFloor,
      inventory,
      runStats: state.runStats,
    };
  }

  private getAbilityTemplate(abilityId: string) {
    return this.simulation!.getAbilityInfo(abilityId);
  }

  private buildTargetingOverlay(state: Readonly<GameState>): RenderInput['targetingOverlay'] {
    if (!this.targeting.state) return null;

    const preview = this.targetingHover
      ? this.targeting.previewTarget(this.targetingHover, this.simulation!, state)
      : null;

    return {
      valid: this.targeting.state.validTargets,
      hover: this.targetingHover,
      affected: preview?.affectedPositions ?? [],
      selected: this.targeting.state.selectedTargets,
      previewIntents: preview?.intents ?? [],
    };
  }

  /** Изменить масштаб камеры на дельту. */
  setZoom(delta: number): void {
    const factor = 1 + delta;
    this.camera.multiplyZoom(factor);
    this.notify();
  }

  /** Сбросить масштаб к 1. */
  resetZoom(): void {
    this.camera.resetZoom();
    this.notify();
  }

  /** Текущий режим экрана */
  getMode(): SessionMode {
    return this.mode;
  }

  /**
   * Предпросмотр характеристик персонажа при создании.
   * Не требует активной симуляции.
   */
  static previewCharacterStats(config: CharacterConfig): PlayerStatsSnapshot {
    return GameSimulation.previewCharacterStats(config);
  }

  /**
   * Возвращает все доступные шаблоны игрока из Content Registry.
   * Статический метод — не требует активной симуляции.
   */
  static getAvailablePlayerTemplates() {
    return getAllPlayerTemplates();
  }

  /**
   * Возвращает путь к портрету игрока по templateId.
   * Статический метод — не требует активной симуляции.
   */
  static getPlayerPortraitSrc(templateId: string): string | undefined {
    return tryGetPlayerTemplate(templateId)?.portraitImg;
  }

  /**
   * Возвращает информацию о предмете по ID для отображения в UI.
   * Статический метод — не требует активной симуляции.
   */
  static getItemInfo(id: string): {name: string; icon?: string; fallback?: string; type: string} | null {
    const template = tryGetItem(id);
    if (!template) return null;
    return {
      name: template.name,
      icon: template.icon,
      fallback: template.fallback,
      type: template.type,
    };
  }

  /** Переход в экран создания персонажа */
  enterCharacterCreation(): void {
    this.mode = 'characterCreation';
    this.simulation = null;
    this.lastResult = null;
    this.animation.phase = 'idle';
    this.clearLogs();
    this.notify();
  }

  /**
   * Начало новой игры.
   *
   * Фабрика GameSimulation.createNewGame инкапсулирует:
   * - создание начального GameState
   * - применение конфига персонажа
   * - генерацию этажа
   *
   * Presentation не мутирует GameState напрямую.
   */
  startNewGame(config: CharacterConfig, seed: number): void {
    const defaultMapParams: MapParams = {
      id: 'floor_1',
      height: 20,
      width: 20,
      minRooms: 5,
      maxRooms: 20,
      minRoomSize: 3,
      maxRoomSize: 4,
      enemyDensity: 1.0,
      itemDensity: 0.1,
      enemyPool: ['cat_small', 'cat_mid', 'cat_big'],
      itemPool: ['health_potion'],
    };
    this.simulation = GameSimulation.createNewGame(seed, config, defaultMapParams);
    this.mode = 'playing';
    this.lastResult = null;
    this.animation.phase = 'idle';
    this.clearLogs();
    this.notify();
  }

  /**
   * Загрузка существующего сохранения.
   *
   * Ожидает уже десериализованный GameState.
   * Десериализация (JSON → GameState) — ответственность вызывающего (Presentation-level helper или UI).
   */
  loadGame(state: GameState): void {
    this.simulation = GameSimulation.loadSavedGame(state);
    this.mode = this.resolveModeFromPhase(state.phase);
    this.lastResult = null;
    this.animation.phase = this.mode === 'playing' ? 'idle' : 'gameOver';
    this.clearLogs();
    this.notify();
  }

  /** Начать выбор цели для способности. */
  beginTargeting(abilityId: string): void {
    if (!this.simulation) return;
    const ok = this.targeting.beginTargeting(abilityId, this.simulation);
    if (!ok) return;
    this.targetingHover = null;
    this.notify();
  }

  /** Отменить выбор цели. */
  cancelTargeting(): void {
    this.targeting.cancelTargeting();
    this.targetingHover = null;
    this.notify();
  }

  /** Подтвердить выбор клетки цели. */
  submitTarget(position: Position): void {
    if (!this.simulation) return;

    const ok = this.targeting.submitTarget(position);
    if (!ok) return;

    const remaining = this.targeting.getRemainingSelections(this.simulation);
    if (remaining <= 0) {
      const state = this.targeting.state!;
      const action: GameAction = {
        type: 'USE_ABILITY',
        entityId: 'player',
        abilityId: state.abilityId,
        targets: state.selectedTargets,
      };
      this.targeting.cancelTargeting();
      this.targetingHover = null;
      this.dispatch(action);
      return;
    }

    this.targetingHover = null;
    this.notify();
  }

  /** Превью при наведении на клетку в режиме таргетинга. */
  previewTarget(hoveredPosition: Position | null): PresentationActionPreview {
    const prevHover = this.targetingHover;
    this.targetingHover = hoveredPosition;
    const state = this.simulation!.getState();
    const result = this.targeting.previewTarget(hoveredPosition, this.simulation!, state);
    if (hoveredPosition?.x !== prevHover?.x || hoveredPosition?.y !== prevHover?.y) {
      this.notify();
    }
    return result;
  }

  /** Выполнить игровое действие */
  dispatch(action: GameAction): void {
    if (!this.simulation) {
      throw new Error('Cannot dispatch: simulation not initialized');
    }
    if (this.mode !== 'playing') {
      throw new Error(`Cannot dispatch in mode: ${this.mode}`);
    }
    if (this.animation.phase === 'animating') {
      return;
    }

    // Любое действие отменяет подготовку скилла
    if (this.targeting.phase === 'targeting') {
      this.cancelTargeting();
    }

    const result = this.simulation.dispatch(action);
    this.lastResult = result;

    if (result.success && result.stateChanged) {
      const state = this.simulation.getState();
      const events = extractEvents(result);
      this.logs.append(state, events);
      this.logs.logs = this.logs.logs.slice(-30);

      // Проверяем, не обнаружена ли лестница — нужен ли авто-переход
      const stairTrigger = this.findStairExitTriggered(result);
      if (stairTrigger) {
        this.animation.pendingAutoTransition = stairTrigger;
      }

      // Строим дерево анимаций из дерева событий
      const animations = buildAnimationTree(result, state);
      if (animations.length > 0) {
        this.animation.phase = 'animating';
        this.animationBatchId++;
      } else if (this.animation.pendingAutoTransition) {
        // Анимаций нет — можно сразу выполнить transition
        const pending = this.animation.pendingAutoTransition;
        this.animation.pendingAutoTransition = null;
        const transitionAction: GameAction =
          pending.direction === 'down'
            ? {type: 'DESCEND', entityId: 'player'}
            : {type: 'ASCEND', entityId: 'player'};
        this.dispatch(transitionAction);
        return;
      }
    } else {
      // При неудачном ходе сбрасываем анимации
      this.lastResult = null;
    }

    // После каждого хода проверяем, не закончилась ли игра
    const state = this.simulation.getState();
    if (state.phase === 'dead') {
      this.mode = 'gameOver';
      this.animation.phase = 'gameOver';
    } else if (state.phase === 'victory') {
      this.mode = 'victory';
      this.animation.phase = 'gameOver';
    }
    this.notify();

    // Автопропуск хода, если игрок кастует и нет активных анимаций
    if (this.autoSkipTurnIfCasting()) return;
  }

  /** Превью действия (для подсветки пути, подсказок урона и т.д.) */
  preview(action: GameAction): ActionPreview {
    if (!this.simulation) {
      return {
        valid: false,
        intents: [],
        errors: [{code: 'no_simulation', description: 'Simulation not initialized'}],
      };
    }
    return this.simulation.preview(action);
  }

  /**
   * Перемещение или атака в направлении (dx, dy).
   *
   * Логика:
   * - Смотрит на соседнюю клетку от игрока.
   * - Если там есть атакуемая сущность — вызывает ATTACK.
   * - Иначе — вызывает MOVE.
   *
   * Это Presentation-level routing: UI передаёт только направление,
   * Presentation решает, какое действие выполнить, основываясь на состоянии.
   */
  moveOrAttack(dx: number, dy: number): void {
    if (!this.simulation || this.mode !== 'playing') {
      return;
    }

    // Движение/атака отменяет подготовку скилла
    if (this.targeting.phase === 'targeting') {
      this.cancelTargeting();
    }

    const state = this.simulation.getState();
    const targetX = state.player.x + dx;
    const targetY = state.player.y + dy;

    const target = findFirstAttackableEntityAt(state, targetX, targetY);

    const action: GameAction =
      target && target.id !== state.player.id
        ? {type: 'ATTACK', entityId: state.player.id, dx, dy}
        : {type: 'MOVE', entityId: state.player.id, dx, dy};

    this.dispatch(action);
  }

  /** Задать удерживаемое направление движения. */
  setHeldDirection(dx: number, dy: number): void {
    this.heldDirection = {dx, dy};
  }

  /** Сбросить удерживаемое направление. */
  clearHeldDirection(): void {
    this.heldDirection = null;
  }

  /** Сигнал от UI: все анимации завершены. Разрешаем следующий ввод. */
  onAnimationsComplete(): void {
    const hadAnimations = this.animation.phase === 'animating';
    if (hadAnimations) {
      this.animation.phase = 'idle';
      this.lastResult = null; // сбрасываем анимации, чтобы не воспроизводить повторно
    }

    // Автоматический переход по лестнице после завершения анимаций
    if (this.animation.pendingAutoTransition && this.animation.phase === 'idle' && this.mode === 'playing') {
      const pending = this.animation.pendingAutoTransition;
      this.animation.pendingAutoTransition = null;
      const transitionAction: GameAction =
        pending.direction === 'down'
          ? {type: 'DESCEND', entityId: 'player'}
          : {type: 'ASCEND', entityId: 'player'};
      this.dispatch(transitionAction);
      return;
    }

    // Автопропуск хода, если игрок кастует
    if (this.autoSkipTurnIfCasting()) return;

    if (this.heldDirection && this.animation.phase === 'idle' && this.mode === 'playing') {
      this.moveOrAttack(this.heldDirection.dx, this.heldDirection.dy);
    } else if (hadAnimations) {
      this.notify();
    }
  }

  private autoSkipTurnIfCasting(): boolean {
    if (!this.simulation || this.mode !== 'playing') return false;
    if (this.animation.phase === 'animating') return false;
    if (this.animation.pendingAutoTransition) return false;

    const state = this.simulation.getState();
    if (state.player.activeCast && state.player.ap > 0) {
      this.dispatch({ type: 'WAIT', entityId: 'player' });
      return true;
    }
    return false;
  }

  /** Возврат в главное меню. Уничтожает текущую симуляцию. */
  returnToMenu(): void {
    this.simulation = null;
    this.mode = 'mainMenu';
    this.lastResult = null;
    this.animation.phase = 'idle';
    this.clearLogs();
    this.notify();
  }

  private resolveModeFromPhase(phase: GameState['phase']): SessionMode {
    switch (phase) {
      case 'playing':
        return 'playing';
      case 'dead':
        return 'gameOver';
      case 'victory':
        return 'victory';
    }
  }

  private clearLogs(): void {
    this.logs.clear();
  }

  /**
   * Ищет событие STAIR_EXIT_TRIGGERED в дереве ExecutionNode.
   * Если найдено — возвращает направление для авто-перехода.
   */
  private findStairExitTriggered(result: SimulationResult): {direction: 'down' | 'up'} | null {
    for (const phase of result.phases) {
      for (const action of phase.actions) {
        const found = this.findStairExitInNode(action);
        if (found) return found;
      }
    }
    return null;
  }

  private findStairExitInNode(node: ExecutionNode): {direction: 'down' | 'up'} | null {
    const event = node.event as GameEvent;
    if (event.type === 'STAIR_EXIT_TRIGGERED') {
      return { direction: event.direction };
    }
    for (const child of node.children) {
      const found = this.findStairExitInNode(child);
      if (found) return found;
    }
    return null;
  }

}
