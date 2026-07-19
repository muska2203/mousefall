import type {Resources} from '@i18n/schema';
import {ruCommonUi} from './common/ui';
import {ruCommonGame} from './common/game';
import {ruMainMenu} from './screens/mainMenu';
import {ruCharacterCreation} from './screens/characterCreation';
import {ruGame} from './screens/game';
import {ruEnding} from './screens/ending';
import {ruHeroPanel} from './components/heroPanel';
import {ruLogPanel} from './components/logPanel';
import {ruInventoryPanel} from './components/inventoryPanel';
import {ruItemDetail} from './components/itemDetail';
import {ruEquipmentPanel} from './components/equipmentPanel';
import {ruSkillsPanel} from './components/skillsPanel';
import {ruEffectsPanel} from './components/effectsPanel';
import {ruEndingMetrics} from './components/endingMetrics';
import {ruEndingActions} from './components/endingActions';
import {ruBossList} from './components/bossList';
import {ruConsumables} from './components/consumables';
import {ruMetaFooter} from './components/metaFooter';
import {ruHotbar} from './components/hotbar';
import {ruGameField} from './components/gameField';
import {ruFieldObjectPopover} from './components/fieldObjectPopover';
import {ruInteractionHint} from './components/interactionHint';
import {ruDebugPanel} from './components/debugPanel';
import {ruStarterEquipmentPanel} from './components/starterEquipmentPanel';
import {ruStatRow} from './components/statRow';
import {ruPortrait} from './components/portrait';
import {ruPortraitGallery} from './components/portraitGallery';
import {ruDetailPopover} from './components/detailPopover';
import {ruToast} from './components/toast';
import {ruLogBuilder} from './system/logBuilder';
import {ruItemMapper} from './system/itemMapper';
import {ruEnemyMapper} from './system/enemyMapper';
import {ruAnimation} from './system/animation';
import {ruGameSession} from './system/gameSession';
import {ruActionValidations} from './system/actionValidations';
import {ruEntityNames} from './system/entityNames';
import {ruMapObjects} from './system/mapObjects';

export const ruResources: Resources = {
  common: {
    ui: ruCommonUi,
    game: ruCommonGame,
  },
  screens: {
    mainMenu: ruMainMenu,
    characterCreation: ruCharacterCreation,
    game: ruGame,
    ending: ruEnding,
  },
  components: {
    heroPanel: ruHeroPanel,
    logPanel: ruLogPanel,
    inventoryPanel: ruInventoryPanel,
    itemDetail: ruItemDetail,
    equipmentPanel: ruEquipmentPanel,
    skillsPanel: ruSkillsPanel,
    effectsPanel: ruEffectsPanel,
    endingMetrics: ruEndingMetrics,
    endingActions: ruEndingActions,
    bossList: ruBossList,
    consumables: ruConsumables,
    metaFooter: ruMetaFooter,
    hotbar: ruHotbar,
    gameField: ruGameField,
    fieldObjectPopover: ruFieldObjectPopover,
    interactionHint: ruInteractionHint,
    debugPanel: ruDebugPanel,
    starterEquipmentPanel: ruStarterEquipmentPanel,
    statRow: ruStatRow,
    portrait: ruPortrait,
    portraitGallery: ruPortraitGallery,
    detailPopover: ruDetailPopover,
    toast: ruToast,
  },
  system: {
    logBuilder: ruLogBuilder,
    itemMapper: ruItemMapper,
    enemyMapper: ruEnemyMapper,
    animation: ruAnimation,
    gameSession: ruGameSession,
    actionValidations: ruActionValidations,
    entityNames: ruEntityNames,
    mapObjects: ruMapObjects,
  },
};
