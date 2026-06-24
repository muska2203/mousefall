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

import { t } from '@i18n/t';
import type {GameState, Simulation, SimulationResult, GameEvent, PlayerStatsSnapshot, Position, ActionPreview} from '@simulation/types';

import type {ExecutionNode} from '@simulation/systems/actions/types';
import type {GameAction} from '@simulation/systems/actions/types';
import {GameSimulation, findFirstAttackableEntityAt, findAllEntitiesAt, findStairsAt} from '@simulation/simulation';
import {findDoorAt} from '@simulation/state';
import type {CharacterConfig} from '@simulation/characterCreation';
import type {MapParams} from '@content/schemas';
import type {AnimationNode, RenderInput, EquipmentSnapshot, PlayerSkillViewModel, PresentationActionPreview, InventoryItemViewModel, ActiveEffectViewModel, InteractionOption, InteractionHintViewModel} from './types';
import {
  getAllLocalizedPlayerTemplates,
  tryGetPlayerTemplate,
  tryGetLocalizedItem,
  tryGetLocalizedAbility,
  getAllLocalizedItems,
  getAllLocalizedEntities,
  getAllLocalizedDoors,
  getAllLocalizedStairs,
} from '@content/registry';
import type { Locale } from '@content/texts/lookup';

import {buildAnimationTree} from './animationPlanner';
import {extractEvents, gameEventToLog} from './logBuilder';
import {extractToasts, errorCodeToToast} from './toastBuilder';
import {ToastBuffer} from './toastBuffer';
import type {ToastItem} from './types';
import {mapItemTemplateToDetail} from './itemDetailMapper';
import {mapEnemyToPopover} from './enemyDetailMapper';
import {mapStairsToPopover} from './stairsDetailMapper';
import {mapDoorToPopover} from './doorDetailMapper';
import { tryGetDoor } from '@content/registry';
import { resolveDoorSprite } from '@utils/assetResolver';
import {resolveAbilityIcon, resolveItemIcon} from '@utils/assetResolver';

import {CameraState} from './cameraState';
import {LogBuffer, type LogItem} from './logBuffer';
import {AnimationState} from './animationState';
import {TargetingController} from './targetingController';

// Реэкспорт типов для UI-слоя, чтобы UI не импортировал из simulation/ напрямую
export type {CharacterConfig} from '@simulation/characterCreation';
export type {MapParams} from '@content/schemas';
export type {AnimationNode, RenderInput, EquipmentSnapshot} from './types';
export type {RenderState} from './types';
export type {PlayerStatsSnapshot, RunStats} from '@simulation/types';

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
  /** Активные всплывающие уведомления */
  toasts: ToastItem[];
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
  private toasts = new ToastBuffer();
  private animation = new AnimationState();
  private targeting = new TargetingController();
  private listeners = new Set<() => void>();
  private viewModelCache: GameViewModel | null = null;
  /** Монотонный счётчик партий анимаций. Инкрементируется при каждом dispatch, порождающем анимации. */
  private animationBatchId = 0;
  private locale: Locale = 'ru';
  /** Клетка под мышью в режиме таргетинга. */
  private targetingHover: Position | null = null;
  /** Клетка под мышью в обычном режиме (для popover объекта на поле). */
  private fieldHover: Position | null = null;
  /** Удерживаемое направление движения (для автохода при зажатой клавише). */
  private heldDirection: {dx: number; dy: number} | null = null;
  /** Флаг debug-режима. Живёт только в Presentation, не попадает в GameState. */
  private debugEnabled: boolean = false;
  /** Флаг debug-визуализации комнат и коридоров. Живёт только в Presentation. */
  private mapgenDebugEnabled: boolean = false;
  /** Индекс выбранной опции взаимодействия (F / Tab). */
  private selectedInteractionIndex = 0;
  /** Ключ последнего набора опций взаимодействия, чтобы сбрасывать индекс при изменении. */
  private lastInteractionOptionsKey = '';

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

  /** Установить текущую локаль. */
  setLocale(locale: Locale): void {
    this.locale = locale;
    this.notify();
  }

  /** Получить текущую локаль. */
  getLocale(): Locale {
    return this.locale;
  }

  /** Текущий ViewModel для отрисовки UI. Кешируется между нотификациями для useSyncExternalStore. */
  getViewModel(): GameViewModel {
    if (!this.viewModelCache) {
      const state = this.simulation?.getState() ?? null;
      this.viewModelCache = {
        mode: this.mode,
        renderInput: state ? this.buildRenderInput(state) : null,
        logs: this.logs.logs,
        toasts: this.toasts.toasts,
      };
    }
    return this.viewModelCache;
  }

  private buildRenderInput(state: Readonly<GameState>): RenderInput {
    const locale = this.locale;
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
      const template = this.getAbilityTemplate(ability.templateId, locale);
      const isCasting = player.activeCast?.abilityId === ability.templateId;
      return {
        abilityId: ability.templateId,
        name: template?.name ?? ability.templateId,
        icon: template?.spriteId ? `/assets/skills/${template.spriteId}.png` : null,
        cooldown: ability.currentCooldown,
        maxCooldown: template?.cooldown ?? 0,
        isAvailable: ability.currentCooldown === 0 && !isCasting,
        source: ability.source,
        isCasting,
        remainingCastTurns: isCasting ? player.activeCast!.remainingTurns : 0,
      };
    });

    const currentPs = this.simulation!.getPlayerStats();
    // Во время анимаций показываем AP игрока после его действия, но до восстановления
    // в начале следующего хода. Presentation сама извлекает это значение из дерева
    // событий, чтобы слой симуляции не знал про анимации/отображение.
    const pendingAp = this.animation.phase === 'animating' && this.lastResult
      ? this.extractPlayerApAfterAction(this.lastResult)
      : undefined;
    const ps = pendingAp !== undefined
      ? { ...currentPs, ap: pendingAp }
      : currentPs;
    const eq = equipment;

    const heroStats = [
      {type: 'readonly' as const, icon: '💪', name: t('system.gameSession.heroStatStrength'), value: String(ps.effectiveStats.str)},
      {type: 'readonly' as const, icon: '✨', name: t('system.gameSession.heroStatIntelligence'), value: String(ps.effectiveStats.int)},
      {type: 'readonly' as const, icon: '🐾', name: t('system.gameSession.heroStatDexterity'), value: String(ps.effectiveStats.dex)},
      {type: 'readonly' as const, icon: '❤️', name: t('system.gameSession.heroStatVitality'), value: String(ps.effectiveStats.vit)},
    ];

    const weaponTemplate = eq.weaponId ? tryGetLocalizedItem(eq.weaponId, locale) : null;
    const armorTemplate = eq.armorId ? tryGetLocalizedItem(eq.armorId, locale) : null;
    const amuletTemplate = eq.amuletId ? tryGetLocalizedItem(eq.amuletId, locale) : null;

    const weaponDetail = weaponTemplate ? mapItemTemplateToDetail(weaponTemplate, {}, locale) : undefined;
    const armorDetail = armorTemplate ? mapItemTemplateToDetail(armorTemplate, {}, locale) : undefined;
    const amuletDetail = amuletTemplate ? mapItemTemplateToDetail(amuletTemplate, {}, locale) : undefined;

    const equippedIds = new Set([
      player.equippedWeaponInstanceId,
      player.equippedArmorInstanceId,
      player.equippedAmuletInstanceId,
    ].filter(Boolean) as string[]);

    const buildItemDetail = (invItem: typeof player.inventory[0]) => {
      const template = tryGetLocalizedItem(invItem.templateId, locale);
      const detail = template
        ? {
            ...mapItemTemplateToDetail(template, {
              stackCount: invItem.quantity,
              rarity: template.rarity,
            }, locale),
            name: template.name,
            description: template.description,
          }
        : {
            name: invItem.templateId,
            description: '',
            rarity: 'common' as const,
            rarityLabel: t('system.gameSession.rarityFallback'),
            typeLabel: t('system.gameSession.typeFallback'),
            type: 'unknown',
            icon: '',
            frameUrl: '',
            fallbackIcon: '?',
            stackCount: invItem.quantity,
            sections: [],
          };
      const grantedAbilities = invItem.grantedAbilities.map((ability) => {
        const abilityTemplate = this.getAbilityTemplate(ability.templateId, locale);
        return {
          templateId: ability.templateId,
          name: abilityTemplate?.name ?? ability.templateId,
          level: ability.level,
          icon: abilityTemplate?.spriteId ? resolveAbilityIcon(abilityTemplate.spriteId) : null,
        };
      });
      return {
        ...detail,
        grantedAbilities: grantedAbilities.length > 0 ? grantedAbilities : null,
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
        label: t('system.gameSession.equipSlotWeapon'),
        icon: weaponItem ? resolveItemIcon(weaponItem.templateId) : undefined,
        fallback: '⚔',
        damage: player.equippedWeaponId ? player.damage : null,
        rarity: weaponDetailVm?.rarity ?? 'common',
        detail: weaponDetailVm ?? undefined,
        slotType: 'weapon' as const,
        instanceId: player.equippedWeaponInstanceId,
        grantedAbilityNames: weaponDetailVm?.grantedAbilities?.map(a => a.name) ?? [],
      },
      {
        label: t('system.gameSession.equipSlotArmor'),
        icon: armorItem ? resolveItemIcon(armorItem.templateId) : undefined,
        fallback: '🛡',
        rarity: armorDetailVm?.rarity ?? 'common',
        detail: armorDetailVm ?? undefined,
        slotType: 'armor' as const,
        instanceId: player.equippedArmorInstanceId,
        grantedAbilityNames: armorDetailVm?.grantedAbilities?.map(a => a.name) ?? [],
      },
      {
        label: t('system.gameSession.equipSlotAmulet'),
        icon: amuletItem ? resolveItemIcon(amuletItem.templateId) : undefined,
        fallback: '📿',
        rarity: amuletDetailVm?.rarity ?? 'common',
        detail: amuletDetailVm ?? undefined,
        slotType: 'amulet' as const,
        instanceId: player.equippedAmuletInstanceId,
        grantedAbilityNames: amuletDetailVm?.grantedAbilities?.map(a => a.name) ?? [],
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

    // Предвычисляем пути к спрайтам дверей, чтобы UI не обращался к Content-реестру напрямую.
    const doorSprites = new Map<string, string>();
    for (const entity of state.entities.values()) {
      if (entity.type === 'door' && entity.isAlive !== false) {
        const template = tryGetDoor(entity.templateId);
        doorSprites.set(
          entity.id,
          resolveDoorSprite(entity.templateId, entity.isOpen, template?.openSpriteId),
        );
      }
    }

    const inventory = state.player.inventory
      .filter(invItem => !equippedIds.has(invItem.instanceId))
      .map(invItem => {
        const detail = buildItemDetail(invItem);
        const template = tryGetLocalizedItem(invItem.templateId, locale);
        const damage = template?.type === 'weapon' && template.weapon
          ? this.simulation!.getWeaponDamage(state.player, template)
          : null;

        return {
          instanceId: invItem.instanceId,
          templateId: invItem.templateId,
          quantity: invItem.quantity,
          detail,
          damage,
        };
      })
      .sort(compareInventoryItems);

    const activeEffects: ActiveEffectViewModel[] = state.player.statusEffects.map(effect => {
      switch (effect.type) {
        case 'poisoned':
          return {icon: '🧪', name: t('system.gameSession.effectPoisoned'), desc: t('system.gameSession.effectPoisonedDesc', { value: effect.value }), turns: effect.duration};
        case 'burning':
          return {icon: '🔥', name: t('system.gameSession.effectBurning'), desc: t('system.gameSession.effectBurningDesc', { value: effect.value }), turns: effect.duration};
        case 'frozen':
          return {icon: '❄️', name: t('system.gameSession.effectFrozen'), desc: t('system.gameSession.effectFrozenDesc'), turns: effect.duration};
        case 'stunned':
          return {icon: '💫', name: t('system.gameSession.effectStunned'), desc: t('system.gameSession.effectStunnedDesc'), turns: effect.duration};
        case 'regenerating':
          return {icon: '✨', name: t('system.gameSession.effectRegenerating'), desc: t('system.gameSession.effectRegeneratingDesc', { value: effect.value }), turns: effect.duration};
        case 'counterattack':
          return {
            icon: '⚔️',
            name: t('system.gameSession.effectCounterattack'),
            desc: t('system.gameSession.effectCounterattackDesc', { stacks: effect.stacks ?? 1, turns: effect.duration }),
            turns: effect.duration,
          };
        default:
          return {icon: '❓', name: t('system.gameSession.effectUnknown'), desc: '', turns: effect.duration};
      }
    });

    const fieldObjectPopover = this.buildFieldObjectPopover(state);
    const interactionHint = this.buildInteractionHint(state);

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
      doorSprites,
      inventory,
      activeEffects,
      runStats: state.runStats,
      fieldObjectPopover,
      interactionHint,
      debugEnabled: this.debugEnabled,
      mapgenDebugEnabled: this.mapgenDebugEnabled,
    };
  }

  // ── Взаимодействия (F / Tab) ─────────────────────────────────────

  /** Собрать все доступные опции взаимодействия для текущей клетки игрока.
   *
   * Presentation не решает, доступно ли действие: валидность проверяется через
   * simulation.preview(), чтобы единственный источник правил оставался в Simulation.
   * Дополнительно проверяется достаточность AP через simulation.getActionCost(). */
  private buildInteractionOptions(state: Readonly<GameState>): InteractionOption[] {
    if (!this.simulation) return [];
    const options: InteractionOption[] = [];
    const player = state.player;
    const px = player.x;
    const py = player.y;

    const canPerform = (action: GameAction): boolean => {
      const preview = this.simulation!.preview(action);
      if (!preview.valid) return false;
      const cost = this.simulation!.getActionCost(action);
      return player.ap >= cost;
    };

    // Предметы на клетке игрока — одна опция на все предметы (PICKUP поднимает первый).
    const pickupAction: GameAction = { type: 'PICKUP', entityId: player.id };
    if (canPerform(pickupAction)) {
      options.push({
        kind: 'pickup',
        action: pickupAction,
        targetPosition: { x: px, y: py },
        labelKey: 'components.interactionHint.pickup',
        priority: 0,
      });
    }

    // Лестница вниз.
    const stairsDown = findStairsAt(state, px, py, 'stairs_down');
    if (stairsDown) {
      const descendAction: GameAction = { type: 'DESCEND', entityId: player.id };
      if (canPerform(descendAction)) {
        options.push({
          kind: 'descend',
          action: descendAction,
          targetPosition: { x: stairsDown.x, y: stairsDown.y },
          labelKey: 'components.interactionHint.descend',
          priority: 1,
        });
      }
    }

    // Лестница вверх.
    const stairsUp = findStairsAt(state, px, py, 'stairs_up');
    if (stairsUp) {
      const ascendAction: GameAction = { type: 'ASCEND', entityId: player.id };
      if (canPerform(ascendAction)) {
        options.push({
          kind: 'ascend',
          action: ascendAction,
          targetPosition: { x: stairsUp.x, y: stairsUp.y },
          labelKey: 'components.interactionHint.ascend',
          priority: 1,
        });
      }
    }

    // Двери на соседних клетках.
    const neighborOffsets = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
    ];
    for (const offset of neighborOffsets) {
      const x = px + offset.dx;
      const y = py + offset.dy;
      const door = findDoorAt(state, x, y);
      if (!door || door.isAlive === false) continue;

      if (door.isOpen) {
        const closeAction: GameAction = {
          type: 'CLOSE_DOOR',
          entityId: player.id,
          targetPosition: { x, y },
        };
        if (canPerform(closeAction)) {
          options.push({
            kind: 'closeDoor',
            action: closeAction,
            targetPosition: { x, y },
            labelKey: 'components.interactionHint.closeDoor',
            priority: 2,
          });
        }
      } else {
        const openAction: GameAction = {
          type: 'OPEN_DOOR',
          entityId: player.id,
          targetPosition: { x, y },
        };
        if (canPerform(openAction)) {
          options.push({
            kind: 'openDoor',
            action: openAction,
            targetPosition: { x, y },
            labelKey: 'components.interactionHint.openDoor',
            priority: 2,
          });
        }
      }
    }

    return options.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.kind.localeCompare(b.kind);
    });
  }

  /** Сбросить выбранный индекс, если набор опций или позиция игрока изменились. */
  private maybeResetInteractionIndex(options: InteractionOption[], player: Readonly<GameState>['player']): void {
    const key = `${player.x},${player.y}|` + options.map(o => `${o.kind}:${o.targetPosition.x}:${o.targetPosition.y}`).join('|');
    if (key !== this.lastInteractionOptionsKey) {
      this.lastInteractionOptionsKey = key;
      this.selectedInteractionIndex = 0;
    }
  }

  /** Получить актуальный список опций с учётом сброса индекса. */
  private getInteractionOptions(state: Readonly<GameState>): InteractionOption[] {
    const options = this.buildInteractionOptions(state);
    this.maybeResetInteractionIndex(options, state.player);
    return options;
  }

  /** Вернуть выбранную опцию, если список не пуст. */
  private getSelectedOption(options: InteractionOption[]): InteractionOption | null {
    return options[this.selectedInteractionIndex] ?? options[0] ?? null;
  }

  /** Построить ViewModel подсказки для renderer'а. */
  private buildInteractionHint(state: Readonly<GameState>): InteractionHintViewModel | null {
    const options = this.getInteractionOptions(state);
    const option = this.getSelectedOption(options);
    if (!option) return null;
    return {
      targetPosition: option.targetPosition,
      label: t(option.labelKey),
      hasMultiple: options.length > 1,
    };
  }

  /** Переключиться на следующую доступную опцию взаимодействия (Tab). */
  cycleInteraction(delta = 1): void {
    if (!this.simulation || this.mode !== 'playing' || this.animation.phase === 'animating') return;
    const state = this.simulation.getState();
    const options = this.getInteractionOptions(state);
    if (options.length <= 1) return;
    this.selectedInteractionIndex = (this.selectedInteractionIndex + delta) % options.length;
    if (this.selectedInteractionIndex < 0) {
      this.selectedInteractionIndex += options.length;
    }
    this.notify();
  }

  /** Выполнить выбранное взаимодействие (F). */
  performSelectedInteraction(): void {
    if (!this.simulation || this.mode !== 'playing' || this.animation.phase === 'animating') return;
    const state = this.simulation.getState();
    const options = this.getInteractionOptions(state);
    const option = this.getSelectedOption(options);
    if (!option) return;
    this.dispatch(option.action);
  }

  /** Извлекает AP игрока после выполнения его действия, но до восстановления
   *  в начале следующего хода. Ищет событие RESOURCE_CONSUMED с resource='ap'
   *  в дереве фазы PLAYER. Возвращает undefined, если событие не найдено. */
  private extractPlayerApAfterAction(result: SimulationResult): number | undefined {
    const playerPhase = result.phases.find((phase) => phase.side === 'PLAYER');
    if (!playerPhase) return undefined;

    for (const action of playerPhase.actions) {
      const remaining = this.findApConsumedRemaining(action);
      if (remaining !== undefined) return remaining;
    }

    return undefined;
  }

  private findApConsumedRemaining(node: ExecutionNode): number | undefined {
    const event = node.event;
    if (event.type === 'RESOURCE_CONSUMED' && event.resource === 'ap') {
      return event.remaining;
    }
    for (const child of node.children) {
      const remaining = this.findApConsumedRemaining(child);
      if (remaining !== undefined) return remaining;
    }
    return undefined;
  }

  private getAbilityTemplate(abilityId: string, locale: Locale): { name: string; description: string; spriteId: string | undefined; cooldown: number; apCost: number | 'all' } | null {
    const fromSim = this.simulation!.getAbilityInfo(abilityId);
    if (!fromSim) return null;
    const localized = tryGetLocalizedAbility(abilityId, locale);
    return localized ? { ...fromSim, name: localized.name, description: localized.description } : { ...fromSim, name: abilityId, description: '' };
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

  private buildFieldObjectPopover(state: Readonly<GameState>): RenderInput['fieldObjectPopover'] {
    if (!this.fieldHover) return null;

    const { x, y } = this.fieldHover;

    // Ищем объект на клетке, исключая игрока
    let enemy = null;
    let door = null;
    let item = null;
    let stairs = null;

    for (const entity of state.entities.values()) {
      if (entity.x !== x || entity.y !== y) continue;
      if (entity.type === 'enemy') {
        enemy = entity;
        break; // приоритет врагам
      }
      if (entity.type === 'door' && !door) {
        door = entity;
      }
      if (entity.type === 'item') {
        item = entity;
      }
      if (entity.type === 'stairs' && !stairs) {
        stairs = entity;
      }
    }

    const currentLocale = this.locale;

    if (enemy) {
      return { kind: 'enemy', data: mapEnemyToPopover(enemy, currentLocale) };
    }

    if (door) {
      return { kind: 'door', data: mapDoorToPopover(door, currentLocale) };
    }

    if (item) {
      const template = tryGetLocalizedItem(item.item.templateId, currentLocale);
      if (template) {
        const detail = mapItemTemplateToDetail(template, {
          stackCount: item.item.quantity,
          rarity: template.rarity,
        }, currentLocale);
        return { kind: 'item', data: { ...detail, name: template.name, description: template.description } };
      }
    }

    if (stairs) {
      return { kind: 'stairs', data: mapStairsToPopover(stairs, currentLocale) };
    }

    return null;
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
   * Шаблон, помеченный isDefault, всегда идёт первым — это выбор по умолчанию
   * в экране создания персонажа. Остальные сохраняют порядок манифеста.
   * Статический метод — не требует активной симуляции.
   */
  static getAvailablePlayerTemplates(locale: Locale) {
    const templates = getAllLocalizedPlayerTemplates(locale);
    return [...templates].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  /**
   * Возвращает путь к портрету игрока по templateId.
   * Статический метод — не требует активной симуляции.
   */
  static getPlayerPortraitSrc(templateId: string): string | undefined {
    return tryGetPlayerTemplate(templateId)?.portraitImg;
  }

  /**
   * Возвращает все локализованные шаблоны предметов.
   * Статический метод — не требует активной симуляции.
   */
  static getAllItems(locale: Locale) {
    return getAllLocalizedItems(locale);
  }

  /**
   * Возвращает все локализованные шаблоны сущностей (врагов / NPC).
   * Статический метод — не требует активной симуляции.
   */
  static getAllEntities(locale: Locale) {
    return getAllLocalizedEntities(locale);
  }

  /**
   * Возвращает все локализованные шаблоны дверей.
   * Статический метод — не требует активной симуляции.
   */
  static getAllDoors(locale: Locale) {
    return getAllLocalizedDoors(locale);
  }

  /**
   * Возвращает все локализованные шаблоны лестниц.
   * Статический метод — не требует активной симуляции.
   */
  static getAllStairs(locale: Locale) {
    return getAllLocalizedStairs(locale);
  }

  /**
   * Возвращает информацию о предмете по ID для отображения в UI.
   * Статический метод — не требует активной симуляции.
   */
  static getItemInfo(id: string, locale: Locale): {name: string; icon?: string; fallback?: string; type: string} | null {
    const template = tryGetLocalizedItem(id, locale);
    if (!template) return null;
    return {
      name: template.name,
      icon: template.icon,
      fallback: template.fallback,
      type: template.type,
    };
  }

  static getStarterItemInfo(id: string, locale: Locale): {
    id: string;
    name: string;
    icon: string;
    fallback: string;
    detail: import('./itemDetailMapper').ItemDetailViewModel | undefined;
  } {
    const info = GameSession.getItemInfo(id, locale);
    const template = tryGetLocalizedItem(id, locale);
    const rawTemplate = tryGetLocalizedItem(id, locale);
    return {
      id,
      name: info?.name ?? id,
      icon: info?.icon ?? `/assets/items/${id}.png`,
      fallback: info?.fallback ?? '?',
      detail: rawTemplate ? mapItemTemplateToDetail(rawTemplate, {}, locale) : undefined,
    };
  }

  /** Переход в экран создания персонажа */
  enterCharacterCreation(): void {
    this.mode = 'characterCreation';
    this.simulation = null;
    this.lastResult = null;
    this.animation.phase = 'idle';
    this.clearLogs();
    this.clearToasts();
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
      strategy: 'tree',
      height: 40,
      width: 40,
      minRooms: 5,
      maxRooms: 20,
      minRoomSize: 3,
      maxRoomSize: 8,
      enemyDensity: 1.0,
      itemDensity: 0.1,
      enemyPool: ['cat_small', 'cat_mid', 'cat_big'],
      itemPool: ['health_potion'],
    };
    this.simulation = GameSimulation.createNewGame(seed, config, defaultMapParams, this.debugEnabled);
    this.mode = 'playing';
    this.lastResult = null;
    this.animation.phase = 'idle';
    this.clearLogs();
    this.clearToasts();
    this.notify();
  }

  /**
   * Загрузка существующего сохранения.
   *
   * Ожидает уже десериализованный GameState.
   * Десериализация (JSON → GameState) — ответственность вызывающего (Presentation-level helper или UI).
   */
  loadGame(state: GameState): void {
    this.simulation = GameSimulation.loadSavedGame(state, this.debugEnabled);
    this.mode = this.resolveModeFromPhase(state.phase);
    this.lastResult = null;
    this.animation.phase = this.mode === 'playing' ? 'idle' : 'gameOver';
    this.selectedInteractionIndex = 0;
    this.lastInteractionOptionsKey = '';
    this.clearLogs();
    this.clearToasts();
    this.notify();
  }

  /** Начать выбор цели для способности. */
  beginTargeting(abilityId: string): void {
    if (!this.simulation) return;

    const info = this.simulation.getAbilityInfo(abilityId);
    if (!info) {
      this.pushToastFromCode('ability_not_found');
      return;
    }

    if (info.currentCooldown > 0) {
      this.pushToastFromCode('ability_on_cooldown');
      return;
    }

    const action: GameAction = {
      type: 'USE_ABILITY',
      entityId: 'player',
      abilityId,
      targets: [],
    };
    const cost = this.simulation.getActionCost(action);
    const currentAp = this.simulation.getPlayerStats().ap;
    if (currentAp < cost) {
      this.pushToastFromCode('not_enough_ap');
      return;
    }

    const ok = this.targeting.beginTargeting(abilityId, this.simulation);
    if (!ok) {
      this.pushToastFromCode('ability_not_found');
      return;
    }
    this.targetingHover = null;
    this.fieldHover = null;
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

  /** Находимся ли сейчас в режиме таргетинга. */
  isTargeting(): boolean {
    return this.targeting.phase === 'targeting';
  }

  /** Установить клетку под мышью в обычном режиме (для popover объекта на поле). */
  setFieldHover(hoveredPosition: Position | null): void {
    const prevHover = this.fieldHover;
    const canShow =
      this.mode === 'playing' &&
      this.animation.phase !== 'animating' &&
      this.targeting.phase !== 'targeting';
    this.fieldHover = canShow ? hoveredPosition : null;
    if (this.fieldHover?.x !== prevHover?.x || this.fieldHover?.y !== prevHover?.y) {
      this.notify();
    }
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
      this.logs.append(state, events, this.locale);
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
      // При неудачном ходе показываем причины отказа и сбрасываем анимации
      const rejectedToasts = extractToasts(result);
      for (const toast of rejectedToasts) {
        this.toasts.push(toast.kind, toast.title, toast.message, toast.duration);
      }
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
        errors: [{code: 'no_simulation'}],
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

    let action: GameAction;

    const doorAtTarget = findDoorAt(state, targetX, targetY);

    if (target && target.id !== state.player.id && target.type !== 'door') {
      // Атака по врагу/другой не-дверной цели.
      // Если враг стоит на клетке с открытой дверью, атака всё равно должна
      // сработать в приоритете, а не превращаться в MOVE.
      action = {type: 'ATTACK', entityId: state.player.id, dx, dy};
    } else if (doorAtTarget) {
      if (doorAtTarget.isOpen) {
        // Открытая дверь — просто заходим на её клетку.
        action = {type: 'MOVE', entityId: state.player.id, dx, dy};
      } else {
        // Закрытая дверь — открываем вместо атаки.
        // Сбрасываем удерживаемое направление, чтобы при зажатой клавише
        // персонаж не зашёл на клетку двери автоматически в тот же ход.
        this.dispatch({
          type: 'OPEN_DOOR',
          entityId: state.player.id,
          targetPosition: {x: targetX, y: targetY},
        });
        this.clearHeldDirection();
        return;
      }
    } else {
      action = {type: 'MOVE', entityId: state.player.id, dx, dy};
    }

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

  /**
   * Взаимодействие с предметом в инвентаре.
   * Presentation-level routing: решает EQUIP или USE_ITEM на основе типа предмета.
   */
  interactWithItem(instanceId: string): void {
    if (!this.simulation || this.mode !== 'playing') {
      return;
    }
    const state = this.simulation.getState();
    const item = state.player.inventory.find(i => i.instanceId === instanceId);
    if (!item) return;
    const template = tryGetLocalizedItem(item.templateId, this.locale);
    if (!template) return;

    if (template.type === 'weapon' || template.type === 'armor' || template.type === 'amulet') {
      this.dispatch({type: 'EQUIP', entityId: 'player', itemInstanceId: instanceId});
    } else if (template.type === 'consumable') {
      this.dispatch({type: 'USE_ITEM', entityId: 'player', itemInstanceId: instanceId});
    }
  }

  /** Переключить debug-режим. */
  toggleDebug(): void {
    this.debugEnabled = !this.debugEnabled;
    if (this.simulation) {
      this.simulation.setDebugEnabled(this.debugEnabled);
    }
    this.notify();
  }

  /** Включён ли debug-режим. */
  isDebug(): boolean {
    return this.debugEnabled;
  }

  /** Переключить визуализацию комнат и коридоров. */
  toggleMapgenDebug(): void {
    this.mapgenDebugEnabled = !this.mapgenDebugEnabled;
    this.notify();
  }

  /** Включена ли визуализация комнат и коридоров. */
  isMapgenDebug(): boolean {
    return this.mapgenDebugEnabled;
  }

  /** Debug: добавить предмет в инвентарь игрока. */
  debugAddItem(templateId: string): void {
    if (!this.simulation || this.mode !== 'playing') {
      return;
    }
    this.dispatch({
      type: 'DEBUG_ADD_ITEM',
      entityId: 'player',
      templateId,
    });
  }

  /** Debug: заспавнить объект на карте. */
  debugSpawnEntity(
    spawnType: 'item' | 'enemy' | 'door' | 'stairs',
    templateId: string,
    position: Position,
  ): void {
    if (!this.simulation || this.mode !== 'playing') {
      return;
    }
    this.dispatch({
      type: 'DEBUG_SPAWN_ENTITY',
      entityId: 'player',
      spawnType,
      templateId,
      position,
    });
  }

  /** Debug: полностью перегенерировать текущий уровень. */
  debugRegenerateMap(): void {
    if (!this.simulation || this.mode !== 'playing') {
      return;
    }
    this.simulation.regenerateMap();
    this.viewModelCache = null;
    this.notify();
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

  private clearToasts(): void {
    this.toasts.clear();
  }

  /** Добавить уведомление по коду ошибки симуляции и уведомить UI. */
  private pushToastFromCode(code: string): void {
    const toast = errorCodeToToast(code);
    this.toasts.push(toast.kind, toast.title, toast.message, toast.duration);
    this.notify();
  }

  /** Закрыть всплывающее уведомление по идентификатору. */
  dismissToast(id: string): void {
    this.toasts.remove(id);
    this.notify();
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
