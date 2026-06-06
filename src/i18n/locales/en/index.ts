import type { Resources } from '@i18n/schema';
import { enCommonUi } from './common/ui';
import { enCommonGame } from './common/game';
import { enMainMenu } from './screens/mainMenu';
import { enCharacterCreation } from './screens/characterCreation';
import { enGame } from './screens/game';
import { enEnding } from './screens/ending';
import { enHeroPanel } from './components/heroPanel';
import { enLogPanel } from './components/logPanel';
import { enInventoryPanel } from './components/inventoryPanel';
import { enItemDetail } from './components/itemDetail';
import { enEquipmentPanel } from './components/equipmentPanel';
import { enSkillsPanel } from './components/skillsPanel';
import { enEffectsPanel } from './components/effectsPanel';
import { enEndingMetrics } from './components/endingMetrics';
import { enEndingActions } from './components/endingActions';
import { enBossList } from './components/bossList';
import { enConsumables } from './components/consumables';
import { enMetaFooter } from './components/metaFooter';
import { enHotSlot } from './components/hotSlot';
import { enGameField } from './components/gameField';
import { enFieldObjectPopover } from './components/fieldObjectPopover';
import { enStarterEquipmentPanel } from './components/starterEquipmentPanel';
import { enStatRow } from './components/statRow';
import { enPortrait } from './components/portrait';
import { enPortraitGallery } from './components/portraitGallery';
import { enDetailPopover } from './components/detailPopover';
import { enLogBuilder } from './system/logBuilder';
import { enItemMapper } from './system/itemMapper';
import { enEnemyMapper } from './system/enemyMapper';
import { enAnimation } from './system/animation';
import { enGameSession } from './system/gameSession';
import { enActionValidations } from './system/actionValidations';
import { enEntityNames } from './system/entityNames';
import { enMapObjects } from './system/mapObjects';

export const enResources: Resources = {
  common: {
    ui: enCommonUi,
    game: enCommonGame,
  },
  screens: {
    mainMenu: enMainMenu,
    characterCreation: enCharacterCreation,
    game: enGame,
    ending: enEnding,
  },
  components: {
    heroPanel: enHeroPanel,
    logPanel: enLogPanel,
    inventoryPanel: enInventoryPanel,
    itemDetail: enItemDetail,
    equipmentPanel: enEquipmentPanel,
    skillsPanel: enSkillsPanel,
    effectsPanel: enEffectsPanel,
    endingMetrics: enEndingMetrics,
    endingActions: enEndingActions,
    bossList: enBossList,
    consumables: enConsumables,
    metaFooter: enMetaFooter,
    hotSlot: enHotSlot,
    gameField: enGameField,
    fieldObjectPopover: enFieldObjectPopover,
    starterEquipmentPanel: enStarterEquipmentPanel,
    statRow: enStatRow,
    portrait: enPortrait,
    portraitGallery: enPortraitGallery,
    detailPopover: enDetailPopover,
  },
  system: {
    logBuilder: enLogBuilder,
    itemMapper: enItemMapper,
    enemyMapper: enEnemyMapper,
    animation: enAnimation,
    gameSession: enGameSession,
    actionValidations: enActionValidations,
    entityNames: enEntityNames,
    mapObjects: enMapObjects,
  },
};
