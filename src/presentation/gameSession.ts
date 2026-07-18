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
import type {GameState, GameEvent, RuleTriggeredEvent, Simulation, SimulationResult, PlayerStatsSnapshot, Position, ActionPreview, StatusEffect, GameAction, ExecutionNode, FloorItemContainerEntity, DoorEntity} from '@simulation/types';
import {GameSimulation} from '@simulation/simulation';
import { MAX_ABILITY_ALL_AP_COST } from '@utils/constants';
import type {CharacterConfig} from '@simulation/characterCreation';
import type {MapParams} from '@content/schemas';
import type {AnimationNode, RenderInput, EquipmentSnapshot, PlayerSkillViewModel, PresentationActionPreview, InventoryItemViewModel, ActiveEffectViewModel, InteractionOption, InteractionHintViewModel, AIPreparedIntentViewModel, PresentationIntent, HighlightedPathTargetKind, GameplayTag} from './types';
import {toPresentationIntent} from './types';
import type { DisplayState, DisplayPatch } from './displayState/types';
import { buildDisplayState, applyPatches, applyPatch } from './displayState/builder';
import { resyncDisplayState } from './displayState/sync';
import { buildPresentationPlan } from './displayState/planner';
import {
  getAllLocalizedPlayerTemplates,
  tryGetPlayerTemplate,
  tryGetItem,
  tryGetLocalizedItem,
  tryGetLocalizedAbility,
  getAllLocalizedItems,
  getAllLocalizedEntities,
  getAllLocalizedDoors,
  getAllLocalizedStairs,
} from '@content/registry';
import type { Locale } from '@content/texts/lookup';

import {buildAnimationTree} from './animation';
import {extractEventsFromPlan} from './logBuilder';
import {extractToasts, errorCodeToToast} from './toastBuilder';
import {ToastBuffer} from './toastBuffer';
import type {ToastItem} from './types';
import {mapItemTemplateToDetail} from './itemDetailMapper';
import {mapEnemyToPopover} from './enemyDetailMapper';
import {mapStairsToPopover} from './stairsDetailMapper';
import {mapDoorToPopover} from './doorDetailMapper';
import { tryGetDoor } from '@content/registry';
import { resolveDoorSprite, resolveAbilityIcon, resolveItemIcon, resolveStatusIcon } from '@utils/assetResolver';

import {CameraState} from './cameraState';
import {LogBuffer, type LogItem} from './logBuffer';
import {AnimationState} from './animationState';
import {TargetingController} from './targetingController';
import {AutoPathController, type AutoPathQueries, type AutoPathStepResult} from './autoPathController';
import {isTileExplored, findPathTowards} from './pathfinding';
import {getInteractionHintKey, getInteractionPriority} from './interactionUtils';
import type {AutoPathTarget, AutoPathTargetKind} from './pathfinding';
import {sortStatusEffects} from './statusSorting';
import {resolveAIMode} from './primaryStatus';

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

/** Размер панели быстрого доступа (слоты 1–9, 0). */
const HOTBAR_SIZE = 10;

/** Внутренняя привязка слота хотбара к скиллу или расходнику. */
type HotbarAssignment =
  | { kind: 'skill'; abilityId: string }
  | { kind: 'consumable'; templateId: string };

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
  private autoPath = new AutoPathController();
  private listeners = new Set<() => void>();
  private viewModelCache: GameViewModel | null = null;
  /** Минимальная модель состояния поля, обновляемая патчами по мере анимаций. */
  private displayState: DisplayState | null = null;
  /** Монотонный счётчик партий анимаций. Инкрементируется при каждом dispatch, порождающем анимации. */
  private animationBatchId = 0;
  /** Защита от бесконечного цикла пустых фаз в step(). */
  private emptyStepCounter = 0;
  /** Лимит подряд идущих пустых фаз (без анимаций) в одном вызове step(). */
  private readonly EMPTY_STEP_WARNING_THRESHOLD = 20;
  private readonly EMPTY_STEP_LIMIT = 200;
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
  /** Флаг подавления следующего клика по полю, если автопуть был отменён
   *  вводом во время анимации. Предотвращает случайный новый автопуть при
   *  отпускании кнопки мыши после отмены зажатием. */
  private suppressNextFieldClick = false;

  /** Индекс выбранной опции взаимодействия (F / Tab). */
  private selectedInteractionIndex = 0;
  /** Ключ последнего набора опций взаимодействия, чтобы сбрасывать индекс при изменении. */
  private lastInteractionOptionsKey = '';
  /** Привязки слотов хотбара (10 слотов). Живут в Presentation, не в Simulation. */
  private hotbarAssignments: (HotbarAssignment | null)[] = Array.from({ length: HOTBAR_SIZE }, () => null);

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
    const displayState = this.displayState ?? resyncDisplayState(state);
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
      return {
        abilityId: ability.templateId,
        name: template?.name ?? ability.templateId,
        icon: template?.spriteId ? `/assets/skills/${template.spriteId}.png` : null,
        cooldown: ability.currentCooldown,
        maxCooldown: template?.cooldown ?? 0,
        isAvailable: ability.currentCooldown === 0,
        source: ability.source,
        tags: template?.tags ?? [],
      };
    });

    const ps = this.simulation!.getPlayerStats();
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
      const rawTemplate = tryGetItem(invItem.templateId);
      const effectiveDamageByTag = rawTemplate?.type === 'weapon' && rawTemplate.weapon
        ? Object.fromEntries(
            rawTemplate.weapon.damageDistribution.map(entry => [
              entry.damageTag,
              this.simulation!.getEffectiveWeaponDamageForTemplate(state.player, rawTemplate, entry.damageTag),
            ])
          ) as Record<GameplayTag, number>
        : undefined;
      const detail = template
        ? {
            ...mapItemTemplateToDetail(template, {
              stackCount: invItem.quantity,
              rarity: template.rarity,
              effectiveDamageByTag,
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
            isTemplate: false,
            properties: [],
            tags: [],
          };
      const grantedAbilities = invItem.grantedAbilities.map((ability) => {
        const abilityTemplate = this.getAbilityTemplate(ability.templateId, locale);
        return {
          templateId: ability.templateId,
          name: abilityTemplate?.name ?? ability.templateId,
          description: abilityTemplate?.description ?? '',
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
      .filter((e): e is FloorItemContainerEntity => e.type === 'floor_item_container')
      .map(e => ({
        id: e.id,
        x: e.x,
        y: e.y,
        templateId: e.item.templateId,
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
        const rawTemplate = tryGetItem(invItem.templateId);
        const damage = rawTemplate?.type === 'weapon' && rawTemplate.weapon
          ? rawTemplate.weapon.damageDistribution.reduce(
              (sum, entry) => sum + this.simulation!.getEffectiveWeaponDamageForTemplate(state.player, rawTemplate, entry.damageTag),
              0,
            )
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

    const statusEffectsByEntity = new Map<string, readonly StatusEffect[]>();
    statusEffectsByEntity.set(displayState.player.id, sortStatusEffects(displayState.player.statusEffects ?? []));
    for (const entity of displayState.entities.values()) {
      if ((entity.statusEffects?.length ?? 0) > 0) {
        statusEffectsByEntity.set(entity.id, sortStatusEffects(entity.statusEffects ?? []));
      }
    }

    const aiModeByEntity = new Map<string, ReturnType<typeof resolveAIMode>>();
    aiModeByEntity.set(player.id, resolveAIMode(player));
    for (const entity of state.entities.values()) {
      aiModeByEntity.set(entity.id, resolveAIMode(entity));
    }

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
            desc: t('system.gameSession.effectCounterattackDesc', { turns: effect.duration }),
            turns: effect.duration,
          };
        case 'silenced':
          return {
            icon: resolveStatusIcon('silenced'),
            name: t('system.gameSession.effectSilenced'),
            desc: t('system.gameSession.effectSilencedDesc', { turns: effect.duration }),
            turns: effect.duration,
          };
        default:
          return {icon: '❓', name: t('system.gameSession.effectUnknown'), desc: '', turns: effect.duration};
      }
    });

    const fieldObjectPopover = this.buildFieldObjectPopover(state);
    const interactionHint = this.buildInteractionHint(state);
    const aiPreparedIntents = this.buildAIPreparedIntents(state);

    // Preview-путь (не committed) не показываем во время анимации, чтобы
    // не отвлекать игрока и не рисовать устаревший путь, пока камера/мышь
    // не обновились. Зафиксированный автопуть показываем всегда.
    let highlightedPath: Position[] | null = null;
    if (this.autoPath.isActive()) {
      const isCommitted = this.autoPath.isCommitted();
      if (isCommitted || this.animation.phase !== 'animating') {
        highlightedPath = this.autoPath.getPath();
      }
    }

    // Во время анимации очередного шага зафиксированного автопути контроллер
    // перестраивает путь только по завершении анимации. Пока анимация идёт,
    // первый тайл пути совпадает с текущей позицией игрока (уже сделанный шаг),
    // поэтому убираем его из отображаемого пути, чтобы превью не съезжало.
    if (highlightedPath && highlightedPath.length > 0) {
      const first = highlightedPath[0]!;
      if (first.x === state.player.x && first.y === state.player.y) {
        highlightedPath = highlightedPath.slice(1);
      }
    }

    const highlightedPathTurnEndIndices = highlightedPath
      ? this.computeTurnEndIndices(highlightedPath, ps.ap, ps.maxAp, state)
      : [];

    return {
      state,
      displayState,
      highlightedPath,
      highlightedPathCommitted: this.autoPath.isCommitted(),
      highlightedPathTargetKind: this.autoPath.isCommitted()
        ? this.kindToRenderKind(this.autoPath.getTargetKind())
        : this.autoPath.isActive()
          ? 'move' // preview всегда белый, kind не влияет на цвет
          : 'none',
      highlightedPathTurnEndIndices,
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
      hotbar: this.buildHotbar(state),
      activeEffects,
      statusEffectsByEntity,
      aiModeByEntity,
      runStats: state.runStats,
      fieldObjectPopover,
      interactionHint,
      aiPreparedIntents,
      currentTurnSide: this.simulation!.isPlayerTurn() ? 'player' : state.turn.activeSide,
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

    for (const entity of this.simulation.findInteractableEntitiesAround(player, 1)) {
      const interaction = this.simulation.resolveInteraction(entity, player);
      if (!interaction) continue;

      const action: GameAction = {
        type: 'INTERACT',
        entityId: player.id,
        targetId: entity.id,
      };

      const preview = this.simulation.preview(action);
      if (!preview.valid) continue;

      const cost = this.simulation.getActionCost(action);
      if (player.ap < cost) continue;

      options.push({
        interactionId: interaction.interactionId,
        action,
        targetPosition: { x: entity.x, y: entity.y },
        labelKey: getInteractionHintKey(interaction.interactionId),
        priority: getInteractionPriority(interaction.interactionId),
      });
    }

    return options.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.interactionId.localeCompare(b.interactionId);
    });
  }

  /** Сбросить выбранный индекс, если набор опций или позиция игрока изменились. */
  private maybeResetInteractionIndex(options: InteractionOption[], player: Readonly<GameState>['player']): void {
    const key = `${player.x},${player.y}|` + options.map(o => `${o.interactionId}:${o.targetPosition.x}:${o.targetPosition.y}`).join('|');
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

  private getAbilityTemplate(
    abilityId: string,
    locale: Locale,
  ): { name: string; description: string; spriteId: string | undefined; cooldown: number; apCost: number | 'all'; tags: GameplayTag[] } | null {
    const fromSim = this.simulation!.getAbilityInfo(abilityId);
    if (!fromSim) return null;
    const localized = tryGetLocalizedAbility(abilityId, locale);
    return localized
      ? { ...fromSim, name: localized.name, description: localized.description, tags: fromSim.tags }
      : { ...fromSim, name: abilityId, description: '', tags: [] };
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

  /**
   * Собирает список подготовленных AI-намерений, видимых игроку.
   * Зона поражения вычисляется в Presentation через публичный API Simulation,
   * чтобы Simulation не хранила derived-данные для отрисовки.
   * Интенты выполнения получаются через SkillExecutor, чтобы отображать
   * перемещение, урон, статусы и другие эффекты так же, как у пользовательских скиллов.
   */
  private buildAIPreparedIntents(state: Readonly<GameState>): AIPreparedIntentViewModel[] {
    if (!this.simulation) return [];

    const intents: AIPreparedIntentViewModel[] = [];

    for (const entity of state.entities.values()) {
      if (entity.type !== 'enemy') continue;
      if (!('aiState' in entity)) continue;

      const prepared = entity.aiState.preparedAbility;
      if (!prepared) continue;

      // Показываем только видимых врагов
      if (!state.visible[entity.y]?.[entity.x]) continue;

      const abilityTemplate = this.getAbilityTemplate(prepared.abilityId, this.locale);

      const skillIntents = this.simulation.getAbilityIntents(prepared.abilityId, entity.id, prepared.targets);

      const presentationIntents: PresentationIntent[] = skillIntents
        .map((intent) => toPresentationIntent(intent, state))
        .filter((intent): intent is PresentationIntent => intent !== null);

      const affectedPositions = this.simulation.getAbilityAffectedPositions(
        prepared.abilityId,
        entity.id,
        prepared.targets,
        prepared.targets[0] ?? null,
      );

      intents.push({
        entityId: entity.id,
        abilityId: prepared.abilityId,
        name: abilityTemplate?.name ?? prepared.abilityId,
        icon: abilityTemplate?.spriteId ? `/assets/skills/${abilityTemplate.spriteId}.png` : null,
        fixedTargets: prepared.targets,
        affectedPositions,
        intents: presentationIntents,
      });
    }

    return intents;
  }

  private buildFieldObjectPopover(state: Readonly<GameState>): RenderInput['fieldObjectPopover'] {
    if (!this.fieldHover) return null;

    const { x, y } = this.fieldHover;

    // Popover объекта показывается только для клеток, видимых игроку в данный момент.
    if (!state.visible[y]?.[x]) return null;

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
      if (entity.type === 'floor_item_container') {
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

    if (item && (item.type === 'floor_item_container' || item.type === 'item')) {
      const inventoryItem = item.item;
      const template = tryGetLocalizedItem(inventoryItem.templateId, currentLocale);
      if (template) {
        const detail = mapItemTemplateToDetail(template, {
          stackCount: inventoryItem.quantity,
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
    detail: import('./types').ItemDetailViewModel | undefined;
  } {
    const info = GameSession.getItemInfo(id, locale);
    const template = tryGetLocalizedItem(id, locale);
    const rawTemplate = tryGetLocalizedItem(id, locale);
    return {
      id,
      name: info?.name ?? id,
      icon: info?.icon ?? `/assets/items/${id}.png`,
      fallback: info?.fallback ?? '?',
      detail: rawTemplate ? mapItemTemplateToDetail(rawTemplate, { isTemplate: true }, locale) : undefined,
    };
  }

  /** Переход в экран создания персонажа */
  enterCharacterCreation(): void {
    this.mode = 'characterCreation';
    this.simulation = null;
    this.displayState = null;
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
    this.displayState = resyncDisplayState(this.simulation.getState());
    this.mode = 'playing';
    this.lastResult = null;
    this.animation.phase = 'idle';
    this.hotbarAssignments = Array.from({ length: HOTBAR_SIZE }, () => null);
    this.synchronizeHotbarAssignments(this.simulation.getState());
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
    this.autoPath.cancel();
    this.suppressNextFieldClick = false;
    this.simulation = GameSimulation.loadSavedGame(state, this.debugEnabled);
    this.displayState = resyncDisplayState(this.simulation.getState());
    this.mode = this.resolveModeFromPhase(state.phase);
    this.lastResult = null;
    this.animation.phase = this.mode === 'playing' ? 'idle' : 'gameOver';
    this.selectedInteractionIndex = 0;
    this.lastInteractionOptionsKey = '';
    this.hotbarAssignments = Array.from({ length: HOTBAR_SIZE }, () => null);
    if (this.mode === 'playing') {
      this.synchronizeHotbarAssignments(this.simulation.getState());
    }
    this.clearLogs();
    this.clearToasts();
    this.notify();
  }

  /** Начать выбор цели для способности. */
  beginTargeting(abilityId: string): void {
    if (!this.simulation) return;
    if (this.animation.phase === 'animating') return;

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
    this.autoPath.cancel();
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

  /** Установить клетку под мышью в обычном режиме (для popover объекта на поля). */
  setFieldHover(hoveredPosition: Position | null): void {
    const prevHover = this.fieldHover;
    const prevPath = this.autoPath.getPath();

    const canShow =
      this.mode === 'playing' &&
      this.targeting.phase !== 'targeting';
    this.fieldHover = canShow ? hoveredPosition : null;

    this.refreshAutoPathPreview();

    const hoverChanged =
      this.fieldHover?.x !== prevHover?.x || this.fieldHover?.y !== prevHover?.y;
    const pathChanged = !this.pathsEqual(prevPath, this.autoPath.getPath());

    if (hoverChanged || pathChanged) {
      this.notify();
    }
  }

  /** Перестроить preview-путь по текущему fieldHover.
   *  Ничего не делает, если условия для preview не выполнены (анимация,
   *  таргетинг, committed-автопуть или игра не в режиме playing). */
  private refreshAutoPathPreview(): void {
    if (
      this.mode !== 'playing' ||
      this.targeting.phase === 'targeting' ||
      !this.simulation ||
      this.autoPath.isCommitted() ||
      this.animation.phase !== 'idle'
    ) {
      return;
    }

    const state = this.simulation.getState();
    const target = this.fieldHover
      ? this.resolveAutoPathTarget(state, this.fieldHover)
      : null;
    this.autoPath.hover(target, state, this.getAutoPathQueries());
  }

  /** Сравнить два пути по значению. */
  private pathsEqual(a: Position[] | null, b: Position[] | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return a.every((p, i) => p.x === b[i]!.x && p.y === b[i]!.y);
  }

  /** Обработать клик по игровому полю (автопуть). */
  handleFieldClick(pos: Position): void {
    // Если автопуть только что был отменён вводом во время анимации,
    // игнорируем клик, который следует за этой отменой (обычно отпускание
    // кнопки мыши), чтобы не начинать новый автопуть случайно.
    if (this.suppressNextFieldClick) {
      this.suppressNextFieldClick = false;
      return;
    }

    if (!this.simulation || this.mode !== 'playing' || this.animation.phase === 'animating') return;
    if (this.targeting.phase === 'targeting') return;

    const state = this.simulation.getState();

    // Клик на клетку игрока — отменить автопуть.
    if (pos.x === state.player.x && pos.y === state.player.y) {
      this.autoPath.cancel();
      this.notify();
      return;
    }

    if (!isTileExplored(state, pos)) return;

    const target = this.resolveAutoPathTarget(state, pos);
    if (!target) {
      this.autoPath.cancel();
      this.notify();
      return;
    }

    // Новый автопуть: сбрасываем старый, строим новый и фиксируем.
    this.autoPath.cancel();
    this.autoPath.hover(target, state, this.getAutoPathQueries());
    const committed = this.autoPath.commit();
    if (!committed) {
      this.notify();
      return;
    }

    const stepResult = this.autoPath.step(state, this.getAutoPathQueries());
    if (stepResult.kind === 'action') {
      this.dispatch(stepResult.action);
    } else {
      this.handleAutoPathCancel(stepResult);
      this.autoPath.cancel();
      this.notify();
    }
  }

  /**
   * Рассчитать индексы тайлов пути, на которых заканчивается ход.
   *
   * Учитывает реальную стоимость действий:
   - MOVE — 1 AP;
   - INTERACT (открытие двери) — 1 AP;
   - ATTACK по врагу — 1 AP.
   *
   * Если действие не перемещает персонажа (открытие/атака), конец хода
   * отмечается на предыдущем достигнутом тайле.
   */
  private computeTurnEndIndices(
    path: Position[],
    ap: number,
    maxAp: number,
    state: Readonly<GameState>,
  ): number[] {
    if (maxAp <= 0 || path.length === 0) return [];

    const target = this.autoPath.getTarget();
    const indices: number[] = [];
    let remaining = ap;
    let reachedIndex = -1;

    for (let i = 0; i < path.length; i++) {
      const pos = path[i]!;
      const isFinalTargetTile =
        target !== null && pos.x === target.position.x && pos.y === target.position.y;

      // Собираем действия, которые нужны для прохождения/взаимодействия с тайлом.
      const actions: Array<{ type: 'move' | 'interact' | 'attack'; pathIndex: number }> = [];

      if (target?.kind === 'enemy' && isFinalTargetTile) {
        actions.push({ type: 'attack', pathIndex: i });
      } else if (target?.kind === 'door' && isFinalTargetTile) {
        const door = this.findSingleClosedDoorAt(pos, state);
        if (door) {
          actions.push({ type: 'interact', pathIndex: i });
        } else {
          actions.push({ type: 'move', pathIndex: i });
        }
      } else {
        const door = this.findSingleClosedDoorAt(pos, state);
        if (door) {
          actions.push({ type: 'interact', pathIndex: i });
        }
        actions.push({ type: 'move', pathIndex: i });
      }

      for (const action of actions) {
        const cost = 1;
        if (remaining < cost) {
          return indices;
        }

        remaining -= cost;
        if (action.type === 'move') {
          reachedIndex = action.pathIndex;
        }

        if (remaining === 0) {
          if (reachedIndex >= 0) {
            indices.push(reachedIndex);
          }
          remaining = maxAp;
          reachedIndex = -1;
        }
      }

      // Автопуть к цели-двери завершается после одного действия.
      if (target?.kind === 'door' && isFinalTargetTile) {
        break;
      }
    }

    return indices;
  }

  /**
   * Возвращает единственную закрытую дверь на тайле.
   * Если на клетке есть другие блокираторы (враг, ещё одна дверь), возвращает null.
   */
  private findSingleClosedDoorAt(pos: Position, state: Readonly<GameState>): DoorEntity | null {
    if (!this.simulation) return null;
    const blockers = this.simulation.findEntitiesAt(pos).filter((e) => e.blocksMovement);
    if (blockers.length !== 1) return null;

    const door = blockers[0];
    if (!door || door.type !== 'door' || door.isAlive === false || door.isOpen) return null;
    return door;
  }

  /** Преобразует внутренний вид цели автопути в вид для renderer'а. */
  private kindToRenderKind(kind: AutoPathTargetKind): HighlightedPathTargetKind {
    switch (kind) {
      case 'enemy':
        return 'enemy';
      case 'door':
      case 'interactable':
        return 'interactable';
      case 'move':
      default:
        return 'move';
    }
  }

  /** Возвращает query-функции для автопути из публичного API Simulation. */
  private getAutoPathQueries(): AutoPathQueries {
    const simulation = this.simulation!;

    // Для построения автопути закрытая дверь считается условно проходимой:
    // игрок подойдёт и откроет её. Если на клетке есть другой блокиратор
    // (враг, ещё одна дверь), клетка остаётся непроходимой.
    const isTilePassable = (pos: Position): boolean => {
      if (simulation.isTileWalkableForPlayer(pos)) return true;

      const blockers = simulation.findEntitiesAt(pos).filter((e) => e.blocksMovement);
      if (blockers.length !== 1) return false;

      const door = blockers[0];
      if (!door) return false;
      return door.type === 'door' && door.isAlive !== false && !door.isOpen;
    };

    return {
      isTileWalkable: (pos) => simulation.isTileWalkableForPlayer(pos),
      isTilePassable,
      findPathTowards: (start, target) => {
        const isWalkable = (p: Position) => simulation.isTileWalkableForPlayer(p);
        return findPathTowards(start, target, isWalkable, isTilePassable);
      },
      findEntityAt: (pos, filter) => simulation.findEntityAt(pos, filter),
      findEntitiesAt: (pos, filter) => simulation.findEntitiesAt(pos, filter),
    };
  }

  /**
   * Определяет цель автопути по клетке клика / hover.
   * Приоритет: враг → дверь → лестница → предмет → пустой тайл.
   * Возвращает null, если клетка не изведана.
   */
  private resolveAutoPathTarget(state: Readonly<GameState>, pos: Position): AutoPathTarget | null {
    if (!isTileExplored(state, pos)) return null;

    const simulation = this.simulation!;

    const enemy = simulation.findEntityAt(
      pos,
      (e) => e.type === 'enemy' && e.isAlive !== false,
    );
    if (enemy && enemy.id !== state.player.id && state.visible[pos.y]?.[pos.x]) {
      return { position: pos, kind: 'enemy', entityId: enemy.id };
    }

    const door = simulation.findEntityAt(
      pos,
      (e) => e.type === 'door' && e.isAlive !== false,
    );
    if (door) {
      return { position: pos, kind: 'door', entityId: door.id };
    }

    const stairs = simulation.findEntityAt(
      pos,
      (e) => e.type === 'stairs',
    );
    if (stairs) {
      return { position: pos, kind: 'interactable', entityId: stairs.id };
    }

    const item = simulation.findEntitiesAt(pos).find(
      (e) => e.type === 'floor_item_container',
    );
    if (item) {
      return { position: pos, kind: 'interactable', entityId: item.id };
    }

    return { position: pos, kind: 'move', entityId: null };
  }

  /** Отменить автопуть (например, по нажатию клавиши или мыши).
   *
   *  @param blockFollowingClick — если true и отмена произошла во время
   *    анимации, следующий клик по полю будет проигнорирован. Используется
   *    UI при отмене зажатием мыши, чтобы отпускание кнопки не начинало
   *    новый автопуть. */
  cancelAutoPath(blockFollowingClick: boolean = false): void {
    if (this.autoPath.isActive() || this.autoPath.isCommitted()) {
      this.autoPath.cancel();
      this.notify();
    }
    this.suppressNextFieldClick = blockFollowingClick && this.animation.phase === 'animating';
  }

  /** Активен ли автопуть (preview или committed). */
  isAutoPathActive(): boolean {
    return this.autoPath.isActive();
  }

  /** Зафиксирован ли автопуть. */
  isAutoPathCommitted(): boolean {
    return this.autoPath.isCommitted();
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

    const mainResult = this.dispatchAction(action);
    let combinedResult = mainResult;

    // Если AP игрока закончилось, автоматически завершаем ход.
    // Не делаем этого, если игрок уже явно завершил ход (action.type === 'END_TURN').
    if (mainResult.success && mainResult.stateChanged && action.type !== 'END_TURN') {
      const state = this.simulation.getState();
      if (state.player.ap <= 0 && state.player.isAlive !== false) {
        const endTurnResult = this.dispatchAction({ type: 'END_TURN', entityId: state.player.id });
        combinedResult = this.mergeResults(combinedResult, endTurnResult);
      }
    }

    // Если авто END_TURN по какой-то причине не удался, сохраняем результат основного
    // действия, чтобы анимация не потерялась и игра не зависла в animating без анимаций.
    this.lastResult = combinedResult.success ? combinedResult : (mainResult.success ? mainResult : null);

    // Явный END_TURN отменяет автопуть.
    if (action.type === 'END_TURN') {
      this.autoPath.cancel();
    }

    // После каждого хода проверяем, не закончилась ли игра
    this.checkGameOver();


    // Если фазы не породили анимаций, но ход не завершён — сразу идём дальше.
    if (this.mode === 'playing' && this.animation.phase === 'idle' && this.lastResult?.hasMoreSteps) {
      this.step();
      return;
    }

    this.notify();
  }

  /** Выполнить одно действие в Simulation и обновить лог/анимации/toast'ы. */
  private dispatchAction(action: GameAction): SimulationResult {
    const result = this.simulation!.dispatch(action);

    // В debug-режиме выводим действие, дерево событий и срабатывания правил в консоль.
    if (this.debugEnabled) {
      console.log('[GameSession] dispatch action:', action);
      this.logDebugSimulationResult(result);
    }

    if (result.success && result.stateChanged) {
      const state = this.simulation!.getState();
      const plan = buildPresentationPlan(result, state);
      const events = extractEventsFromPlan(plan);
      this.logs.append(state, events, this.locale);
      this.logs.logs = this.logs.logs.slice(-30);

      // Строим дерево анимаций из плана презентации
      const animations = buildAnimationTree(result, state);
      if (animations.length > 0) {
        this.animation.phase = 'animating';
        this.animationBatchId++;
      }

      // Применяем патчи только если нет анимаций: с анимациями UI применит патчи
      // по завершении каждого шага через onNodeComplete.
      if (animations.length === 0) {
        this.displayState = applyPatches(this.displayState ?? buildDisplayState(state), plan);
      }
    } else if (!result.success) {
      // При неудачном ходе показываем причины отказа и сбрасываем автопуть
      const rejectedToasts = extractToasts(result);
      for (const toast of rejectedToasts) {
        this.toasts.push(toast.kind, toast.title, toast.message, toast.duration);
      }
      this.autoPath.cancel();
    }

    return result;
  }

  /** Объединить два результата Simulation в один (используется при авто END_TURN). */
  private mergeResults(a: SimulationResult, b: SimulationResult): SimulationResult {
    if (!b.success) {
      // Авто-END_TURN не выполнен: toasts уже извлечены в dispatchAction,
      // но в merged-объекте причины ошибки теряются, поэтому логируем явно.
      const rejectedToasts = extractToasts(b);
      console.error(
        '[GameSession] Автоматический END_TURN не выполнен',
        rejectedToasts.length > 0 ? rejectedToasts : b,
      );
    }
    const merged: SimulationResult = {
      success: a.success && b.success,
      stateChanged: a.stateChanged || b.stateChanged,
      phases: [...a.phases, ...b.phases],
      hasMoreSteps: a.hasMoreSteps || b.hasMoreSteps,
    };
    return merged;
  }

  /** Проверить, не перешла ли игра в состояние dead/victory. */
  private checkGameOver(): void {
    const state = this.simulation!.getState();
    if (state.phase === 'dead') {
      this.mode = 'gameOver';
      this.animation.phase = 'gameOver';
    } else if (state.phase === 'victory') {
      this.mode = 'victory';
      this.animation.phase = 'gameOver';
    }
  }

  /** Выполнить следующую системную фазу или AI-действие. */
  private step(): void {
    if (!this.simulation || this.mode !== 'playing') {
      return;
    }

    // Обрабатываем пустые фазы в цикле, чтобы избежать переполнения стека
    // при большом количестве подряд идущих пустых шагов.
    let running = true;
    while (running) {
      const result = this.simulation.step();
      this.lastResult = result;

      // В debug-режиме выводим объект, полученный от simulation.step(), и срабатывания правил.
      if (this.debugEnabled) {
        console.log('[GameSession] simulation step result:');
        this.logDebugSimulationResult(result);
      }

      const state = this.simulation.getState();
      const plan = buildPresentationPlan(result, state);
      const events = extractEventsFromPlan(plan);
      this.logs.append(state, events, this.locale);
      this.logs.logs = this.logs.logs.slice(-30);

      const animations = buildAnimationTree(result, state);
      if (animations.length > 0) {
        this.animation.phase = 'animating';
        this.animationBatchId++;
        this.emptyStepCounter = 0;
        running = false;
      } else if (!result.hasMoreSteps) {
        this.animation.phase = 'idle';
        this.emptyStepCounter = 0;
        running = false;
      } else {
        // Пустая фаза, но ход не закончен — продолжаем в том же цикле.
        this.emptyStepCounter++;
        if (this.emptyStepCounter > this.EMPTY_STEP_LIMIT) {
          console.error(`[GameSession] Слишком много пустых фаз подряд (${this.emptyStepCounter}), прерываем цикл`);
          this.animation.phase = 'idle';
          this.emptyStepCounter = 0;
          running = false;
        } else if (this.emptyStepCounter === this.EMPTY_STEP_WARNING_THRESHOLD + 1) {
          console.warn(
            `[GameSession] Превышен порог пустых фаз (${this.EMPTY_STEP_WARNING_THRESHOLD}), ` +
            `продолжаем до лимита ${this.EMPTY_STEP_LIMIT}`,
          );
        }
      }

      // Применяем патчи только если нет анимаций: с анимациями UI применит патчи
      // по завершении каждого шага через onNodeComplete.
      if (animations.length === 0) {
        this.displayState = applyPatches(this.displayState ?? buildDisplayState(state), plan);
      }
    }

    this.checkGameOver();

    // Если очередь фаз завершилась без анимаций, UI не получит сигнал
    // onAnimationsComplete. Обрабатываем автопродолжение здесь, не уведомляя
    // UI повторно: единственное уведомление произойдёт либо сейчас
    // (если продолжения нет), либо внутри dispatch/moveOrAttack.
    const needsContinuation =
      this.mode === 'playing' &&
      this.animation.phase === 'idle' &&
      this.lastResult &&
      !this.lastResult.hasMoreSteps;

    if (needsContinuation) {
      const continued = this.onAnimationsComplete({skipNotify: true});
      if (!continued) {
        this.notify();
      }
    } else {
      this.notify();
    }
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

    const target = this.simulation.findEntityAt(
      {x: targetX, y: targetY},
      (e) => (e.type === 'enemy' || e.type === 'player') && e.isAlive !== false,
    );

    let action: GameAction;

    const doorAtTarget = this.simulation.findEntityAt(
      {x: targetX, y: targetY},
      (e) => e.type === 'door' && e.isAlive !== false,
    );

    if (target && target.id !== state.player.id) {
      // Атака по врагу/другой не-дверной цели.
      // Если враг стоит на клетке с открытой дверью, атака всё равно должна
      // сработать в приоритете, а не превращаться в MOVE.
      action = {type: 'ATTACK', entityId: state.player.id, dx, dy};
    } else if (doorAtTarget && doorAtTarget.type === 'door') {
      if (doorAtTarget.isOpen) {
        // Открытая дверь — просто заходим на её клетку.
        action = {type: 'MOVE', entityId: state.player.id, dx, dy};
      } else {
        // Закрытая дверь — взаимодействуем вместо атаки.
        // Сбрасываем удерживаемое направление, чтобы при зажатой клавише
        // персонаж не зашёл на клетку двери автоматически в тот же ход.
        this.dispatch({
          type: 'INTERACT',
          entityId: state.player.id,
          targetId: doorAtTarget.id,
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

  /**
   * Сигнал от UI: все анимации завершены. Разрешаем следующий ввод.
   *
   * @returns true, если управление передано в dispatch/moveOrAttack и
   *   следующее уведомление UI произойдёт внутри этих методов.
   */
  onAnimationsComplete(options: {skipNotify?: boolean} = {}): boolean {
    // Если в очереди остались фазы — продолжаем выполнение.
    if (this.lastResult?.hasMoreSteps) {
      this.step();
      return true;
    }

    const hadAnimations = this.animation.phase === 'animating';
    if (hadAnimations) {
      this.animation.phase = 'idle';
      this.lastResult = null; // сбрасываем анимации, чтобы не воспроизводить повторно
      if (this.simulation) {
        this.displayState = resyncDisplayState(this.simulation.getState());
      }
    }

    // Автопродолжение зафиксированного автопути.
    if (this.autoPath.isCommitted() && this.animation.phase === 'idle' && this.mode === 'playing') {
      const state = this.simulation!.getState();
      const isPlayerTurn = this.simulation!.isPlayerTurn();
      if (!isPlayerTurn || state.player.ap <= 0) {
        this.autoPath.cancel();
        if (!options.skipNotify) {
          this.notify();
        }
        return false;
      }
      const stepResult = this.autoPath.step(state, this.getAutoPathQueries());
      if (stepResult.kind === 'action') {
        this.dispatch(stepResult.action);
        return true;
      }
      // Путь больше не валиден — контроллер уже сбросился, нужно обновить UI.
      this.handleAutoPathCancel(stepResult);
      if (!options.skipNotify) {
        this.notify();
      }
      return false;
    }

    if (this.heldDirection && this.animation.phase === 'idle' && this.mode === 'playing') {
      this.moveOrAttack(this.heldDirection.dx, this.heldDirection.dy);
      return true;
    }

    // После завершения анимации перестраиваем preview-путь: во время
    // анимации он не обновлялся, а fieldHover мог сместиться из-за
    // движения камеры за игроком.
    if (hadAnimations && this.animation.phase === 'idle' && this.mode === 'playing') {
      this.refreshAutoPathPreview();
    }
    if (!options.skipNotify) {
      this.notify();
    }
    return false;
  }

  /** Применить один патч к DisplayState после завершения анимационного шага.
   *
   * UI вызывает этот метод по завершении каждого шага анимации, чтобы
   * DisplayState оставался синхронизированным с визуальным состоянием. */
  applyAnimationPatch(patch: DisplayPatch): void {
    if (!this.displayState) return;
    this.displayState = applyPatch(this.displayState, patch);
    this.notify();
  }

  /** Применить несколько патчей к DisplayState после завершения анимационного шага. */
  applyAnimationPatches(patches: DisplayPatch[]): void {
    if (!this.displayState) return;
    let next = this.displayState;
    for (const patch of patches) {
      next = applyPatch(next, patch);
    }
    this.displayState = next;
    this.notify();
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

  /** Размер панели быстрого доступа. */
  getHotbarSize(): number {
    return HOTBAR_SIZE;
  }

  /** Активировать слот хотбара по индексу (клик или горячая клавиша). */
  activateHotbarSlot(index: number): void {
    if (!this.simulation || this.mode !== 'playing' || this.animation.phase === 'animating') return;
    if (index < 0 || index >= HOTBAR_SIZE) return;

    const assignment = this.hotbarAssignments[index];
    if (!assignment) return;

    if (assignment.kind === 'skill') {
      this.beginTargeting(assignment.abilityId);
    } else if (assignment.kind === 'consumable') {
      const state = this.simulation.getState();
      const item = state.player.inventory.find(i => i.templateId === assignment.templateId && i.quantity > 0);
      if (!item) return;
      this.dispatch({ type: 'USE_ITEM', entityId: 'player', itemInstanceId: item.instanceId });
    }
  }

  /** Построить ViewModel хотбара для UI. */
  private buildHotbar(state: Readonly<GameState>): import('./types').HotbarItemViewModel[] {
    this.synchronizeHotbarAssignments(state);

    const player = state.player;
    const abilityById = new Map(player.abilities.map(a => [a.templateId, a]));

    return Array.from({ length: HOTBAR_SIZE }, (_, index) => {
      const assignment = this.hotbarAssignments[index];
      if (!assignment) {
        return {
          slotIndex: index,
          kind: 'empty' as const,
          icon: null,
          apCost: 0,
          isAvailable: false,
          isActive: false,
        };
      }

      if (assignment.kind === 'skill') {
        const runtimeAbility = abilityById.get(assignment.abilityId);
        const info = runtimeAbility ? this.simulation!.getAbilityInfo(assignment.abilityId) : null;
        const localized = info ? this.getAbilityTemplate(assignment.abilityId, this.locale) : null;
        const cooldown = runtimeAbility?.currentCooldown ?? 0;
        const maxCooldown = info?.cooldown ?? 0;
        const isAvailable = runtimeAbility !== undefined && cooldown === 0;
        const isActive = this.targeting.state?.abilityId === assignment.abilityId;
        const resolvedApCost = info?.apCost === 'all'
          ? Math.min(player.ap, MAX_ABILITY_ALL_AP_COST)
          : (info?.apCost ?? 1);

        return {
          slotIndex: index,
          kind: 'skill' as const,
          abilityId: assignment.abilityId,
          icon: localized && localized.spriteId ? `/assets/skills/${localized.spriteId}.png` : null,
          fallback: localized?.name?.[0] ?? '?',
          apCost: resolvedApCost,
          cooldown,
          maxCooldown,
          isAvailable,
          isActive,
          tooltip: localized
            ? {
                kind: 'skill' as const,
                name: localized.name,
                description: localized.description,
                icon: localized.spriteId ? resolveAbilityIcon(localized.spriteId) : null,
                cooldown,
                maxCooldown,
                apCost: info?.apCost ?? 1,
                tags: localized.tags ?? [],
              }
            : undefined,
        };
      }

      // assignment.kind === 'consumable'
      const template = tryGetLocalizedItem(assignment.templateId, this.locale);
      const itemsOfTemplate = player.inventory.filter(i => i.templateId === assignment.templateId);
      const quantity = itemsOfTemplate.reduce((sum, i) => sum + i.quantity, 0);
      const depleted = quantity <= 0;
      const icon = template ? resolveItemIcon(template.spriteId ?? template.id) : null;
      return {
        slotIndex: index,
        kind: 'consumable' as const,
        templateId: assignment.templateId,
        icon,
        fallback: template?.fallback ?? '?',
        rarity: template?.rarity ?? 'common',
        quantity,
        apCost: template?.apCost ?? 1,
        isAvailable: !depleted,
        isActive: false,
        depleted,
        tooltip: template
          ? {
              kind: 'consumable' as const,
              item: mapItemTemplateToDetail(
                template,
                { stackCount: quantity, rarity: template.rarity, fallbackIcon: template.fallback },
                this.locale,
              ),
            }
          : undefined,
      };
    });
  }

  /** Синхронизировать привязки хотбара с текущим инвентарём и скиллами игрока. */
  private synchronizeHotbarAssignments(state: Readonly<GameState>): void {
    const player = state.player;
    const abilityIds = new Set(player.abilities.map(a => a.templateId));

    // Освобождаем слоты, если привязанный скилл больше не доступен.
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const assignment = this.hotbarAssignments[i];
      if (!assignment) continue;
      if (assignment.kind === 'skill' && !abilityIds.has(assignment.abilityId)) {
        this.hotbarAssignments[i] = null;
      }
      // Расходники остаются в слоте как depleted-призраки, даже если их нет в инвентаре,
      // чтобы UI мог показать серую иконку и красный 0.
    }

    const assignedAbilityIds = new Set(
      this.hotbarAssignments
        .filter((a): a is { kind: 'skill'; abilityId: string } => a?.kind === 'skill')
        .map(a => a.abilityId),
    );
    const assignedConsumableTemplateIds = new Set(
      this.hotbarAssignments
        .filter((a): a is { kind: 'consumable'; templateId: string } => a?.kind === 'consumable')
        .map(a => a.templateId),
    );

    const unassignedAbilities = player.abilities
      .filter(a => !assignedAbilityIds.has(a.templateId))
      .map(a => a.templateId);

    const consumableTemplateIds = new Set(
      player.inventory
        .filter(item => {
          const template = tryGetLocalizedItem(item.templateId, this.locale);
          return template?.type === 'consumable';
        })
        .map(item => item.templateId),
    );

    const unassignedConsumableTemplates = [...consumableTemplateIds].filter(
      templateId => !assignedConsumableTemplateIds.has(templateId),
    );

    const fillables: HotbarAssignment[] = [
      ...unassignedAbilities.map(abilityId => ({ kind: 'skill' as const, abilityId })),
      ...unassignedConsumableTemplates.map(templateId => ({ kind: 'consumable' as const, templateId })),
    ];

    for (const fillable of fillables) {
      const slotIndex = this.findFirstFillableHotbarSlot(state);
      if (slotIndex === -1) break;
      this.hotbarAssignments[slotIndex] = fillable;
    }
  }

  /** Найти первый слот, доступный для автозаполнения: пустой или с исчерпанным расходником. */
  private findFirstFillableHotbarSlot(state: Readonly<GameState>): number {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const assignment = this.hotbarAssignments[i];
      if (!assignment) return i;
      if (assignment.kind === 'consumable') {
        const totalQuantity = state.player.inventory
          .filter(item => item.templateId === assignment.templateId)
          .reduce((sum, item) => sum + item.quantity, 0);
        if (totalQuantity <= 0) return i;
      }
    }
    return -1;
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

  /** Debug: вывести в консоль дерево ExecutionNode и срабатывания правил из SimulationResult. */
  private logDebugSimulationResult(result: SimulationResult): void {
    const tree = result.phases.map((phase) => ({
      side: phase.side,
      actions: phase.actions.map((node) => this.toDebugExecutionNode(node)),
    }));

    console.log('[GameSession] Execution tree:', {
      success: result.success,
      stateChanged: result.stateChanged,
      hasMoreSteps: result.hasMoreSteps,
      phases: tree,
    });

    const ruleTriggers = this.collectRuleTriggers(result);
    if (ruleTriggers.length > 0) {
      console.log('[GameSession] Rule triggers:');
      for (const trigger of ruleTriggers) {
        console.log(
          `  [DEBUG] Сработало правило ${trigger.ruleId} (${trigger.layer}) ` +
          `→ ${trigger.intents.length} интентов ` +
          `(trigger: ${trigger.triggerEventType}, owner: ${trigger.ownerEntityId ?? 'world'})`,
        );
      }
    }
  }

  /** Рекурсивно собрать все RULE_TRIGGERED события из SimulationResult. */
  private collectRuleTriggers(result: SimulationResult): RuleTriggeredEvent[] {
    const triggers: RuleTriggeredEvent[] = [];
    for (const phase of result.phases) {
      for (const action of phase.actions) {
        this.walkRuleTriggers(action, triggers);
      }
    }
    return triggers;
  }

  private walkRuleTriggers(node: ExecutionNode, out: RuleTriggeredEvent[]): void {
    if (node.event.type === 'RULE_TRIGGERED') {
      out.push(node.event);
    }
    for (const child of node.children) {
      this.walkRuleTriggers(child, out);
    }
  }

  /** Рекурсивно превратить ExecutionNode в плоский объект без ссылки parent. */
  private toDebugExecutionNode(node: ExecutionNode): { event: GameEvent; children: unknown[] } {
    return {
      event: node.event,
      children: node.children.map((child) => this.toDebugExecutionNode(child)),
    };
  }

  /** Возврат в главное меню. Уничтожает текущую симуляцию. */
  returnToMenu(): void {
    this.autoPath.cancel();
    this.suppressNextFieldClick = false;
    this.simulation = null;
    this.displayState = null;
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

  /** Показать toast, если автопуть отменён по причине, требующей уведомления. */
  private handleAutoPathCancel(stepResult: AutoPathStepResult): void {
    if (stepResult.kind === 'cancelled' && stepResult.reason === 'new_enemy') {
      this.toasts.push(
        'warning',
        t('components.toast.autoPathEnemyDetectedTitle'),
        t('components.toast.autoPathEnemyDetectedMessage'),
      );
    }
  }

  /** Закрыть всплывающее уведомление по идентификатору. */
  dismissToast(id: string): void {
    this.toasts.remove(id);
    this.notify();
  }

}
