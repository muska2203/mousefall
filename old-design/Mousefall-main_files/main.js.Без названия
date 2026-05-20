import { createInitialState, createPlayerSheet } from "./state.js?v=0.5.7-pre-alpha";
import {
  STARTER_LOADOUT_MAX,
  applyLoadoutToSheet,
  createRuntimeItemInstance,
  chooseStarterLoadoutItem,
  getStarterCommonItems,
  getAllLootItems,
  getItemById,
  initializeInventoryForRun,
  restoreItemInstanceToBag,
  swapItemFromBag,
  spendLevelUpPoint,
  recalculateSheetFromInventory,
} from "./loadout.js?v=0.5.7-pre-alpha";
import { createRunState, createNextLevelRun, tryStep, beginEnvironmentTurn, stepEnvironmentTurn, buildPathToDiscoveredCell } from "./game.js?v=0.5.7-pre-alpha";
import { drawRunToCanvas } from "./render.js?v=0.5.7-pre-alpha";
import { resolveMoveDirectionFromEvent } from "./input/moveKeys.js?v=0.5.7-pre-alpha";
import { resolveDirectionByDelta } from "./input/directionMap.js?v=0.5.7-pre-alpha";
import { resolveQuickbarSlotIndexFromKeyboardEvent } from "./input/gameControls.js?v=0.5.7-pre-alpha";
import { screenPointToGrid, isValidPathTargetCell } from "./runtime/canvasGrid.js?v=0.5.7-pre-alpha";
import { normalizeCanvasZoom } from "./runtime/canvasCamera.js?v=0.5.7-pre-alpha";
import { createCanvasRunHandlers } from "./runtime/canvasRunHandlers.js?v=0.5.7-pre-alpha";
import { startAnimationLoop } from "./runtime/gameLoop.js?v=0.5.7-pre-alpha";
import {
  advanceRunAnimationState,
  isBlockingMotionActive,
  normalizeFinishedAnimationsForRun,
} from "./runtime/motionTiming.js?v=0.5.7-pre-alpha";
import { canAcceptPlayerAction, canStartEnvironmentTurn } from "./runtime/playerActionGuards.js?v=0.5.7-pre-alpha";
import { buildCanvasOverlayViewModel } from "./runtime/canvasOverlayViewModel.js?v=0.5.7-pre-alpha";
import { installMousefallConsoleHelpers } from "./runtime/consoleDevHelpers.js?v=0.5.7-pre-alpha";
import { ensureRunFxState } from "./runtime/runFxState.js?v=0.5.7-pre-alpha";
import {
  isEnvironmentTurnStepReady,
  isLevelTransitionReady,
  isPlayerInputBlockedByMotion,
} from "./runtime/runFlow.js?v=0.5.7-pre-alpha";
import { getEnemyById } from "./game/enemies.js?v=0.5.7-pre-alpha";
import { randomInt } from "./game/rng.js?v=0.5.7-pre-alpha";
import { useConsumable } from "./game/consumables.js?v=0.5.7-pre-alpha";
import { placeTrap } from "./game/consumables.js?v=0.5.7-pre-alpha";
import { getConsumableApplyConsistencyReport } from "./items/consumableApply.js?v=0.5.7-pre-alpha";
import { getTrapPlacementCells } from "./game/trapPlacement.js?v=0.5.7-pre-alpha";
import { buildSkillTargetingPreviews } from "./game/skillTargetingPreviews.js?v=0.5.7-pre-alpha";
import { getSkillTargetsByKind } from "./game/skillTargetsByKind.js?v=0.5.7-pre-alpha";
import { applyXpGain } from "./game/xp.js?v=0.5.7-pre-alpha";
import {
  getSkillsForEquippedItem,
  getSkillById,
  getSkillManaCost,
  getSkillIdsForItem,
  usePreparedSkillSelections,
  processPendingSkillApplications,
  getSkillTargetingProfile,
  getSkillAffectedCellsForRoot,
  getSkillPreviewForPreparedSelections,
} from "./skillsRuntime.js?v=0.5.7-pre-alpha";
import { STRINGS_RU } from "./strings/ru.js?v=0.5.7-pre-alpha";
import { DEVLOG_ENTRIES } from "./devlog.js?v=0.5.7-pre-alpha";
import { createInventoryItemPopoverController } from "./ui/inventoryPopover.js?v=0.5.7-pre-alpha";
import {
  createSkillHoverPopoverController,
  createWorldObjectHoverPopoverController,
} from "./ui/gameHoverPopovers.js?v=0.5.7-pre-alpha";
import { buildQuickbarHtml, buildSkillsListHtml } from "./ui/gameSkillQuickbarHtml.js?v=0.5.7-pre-alpha";
import { buildActiveEffectsViewModel } from "./ui/gameEffectsViewModel.js?v=0.5.7-pre-alpha";
import { buildConsumableCellsHtml, buildInventoryCellsHtml } from "./ui/gameInventoryHtml.js?v=0.5.7-pre-alpha";
import { buildEndingEquipRowsHtml, buildGameEquipRowsHtml } from "./ui/equipmentRowsHtml.js?v=0.5.7-pre-alpha";
import { buildItemSpriteStackHtml } from "./ui/spriteIconHtml.js?v=0.5.7-pre-alpha";
import { buildEndingScreenHtml } from "./ui/renderers/endingScreen.js?v=0.5.7-pre-alpha";
import { buildGameScreenHtml } from "./ui/renderers/gameScreen.js?v=0.5.7-pre-alpha";
import { buildAnvilOverlayHtml } from "./ui/renderers/anvilOverlay.js?v=0.5.7-pre-alpha";
import { buildFooterMetaHtml } from "./ui/footerMetaHtml.js?v=0.5.7-pre-alpha";
import { initAnalytics, trackEvent, createRunAnalyticsId } from "./analytics.js?v=0.5.7-pre-alpha";
import { APP_VERSION, GA4_MEASUREMENT_ID } from "./app-config.js?v=0.5.7-pre-alpha";
import { buildDerivedStats, calculateWeaponDamage, getWeaponDamageFormulaText } from "./rules.js?v=0.5.7-pre-alpha";
import {
  buildImproveResult,
  buildRecycleResult,
  buildReforgeResult,
  canCraftImprove,
  canCraftRecycle,
  canCraftReforge,
  describeAnvilMode,
  getItemRarity as getAnvilRarity,
  getRarityBadgeClass,
  getRecyclePreview,
  getReforgeCandidates,
  isEquipableItem,
} from "./game/anvilCrafting.js?v=0.5.7-pre-alpha";
import { ACTOR_KIND, removeObject } from "./game/cellObjects.js?v=0.5.7-pre-alpha";
import { applyObjectActivationOnCell } from "./game/cellActivation.js?v=0.5.7-pre-alpha";
import { PLAYER_PORTRAITS } from "./game/playerPortraitsCatalog.js?v=0.5.7-pre-alpha";

import { buildSkillDetailHtml } from "./ui/skillPresentation.js?v=0.5.7-pre-alpha";
import { buildHoverCardHtml } from "./ui/hoverCardHtml.js?v=0.5.7-pre-alpha";

const root = document.getElementById("app");

const PORTRAITS = PLAYER_PORTRAITS;

const state = createInitialState();
state.selectedPortraitId = "witcher";
state.uiNewModal = null;
state.uiHud.anvilSession = null;
state.uiNewStartMessage = "";
state.screen = "welcome";
state.uiNewRunStartedAtMs = null;
state.uiNewLastCanvasClickAtMs = 0;
let uiNewResizeTimer = null;
let lastPointerClientX = null;
let lastPointerClientY = null;
let anvilDragState = null;

initAnalytics({ measurementId: GA4_MEASUREMENT_ID, version: APP_VERSION });

const consumableConsistency = getConsumableApplyConsistencyReport(getAllLootItems());
if (!consumableConsistency.ok) {
  console.warn("[consumables] handler consistency mismatch", consumableConsistency);
}

const SUBTYPE_SORT_ORDER_BY_TYPE = {
  weapon: ["sword", "staff"],
  armor: ["armor", "cloak"],
  amulet: ["tooth", "bead"],
  consumable: ["heal_hp", "heal_mana", "heal_hybrid", "buff", "trap"],
};

function getItemRarity(item) {
  const id = String(item?.id || "");
  if (id.startsWith("unique_")) return "unique";
  if (id.startsWith("rare_")) return "rare";
  return "common";
}

function getRaritySortWeight(item) {
  const rarity = getItemRarity(item);
  if (rarity === "unique") return 3;
  if (rarity === "rare") return 2;
  return 1;
}

function getSubtypeSortWeight(item) {
  const type = String(item?.type || "");
  const subtype = String(item?.subtype || "");
  const orderedSubtypes = SUBTYPE_SORT_ORDER_BY_TYPE[type];
  if (!Array.isArray(orderedSubtypes) || orderedSubtypes.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  const index = orderedSubtypes.indexOf(subtype);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getTypeSortWeight(item) {
  const type = String(item?.type || "");
  if (type === "weapon") return 1;
  if (type === "armor") return 2;
  if (type === "amulet") return 3;
  if (type === "consumable") return 4;
  return Number.MAX_SAFE_INTEGER;
}

function compareItemsByRarityThenId(a, b) {
  const byType = getTypeSortWeight(a) - getTypeSortWeight(b);
  if (byType !== 0) return byType;
  const bySubtype = getSubtypeSortWeight(a) - getSubtypeSortWeight(b);
  if (bySubtype !== 0) return bySubtype;
  const byRarity = getRaritySortWeight(b) - getRaritySortWeight(a);
  if (byRarity !== 0) return byRarity;
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

function getConsumableSubtypeSortWeight(item) {
  const subtype = String(item?.subtype || "");
  if (subtype === "heal_hp") return 1;
  if (subtype === "heal_mana") return 2;
  if (subtype === "heal_hybrid") return 3;
  if (subtype === "trap") return 4;
  return 5;
}

function compareConsumablesForInventory(a, b) {
  const bySubtype = getConsumableSubtypeSortWeight(a) - getConsumableSubtypeSortWeight(b);
  if (bySubtype !== 0) return bySubtype;
  const aIsTrap = String(a?.subtype || "") === "trap";
  const bIsTrap = String(b?.subtype || "") === "trap";
  if (aIsTrap && bIsTrap) {
    const byRarity = getRaritySortWeight(b) - getRaritySortWeight(a);
    if (byRarity !== 0) return byRarity;
  }
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

function toRuStatName(statName) {
  if (statName === "STR") return "СИЛ";
  if (statName === "INT") return "ИНТ";
  if (statName === "AGI") return "ЛВК";
  if (statName === "LUK") return "УДЧ";
  if (statName === "HP_MAX") return "HP МАКС";
  if (statName === "CRIT_CHANCE") return "ШАНС КРИТА";
  if (statName === "CRIT_MULT") return "МНОЖИТЕЛЬ КРИТА";
  return statName;
}

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatItemStatBonusesDetailSection(item) {
  const entries = Object.entries(item.statBonuses || {});
  if (entries.length === 0) return "";
  const lis = entries
    .map(([statName, value]) => {
      const label = toRuStatName(statName);
      const sign = value > 0 ? "+" : "";
      return `<li>${sign}${escapeHtml(String(value))} ${escapeHtml(label)}</li>`;
    })
    .join("");
  const id = STRINGS_RU.itemDetail;
  return `<div class="item-detail-section"><h4 class="item-detail-section-title">${id.bonusesTitle}</h4><ul class="item-detail-list">${lis}</ul></div>`;
}

function formatWeaponCombatDetailSection(item) {
  if (item.type !== "weapon") return "";
  const wd = item.weaponDamage != null ? Number(item.weaponDamage) : "—";
  const cc = item.weaponCritChance != null ? Number(item.weaponCritChance) : "—";
  const cm = item.weaponCritMult != null ? Number(item.weaponCritMult) : "—";
  const formulaText = getWeaponDamageFormulaText(item);
  const id = STRINGS_RU.itemDetail;
  return `<div class="item-detail-section"><h4 class="item-detail-section-title">${id.combatTitle}</h4><ul class="item-detail-list item-detail-list-plain"><li>${id.baseDamage} <strong>${escapeHtml(String(wd))}</strong></li><li>${id.critChanceBase} <strong>${escapeHtml(String(cc))}%</strong></li><li>${id.critMultBase} <strong>×${escapeHtml(String(cm))}</strong></li><li>${id.damageFormulaLine} <span class="item-detail-muted">${escapeHtml(formulaText)}</span></li></ul></div>`;
}

function formatSkillsDetailSection(item, instanceEntry) {
  if (!item || !["weapon", "armor", "amulet"].includes(item.type)) return "";
  const skillData = instanceEntry?.skill || null;
  const assignedSkillIds = Array.isArray(skillData?.skillIds) ? skillData.skillIds : [];
  const fallbackSkillIds = getSkillIdsForItem(item);
  const skillIds = assignedSkillIds.length > 0 ? assignedSkillIds : fallbackSkillIds;
  if (skillIds.length === 0) return "";
  const rows = skillIds
    .map((skillId) => {
      const skill = getSkillById(skillId);
      if (!skill) return null;
      const level = Math.max(1, Number(skillData?.skillLevels?.[skillId] || 1));
      return `<li>${escapeHtml(skill.icon || "✨")} ${escapeHtml(skill.name)} [ур. ${level}]</li>`;
    })
    .filter(Boolean)
    .join("");
  if (!rows) return "";
  const note = assignedSkillIds.length === 0
    ? `<p class="item-detail-muted">При создании экземпляра выдаются случайные 2 скилла.</p>`
    : "";
  return `<div class="item-detail-section"><h4 class="item-detail-section-title">Скиллы предмета</h4><ul class="item-detail-list item-detail-list-plain">${rows}</ul>${note}</div>`;
}

import { getConsumableDescription, getConsumableRecoveryPreview } from "./items/itemPresentation.js?v=0.5.7-pre-alpha";

function formatItemDetailWorkPrincipleSection(item) {
  if (!item?.isConsumable) {
    return "";
  }
  const consumableEffect = getConsumableDescription(item);
  if (!consumableEffect) {
    return "";
  }
  return `<div class="item-detail-section"><h4 class="item-detail-section-title">Принцип работы</h4><p class="item-detail-desc">${escapeHtml(consumableEffect).replace(/\n/g, "<br>")}</p></div>`;
}

function formatItemDetailDescriptionSection(item) {
  const id = STRINGS_RU.itemDetail;
  let rawDescription = String(item?.description || "").trim();
  if (rawDescription) {
    return `<div class="item-detail-section"><h4 class="item-detail-section-title">${id.descriptionTitle}</h4><p class="item-detail-desc">${escapeHtml(rawDescription).replace(/\n/g, "<br>")}</p></div>`;
  }
  return "";
}

function formatConsumableRecoveryBadges(item) {
  if (!item?.isConsumable || item?.isTrapItem) {
    return "";
  }
  const preview = getConsumableRecoveryPreview(item, state.playerSheet);
  if (!preview) {
    return "";
  }
  const badges = [];
  function formatRestoreLabel(statLabel, data, badgeClass) {
    return `<span class="${badgeClass}">${statLabel}: +${data.plannedRestore}</span>`;
  }
  if (preview.hp && preview.hpPercent > 0) {
    badges.push(formatRestoreLabel("HP", preview.hp, "cm-skill-choice-card__heal-badge"));
  }
  if (preview.mana && preview.manaPercent > 0) {
    badges.push(formatRestoreLabel("Мана", preview.mana, "cm-skill-choice-card__mana-badge"));
  }
  if (badges.length === 0) {
    return "";
  }
  return `<div class="skill-detail-badges skill-detail-badges--item">${badges.join("")}</div>`;
}

function buildInventoryItemDetailHtml(item, options = {}) {
  if (!item) return "";
  const stackCount = options.stackCount;
  const rarity = getItemRarity(item);
  const id = STRINGS_RU.itemDetail;
  const rarityRu = rarity === "unique" ? id.rarityUnique : rarity === "rare" ? id.rarityRare : id.rarityCommon;
  const typeRu = toRuType(item.type);
  const icon = item.icon || "•";
  const iconHtml = buildItemSpriteStackHtml(item, { fallbackText: icon });
  const stackPill = item.isConsumable && stackCount != null && stackCount > 1
    ? `<span class="item-detail-stack-pill" aria-hidden="true">×${stackCount}</span>`
    : "";
  const sections = [
    formatItemStatBonusesDetailSection(item),
    formatWeaponCombatDetailSection(item),
    formatSkillsDetailSection(item, options.instanceEntry || null),
    formatItemDetailWorkPrincipleSection(item),
    formatItemDetailDescriptionSection(item),
  ].filter(Boolean).join("");
  const emptyHint = sections === "" ? `<p class="item-detail-muted item-detail-empty">${STRINGS_RU.itemDetail.emptyHint}</p>` : "";
  const recoveryBadges = formatConsumableRecoveryBadges(item);
  return buildHoverCardHtml({
    rarity,
    headerLeft: rarityRu,
    headerRight: typeRu,
    titleRowHtml: `<div class="item-detail-title-row"><span class="item-detail-icon cm-inv-cell item-rarity-${escapeHtml(rarity)}" aria-hidden="true">${iconHtml}</span><span class="item-detail-name">${escapeHtml(item.name)}</span></div>`,
    badgesHtml: recoveryBadges,
    sectionsHtml: sections,
    emptyHintHtml: emptyHint,
  });
}

const inventoryPopover = createInventoryItemPopoverController({
  root,
  getScreen: () => state.screen,
  getItemById,
  getItemInstanceById: (instanceId) => state.playerSheet?.itemInstances?.[instanceId] || null,
  buildInventoryItemDetailHtml,
});
const skillPopover = createSkillHoverPopoverController({
  root,
  getScreen: () => state.screen,
  getPlayerSheet: () => state.playerSheet,
  getActiveSkills,
  getSkillById,
  getEquippedItemContextBySkill,
  buildSkillDetailHtml,
});

const worldObjectPopover = createWorldObjectHoverPopoverController({
  getState: () => state,
  screenPointToGrid,
  buildGroundLootDetailHtml: (object) => {
    if (object?.type !== "ground_loot") return "";
    const item = object?.data?.item || getItemById(object?.data?.itemId);
    if (!item) return "";
    return buildInventoryItemDetailHtml(item);
  },
});

function queueInventoryPopoverUpdate(event) {
  const trigger = event.target.closest("[data-inventory-detail-item-id]");
  if (!trigger || !root.contains(trigger)) {
    inventoryPopover.scheduleHide();
    return;
  }
  inventoryPopover.updateFromEvent({ target: trigger });
}

function queueSkillPopoverUpdate(event) {
  const trigger = event.target.closest("[data-skill-detail-id]");
  if (!trigger || !root.contains(trigger)) {
    skillPopover.scheduleHide();
    return;
  }
  skillPopover.updateFromEvent({ target: trigger });
}

function clearSkillTargeting() {
  state.uiHud.skillTargeting = null;
  state.uiHud.trapTargeting = null;
  state.uiHud.skillTargetingPreviews = [];
  state.uiHud.skillTargetingCursorCell = null;
  state.uiHud.skillTargetingChargeBadge = null;
  state.uiHud.skillTargetingAffectedCells = [];
  state.uiHud.targetingLines = [];
}

function clearPathingState() {
  state.uiHud.pathHoverCell = null;
  state.uiHud.pathHoverEnemy = null;
  state.uiHud.pathPreviewCells = [];
  state.uiHud.pathLockedCells = [];
  state.uiHud.pathLockedTarget = null;
  state.uiHud.pathLockedEnemyId = null;
  state.uiHud.autoMoveActive = false;
  state.uiHud.autoMoveLastHp = null;
  state.uiHud.autoMoveStopOnEnemySight = false;
}

function isAnvilSessionOpen() {
  return !!state.uiHud?.anvilSession;
}

function getAnvilObjectById(anvilId) {
  if (!state.run || !anvilId) return null;
  return (state.run.objects || []).find((object) => object?.id === anvilId && object.type === "anvil") || null;
}

function closeAnvilSession(options = {}) {
  const session = state.uiHud?.anvilSession;
  if (!session || !state.playerSheet) return;
  anvilDragState = null;
  const committed = options.committed === true;
  if (!committed) {
    for (const slot of (session.slots || [])) {
      if (!slot) continue;
      state.playerSheet = restoreItemInstanceToBag(state.playerSheet, slot);
    }
    state.uiHud.anvilSession = null;
    return;
  }
  if (!session.resultTakenToBag && session.result?.instanceId && session.result?.itemId) {
    const nextBag = [...(state.playerSheet?.bag || [])];
    nextBag.push({ instanceId: session.result.instanceId, itemId: session.result.itemId });
    state.playerSheet = recalculateSheetFromInventory(
      state.playerSheet,
      state.playerSheet.equippedByType,
      nextBag,
      state.playerSheet.equippedInstanceByType,
    );
  }
  if (state.run && session.anvilId) {
    const anvilObject = getAnvilObjectById(session.anvilId);
    const remainingCraftsBefore = Math.max(0, Number(anvilObject?.data?.remainingCrafts ?? 3));
    const remainingCraftsAfter = Math.max(0, remainingCraftsBefore - 1);
    if (anvilObject) {
      anvilObject.data = {
        ...(anvilObject.data || {}),
        remainingCrafts: remainingCraftsAfter,
      };
    }
    if (remainingCraftsAfter <= 0) {
      removeObject(state.run, session.anvilId);
      if (state.run?.status === "running") {
        state.run.lastLog = "Наковальня рассыпалась после последней работы.";
      }
    } else if (state.run?.status === "running") {
      state.run.lastLog = `Наковальня готова ещё на ${remainingCraftsAfter} ${remainingCraftsAfter === 1 ? "создание" : "создания"}.`;
    }
  }
  state.uiHud.anvilSession = null;
}

function consumeAnvilUse(session) {
  if (!session?.anvilId || !state.run) return { exhausted: true, remaining: 0 };
  const anvilObject = getAnvilObjectById(session.anvilId);
  const remainingCraftsBefore = Math.max(0, Number(anvilObject?.data?.remainingCrafts ?? 3));
  const remainingCraftsAfter = Math.max(0, remainingCraftsBefore - 1);
  if (anvilObject) {
    anvilObject.data = {
      ...(anvilObject.data || {}),
      remainingCrafts: remainingCraftsAfter,
    };
  }
  if (remainingCraftsAfter <= 0) {
    removeObject(state.run, session.anvilId);
    if (state.run?.status === "running") {
      state.run.lastLog = "Наковальня рассыпалась после последней работы.";
    }
    return { exhausted: true, remaining: 0 };
  }
  session.usesLeft = remainingCraftsAfter;
  if (state.run?.status === "running") {
    state.run.lastLog = `Наковальня готова ещё на ${remainingCraftsAfter} ${remainingCraftsAfter === 1 ? "создание" : "создания"}.`;
  }
  return { exhausted: false, remaining: remainingCraftsAfter };
}

function openAnvilSession(anvilObject, options = {}) {
  if (!state.run || !state.playerSheet || !anvilObject) return;
  const remainingCrafts = Math.max(0, Number(anvilObject?.data?.remainingCrafts ?? 3));
  if (remainingCrafts <= 0) return;
  const ignoreAutoMoveLock = options.ignoreAutoMoveLock === true;
  if (
    state.uiHud.skillTargeting?.skillId
    || state.uiHud.trapTargeting?.itemId
    || (!ignoreAutoMoveLock && state.uiHud.autoMoveActive)
  ) {
    return;
  }
  state.uiHud.anvilSession = {
    anvilId: anvilObject.id,
    usesLeft: remainingCrafts,
    windowPosition: null,
    mode: null,
    slots: [null, null, null],
    reforgeTargetItemId: null,
    improvePreviewResult: null,
    reforgePreviewResult: null,
    result: null,
    canCraft: false,
    resultTakenToBag: false,
  };
}

function removeBagEntryAndReturnSlot(instanceId) {
  const bag = [...(state.playerSheet?.bag || [])];
  const index = bag.findIndex((entry) => entry?.instanceId === instanceId);
  if (index === -1) return null;
  const [bagEntry] = bag.splice(index, 1);
  const itemInstances = { ...(state.playerSheet?.itemInstances || {}) };
  const instanceEntry = itemInstances[instanceId] ? { ...itemInstances[instanceId] } : null;
  delete itemInstances[instanceId];
  state.playerSheet = recalculateSheetFromInventory(
    { ...state.playerSheet, itemInstances },
    state.playerSheet.equippedByType,
    bag,
    state.playerSheet.equippedInstanceByType,
  );
  const item = getItemById(bagEntry.itemId);
  return {
    instanceId: bagEntry.instanceId,
    itemId: bagEntry.itemId,
    source: "bag",
    originType: item?.type || null,
    rarity: getAnvilRarity(item),
    instanceEntry,
  };
}

function removeEquippedEntryAndReturnSlot(equipType) {
  const itemId = state.playerSheet?.equippedByType?.[equipType] || null;
  const instanceId = state.playerSheet?.equippedInstanceByType?.[equipType] || null;
  if (!itemId || !instanceId) return null;
  const nextEquipped = { ...(state.playerSheet.equippedByType || {}) };
  const nextEquippedInstances = { ...(state.playerSheet.equippedInstanceByType || {}) };
  nextEquipped[equipType] = null;
  nextEquippedInstances[equipType] = null;
  const itemInstances = { ...(state.playerSheet?.itemInstances || {}) };
  const instanceEntry = itemInstances[instanceId] ? { ...itemInstances[instanceId] } : null;
  delete itemInstances[instanceId];
  state.playerSheet = recalculateSheetFromInventory(
    { ...state.playerSheet, itemInstances },
    nextEquipped,
    [...(state.playerSheet?.bag || [])],
    nextEquippedInstances,
  );
  const item = getItemById(itemId);
  return {
    instanceId,
    itemId,
    source: "equipped",
    originType: equipType,
    rarity: getAnvilRarity(item),
    instanceEntry,
  };
}

function updateAnvilSessionComputedState() {
  const session = state.uiHud?.anvilSession;
  if (!session) return;
  const slots = session.slots || [];
  session.improvePreviewResult = null;
  session.reforgePreviewResult = null;
  if (session.mode === "recycle") {
    session.canCraft = canCraftRecycle(slots);
  } else if (session.mode === "improve") {
    session.canCraft = canCraftImprove(slots);
    if (session.canCraft) {
      session.improvePreviewResult = buildImproveResult(slots, state.run?.rng || null);
    }
  } else if (session.mode === "reforge") {
    session.canCraft = canCraftReforge(slots, session.reforgeTargetItemId);
    if (session.canCraft) {
      session.reforgePreviewResult = buildReforgeResult(
        slots,
        session.reforgeTargetItemId,
        state.run?.rng || null,
      );
    }
  } else {
    session.canCraft = false;
  }
}

function placeIntoAnvilSlot(targetSlotIndex, payload) {
  const session = state.uiHud?.anvilSession;
  if (!session || !session.mode) return false;
  if (!Number.isInteger(targetSlotIndex) || targetSlotIndex < 0 || targetSlotIndex > 2) return false;
  if (session.result) return false;
  if (session.slots[targetSlotIndex]) return false;
  let slotEntry = null;
  if (payload?.kind === "bag-equip" && payload.bagInstanceId) {
    slotEntry = removeBagEntryAndReturnSlot(payload.bagInstanceId);
  } else if (payload?.kind === "equipped-item" && payload.equipType) {
    slotEntry = removeEquippedEntryAndReturnSlot(payload.equipType);
  }
  if (!slotEntry) return false;
  const item = getItemById(slotEntry.itemId);
  if (!isEquipableItem(item)) {
    state.playerSheet = restoreItemInstanceToBag(state.playerSheet, slotEntry);
    return false;
  }
  if (session.mode === "improve") {
    const placedEntries = (session.slots || []).filter(Boolean);
    if (placedEntries.length > 0) {
      const requiredItemId = placedEntries[0].itemId;
      if (slotEntry.itemId !== requiredItemId) {
        state.playerSheet = restoreItemInstanceToBag(state.playerSheet, slotEntry);
        return false;
      }
    }
  }
  const nextSlots = [...session.slots];
  nextSlots[targetSlotIndex] = slotEntry;
  session.slots = nextSlots;
  if (session.mode === "reforge") {
    const candidates = getReforgeCandidates(session.slots);
    if (candidates.length > 0 && !candidates.some((itemEntry) => itemEntry.id === session.reforgeTargetItemId)) {
      session.reforgeTargetItemId = candidates[0].id;
    }
  }
  updateAnvilSessionComputedState();
  return true;
}

function restoreFromAnvilSlot(slotIndex) {
  const session = state.uiHud?.anvilSession;
  if (!session) return false;
  const slotEntry = session.slots?.[slotIndex] || null;
  if (!slotEntry) return false;
  state.playerSheet = restoreItemInstanceToBag(state.playerSheet, slotEntry);
  const nextSlots = [...session.slots];
  nextSlots[slotIndex] = null;
  session.slots = nextSlots;
  if (session.mode === "reforge") {
    const candidates = getReforgeCandidates(session.slots);
    if (!candidates.some((itemEntry) => itemEntry.id === session.reforgeTargetItemId)) {
      session.reforgeTargetItemId = candidates[0]?.id || null;
    }
  }
  updateAnvilSessionComputedState();
  return true;
}

/** Готовый предмет наковальни не должен пропадать при смене экрана — как при нажатии «Забрать». */
function flushPendingAnvilResultToBag() {
  const session = state.uiHud?.anvilSession;
  if (!session?.result || session.resultTakenToBag) return;
  finalizeAnvilResultToBag();
}

function finalizeAnvilResultToBag() {
  const session = state.uiHud?.anvilSession;
  if (!session?.result || session.resultTakenToBag) return false;
  const nextBag = [...(state.playerSheet?.bag || [])];
  nextBag.push({ instanceId: session.result.instanceId, itemId: session.result.itemId });
  state.playerSheet = recalculateSheetFromInventory(
    state.playerSheet,
    state.playerSheet.equippedByType,
    nextBag,
    state.playerSheet.equippedInstanceByType,
  );
  session.resultTakenToBag = true;
  const consumeResult = consumeAnvilUse(session);
  if (consumeResult.exhausted) {
    state.uiHud.anvilSession = null;
  } else {
    session.mode = null;
    session.slots = [null, null, null];
    session.improvePreviewResult = null;
    session.reforgePreviewResult = null;
    session.result = null;
    session.reforgeTargetItemId = null;
    session.canCraft = false;
    session.resultTakenToBag = false;
  }
  return true;
}

function executeAnvilCraft() {
  const session = state.uiHud?.anvilSession;
  if (!session || !session.mode || !session.canCraft) return false;
  const slots = session.slots || [];
  let result = null;
  if (session.mode === "recycle") {
    result = buildRecycleResult(slots, state.run?.rng || null);
  } else if (session.mode === "improve") {
    result = session.improvePreviewResult || buildImproveResult(slots, state.run?.rng || null);
  } else if (session.mode === "reforge") {
    result = session.reforgePreviewResult
      || buildReforgeResult(slots, session.reforgeTargetItemId, state.run?.rng || null);
  }
  if (!result) return false;
  const created = createRuntimeItemInstance(state.playerSheet, result.itemId, null, result.skill || null);
  state.playerSheet = {
    ...state.playerSheet,
    itemInstances: created.itemInstances,
  };
  session.slots = [null, null, null];
  session.improvePreviewResult = null;
  session.reforgePreviewResult = null;
  session.result = {
    instanceId: created.instanceId,
    itemId: result.itemId,
    rarity: result.rarity || getAnvilRarity(result.item),
  };
  session.resultTakenToBag = false;
  updateAnvilSessionComputedState();
  return true;
}

function snapshotProgress() {
  return {};
}

function maybeOpenSkillsOnNewPoint() {}
function maybeTriggerLevelUpPulse() {}
function pulseQuickbarSlot() {}

function shouldAutoOpenSkillChoiceModal() {
  return false;
}
function trackSkillUse(skillId = null) {
  if (!state.run) return;
  trackEvent("skill_use", {
    run_id: state.run.analyticsRunId || null,
    class_id: null,
    skill_id: skillId || null,
    source: "ui-new",
  });
}

function inferDefeatReason(run) {
  const log = String(run?.lastLog || "").toLowerCase();
  if (log.includes("атакует")) return "enemy_attack";
  return "hp_zero";
}

function maybeTrackRunEnd() {
  if (!state.run || !state.playerSheet) return;
  if (state.run.analyticsRunEndTracked) return;
  if (state.run.status !== "victory" && state.run.status !== "defeat") return;
  const commonPayload = {
    run_id: state.run.analyticsRunId || null,
    class_id: null,
    result: state.run.status,
  };
  trackEvent("run_end", commonPayload);
  if (state.run.status === "defeat") {
    trackEvent("defeat_reason", {
      ...commonPayload,
      level: state.run.level || 1,
      reason: inferDefeatReason(state.run),
    });
  }
  state.run.analyticsRunEndTracked = true;
}

function isPlayerInputBlocked(nowMs) {
  return isPlayerInputBlockedByMotion(state.run, nowMs);
}

function getPortraitById(id) {
  return PORTRAITS.find((p) => p.id === id) || PORTRAITS[0];
}

function esc(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toRuType(type) {
  if (type === "weapon") return "Оружие";
  if (type === "armor") return "Броня";
  if (type === "amulet") return "Амулет";
  if (type === "consumable") return "Расходник";
  return type;
}

function getUiStatIcon(key) {
  const map = { STR: "💪", INT: "✨", AGI: "🐾", LUK: "🍀", CRIT_CHANCE: "🎯", CRIT_MULT: "💥", HP_MAX: "❤", WEAPON_DM: "⚔" };
  return map[key] || "•";
}

function getUiStatName(key) {
  const map = { STR: "Сила", INT: "Интеллект", AGI: "Ловкость", LUK: "Удача", CRIT_CHANCE: "Крит шанс", CRIT_MULT: "Крит x", HP_MAX: "HP макс", WEAPON_DM: "Урон оруж" };
  return map[key] || key;
}

function getStatValueForUi(sheet, key) {
  if (key === "CRIT_CHANCE") return `${Number(sheet?.derived?.CRIT_CHANCE || 0)}%`;
  if (key === "CRIT_MULT") return `${Number(sheet?.derived?.CRIT_MULT || 1)}x`;
  if (key === "WEAPON_DM") return Number(sheet?.derived?.WEAPON_DAMAGE || 0);
  if (key === "HP_MAX") return Number(sheet?.stats?.HP_MAX || 0);
  return Number(sheet?.stats?.[key] || 0);
}

function getSelectedSheet() {
  return applyLoadoutToSheet(createPlayerSheet(state.preGameStats), state.starterLoadout);
}

function getValueDeltaClass(baseValue, previewValue) {
  const base = Number.parseFloat(String(baseValue).replace(",", "."));
  const next = Number.parseFloat(String(previewValue).replace(",", "."));
  if (Number.isFinite(next) && Number.isFinite(base) && next > base) return "cm-stat-value--up";
  if (Number.isFinite(next) && Number.isFinite(base) && next < base) return "cm-stat-value--down";
  return "";
}

function getHoveredStatPreview() {
  const hover = state.uiHud?.statHoverPreview || null;
  if (!hover || !hover.stat || !Number.isFinite(Number(hover.delta))) {
    return null;
  }
  return {
    screen: hover.screen,
    stat: String(hover.stat),
    delta: Number(hover.delta),
  };
}

function getHoveredItemPreview() {
  const hover = state.uiHud?.itemHoverPreview || null;
  if (!hover || !hover.screen || !hover.itemId) {
    return null;
  }
  return {
    screen: String(hover.screen),
    itemId: String(hover.itemId),
    bagInstanceId: hover.bagInstanceId ? String(hover.bagInstanceId) : null,
  };
}

function getAllEquippedItemContexts(playerSheet) {
  if (!playerSheet) return [];
  const contexts = [];
  for (const type of ["weapon", "armor", "amulet"]) {
    const itemId = playerSheet?.equippedByType?.[type] || null;
    const instanceId = playerSheet?.equippedInstanceByType?.[type] || null;
    if (!itemId || !instanceId) continue;
    const item = getItemById(itemId);
    const instanceEntry = playerSheet?.itemInstances?.[instanceId] || null;
    if (!item || !instanceEntry) continue;
    contexts.push({ item, instanceId, instanceEntry });
  }
  return contexts;
}

function getActiveSkills(playerSheet) {
  const merged = [];
  for (const context of getAllEquippedItemContexts(playerSheet)) {
    const skills = getSkillsForEquippedItem(context.item, context.instanceEntry.skill || null);
    for (const skill of skills) {
      merged.push({
        ...skill,
        sourceSkillInstanceId: context.instanceId,
        sourceItemId: context.item.id,
        sourceItemName: context.item.name,
      });
    }
  }
  return merged;
}

function getEquippedItemContextBySkill(playerSheet, skillId) {
  const activeSkill = getActiveSkills(playerSheet).find((entry) => entry.id === skillId) || null;
  if (!activeSkill) return null;
  return getAllEquippedItemContexts(playerSheet)
    .find((entry) => entry.instanceId === activeSkill.sourceSkillInstanceId) || null;
}

function useSkillAtCellFromContext(run, playerSheet, skillId, selectedRoots) {
  const activeSkill = getActiveSkills(playerSheet).find((entry) => entry.id === skillId) || null;
  const context = getAllEquippedItemContexts(playerSheet)
    .find((entry) => entry.instanceId === activeSkill?.sourceSkillInstanceId) || null;
  if (!context) {
    return { run, playerSheet, ok: false, log: "Источник скилла не экипирован.", actionConsumed: false };
  }
  const result = usePreparedSkillSelections(
    run,
    playerSheet,
    context.item,
    context.instanceEntry.skill || null,
    skillId,
    selectedRoots,
  );
  if (result.instanceData) {
    if (!playerSheet.itemInstances) {
      playerSheet.itemInstances = {};
    }
    playerSheet.itemInstances[context.instanceId] = {
      ...(playerSheet.itemInstances[context.instanceId] || {}),
      instanceId: context.instanceId,
      itemId: context.item.id,
      skill: result.instanceData,
    };
  }
  return result;
}

const DIRECTION_DELTA_BY_ID = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up_left: { x: -1, y: -1 },
  up_right: { x: 1, y: -1 },
  down_left: { x: -1, y: 1 },
  down_right: { x: 1, y: 1 },
};

function refreshSkillTargetingPreviewFromPointer() {
  if (
    state.screen !== "game"
    || !state.run
    || !state.playerSheet
    || !state.uiHud.skillTargeting?.skillId
    || !Number.isFinite(lastPointerClientX)
    || !Number.isFinite(lastPointerClientY)
  ) {
    return false;
  }
  const canvas = document.getElementById("newGameCanvas");
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  const localX = lastPointerClientX - rect.left;
  const localY = lastPointerClientY - rect.top;
  const cell = screenPointToGrid(
    state.run,
    localX,
    localY,
    rect.width,
    rect.height,
    state.uiHud?.canvasZoom ?? 1,
  );
  const targeting = state.uiHud.skillTargeting;
  const context = getEquippedItemContextBySkill(state.playerSheet, targeting.skillId);
  const committedPreviews = context
    ? getSkillPreviewForPreparedSelections(
      state.run,
      state.playerSheet,
      context.item,
      context.instanceEntry.skill || null,
      targeting.skillId,
      targeting.selectedRoots || [],
    )
    : [];
  const isValidHoverTarget = !!cell && (targeting.targets || []).some((target) => target.x === cell.x && target.y === cell.y);
  const nextPreviews = isValidHoverTarget
    ? buildSkillTargetingPreviews(
      state.run,
      state.playerSheet,
      targeting,
      cell,
      getEquippedItemContextBySkill,
    )
    : committedPreviews;
  const prevJson = JSON.stringify(state.uiHud.skillTargetingPreviews || []);
  const nextJson = JSON.stringify(nextPreviews || []);
  state.uiHud.skillTargetingCursorCell = cell || null;
  const chargesTotal = Number(targeting?.chargesTotal ?? targeting?.profile?.charges ?? 1);
  state.uiHud.skillTargetingChargeBadge = chargesTotal > 1
    ? (targeting?.remainingCharges ?? null)
    : null;
  const hoverAffected = cell
    ? getSkillAffectedCellsForRoot(state.run, state.uiHud.skillTargeting.skillId, cell.x, cell.y)
    : [];
  const pickedAffected = (state.uiHud.skillTargeting?.selectedRoots || []).flatMap((root) =>
    getSkillAffectedCellsForRoot(state.run, state.uiHud.skillTargeting.skillId, root.x, root.y)
  );
  state.uiHud.skillTargetingAffectedCells = [...pickedAffected, ...hoverAffected];
  const selectedRoots = targeting.selectedRoots || [];
  const lines = selectedRoots.map((root) => ({
    x: root.x,
    y: root.y,
    color: "rgba(244, 63, 94, 0.95)",
  }));
  if (isValidHoverTarget) {
    lines.push({
      x: cell.x,
      y: cell.y,
      color: "rgba(244, 63, 94, 0.7)",
    });
  }
  state.uiHud.targetingLines = lines;
  if (prevJson === nextJson) {
    return false;
  }
  state.uiHud.skillTargetingPreviews = nextPreviews;
  return true;
}

function buildPreGamePreviewStats(hoverPreview) {
  const current = {
    STR: Number(state.preGameStats.STR || 0),
    INT: Number(state.preGameStats.INT || 0),
    AGI: Number(state.preGameStats.AGI || 0),
    LUK: Number(state.preGameStats.LUK || 0),
  };
  if (!hoverPreview || hoverPreview.screen !== "welcome") {
    return null;
  }
  const { stat, delta } = hoverPreview;
  if (!["STR", "INT", "AGI", "LUK"].includes(stat)) return null;
  if (delta > 0 && state.preGamePointsRemaining <= 0) return null;
  if (delta < 0 && current[stat] <= 0) return null;
  const nextValue = Math.max(0, current[stat] + delta);
  return { ...current, [stat]: nextValue };
}

function renderAllocStatRow(key, baseValue, previewValue, canDecrease = false) {
  const value = Number(baseValue || 0);
  const nextValue = Number(previewValue ?? baseValue ?? 0);
  const minusDisabled = !canDecrease;
  const plusDisabled = state.preGamePointsRemaining <= 0;
  const valueDeltaClass = getValueDeltaClass(value, nextValue);
  return `
    <li class="cm-stat-row cm-stat-row--alloc">
      <span class="cm-stat-icon" aria-hidden="true">${getUiStatIcon(key)}</span>
      <span class="cm-stat-name">${getUiStatName(key)}</span>
      <button type="button" class="cm-stat-btn" data-action="pregame-stat-minus" data-stat="${key}" data-preview-screen="welcome" data-preview-stat="${key}" data-preview-delta="-1" ${minusDisabled ? "disabled" : ""}>-</button>
      <span class="cm-stat-value ${valueDeltaClass}">${nextValue}</span>
      <button type="button" class="cm-stat-btn" data-action="pregame-stat-plus" data-stat="${key}" data-preview-screen="welcome" data-preview-stat="${key}" data-preview-delta="1" ${plusDisabled ? "disabled" : ""}>+</button>
    </li>
  `;
}

function renderReadOnlyStatRow(sheet, key, previewSheet = null) {
  const baseValue = getStatValueForUi(sheet, key);
  const nextValue = previewSheet ? getStatValueForUi(previewSheet, key) : baseValue;
  const valueDeltaClass = getValueDeltaClass(baseValue, nextValue);
  return `
    <li class="cm-stat-row cm-stat-row--readonly">
      <span class="cm-stat-icon" aria-hidden="true">${getUiStatIcon(key)}</span>
      <span class="cm-stat-name">${getUiStatName(key)}</span>
      <span class="cm-stat-value ${valueDeltaClass}">${nextValue}</span>
    </li>
  `;
}

function renderStarterGroup(type, options, baseActorStats = null, previewActorStats = null) {
  const selected = options.find((item) => state.starterLoadout.includes(item.id)) || null;
  return `
    <div class="cm-welcome-equip-slot">
      <div class="cm-welcome-equip-header">
        <span class="cm-welcome-equip-label">${toRuType(type)}</span>
        <span class="cm-welcome-equip-desc">${selected ? esc(selected.name) : "Выбрано: 0"}</span>
      </div>
      <div class="cm-welcome-options">
        ${options.map((item) => {
          const active = state.starterLoadout.includes(item.id);
          return `
            <button
              class="cm-welcome-item item-rarity-${getItemRarity(item)} ${active ? "active" : ""}"
              type="button"
              data-action="toggle-starter-item"
              data-item-id="${item.id}"
              data-preview-item-screen="welcome"
              data-preview-item-id="${item.id}"
              data-inventory-detail-item-id="${item.id}"
              aria-label="${esc(item.name)}"
              title="${esc(item.name)}"
            >${buildItemSpriteStackHtml(item)}${item.type === "weapon" ? `<span class="cm-item-weapon-damage ${getValueDeltaClass(getWeaponDamageForActorStats(baseActorStats || state.preGameStats, item), getWeaponDamageForActorStats(previewActorStats || baseActorStats || state.preGameStats, item))}">${getWeaponDamageForActorStats(previewActorStats || baseActorStats || state.preGameStats, item)}</span>` : ""}</button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function getWeaponDamageForActorStats(actorStats, item) {
  if (!item || item.type !== "weapon") return null;
  const safeStats = {
    STR: Number(actorStats?.STR || 0),
    INT: Number(actorStats?.INT || 0),
    AGI: Number(actorStats?.AGI || 0),
    LUK: Number(actorStats?.LUK || 0),
    HP_MAX: Number(actorStats?.HP_MAX || 1),
  };
  return calculateWeaponDamage(item, safeStats);
}

function getWeaponDamageForSheet(sheet, item) {
  if (!item || item.type !== "weapon") return null;
  const actorStats = sheet?.stats || sheet?.baseStats || null;
  return getWeaponDamageForActorStats(actorStats, item);
}

function getWeaponDamageForPreGameStats(preGameStats, item) {
  return getWeaponDamageForActorStats(preGameStats, item);
}

function grantOneOfEachLootItemToBag(playerSheet) {
  if (!playerSheet) return playerSheet;
  const nextBag = [...(playerSheet.bag || [])];
  let nextItemInstances = { ...(playerSheet.itemInstances || {}) };
  for (const item of getAllLootItems()) {
    const created = createRuntimeItemInstance(
      { ...playerSheet, itemInstances: nextItemInstances },
      item.id,
    );
    nextItemInstances = created.itemInstances;
    nextBag.push({ instanceId: created.instanceId, itemId: item.id });
  }
  return recalculateSheetFromInventory(
    { ...playerSheet, itemInstances: nextItemInstances },
    playerSheet.equippedByType || {},
    nextBag,
    playerSheet.equippedInstanceByType || {},
  );
}

function buildWelcomePreviewSheetFromItem(itemPreview) {
  if (!itemPreview || itemPreview.screen !== "welcome") return null;
  const item = getItemById(itemPreview.itemId);
  if (!item || !["weapon", "armor", "amulet"].includes(item.type)) return null;
  const nextLoadout = [...state.starterLoadout];
  for (let i = nextLoadout.length - 1; i >= 0; i -= 1) {
    const loaded = getItemById(nextLoadout[i]);
    if (loaded?.type === item.type) {
      nextLoadout.splice(i, 1);
    }
  }
  nextLoadout.push(item.id);
  return applyLoadoutToSheet(createPlayerSheet(state.preGameStats), nextLoadout);
}

function renderModal() {
  if (!state.uiNewModal) return "";
  const isDevlog = state.uiNewModal === "devlog";
  const title = isDevlog ? "Devlog" : STRINGS_RU.helpModal.title;
  const content = isDevlog
    ? `
      <div class="cm-modal-devlog">
        ${DEVLOG_ENTRIES.slice(0, 5).map((entry) => `
          <article class="cm-modal-devlog__entry">
            <h4>v${esc(entry.version)}</h4>
            <ul>
              ${(entry.changes || []).map((row) => `<li>${esc(row)}</li>`).join("")}
            </ul>
          </article>
        `).join("")}
      </div>
    `
    : `
      <div class="cm-modal-help">
        <p><strong>${esc(STRINGS_RU.helpModal.move)}</strong> ${esc(STRINGS_RU.helpModal.moveBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.mouse)}</strong> ${esc(STRINGS_RU.helpModal.mouseBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.auto)}</strong> ${esc(STRINGS_RU.helpModal.autoBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.skills)}</strong> ${esc(STRINGS_RU.helpModal.skillsBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.turns)}</strong> ${esc(STRINGS_RU.helpModal.turnsBody)}</p>
        <p><strong>${esc(STRINGS_RU.helpModal.hints)}</strong> ${esc(STRINGS_RU.helpModal.hintsBody)}</p>
      </div>
    `;
  return `
    <div class="cm-modal-backdrop is-open" data-action="close-modal">
      <section class="cm-panel cm-modal" role="dialog" aria-modal="true" aria-label="${title}">
        <h2 class="cm-panel__title">${title}</h2>
        <div class="cm-panel__body">
          ${content}
          <div class="cm-modal__actions"><button class="cm-btn cm-btn--secondary" type="button" data-action="close-modal">${STRINGS_RU.helpModal.close}</button></div>
        </div>
      </section>
    </div>
  `;
}

function buildDescendOverlayHtml() {
  const prompt = state.uiHud?.descendPrompt || null;
  if (!prompt || state.screen !== "game") return "";
  const nextLevel = Math.max(1, Number(prompt.nextLevel || ((state.run?.level || 1) + 1)));
  return `
    <div class="cm-modal-backdrop is-open">
      <section class="cm-panel cm-modal" role="dialog" aria-modal="true" aria-label="Переход на следующий уровень">
        <h2 class="cm-panel__title">Спуститься на уровень ${nextLevel}?</h2>
        <div class="cm-panel__body">
          <p>В норе пахнет новым лутом и новыми котами.</p>
          <div class="cm-modal__actions">
            <button class="cm-btn cm-btn--primary" type="button" data-action="descend-confirm">Спуститься</button>
            <button class="cm-btn cm-btn--secondary" type="button" data-action="descend-stay">Остаться</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function render() {
  if (state.screen === "ending") {
    renderEndingScreen();
    return;
  }
  if (state.screen === "game") {
    renderGameScreen();
    return;
  }

  const portrait = getPortraitById(state.selectedPortraitId);
  const sheet = getSelectedSheet();
  const hoverPreview = getHoveredStatPreview();
  const itemPreview = getHoveredItemPreview();
  const previewStats = buildPreGamePreviewStats(hoverPreview);
  const previewSheetFromStats = previewStats ? applyLoadoutToSheet(createPlayerSheet(previewStats), state.starterLoadout) : null;
  const previewSheetFromItem = !previewStats ? buildWelcomePreviewSheetFromItem(itemPreview) : null;
  const previewSheet = previewSheetFromStats || previewSheetFromItem;
  const displaySheet = previewSheet || sheet;
  const starterItems = getStarterCommonItems().filter((item) => ["weapon", "armor", "amulet"].includes(item.type));
  const grouped = {
    weapon: starterItems.filter((item) => item.type === "weapon"),
    armor: starterItems.filter((item) => item.type === "armor"),
    amulet: starterItems.filter((item) => item.type === "amulet"),
  };
  const hasAllTypes = ["weapon", "armor", "amulet"].every((type) =>
    state.starterLoadout.some((id) => getItemById(id)?.type === type),
  );
  const canStart = state.preGamePointsRemaining === 0 && hasAllTypes;
  const footerMetaHtml = buildFooterMetaHtml();

  root.innerHTML = `
    <div class="cm-app">
      <div class="cm-main">
        <aside class="cm-col cm-col--left">
          <section class="cm-panel cm-panel--fill" aria-labelledby="hero-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="hero-title">Герой</h2>
            <div class="cm-panel__body">
              <div class="cm-hero-portrait">
                <div class="cm-portrait-ring">
                  <div class="cm-portrait-inner">
                    <img src="${portrait.imageSrc}" width="112" height="112" alt="${esc(portrait.name)}" />
                  </div>
                </div>
                <div class="cm-level-badge" aria-label="Уровень 1" title="Уровень 1">1</div>
              </div>

              <div class="cm-bar cm-bar--hp">
                <div class="cm-bar__row">
                  <span class="cm-bar__icon-wrap" aria-hidden="true"><img class="cm-bar__icon" src="./src/assets/icons/ui/hp.svg" width="22" height="22" alt="" /></span>
                  <div class="cm-bar__content">
                    <div class="cm-bar__label"><span>HP</span><span>${displaySheet.stats.HP} / ${displaySheet.stats.HP_MAX}</span></div>
                    <div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round((displaySheet.stats.HP / Math.max(1, displaySheet.stats.HP_MAX)) * 100)))}%"></div></div>
                  </div>
                </div>
              </div>
              <div class="cm-bar cm-bar--mana">
                <div class="cm-bar__row">
                  <span class="cm-bar__icon-wrap" aria-hidden="true"><img class="cm-bar__icon" src="./src/assets/icons/ui/mana.svg" width="22" height="22" alt="" /></span>
                  <div class="cm-bar__content">
                    <div class="cm-bar__label"><span>Мана</span><span>${displaySheet.mana} / ${displaySheet.manaMax}</span></div>
                    <div class="cm-bar__track"><div class="cm-bar__fill" style="width:${Math.max(0, Math.min(100, Math.round((displaySheet.mana / Math.max(1, displaySheet.manaMax)) * 100)))}%"></div></div>
                  </div>
                </div>
              </div>

              <div class="cm-welcome-section-title">Распределение очков</div>
              <div class="cm-welcome-points">Свободно очков: <span class="cm-welcome-points-val">${state.preGamePointsRemaining}</span></div>
              <ul class="cm-stats cm-stats--alloc">
                ${renderAllocStatRow("STR", Number(sheet?.stats?.STR || 0), Number(previewSheet?.stats?.STR || sheet?.stats?.STR || 0), Number(state.preGameStats?.STR || 0) > 0)}
                ${renderAllocStatRow("INT", Number(sheet?.stats?.INT || 0), Number(previewSheet?.stats?.INT || sheet?.stats?.INT || 0), Number(state.preGameStats?.INT || 0) > 0)}
                ${renderAllocStatRow("AGI", Number(sheet?.stats?.AGI || 0), Number(previewSheet?.stats?.AGI || sheet?.stats?.AGI || 0), Number(state.preGameStats?.AGI || 0) > 0)}
                ${renderAllocStatRow("LUK", Number(sheet?.stats?.LUK || 0), Number(previewSheet?.stats?.LUK || sheet?.stats?.LUK || 0), Number(state.preGameStats?.LUK || 0) > 0)}
                ${renderReadOnlyStatRow(sheet, "CRIT_CHANCE", previewSheet)}
                ${renderReadOnlyStatRow(sheet, "CRIT_MULT", previewSheet)}
              </ul>
            </div>
          </section>
        </aside>

        <main class="cm-col cm-col--center">
          <section class="cm-panel cm-panel--fill" aria-labelledby="portrait-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="portrait-title">Выбор внешности</h2>
            <div class="cm-panel__body cm-welcome-center">
              <div class="cm-welcome-preview">
                <div class="cm-welcome-preview-img-wrap"><img src="${portrait.imageSrc}" alt="Предпросмотр" /></div>
                <h3 class="cm-welcome-preview-name">${esc(portrait.name)}</h3>
                <p class="cm-welcome-preview-desc">${esc(portrait.desc)}</p>
              </div>

              <div class="cm-welcome-gallery-wrap cm-scroll-wood">
                <div class="cm-welcome-gallery">
                  ${PORTRAITS.map((item) => `
                    <button
                      class="cm-welcome-gallery-item ${item.id === state.selectedPortraitId ? "active" : ""}"
                      type="button"
                      data-action="select-portrait"
                      data-portrait-id="${item.id}"
                      aria-label="${esc(item.name)}"
                      title="${esc(item.name)}"
                    >
                      <img src="${item.imageSrc}" alt="" />
                    </button>
                  `).join("")}
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside class="cm-col cm-col--right">
          <section class="cm-panel cm-panel--welcome-equip" aria-labelledby="equip-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="equip-title">Стартовая экипировка</h2>
            <div class="cm-panel__body">
              ${renderStarterGroup("weapon", grouped.weapon, sheet?.stats || state.preGameStats, previewSheet?.stats || sheet?.stats || state.preGameStats)}
              ${renderStarterGroup("armor", grouped.armor, sheet?.stats || state.preGameStats, previewSheet?.stats || sheet?.stats || state.preGameStats)}
              ${renderStarterGroup("amulet", grouped.amulet, sheet?.stats || state.preGameStats, previewSheet?.stats || sheet?.stats || state.preGameStats)}
            </div>
          </section>

          <section class="cm-panel" aria-labelledby="info-title">
            <span class="cm-rivet cm-rivet--tl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--tr" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--bl" aria-hidden="true"></span>
            <span class="cm-rivet cm-rivet--br" aria-hidden="true"></span>
            <h2 class="cm-panel__title" id="info-title">Информация</h2>
            <div class="cm-panel__body cm-welcome-info-body">
              <button class="cm-btn cm-btn--secondary" type="button" data-action="open-help">Подсказки по игре</button>
              <button class="cm-btn cm-btn--secondary" type="button" data-action="open-devlog">Devlog</button>
            </div>
          </section>
          <div class="cm-welcome-start-wrap">
            <button class="cm-btn cm-btn--primary cm-welcome-start" type="button" data-action="start-game" ${canStart ? "" : "disabled"}>Начать забег</button>
            ${state.uiNewStartMessage ? `<p class="cm-start-placeholder">${esc(state.uiNewStartMessage)}</p>` : ""}
          </div>
        </aside>
      </div>
      ${footerMetaHtml}
    </div>
    ${renderModal()}
  `;
}

function syncQuickbarSkills() {
  if (!state.playerSheet || !state.uiHud) return;
  const activeSkills = getActiveSkills(state.playerSheet);
  const activeIds = activeSkills.map((s) => s.id);
  
  const slots = [...(state.uiHud.quickbarSlots || [])];
  while (slots.length < 9) slots.push(null);

  let changed = false;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot && slot.kind === "skill") {
      if (!activeIds.includes(slot.skillId)) {
        slots[i] = null;
        changed = true;
      }
    }
  }

  for (const skillId of activeIds) {
    const isAlreadyInQuickbar = slots.some((s) => s && s.kind === "skill" && s.skillId === skillId);
    if (!isAlreadyInQuickbar) {
      const emptyIndex = slots.findIndex(s => !s);
      if (emptyIndex !== -1) {
        slots[emptyIndex] = { kind: "skill", skillId };
        changed = true;
      }
    }
  }

  if (changed) {
    state.uiHud.quickbarSlots = slots;
  }
}

function renderGameScreen() {
  syncQuickbarSkills();
  const portrait = getPortraitById(state.selectedPortraitId);
  const run = state.run;
  const sheet = state.playerSheet;
  const hoverPreview = getHoveredStatPreview();
  const itemPreview = getHoveredItemPreview();
  const previewSheetFromStats = hoverPreview && hoverPreview.screen === "game" && hoverPreview.delta > 0
    ? spendLevelUpPoint(sheet, hoverPreview.stat)
    : null;
  const previewSheetFromItem = !previewSheetFromStats && itemPreview?.screen === "game" && itemPreview?.bagInstanceId
    ? swapItemFromBag(sheet, itemPreview.bagInstanceId, -1)
    : null;
  const previewSheet = previewSheetFromStats || previewSheetFromItem;
  const displaySheet = previewSheet || sheet;
  const bag = sheet?.bag || [];
  const equipRows = buildGameEquipRowsHtml({
    sheet,
    previewSheet,
    getItemById,
    getItemRarity,
    getWeaponDamageForSheet,
    getValueDeltaClass,
    toRuType,
    esc,
  });

  const equipablesById = new Map();
  const consumablesById = new Map();
  const itemInstances = sheet?.itemInstances || {};
  function getEquipableStackKey(item, bagEntry) {
    if (!item || !bagEntry?.instanceId) {
      return item?.id || "";
    }
    const instanceEntry = itemInstances?.[bagEntry.instanceId] || null;
    const skillData = instanceEntry?.skill || null;
    const skillIds = Array.isArray(skillData?.skillIds) ? [...skillData.skillIds].sort() : [];
    const skillLevels = (skillData?.skillLevels && typeof skillData.skillLevels === "object")
      ? skillData.skillLevels
      : {};
    const skillSignature = skillIds
      .map((skillId) => `${skillId}:${Math.max(1, Number(skillLevels[skillId] || 1))}`)
      .join("|");
    return `${item.id}::${skillSignature || "no-skill-signature"}`;
  }
  for (const entry of bag) {
    const item = getItemById(entry.itemId);
    if (!item) continue;
    if (["weapon", "armor", "amulet"].includes(item.type)) {
      const stackKey = getEquipableStackKey(item, entry);
      const cur = equipablesById.get(stackKey) || { item, count: 0, entries: [] };
      cur.count += 1;
      cur.entries.push(entry);
      equipablesById.set(stackKey, cur);
      continue;
    }
    if (item.type === "consumable") {
      const cur = consumablesById.get(item.id) || { item, count: 0, entries: [] };
      cur.count += 1;
      cur.entries.push(entry);
      consumablesById.set(item.id, cur);
    }
  }
  const equipables = Array.from(equipablesById.values())
    .sort((a, b) => compareItemsByRarityThenId(a.item, b.item));
  const consumables = Array.from(consumablesById.values())
    .sort((a, b) => compareConsumablesForInventory(a.item, b.item));
  const skills = getActiveSkills(sheet);

  const effects = buildActiveEffectsViewModel(run, sheet);

  const quickSlots = Array.isArray(state.uiHud?.quickbarSlots) ? state.uiHud.quickbarSlots : [];
  const inventoryCellsHtml = buildInventoryCellsHtml({
    equipables,
    getItemRarity,
    getWeaponDamageForSheet,
    getValueDeltaClass,
    sheet,
    previewSheet,
    esc,
  });
  const consumableCellsHtml = buildConsumableCellsHtml({
    consumables,
    getItemRarity,
    esc,
  });
  const skillsHtml = buildSkillsListHtml({ skills, sheet, esc });
  const quickbarHtml = buildQuickbarHtml({
    quickSlots,
    sheet,
    skills,
    getItemById,
    activeSlotIndex: state.uiHud?.skillTargeting?.slotIndex ?? null,
    esc,
  });
  const anvilSession = state.uiHud?.anvilSession || null;
  const descendOverlayHtml = buildDescendOverlayHtml();
  const anvilOverlayHtml = anvilSession
    ? buildAnvilOverlayHtml({
      session: anvilSession,
      modeDescription: describeAnvilMode(anvilSession.mode),
      esc,
      getItemById,
      getRarityBadgeClass,
      improvePreview: anvilSession.improvePreviewResult || null,
      reforgePreview: anvilSession.reforgePreviewResult || null,
      recyclePreview: getRecyclePreview(anvilSession.slots || []),
      reforgeCandidates: getReforgeCandidates(anvilSession.slots || []),
      windowPosition: anvilSession.windowPosition || null,
    })
    : "";

  root.innerHTML = buildGameScreenHtml({
    portrait,
    run,
    sheet,
    displaySheet,
    previewSheet,
    effects,
    quickbarHtml,
    equipRows,
    inventoryCellsHtml,
    consumableCellsHtml,
    skillsHtml,
    esc,
    getUiStatIcon,
    getUiStatName,
    getValueDeltaClass,
    renderModal,
    anvilOverlayHtml,
    descendOverlayHtml,
    footerMetaHtml: buildFooterMetaHtml(),
  });

  const canvasOverlay = buildCanvasOverlayViewModel(state.uiHud);
  drawRunToCanvas(
    document.getElementById("newGameCanvas"),
    run,
    sheet,
    performance.now(),
    state.uiHud?.canvasZoom ?? 1,
    canvasOverlay,
  );
  syncCanvasHoverFromPointer();
}

function renderEndingScreen() {
  const portrait = getPortraitById(state.selectedPortraitId);
  const run = state.run;
  const sheet = state.playerSheet;
  const isVictory = run?.status === "victory";
  const title = isVictory ? "Победа" : "Поражение";
  const subtitle = isVictory
    ? "Мышь добралась до норы и выбралась с добычей."
    : "HP опустилось до нуля, забег завершен.";
  const durationSec = Math.max(0, Math.floor((Date.now() - Number(state.uiNewRunStartedAtMs || Date.now())) / 1000));
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationLabel = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const equipRows = buildEndingEquipRowsHtml({
    sheet,
    getItemById,
    getItemRarity,
    getWeaponDamageForSheet,
    toRuType,
  });

  root.innerHTML = buildEndingScreenHtml({
    portrait,
    run,
    sheet,
    isVictory,
    title,
    subtitle,
    durationLabel,
    equipRows,
    esc,
    getUiStatIcon,
    getUiStatName,
    renderModal,
    footerMetaHtml: buildFooterMetaHtml(),
  });
}

function resetToWelcome() {
  const reset = createInitialState();
  state.screen = reset.screen;
  state.preGameStats = reset.preGameStats;
  state.preGamePointsRemaining = reset.preGamePointsRemaining;
  state.playerSheet = null;
  state.starterLoadout = [];
  state.run = null;
  state.selectedPortraitId = "witcher";
  state.uiNewModal = null;
  state.uiNewStartMessage = "";
  state.uiNewRunStartedAtMs = null;
  state.uiHud.anvilSession = null;
  state.uiHud.descendPrompt = null;
  inventoryPopover.hide();
  skillPopover.hide();
  worldObjectPopover.hide();
}

function performStep(direction, isRouteStepFinal = true) {
  if (!canAcceptPlayerAction(state)) {
    return false;
  }
  if (isAnvilSessionOpen()) {
    closeAnvilSession({ committed: false });
  }
  const result = tryStep(state.run, state.playerSheet, direction, isRouteStepFinal);
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  if (state.run && result.motion) {
    ensureRunFxState(state.run).motion = result.motion;
  }
  processPendingUiActions();

  if (state.run.status === "victory" || state.run.status === "defeat") {
    maybeTrackRunEnd();
    state.screen = "ending";
    render();
    return Boolean(result.actionConsumed);
  }

  if (result.actionConsumed) {
    consumeActionAndRunEnvironment();
  }
  render();
  return Boolean(result.actionConsumed);
}

function processPendingUiActions() {
  if (state.run?.status !== "running") return;
  const pendingUiActions = Array.isArray(state.run.pendingUiActions) ? [...state.run.pendingUiActions] : [];
  state.run.pendingUiActions = [];
  for (const action of pendingUiActions) {
    if (action?.type === "open_anvil") {
      const anvilObject = (state.run.objects || []).find((object) => (
        object?.id === action.objectId
        && object?.type === "anvil"
      )) || null;
      if (anvilObject) {
        openAnvilSession(anvilObject, { ignoreAutoMoveLock: true });
      }
      continue;
    }
    if (action?.type === "open_descend_prompt") {
      state.uiHud.descendPrompt = {
        currentLevel: Math.max(1, Number(action.currentLevel || state.run.level || 1)),
        nextLevel: Math.max(1, Number(action.nextLevel || ((state.run.level || 1) + 1))),
      };
    }
  }
}

function tryActivateCurrentCellObject() {
  if (!state.run || !state.playerSheet) return false;
  const activationResult = applyObjectActivationOnCell(
    state.run,
    state.playerSheet,
    ACTOR_KIND.PLAYER,
    state.run.player.x,
    state.run.player.y,
    null,
    { isRouteStepFinal: true }
  );
  state.playerSheet = activationResult.playerSheet || state.playerSheet;
  processPendingUiActions();
  if (activationResult.log) {
    state.run.lastLog = activationResult.log;
    consumeActionAndRunEnvironment();
    return true;
  }
  return false;
}

function handleSkipTurnAction() {
  if (!canAcceptPlayerAction(state)) return false;
  if (state.uiHud.trapTargeting?.itemId) {
    state.run.lastLog = "Выбери клетку мышью для установки ловушки.";
    return true;
  }
  if (state.uiHud.skillTargeting?.skillId) {
    tryCastPreparedSkillOnSelf();
    return true;
  }
  if (tryActivateCurrentCellObject()) {
    return true;
  }
  state.run.lastLog = "Ход пропущен.";
  consumeActionAndRunEnvironment();
  return true;
}

function handleLevelTransition(nowMs) {
  if (!isLevelTransitionReady(state.run, nowMs)) {
    return;
  }
  state.uiHud.descendPrompt = null;
  state.run = createNextLevelRun(state.run, state.playerSheet);
  clearSkillTargeting();
  clearPathingState();
  render();
}

function consumeActionAndRunEnvironment() {
  if (!canStartEnvironmentTurn(state.run)) {
    return;
  }
  clearSkillTargeting();
  state.run.pendingEnvironmentTurn = true;
}

function flushQueuedEnvironmentTurn(nowMs) {
  if (!state.run || !state.playerSheet || !state.run.pendingEnvironmentTurn) {
    return;
  }
  const fx = ensureRunFxState(state.run);
  normalizeFinishedAnimationsForRun(state.run, nowMs);
  if (isBlockingMotionActive(fx.motion, nowMs) || isBlockingMotionActive(fx.environmentMotion, nowMs)) {
    return;
  }
  state.run.pendingEnvironmentTurn = false;
  beginEnvironmentTurn(state.run);
  // Фаза меняется асинхронно (после блокирующих анимаций), поэтому нужно сразу обновить плашку.
  render();
}

function tryMoveToCanvasCell(canvas, clientX, clientY) {
  if (!canAcceptPlayerAction(state)) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const cell = screenPointToGrid(state.run, localX, localY, rect.width, rect.height, 1);
  if (!cell || !isValidPathTargetCell(state.run, cell)) {
    return;
  }
  const path = buildPathToDiscoveredCell(
    state.run,
    { x: state.run.player.x, y: state.run.player.y },
    { x: cell.x, y: cell.y },
    { allowPlayer: true, allowGoal: true, blockObjects: true },
  );
  if (path.length < 2) {
    return;
  }
  const next = path[1];
  const direction = resolveDirectionByDelta(next.x - state.run.player.x, next.y - state.run.player.y);
  if (!direction) return;
  performStep(direction, true);
}

const canvasHandlers = createCanvasRunHandlers({
  getState: () => state,
  canAcceptPlayerAction,
  rerender: render,
  clearPathingState,
  performStep,
  tryStep,
  buildPathToDiscoveredCell,
  isValidPathTargetCell,
  screenPointToGrid,
  isPlayerInputBlocked,
  getItemById,
  getEnemyById,
  placeTrap,
  openAnvilSession,
  beforePlayerMovement: () => {
    if (isAnvilSessionOpen()) {
      closeAnvilSession({ committed: false });
    }
  },
  recalculateSheetFromInventory,
  consumePlayerActionAndStartEnvironment: consumeActionAndRunEnvironment,
  clearSkillTargeting,
  useSkillAtCell: (run, playerSheet, skillId, x, y) => {
    const result = trySelectPreparedSkillRoot({ x, y });
    return {
      run: state.run,
      playerSheet: state.playerSheet,
      ok: result.ok,
      actionConsumed: result.actionConsumed,
      keepTargeting: result.keepTargeting,
    };
  },
  snapshotProgress,
  maybeOpenSkillsOnNewPoint,
  maybeTriggerLevelUpPulse,
  pulseQuickbarSlot,
  trackSkillUse,
  normalizeFinishedAnimationsForRun,
  isBlockingMotionActive,
});

function initQuickbarForNewRun() {
  const slots = Array.from({ length: 9 }, () => null);
  const bag = state.playerSheet?.bag || [];
  let slotIndex = 0;

  const consumableIds = [];
  for (const entry of bag) {
    const item = getItemById(entry.itemId);
    if (!item || item.type !== "consumable") continue;
    if (!consumableIds.includes(item.id)) {
      consumableIds.push(item.id);
    }
  }
  for (const itemId of consumableIds) {
    if (slotIndex >= 9) break;
    slots[slotIndex] = { kind: "consumable", itemId };
    slotIndex += 1;
  }

  const skills = getActiveSkills(state.playerSheet);
  for (const skill of skills) {
    if (slotIndex >= 9) break;
    slots[slotIndex] = { kind: "skill", skillId: skill.id };
    slotIndex += 1;
  }
  state.uiHud.quickbarSlots = slots;
}

function normalizeQuickbarSlot(value) {
  if (!value) return null;
  if (value.kind === "consumable" && value.itemId) return value;
  if (value.kind === "skill" && value.skillId) return value;
  return null;
}

function useConsumableById(itemId, bagInstanceId = null, bagIndex = -1) {
  if (!itemId || !canAcceptPlayerAction(state)) {
    return false;
  }
  const item = getItemById(itemId);
  if (!item || !item.isConsumable) {
    return false;
  }
  const nextBag = [...(state.playerSheet.bag || [])];
  let removeIndex = nextBag.findIndex((entry) => entry.itemId === itemId);
  if (removeIndex === -1 && bagInstanceId) {
    removeIndex = nextBag.findIndex((entry) => entry.instanceId === bagInstanceId);
  }
  if (removeIndex === -1 && bagIndex >= 0 && bagIndex < nextBag.length) {
    removeIndex = bagIndex;
  }
  if (removeIndex === -1) {
    return false;
  }

  if (item.isTrapItem) {
    const targets = getTrapPlacementCells(state.run);
    if (targets.length === 0) {
      state.run.lastLog = "Нет свободных соседних клеток для установки ловушки.";
      return false;
    }
    clearSkillTargeting();
    state.uiHud.trapTargeting = { itemId: item.id, bagRemoveIndex: removeIndex, targets };
    return false;
  }

  const result = useConsumable(state.run, state.playerSheet, item);
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  nextBag.splice(removeIndex, 1);
  state.playerSheet = recalculateSheetFromInventory(
    state.playerSheet,
    state.playerSheet.equippedByType,
    nextBag,
  );
  consumeActionAndRunEnvironment();
  return true;
}

function useQuickbarSlot(slotIndex) {
  if (!canAcceptPlayerAction(state)) {
    return;
  }
  const slotValue = state.uiHud.quickbarSlots?.[slotIndex];
  const slotPayload = normalizeQuickbarSlot(slotValue);
  if (!slotPayload) {
    return;
  }
  if (slotPayload.kind === "consumable") {
    clearSkillTargeting();
    useConsumableById(slotPayload.itemId, null, -1);
    return;
  }
  if (slotPayload.kind === "skill") {
    const skillDef = getSkillById(slotPayload.skillId);
    const manaCost = getSkillManaCost(skillDef, state.playerSheet);
    if ((state.playerSheet.mana || 0) < manaCost) {
      state.run.lastLog = "Недостаточно маны.";
      return;
    }
    clearPathingState();
    const skillTargets = getSkillTargetsByKind(state.run, state.playerSheet, slotPayload.skillId, getEquippedItemContextBySkill);
    if (skillTargets.length === 0) {
      state.run.lastLog = "Нет доступной цели для скилла.";
      return;
    }
    const alreadyActive = (
      state.uiHud.skillTargeting?.slotIndex === slotIndex
      || state.uiHud.skillTargeting?.skillId === slotPayload.skillId
    );
    if (alreadyActive) {
      clearSkillTargeting();
    } else {
      const activeSkill = getActiveSkills(state.playerSheet).find((entry) => entry.id === slotPayload.skillId) || null;
      const profile = getSkillTargetingProfile(slotPayload.skillId, activeSkill?.level || 1);
      state.uiHud.skillTargeting = {
        slotIndex,
        skillId: slotPayload.skillId,
        targets: skillTargets,
        selectedRoots: [],
        remainingCharges: profile?.charges || 1,
        chargesTotal: profile?.charges || 1,
        profile,
      };
      trackSkillUse(slotPayload.skillId);
      refreshSkillTargetingPreviewFromPointer();
    }
  }
}

function trySelectPreparedSkillRoot(targetCell) {
  const targeting = state.uiHud.skillTargeting;
  if (!targeting?.skillId || !state.run || !state.playerSheet || state.run.turnPhase !== "player" || !targetCell) {
    return { ok: false, actionConsumed: false, keepTargeting: true };
  }
  const isValid = (targeting.targets || []).some((cell) => cell.x === targetCell.x && cell.y === targetCell.y);
  if (!isValid) {
    state.run.lastLog = "Неверная клетка для скилла.";
    return { ok: false, actionConsumed: false, keepTargeting: true };
  }
  const selectedRoots = [...(targeting.selectedRoots || []), { x: targetCell.x, y: targetCell.y }];
  const chargesTotal = Number(targeting.chargesTotal || targeting.profile?.charges || 1);
  const remainingCharges = Math.max(0, chargesTotal - selectedRoots.length);
  const nextAffectedCells = selectedRoots.flatMap((root) =>
    getSkillAffectedCellsForRoot(state.run, targeting.skillId, root.x, root.y)
  );
  targeting.selectedRoots = selectedRoots;
  targeting.remainingCharges = remainingCharges;
  state.uiHud.skillTargetingAffectedCells = nextAffectedCells;
  if (remainingCharges > 0) {
    refreshSkillTargetingPreviewFromPointer();
    state.run.lastLog = `Выбери ещё ${remainingCharges} ${remainingCharges === 1 ? "цель" : "цели"} для ${getSkillById(targeting.skillId)?.name || "скилла"}.`;
    return { ok: true, actionConsumed: false, keepTargeting: true };
  }
  const result = useSkillAtCellFromContext(
    state.run,
    state.playerSheet,
    targeting.skillId,
    selectedRoots,
  );
  state.run = result.run;
  state.playerSheet = result.playerSheet;
  if (!result.ok) {
    if (result.log) state.run.lastLog = result.log;
    targeting.selectedRoots = [];
    targeting.remainingCharges = chargesTotal;
    state.uiHud.skillTargetingAffectedCells = [];
    return { ok: false, actionConsumed: false, keepTargeting: true };
  }
  return { ok: true, actionConsumed: true, keepTargeting: false };
}

function tryCastPreparedSkillOnSelf() {
  const targeting = state.uiHud.skillTargeting;
  if (!targeting?.skillId || !state.run || !state.playerSheet || state.run.turnPhase !== "player") {
    return;
  }
  const result = trySelectPreparedSkillRoot({ x: state.run.player.x, y: state.run.player.y });
  if (!result.keepTargeting) {
    clearSkillTargeting();
  }
  if (result.actionConsumed) {
    consumeActionAndRunEnvironment();
  }
}

function findNearestPreparedSkillTargetInDirection(direction) {
  const targeting = state.uiHud?.skillTargeting;
  const run = state.run;
  if (!targeting?.skillId || !run?.player) {
    return null;
  }
  const directionDelta = DIRECTION_DELTA_BY_ID[direction];
  if (!directionDelta) {
    return null;
  }
  const targets = Array.isArray(targeting.targets) ? targeting.targets : [];
  const px = Number(run.player.x || 0);
  const py = Number(run.player.y || 0);
  let best = null;
  for (const cell of targets) {
    if (!cell) continue;
    if (cell.x === px && cell.y === py) continue;
    const dx = Number(cell.x) - px;
    const dy = Number(cell.y) - py;
    const dot = dx * directionDelta.x + dy * directionDelta.y;
    if (dot <= 0) continue;
    const distance = Math.hypot(dx, dy);
    const lateralDeviation = Math.abs(dx * directionDelta.y - dy * directionDelta.x);
    if (
      !best
      || distance < best.distance
      || (distance === best.distance && lateralDeviation < best.lateralDeviation)
      || (distance === best.distance && lateralDeviation === best.lateralDeviation && dot > best.dot)
    ) {
      best = { cell, distance, lateralDeviation, dot };
    }
  }
  return best?.cell || null;
}

function tryCastPreparedSkillByDirection(direction) {
  const targeting = state.uiHud.skillTargeting;
  if (!targeting?.skillId || !state.run || !state.playerSheet || state.run.turnPhase !== "player") {
    return;
  }
  const targetCell = findNearestPreparedSkillTargetInDirection(direction);
  if (!targetCell) {
    state.run.lastLog = "В этом направлении нет доступной клетки для скилла.";
    return;
  }
  const result = trySelectPreparedSkillRoot(targetCell);
  if (!result.keepTargeting) {
    clearSkillTargeting();
  }
  if (result.actionConsumed) {
    consumeActionAndRunEnvironment();
  }
}

function syncCanvasHoverFromPointer() {
  if (state.screen !== "game" || !state.run || !state.playerSheet) {
    return;
  }
  if (!Number.isFinite(lastPointerClientX) || !Number.isFinite(lastPointerClientY)) {
    return;
  }
  const pointedElement = document.elementFromPoint(lastPointerClientX, lastPointerClientY);
  const canvas = pointedElement?.closest?.("#newGameCanvas");
  if (!canvas) {
    const targeting = state.uiHud.skillTargeting;
    const context = targeting?.skillId ? getEquippedItemContextBySkill(state.playerSheet, targeting.skillId) : null;
    const committedPreviews = (targeting && context)
      ? getSkillPreviewForPreparedSelections(
        state.run,
        state.playerSheet,
        context.item,
        context.instanceEntry.skill || null,
        targeting.skillId,
        targeting.selectedRoots || [],
      )
      : [];
    state.uiHud.skillTargetingPreviews = committedPreviews;
    state.uiHud.skillTargetingCursorCell = null;
    state.uiHud.skillTargetingChargeBadge = null;
    state.uiHud.skillTargetingAffectedCells = (targeting?.selectedRoots || []).flatMap((root) =>
      getSkillAffectedCellsForRoot(state.run, targeting.skillId, root.x, root.y)
    );
    state.uiHud.targetingLines = (targeting?.selectedRoots || []).map((root) => ({
      x: root.x,
      y: root.y,
      color: "rgba(244, 63, 94, 0.95)",
    }));
    canvasHandlers.onCanvasMouseLeave();
    return;
  }
  if (state.uiHud.skillTargeting?.skillId) {
    if (refreshSkillTargetingPreviewFromPointer()) {
      return;
    }
  } else if (state.uiHud.trapTargeting?.itemId) {
    const rect = canvas.getBoundingClientRect();
    const localX = lastPointerClientX - rect.left;
    const localY = lastPointerClientY - rect.top;
    const cell = screenPointToGrid(
      state.run,
      localX,
      localY,
      rect.width,
      rect.height,
      state.uiHud?.canvasZoom ?? 1,
    );
    const isValidTrapTarget = !!cell && (state.uiHud.trapTargeting.targets || []).some((target) => target.x === cell.x && target.y === cell.y);
    state.uiHud.targetingLines = isValidTrapTarget
      ? [{ x: cell.x, y: cell.y, color: "rgba(147, 197, 253, 0.85)" }]
      : [];
  }
  canvasHandlers.onCanvasMouseMove(
    { clientX: lastPointerClientX, clientY: lastPointerClientY, target: canvas },
    canvas,
  );
}

function onRootClick(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === "pregame-stat-plus" || action === "pregame-stat-minus") {
    state.uiHud.statHoverPreview = null;
    const stat = actionEl.dataset.stat;
    if (!["STR", "INT", "AGI", "LUK"].includes(stat)) return;
    const current = Number(state.preGameStats[stat] || 0);
    if (action === "pregame-stat-plus") {
      if (state.preGamePointsRemaining <= 0) return;
      state.preGameStats[stat] = current + 1;
      state.preGamePointsRemaining -= 1;
    } else {
      if (current <= 0) return;
      state.preGameStats[stat] = current - 1;
      state.preGamePointsRemaining += 1;
    }
    render();
    syncStatHoverPreviewFromPointer();
    return;
  }

  if (action === "toggle-starter-item") {
    const itemId = actionEl.dataset.itemId;
    state.starterLoadout = chooseStarterLoadoutItem(state.starterLoadout, itemId);
    render();
    return;
  }

  if (action === "select-portrait") {
    state.selectedPortraitId = actionEl.dataset.portraitId || state.selectedPortraitId;
    render();
    return;
  }

  if (action === "open-help") {
    state.uiNewModal = "help";
    render();
    return;
  }

  if (action === "open-devlog") {
    state.uiNewModal = "devlog";
    render();
    return;
  }

  if (action === "close-modal") {
    state.uiNewModal = null;
    render();
    return;
  }

  if (action === "anvil-close") {
    const committed = !!state.uiHud?.anvilSession?.result;
    closeAnvilSession({ committed });
    render();
    return;
  }

  if (action === "anvil-back-to-modes") {
    const session = state.uiHud?.anvilSession;
    if (!session) {
      render();
      return;
    }
    flushPendingAnvilResultToBag();
    if (!state.uiHud.anvilSession) {
      render();
      return;
    }
    const s = state.uiHud.anvilSession;
    for (let i = 0; i < 3; i += 1) {
      if (s.slots?.[i]) {
        restoreFromAnvilSlot(i);
      }
    }
    s.mode = null;
    s.reforgeTargetItemId = null;
    s.improvePreviewResult = null;
    s.reforgePreviewResult = null;
    s.result = null;
    s.canCraft = false;
    render();
    return;
  }

  if (action === "anvil-mode-select") {
    const session = state.uiHud?.anvilSession;
    if (!session) return;
    flushPendingAnvilResultToBag();
    if (!state.uiHud.anvilSession) {
      render();
      return;
    }
    const sessionAfter = state.uiHud.anvilSession;
    const mode = String(actionEl.dataset.anvilMode || "");
    if (!["recycle", "improve", "reforge"].includes(mode)) return;
    sessionAfter.mode = mode;
    sessionAfter.improvePreviewResult = null;
    sessionAfter.reforgePreviewResult = null;
    sessionAfter.result = null;
    if (mode === "reforge") {
      const candidates = getReforgeCandidates(sessionAfter.slots || []);
      sessionAfter.reforgeTargetItemId = candidates[0]?.id || null;
    } else {
      sessionAfter.reforgeTargetItemId = null;
    }
    updateAnvilSessionComputedState();
    render();
    return;
  }

  if (action === "anvil-slot-return") {
    const slotIndex = Number(actionEl.dataset.anvilSlotIndex);
    if (restoreFromAnvilSlot(slotIndex)) {
      render();
    }
    return;
  }

  if (action === "anvil-result-take") {
    if (finalizeAnvilResultToBag()) {
      render();
    }
    return;
  }

  if (action === "anvil-craft") {
    if (executeAnvilCraft()) {
      render();
    }
    return;
  }

  if (action === "skip-turn" && state.screen === "game") {
    if (handleSkipTurnAction()) {
      render();
    }
    return;
  }

  if (action === "descend-stay" && state.screen === "game") {
    state.uiHud.descendPrompt = null;
    state.run.lastLog = "Спуск отменен. Ты остаешься на текущем уровне.";
    render();
    return;
  }

  if (action === "descend-confirm" && state.screen === "game" && state.run?.status === "running") {
    const nextLevel = Math.max(1, Number(state.uiHud?.descendPrompt?.nextLevel || ((state.run.level || 1) + 1)));
    state.uiHud.descendPrompt = null;
    state.run.status = "level_complete";
    ensureRunFxState(state.run).levelTransition = {
      phase: "out",
      startedMs: null,
      durationMs: 420,
      nextLevel,
    };
    state.run.lastLog = `Уровень ${state.run.level} пройден. Переход на ${nextLevel}...`;
    render();
    return;
  }

  if (action === "start-game") {
    const hasAllTypes = ["weapon", "armor", "amulet"].every((type) =>
      state.starterLoadout.some((id) => getItemById(id)?.type === type),
    );
    if (state.preGamePointsRemaining !== 0 || !hasAllTypes) {
      return;
    }
    state.playerSheet = applyLoadoutToSheet(createPlayerSheet(state.preGameStats), state.starterLoadout);
    state.playerSheet = initializeInventoryForRun(state.playerSheet);
    state.run = createRunState(state.playerSheet, 1, { playerPortraitId: state.selectedPortraitId });
    state.run.analyticsRunId = createRunAnalyticsId();
    state.run.analyticsRunEndTracked = false;
    trackEvent("game_start", {
      class_id: null,
      run_id: state.run.analyticsRunId,
    });
    state.uiNewRunStartedAtMs = Date.now();
    initQuickbarForNewRun();
    state.uiHud.anvilSession = null;
    state.uiHud.descendPrompt = null;
    state.screen = "game";
    state.uiNewStartMessage = "";
    render();
    return;
  }

  if (action === "use-consumable" && state.screen === "game" && state.run?.turnPhase === "player") {
    const itemId = actionEl.dataset.itemId;
    const bagInstanceId = actionEl.dataset.bagInstanceId || null;
    useConsumableById(itemId, bagInstanceId, -1);
    render();
    return;
  }

  if (action === "bag-item-action" && state.screen === "game" && state.run?.turnPhase === "player") {
    const itemId = actionEl.dataset.itemId;
    const bagInstanceId = actionEl.dataset.bagInstanceId;
    const item = getItemById(itemId);
    if (!item) return;
    if (item.isConsumable) {
      useConsumableById(item.id, bagInstanceId || null, -1);
    } else {
      const anvilSession = state.uiHud?.anvilSession;
      const firstFreeAnvilSlot = anvilSession?.mode && !anvilSession?.result
        ? (anvilSession.slots || []).findIndex((slot) => !slot)
        : -1;
      if (firstFreeAnvilSlot >= 0 && bagInstanceId) {
        const placed = placeIntoAnvilSlot(firstFreeAnvilSlot, { kind: "bag-equip", bagInstanceId });
        if (placed) {
          render();
          return;
        }
      }
      const previousSheet = state.playerSheet;
      state.playerSheet = swapItemFromBag(state.playerSheet, bagInstanceId, -1);
      if (state.playerSheet !== previousSheet) {
        consumeActionAndRunEnvironment();
      }
    }
    render();
    return;
  }

  if (action === "equip-slot-action" && state.screen === "game" && state.run?.turnPhase === "player") {
    const equipType = actionEl.dataset.equipType;
    const anvilSession = state.uiHud?.anvilSession;
    const firstFreeAnvilSlot = anvilSession?.mode && !anvilSession?.result
      ? (anvilSession.slots || []).findIndex((slot) => !slot)
      : -1;
    if (firstFreeAnvilSlot >= 0 && equipType) {
      const placed = placeIntoAnvilSlot(firstFreeAnvilSlot, { kind: "equipped-item", equipType });
      if (placed) {
        render();
        return;
      }
    }
    moveEquippedItemToBag(equipType);
    render();
    return;
  }

  if (action === "left-skill-use" && state.screen === "game" && state.run?.turnPhase === "player") {
    const skillId = actionEl.dataset.skillId;
    if (!skillId) return;

    const manaCost = getSkillManaCost(getSkillById(skillId), state.playerSheet);
    
    if ((state.playerSheet.mana || 0) < manaCost) {
      state.run.lastLog = "Недостаточно маны.";
      render();
      return;
    }

    clearPathingState();
    const targets = getSkillTargetsByKind(state.run, state.playerSheet, skillId, getEquippedItemContextBySkill);
    if (!targets.length) {
      state.run.lastLog = "Нет доступных клеток для применения.";
      render();
      return;
    }
    const activeSkill = getActiveSkills(state.playerSheet).find((entry) => entry.id === skillId) || null;
    const profile = getSkillTargetingProfile(skillId, activeSkill?.level || 1);
    state.uiHud.skillTargeting = {
      slotIndex: null,
      skillId,
      targets,
      selectedRoots: [],
      remainingCharges: profile?.charges || 1,
      chargesTotal: profile?.charges || 1,
      profile,
    };
    trackSkillUse(skillId);
    refreshSkillTargetingPreviewFromPointer();
    render();
    return;
  }

  if (action === "quickbar-use" && state.screen === "game" && state.run?.turnPhase === "player") {
    const slotIndex = Number(actionEl.dataset.slotIndex);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) return;
    useQuickbarSlot(slotIndex);
    render();
    return;
  }

  if (action === "upgrade-stat" && state.playerSheet && state.screen === "game") {
    state.uiHud.statHoverPreview = null;
    const stat = actionEl.dataset.stat;
    if (["STR", "INT", "AGI", "LUK"].includes(stat)) {
      state.playerSheet = spendLevelUpPoint(state.playerSheet, stat);
      render();
      syncStatHoverPreviewFromPointer();
    }
    return;
  }

  if (action === "secret-level-up" && state.playerSheet && state.screen === "game") {
    const currentXp = Number(state.playerSheet.xp || 0);
    const xpToNext = Math.max(1, Number(state.playerSheet.xpToNext || 1));
    const xpNeededForLevelUp = Math.max(1, xpToNext - currentXp);
    const levelBefore = Number(state.playerSheet.level || 1);
    const result = applyXpGain(state.playerSheet, xpNeededForLevelUp);
    state.playerSheet = result.playerSheet;
    if (Number(state.playerSheet.level || 1) > levelBefore && state.run) {
      state.run.lastLog = `Скрытый бонус: уровень повышен до ${state.playerSheet.level}.`;
    }
    render();
    return;
  }

  if (action === "back-to-welcome" || action === "end-to-welcome") {
    resetToWelcome();
    render();
    return;
  }
}

function updateStatHoverPreviewFromTarget(target) {
  const previewEl = target?.closest?.("[data-preview-stat]");
  if (!previewEl || previewEl.disabled) {
    if (state.uiHud.statHoverPreview) {
      state.uiHud.statHoverPreview = null;
      render();
    }
    return;
  }
  const stat = previewEl.dataset.previewStat;
  const screen = previewEl.dataset.previewScreen;
  const delta = Number(previewEl.dataset.previewDelta);
  if (!stat || !Number.isFinite(delta) || !screen) return;
  const prev = state.uiHud.statHoverPreview || {};
  if (prev.stat === stat && prev.delta === delta && prev.screen === screen) return;
  state.uiHud.statHoverPreview = { stat, delta, screen };
  render();
}

function updateItemHoverPreviewFromTarget(target) {
  const previewEl = target?.closest?.("[data-preview-item-id]");
  if (!previewEl) {
    if (state.uiHud.itemHoverPreview) {
      state.uiHud.itemHoverPreview = null;
      render();
    }
    return;
  }
  const itemId = previewEl.dataset.previewItemId;
  const screen = previewEl.dataset.previewItemScreen;
  const bagInstanceId = previewEl.dataset.previewItemBagInstanceId || null;
  if (!itemId || !screen) return;
  const prev = state.uiHud.itemHoverPreview || {};
  if (prev.itemId === itemId && prev.screen === screen && prev.bagInstanceId === bagInstanceId) {
    return;
  }
  state.uiHud.itemHoverPreview = { itemId, screen, bagInstanceId };
  render();
}

function syncStatHoverPreviewFromPointer() {
  if (!Number.isFinite(lastPointerClientX) || !Number.isFinite(lastPointerClientY)) {
    return;
  }
  const target = document.elementFromPoint(lastPointerClientX, lastPointerClientY);
  updateStatHoverPreviewFromTarget(target);
}

function clearDragUiState() {
  root.querySelectorAll(".cm-equip-slot__box--drop-target").forEach((el) => {
    el.classList.remove("cm-equip-slot__box--drop-target");
  });
  root.querySelectorAll(".cm-anvil-slot--drop-target").forEach((el) => {
    el.classList.remove("cm-anvil-slot--drop-target");
  });
}

function applyEquipDropTargetHighlight(payload) {
  if (!payload || payload.kind !== "bag-equip" || !payload.itemType) {
    return;
  }
  root.querySelectorAll(`[data-equip-type="${payload.itemType}"]`).forEach((el) => {
    el.classList.add("cm-equip-slot__box--drop-target");
  });
}

function moveEquippedItemToBag(equipType) {
  if (!canAcceptPlayerAction(state)) {
    return false;
  }
  if (!equipType || !["weapon", "armor", "amulet"].includes(equipType)) {
    return false;
  }
  const equippedId = state.playerSheet.equippedByType?.[equipType];
  if (!equippedId) return false;
  const equippedInstanceByType = { ...(state.playerSheet.equippedInstanceByType || {}) };
  const instanceId = equippedInstanceByType[equipType]
    || `item_runtime_${Date.now()}_${randomInt(0, 99999, state.run?.rng || null)}`;
  const nextEquippedByType = { ...(state.playerSheet.equippedByType || {}) };
  nextEquippedByType[equipType] = null;
  equippedInstanceByType[equipType] = null;
  const nextBag = [...(state.playerSheet.bag || []), { instanceId, itemId: equippedId }];
  state.playerSheet = recalculateSheetFromInventory(
    { ...state.playerSheet, equippedInstanceByType },
    nextEquippedByType,
    nextBag,
    equippedInstanceByType,
  );
  consumeActionAndRunEnvironment();
  return true;
}

function onRootDragStart(event) {
  const anvilResult = event.target.closest("[data-anvil-result='true']");
  if (anvilResult) {
    state.uiHud.dragPayload = { kind: "anvil-result" };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "anvil-result");
    return;
  }

  const anvilSlot = event.target.closest("[data-drag-kind='anvil-slot']");
  if (anvilSlot) {
    const slotIndex = Number(anvilSlot.dataset.anvilSlotIndex);
    if (!Number.isInteger(slotIndex)) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "anvil-slot", slotIndex };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `anvil-slot:${slotIndex}`);
    return;
  }

  const quickbarSlot = event.target.closest("[data-drag-kind='quick-slot']");
  if (quickbarSlot) {
    const slotIndex = Number(quickbarSlot.dataset.dragSlotIndex);
    if (!Number.isInteger(slotIndex) || !state.uiHud.quickbarSlots?.[slotIndex]) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "quick-slot", slotIndex };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `quick-slot:${slotIndex}`);
    return;
  }

  const consumable = event.target.closest("[data-drag-kind='consumable']");
  if (consumable) {
    const itemId = consumable.dataset.dragItemId;
    if (!itemId) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "consumable", itemId };
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", `consumable:${itemId}`);
    return;
  }

  const equipItem = event.target.closest("[data-drag-kind='bag-equip']");
  if (equipItem) {
    const bagInstanceId = equipItem.dataset.dragBagInstanceId;
    const itemType = equipItem.dataset.dragItemType;
    if (!bagInstanceId || !itemType) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "bag-equip", bagInstanceId, itemType };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `bag-equip:${bagInstanceId}`);
    clearDragUiState();
    applyEquipDropTargetHighlight(state.uiHud.dragPayload);
    return;
  }

  const equippedItem = event.target.closest("[data-drag-kind='equipped-item']");
  if (equippedItem) {
    const equipType = equippedItem.dataset.dragEquipType;
    if (!equipType) {
      event.preventDefault();
      return;
    }
    state.uiHud.dragPayload = { kind: "equipped-item", equipType };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `equipped-item:${equipType}`);
    return;
  }

  const skill = event.target.closest("[data-drag-kind='skill']");
  if (!skill) return;
  const skillId = skill.dataset.dragSkillId;
  if (!skillId) {
    event.preventDefault();
    return;
  }
  state.uiHud.dragPayload = { kind: "skill", skillId };
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("text/plain", `skill:${skillId}`);
}

function onRootDragOver(event) {
  clearDragUiState();
  const quickbarSlot = event.target.closest("[data-slot-index]");
  const equipSlot = event.target.closest("[data-equip-type]");
  const bagDropzone = event.target.closest("[data-bag-dropzone]");
  const anvilSlot = event.target.closest("[data-anvil-slot-index]");
  const payload = state.uiHud.dragPayload;
  applyEquipDropTargetHighlight(payload);
  if (!payload || (!quickbarSlot && !equipSlot && !bagDropzone && !anvilSlot)) {
    return;
  }
  if (anvilSlot) {
    const slotIndex = Number(anvilSlot.dataset.anvilSlotIndex);
    if (!Number.isInteger(slotIndex)) return;
    if (payload.kind !== "bag-equip" && payload.kind !== "equipped-item") return;
    event.preventDefault();
    anvilSlot.classList.add("cm-anvil-slot--drop-target");
    event.dataTransfer.dropEffect = "move";
    return;
  }
  if (equipSlot) {
    const equipType = equipSlot.dataset.equipType;
    if (payload.kind !== "bag-equip" || !equipType || payload.itemType !== equipType) {
      return;
    }
    equipSlot.classList.add("cm-equip-slot__box--drop-target");
  }
  if (bagDropzone && payload.kind !== "equipped-item" && payload.kind !== "anvil-slot" && payload.kind !== "anvil-result") {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function onRootDrop(event) {
  const anvilSlot = event.target.closest("[data-anvil-slot-index]");
  if (anvilSlot && (state.uiHud.dragPayload?.kind === "bag-equip" || state.uiHud.dragPayload?.kind === "equipped-item")) {
    event.preventDefault();
    const placed = placeIntoAnvilSlot(Number(anvilSlot.dataset.anvilSlotIndex), state.uiHud.dragPayload);
    state.uiHud.dragPayload = null;
    clearDragUiState();
    if (placed) {
      render();
    }
    return;
  }

  const bagDropzone = event.target.closest("[data-bag-dropzone]");
  if (bagDropzone && state.uiHud.dragPayload?.kind === "anvil-result") {
    event.preventDefault();
    const finalized = finalizeAnvilResultToBag();
    state.uiHud.dragPayload = null;
    clearDragUiState();
    if (finalized) {
      render();
    }
    return;
  }
  if (bagDropzone && state.uiHud.dragPayload?.kind === "anvil-slot") {
    event.preventDefault();
    const restored = restoreFromAnvilSlot(state.uiHud.dragPayload.slotIndex);
    state.uiHud.dragPayload = null;
    clearDragUiState();
    if (restored) {
      render();
    }
    return;
  }
  if (bagDropzone && state.uiHud.dragPayload?.kind === "equipped-item") {
    event.preventDefault();
    const moved = moveEquippedItemToBag(state.uiHud.dragPayload.equipType);
    state.uiHud.dragPayload = null;
    clearDragUiState();
    if (moved) {
      render();
    }
    return;
  }

  const equipSlot = event.target.closest("[data-equip-type]");
  if (equipSlot && state.uiHud.dragPayload?.kind === "anvil-slot") {
    event.preventDefault();
    const restored = restoreFromAnvilSlot(state.uiHud.dragPayload.slotIndex);
    state.uiHud.dragPayload = null;
    clearDragUiState();
    if (restored) {
      render();
    }
    return;
  }
  if (equipSlot && state.uiHud.dragPayload?.kind === "bag-equip") {
    const equipType = equipSlot.dataset.equipType;
    const payload = state.uiHud.dragPayload;
    if (state.playerSheet && state.run && state.run.turnPhase === "player" && equipType && payload.itemType === equipType && payload.bagInstanceId) {
      event.preventDefault();
      const previousSheet = state.playerSheet;
      state.playerSheet = swapItemFromBag(state.playerSheet, payload.bagInstanceId, -1);
      if (state.playerSheet !== previousSheet) {
        consumeActionAndRunEnvironment();
      }
      state.uiHud.dragPayload = null;
      clearDragUiState();
      render();
      return;
    }
  }

  const quickbarSlot = event.target.closest("[data-slot-index]");
  if (!quickbarSlot || !state.uiHud.dragPayload) return;
  const targetSlot = Number(quickbarSlot.dataset.slotIndex);
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot > 8) {
    state.uiHud.dragPayload = null;
    clearDragUiState();
    return;
  }
  event.preventDefault();
  const slots = [...(state.uiHud.quickbarSlots || [])];
  const payload = state.uiHud.dragPayload;
  if (payload.kind === "consumable" && payload.itemId) slots[targetSlot] = { kind: "consumable", itemId: payload.itemId };
  if (payload.kind === "skill" && payload.skillId) {
    slots[targetSlot] = { kind: "skill", skillId: payload.skillId };
  }
  if (payload.kind === "quick-slot" && Number.isInteger(payload.slotIndex)) {
    const sourceSlot = payload.slotIndex;
    if (sourceSlot !== targetSlot) {
      const tmp = slots[targetSlot] || null;
      slots[targetSlot] = slots[sourceSlot] || null;
      slots[sourceSlot] = tmp;
    }
  }
  state.uiHud.quickbarSlots = slots;
  state.uiHud.dragPayload = null;
  clearDragUiState();
  render();
}

function onRootDragEnd(event) {
  const payload = state.uiHud.dragPayload;
  if (payload?.kind === "quick-slot" && Number.isInteger(payload.slotIndex) && event.dataTransfer?.dropEffect === "none") {
    const slots = [...(state.uiHud.quickbarSlots || [])];
    slots[payload.slotIndex] = null;
    state.uiHud.quickbarSlots = slots;
    state.uiHud.dragPayload = null;
    clearDragUiState();
    render();
    return;
  }
  state.uiHud.dragPayload = null;
  clearDragUiState();
}

root.addEventListener("click", onRootClick);
root.addEventListener("mousedown", (event) => {
  const handle = event.target.closest("[data-action='anvil-drag-handle']");
  if (!handle) return;
  const session = state.uiHud?.anvilSession;
  if (!session) return;
  const card = handle.closest(".cm-anvil-card");
  if (!card) return;
  event.preventDefault();
  const rect = card.getBoundingClientRect();
  session.windowPosition = { x: rect.left, y: rect.top };
  anvilDragState = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  render();
});
root.addEventListener("change", (event) => {
  const actionEl = event.target.closest("[data-action='anvil-reforge-target']");
  if (!actionEl) return;
  const session = state.uiHud?.anvilSession;
  if (!session || session.mode !== "reforge") return;
  session.reforgeTargetItemId = String(actionEl.value || "") || null;
  updateAnvilSessionComputedState();
  render();
});
root.addEventListener("dragstart", onRootDragStart);
root.addEventListener("dragover", onRootDragOver);
root.addEventListener("drop", onRootDrop);
root.addEventListener("dragend", onRootDragEnd);
root.addEventListener("mouseup", (event) => {
  const canvas = event.target.closest("#newGameCanvas");
  if (!canvas) return;
  if (event.button === 2) {
    event.preventDefault();
    if (state.uiHud.skillTargeting?.skillId || state.uiHud.trapTargeting?.itemId) {
      clearSkillTargeting();
      if (state.run?.status === "running") {
        state.run.lastLog = "Подготовка скилла отменена.";
      }
      render();
    }
    return;
  }
  if (event.button !== 0) {
    return;
  }
  const nowMs = performance.now();
  if (nowMs - Number(state.uiNewLastCanvasClickAtMs || 0) < 140) {
    return;
  }
  state.uiNewLastCanvasClickAtMs = nowMs;
  if (state.uiHud.autoMoveActive) {
    clearPathingState();
    if (state.run?.status === "running") {
      state.run.lastLog = "Автодвижение отменено.";
    }
    render();
    return;
  }
  canvasHandlers.onCanvasClick(event, canvas);
});
root.addEventListener("contextmenu", (event) => {
  const canvas = event.target.closest("#newGameCanvas");
  if (!canvas) return;
  event.preventDefault();
});
root.addEventListener("mousemove", (event) => {
  lastPointerClientX = Number(event.clientX || 0);
  lastPointerClientY = Number(event.clientY || 0);
  updateItemHoverPreviewFromTarget(event.target);
  updateStatHoverPreviewFromTarget(event.target);
  queueInventoryPopoverUpdate(event);
  queueSkillPopoverUpdate(event);
  worldObjectPopover.updateFromEvent(event);
  const canvas = event.target.closest("#newGameCanvas");
  if (!canvas) return;
  if (state.screen === "game" && state.run && state.playerSheet && state.uiHud.skillTargeting?.skillId) {
    if (refreshSkillTargetingPreviewFromPointer()) {
      return;
    }
  }
  canvasHandlers.onCanvasMouseMove(event, canvas);
});
window.addEventListener("mousemove", (event) => {
  if (!anvilDragState || !state.uiHud?.anvilSession) return;
  const nextX = Math.max(8, event.clientX - anvilDragState.offsetX);
  const nextY = Math.max(8, event.clientY - anvilDragState.offsetY);
  state.uiHud.anvilSession.windowPosition = { x: nextX, y: nextY };
  render();
});
window.addEventListener("mouseup", () => {
  if (!anvilDragState) return;
  anvilDragState = null;
});
root.addEventListener("mouseout", (event) => {
  if (event.target.closest("#newGameCanvas") && !event.relatedTarget?.closest?.("#newGameCanvas")) {
    const targeting = state.uiHud.skillTargeting;
    const context = targeting?.skillId ? getEquippedItemContextBySkill(state.playerSheet, targeting.skillId) : null;
    state.uiHud.skillTargetingPreviews = (targeting && context)
      ? getSkillPreviewForPreparedSelections(
        state.run,
        state.playerSheet,
        context.item,
        context.instanceEntry.skill || null,
        targeting.skillId,
        targeting.selectedRoots || [],
      )
      : [];
    state.uiHud.skillTargetingCursorCell = null;
    state.uiHud.skillTargetingChargeBadge = null;
    state.uiHud.skillTargetingAffectedCells = (targeting?.selectedRoots || []).flatMap((root) =>
      getSkillAffectedCellsForRoot(state.run, targeting.skillId, root.x, root.y)
    );
    state.uiHud.targetingLines = (targeting?.selectedRoots || []).map((root) => ({
      x: root.x,
      y: root.y,
      color: "rgba(244, 63, 94, 0.95)",
    }));
  }
  if (event.target.closest("[data-preview-item-id]") && !event.relatedTarget?.closest?.("[data-preview-item-id]")) {
    updateItemHoverPreviewFromTarget(null);
  }
  if (event.target.closest("[data-preview-stat]") && !event.relatedTarget?.closest?.("[data-preview-stat]")) {
    updateStatHoverPreviewFromTarget(null);
  }
  const toTarget = event.relatedTarget;
  const stillInsideDetail = toTarget?.closest?.("[data-inventory-detail-item-id]");
  if (!stillInsideDetail) {
    inventoryPopover.scheduleHide();
  }
  const stillInsideSkillDetail = toTarget?.closest?.("[data-skill-detail-id]");
  if (!stillInsideSkillDetail) {
    skillPopover.scheduleHide();
  }
  if (event.target.closest("#newGameCanvas") && !event.relatedTarget?.closest?.("#newGameCanvas")) {
    worldObjectPopover.scheduleHide();
  }
  if (event.target.closest("#newGameCanvas") && !event.relatedTarget?.closest?.("#newGameCanvas")) {
    canvasHandlers.onCanvasMouseLeave();
  }
});
root.addEventListener("wheel", (event) => {
  const canvas = event.target.closest("#newGameCanvas");
  if (!canvas || state.screen !== "game" || !state.run || !state.playerSheet) {
    return;
  }
  event.preventDefault();
  const zoomStep = event.deltaY < 0 ? 0.1 : -0.1;
  const currentZoom = Number(state.uiHud?.canvasZoom ?? 1);
  const nextZoom = normalizeCanvasZoom(currentZoom + zoomStep);
  if (nextZoom === currentZoom) {
    return;
  }
  state.uiHud.canvasZoom = nextZoom;
  syncCanvasHoverFromPointer();
  render();
}, { passive: false });
window.addEventListener("keydown", (event) => {
  if (!canAcceptPlayerAction(state)) return;
  if (state.uiHud?.descendPrompt) return;

  const quickSlot = resolveQuickbarSlotIndexFromKeyboardEvent(event);
  if (quickSlot != null) {
    event.preventDefault();
    useQuickbarSlot(quickSlot);
    render();
    return;
  }

  if (event.code === "Space" || event.key === " ") {
    event.preventDefault();
    if (handleSkipTurnAction()) {
      render();
      return;
    }
    return;
  }

  if (event.key === "Escape") {
    if (isAnvilSessionOpen()) {
      event.preventDefault();
      const committed = !!state.uiHud?.anvilSession?.result;
      closeAnvilSession({ committed });
      render();
      return;
    }
    if (state.uiHud.skillTargeting?.skillId || state.uiHud.trapTargeting?.itemId) {
      event.preventDefault();
      clearSkillTargeting();
      state.run.lastLog = "Подготовка скилла отменена.";
      render();
    }
    return;
  }

  const direction = resolveMoveDirectionFromEvent(event);
  if (direction && state.uiHud.skillTargeting?.skillId) {
    event.preventDefault();
    tryCastPreparedSkillByDirection(direction);
    render();
    return;
  }
  if (direction && state.uiHud.trapTargeting?.itemId) {
    event.preventDefault();
    state.run.lastLog = "Для установки ловушки выбери клетку мышью.";
    render();
    return;
  }
  if (state.uiHud.skillTargeting?.skillId || state.uiHud.trapTargeting?.itemId) {
    return;
  }
  if (!direction) return;
  event.preventDefault();
  performStep(direction, true);
});
window.addEventListener("resize", () => {
  if (uiNewResizeTimer) {
    clearTimeout(uiNewResizeTimer);
  }
  uiNewResizeTimer = setTimeout(() => {
    if (state.screen === "game") {
      render();
    }
  }, 120);
});
startAnimationLoop((nowMs) => {
  if (state.screen === "game") {
    if (state.run) {
      ensureRunFxState(state.run);
      advanceRunAnimationState(state.run, nowMs);
      processPendingSkillApplications(state.run, state.playerSheet, nowMs);
      flushQueuedEnvironmentTurn(nowMs);
    }
    handleLevelTransition(nowMs);
    maybeTrackRunEnd();
    const canvas = document.getElementById("newGameCanvas");
    if (canvas && state.run && state.playerSheet) {
      if (isEnvironmentTurnStepReady(state.run)) {
        const envResult = stepEnvironmentTurn(state.run, state.playerSheet);
        state.run = envResult.run;
        state.playerSheet = envResult.playerSheet;
        if (state.run?.status === "defeat" || state.run?.status === "victory") {
          maybeTrackRunEnd();
          state.screen = "ending";
          render();
          return;
        }
        if (envResult.finished) {
          render();
          return;
        }
      }

      const canvasOverlay = buildCanvasOverlayViewModel(state.uiHud);
      drawRunToCanvas(
        canvas,
        state.run,
        state.playerSheet,
        nowMs,
        state.uiHud?.canvasZoom ?? 1,
        canvasOverlay,
      );
    }
    canvasHandlers.maybeRunAutoMoveStep();
  }
});

installMousefallConsoleHelpers({
  getState: () => state,
  render,
  getItemById,
  getAllLootItems,
  createRuntimeItemInstance,
  recalculateSheetFromInventory,
});

render();
