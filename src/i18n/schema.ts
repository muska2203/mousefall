/**
 * Единая схема переводов для всех языков.
 * Каждый языковой агрегатор обязан имплементировать этот interface.
 */

export interface CommonUiTranslations {
  yes: string;
  no: string;
  close: string;
  cancel: string;
  unknownMode: string;
}

export interface CommonGameTranslations {
  strength: string;
  dexterity: string;
  intelligence: string;
  vitality: string;
  hp: string;
  xp: string;
  ap: string;
  level: string;
}

export interface CommonTranslations {
  ui: CommonUiTranslations;
  game: CommonGameTranslations;
}

export interface ScreensMainMenuTranslations {
  newGame: string;
  languageSelect: string;
}

export interface ScreensCharacterCreationTranslations {
  statsTitle: string;
  freePoints: string;
  appearanceTitle: string;
  runSettingsTitle: string;
  seedLabel: string;
  seedPlaceholder: string;
  seedAriaLabel: string;
  infoTitle: string;
  hintsAlert: string;
  hintsButton: string;
  devlogAlert: string;
  startRun: string;
  statStrength: string;
  statStrengthFlavor: string;
  statStrengthDetail1: string;
  statStrengthDetail2: string;
  statStrengthDetail3: string;
  statIntelligence: string;
  statIntelligenceFlavor: string;
  statIntelligenceDetail1: string;
  statIntelligenceDetail2: string;
  statIntelligenceDetail3: string;
  statDexterity: string;
  statDexterityFlavor: string;
  statDexterityDetail1: string;
  statDexterityDetail2: string;
  statDexterityDetail3: string;
  statVitality: string;
  statVitalityFlavor: string;
  statVitalityDetail1: string;
  statVitalityDetail2: string;
  statVitalityDetail3: string;
  slotWeapon: string;
  slotArmor: string;
  slotAmulet: string;
  portraitAlt: string;
}

export interface ScreensGameTranslations {
  loading: string;
}

export interface ScreensEndingTranslations {
  heroCardTitle: string;
  equipmentTitle: string;
  duration: string;
  turns: string;
  enemiesKilled: string;
  maxFloorReached: string;
  chestsOpened: string;
  itemsCollected: string;
  victorySubtitle: string;
  defeatSubtitle: string;
  boss1: string;
  boss2: string;
  boss3: string;
  boss4: string;
  resultVictory: string;
  resultDefeat: string;
  statStrength: string;
  statIntelligence: string;
  statDexterity: string;
  statVitality: string;
  slotWeapon: string;
  slotArmor: string;
  slotAmulet: string;
}

export interface ScreensTranslations {
  mainMenu: ScreensMainMenuTranslations;
  characterCreation: ScreensCharacterCreationTranslations;
  game: ScreensGameTranslations;
  ending: ScreensEndingTranslations;
}

export interface ComponentsHeroPanelTranslations {
  title: string;
  portraitAlt: string;
  xpLabel: string;
}

export interface ComponentsLogPanelTranslations {
  title: string;
  emptyMessage: string;
}

export interface ComponentsInventoryPanelTranslations {
  title: string;
}

export interface ComponentsItemDetailTranslations {
  itemSkillsTitle: string;
  abilityLevelPrefix: string;
  possibleSkillsTitle: string;
  descriptionTitle: string;
}

export interface ComponentsEquipmentPanelTranslations {
  title: string;
}

export interface ComponentsSkillsPanelTranslations {
  title: string;
  noSkills: string;
  equipmentSkillTooltip: string;
  levelupSkillTooltip: string;
  castPrefix: string;
}

export interface ComponentsEffectsPanelTranslations {
  title: string;
  noEffectsName: string;
  noEffectsDesc: string;
}

export interface ComponentsEndingMetricsTranslations {
  title: string;
}

export interface ComponentsEndingActionsTranslations {
  title: string;
  newRun: string;
  toMenu: string;
  devlogAlert: string;
}

export interface ComponentsBossListTranslations {
  title: string;
}

export interface ComponentsConsumablesTranslations {
  title: string;
}

export interface ComponentsMetaFooterTranslations {
  versionLine: string;
  analyticsNote: string;
}

export interface ComponentsHotSlotTranslations {
  emptySlotAria: string;
  occupiedSlotAria: string;
}

export interface ComponentsGameFieldTranslations {
  floorTitle: string;
  skipTurnAriaLabel: string;
  playerPhaseLabel: string;
  environmentPhaseLabel: string;
  statusTickPhaseLabel: string;
  skipTurnHoverLabel: string;
  gameFieldAriaLabel: string;
}

export interface ComponentsFieldObjectPopoverTranslations {
  damageLabel: string;
  hpLabel: string;
  armorLabel: string;
  skillsTitle: string;
  cooldownSuffix: string;
  cooldownReady: string;
  possibleLootTitle: string;
}

export interface ComponentsInteractionHintTranslations {
  pickup: string;
  descend: string;
  ascend: string;
  openDoor: string;
  closeDoor: string;
  keyF: string;
  keyTab: string;
}

export interface ComponentsDebugPanelTranslations {
  title: string;
  giveItemLabel: string;
  addToInventoryButton: string;
  spawnObjectLabel: string;
  spawnTypeItem: string;
  spawnTypeEnemy: string;
  spawnTypeDoor: string;
  spawnTypeStairs: string;
  selectTileHint: string;
  spawnButtonIdle: string;
  spawnButtonPending: string;
  cancelButton: string;
  levelLabel: string;
  regenerateMapButton: string;
  showMapgenDebug: string;
}

export interface ComponentsStarterEquipmentPanelTranslations {
  title: string;
  selectedPrefix: string;
}

export interface ComponentsStatRowTranslations {
  decreaseAria: string;
  increaseAria: string;
}

export interface ComponentsPortraitTranslations {
  levelAriaLabel: string;
}

export interface ComponentsPortraitGalleryTranslations {
  previewAlt: string;
}

export interface ComponentsDetailPopoverTranslations {
  impactTitle: string;
}

export interface ComponentsToastTranslations {
  skillOnCooldownTitle: string;
  skillOnCooldownMessage: string;
  notEnoughApTitle: string;
  notEnoughApMessage: string;
  actorCannotActTitle: string;
  actorCannotActMessage: string;
  invalidTargetTitle: string;
  invalidTargetMessage: string;
  wrongTargetCountTitle: string;
  wrongTargetCountMessage: string;
  alreadyCastingTitle: string;
  alreadyCastingMessage: string;
  abilityNotFoundTitle: string;
  abilityNotFoundMessage: string;
  itemNotFoundTitle: string;
  itemNotFoundMessage: string;
  notConsumableTitle: string;
  notConsumableMessage: string;
  unsupportedEffectTitle: string;
  unsupportedEffectMessage: string;
  notEquippableTitle: string;
  notEquippableMessage: string;
  slotEmptyTitle: string;
  slotEmptyMessage: string;
  bottomFloorReachedTitle: string;
  bottomFloorReachedMessage: string;
  maxFloorReachedTitle: string;
  maxFloorReachedMessage: string;
  noStairsDownTitle: string;
  noStairsDownMessage: string;
  noStairsUpTitle: string;
  noStairsUpMessage: string;
  minFloorReachedTitle: string;
  minFloorReachedMessage: string;
  tileBlockedTitle: string;
  tileBlockedMessage: string;
  noTargetAtTileTitle: string;
  noTargetAtTileMessage: string;
  genericErrorTitle: string;
  genericErrorMessage: string;
  closeLabel: string;
}

export interface ComponentsTranslations {
  heroPanel: ComponentsHeroPanelTranslations;
  logPanel: ComponentsLogPanelTranslations;
  inventoryPanel: ComponentsInventoryPanelTranslations;
  itemDetail: ComponentsItemDetailTranslations;
  equipmentPanel: ComponentsEquipmentPanelTranslations;
  skillsPanel: ComponentsSkillsPanelTranslations;
  effectsPanel: ComponentsEffectsPanelTranslations;
  endingMetrics: ComponentsEndingMetricsTranslations;
  endingActions: ComponentsEndingActionsTranslations;
  bossList: ComponentsBossListTranslations;
  consumables: ComponentsConsumablesTranslations;
  metaFooter: ComponentsMetaFooterTranslations;
  hotSlot: ComponentsHotSlotTranslations;
  gameField: ComponentsGameFieldTranslations;
  fieldObjectPopover: ComponentsFieldObjectPopoverTranslations;
  interactionHint: ComponentsInteractionHintTranslations;
  debugPanel: ComponentsDebugPanelTranslations;
  starterEquipmentPanel: ComponentsStarterEquipmentPanelTranslations;
  statRow: ComponentsStatRowTranslations;
  portrait: ComponentsPortraitTranslations;
  portraitGallery: ComponentsPortraitGalleryTranslations;
  detailPopover: ComponentsDetailPopoverTranslations;
  toast: ComponentsToastTranslations;
}

export interface SystemLogBuilderTranslations {
  heroMoved: string;
  heroAttacked: string;
  damageTaken: string;
  heroDied: string;
  playerDied: string;
  healReceived: string;
  itemUsedLabel: string;
  heroUsedItem: string;
  heroNameFallback: string;
  enemyNameFallback: string;
  doorOpened: string;
  doorClosed: string;
  counterattackTriggered: string;
}

export interface SystemItemMapperTranslations {
  typeWeapon: string;
  typeArmor: string;
  typeAmulet: string;
  typeConsumable: string;
  typeKey: string;
  typeGold: string;
  damagePiercing: string;
  damageSlashing: string;
  damageBlunt: string;
  damageFire: string;
  damageElectric: string;
  damagePoison: string;
  damageFrost: string;
  rarityCommon: string;
  rarityRare: string;
  rarityUnique: string;
  weaponDamageLabel: string;
  weaponBaseDamageLabel: string;
  weaponFormulaLabel: string;
  weaponFormulaFallback: string;
  combatParamsTitle: string;
  armorTitle: string;
  armorRatingLabel: string;
  consumableTitle: string;
  effectTypeLabel: string;
  effectValueLabel: string;
}

export interface SystemEnemyMapperTranslations {
  damagePiercing: string;
  damageSlashing: string;
  damageBlunt: string;
  damageFire: string;
  damageElectric: string;
  damagePoison: string;
  damageFrost: string;
}

export interface SystemAnimationTranslations {
  castInterrupted: string;
  doorOpened: string;
  doorClosed: string;
}

export interface SystemGameSessionTranslations {
  heroStatStrength: string;
  heroStatIntelligence: string;
  heroStatDexterity: string;
  heroStatVitality: string;
  rarityFallback: string;
  typeFallback: string;
  equipSlotWeapon: string;
  equipSlotArmor: string;
  equipSlotAmulet: string;
  effectPoisoned: string;
  effectPoisonedDesc: string;
  effectBurning: string;
  effectBurningDesc: string;
  effectFrozen: string;
  effectFrozenDesc: string;
  effectStunned: string;
  effectStunnedDesc: string;
  effectRegenerating: string;
  effectRegeneratingDesc: string;
  effectCounterattack: string;
  effectCounterattackDesc: string;
  effectUnknown: string;
}

export interface SystemActionValidationsTranslations {
  itemNotFound: string;
  itemCannotEquip: string;
  onlyPlayerCanDescend: string;
  noDescentHere: string;
  bottomFloorReached: string;
  onlyPlayerCanAscend: string;
  noAscentHere: string;
  alreadyOnSurface: string;
  slotEmpty: string;
  itemCannotUse: string;
  itemEffectNotSupported: string;
}

export interface SystemEntityNamesTranslations {
  heroName: string;
}

export interface SystemMapObjectsTranslations {
  stairsDown: string;
  stairsUp: string;
}

export interface SystemTranslations {
  logBuilder: SystemLogBuilderTranslations;
  itemMapper: SystemItemMapperTranslations;
  enemyMapper: SystemEnemyMapperTranslations;
  animation: SystemAnimationTranslations;
  gameSession: SystemGameSessionTranslations;
  actionValidations: SystemActionValidationsTranslations;
  entityNames: SystemEntityNamesTranslations;
  mapObjects: SystemMapObjectsTranslations;
}

/** Единая схема переводов. Все языковые агрегаторы обязаны ей соответствовать. */
export interface Resources {
  common: CommonTranslations;
  screens: ScreensTranslations;
  components: ComponentsTranslations;
  system: SystemTranslations;
}
