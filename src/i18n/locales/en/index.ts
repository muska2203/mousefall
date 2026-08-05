import type {Resources} from '@i18n/schema';
import {enCommonUi} from './common/ui';
import {enCommonGame} from './common/game';
import {enMainMenu} from './screens/mainMenu';
import {enCharacterCreation} from './screens/characterCreation';
import {enGame} from './screens/game';
import {enEnding} from './screens/ending';
import {enHeroPanel} from './components/heroPanel';
import {enLogPanel} from './components/logPanel';
import {enInventoryPanel} from './components/inventoryPanel';
import {enRelicsPanel} from './components/relicsPanel';
import {enItemDetail} from './components/itemDetail';
import {enEquipmentPanel} from './components/equipmentPanel';
import {enSkillsPanel} from './components/skillsPanel';
import {enRelicChoice} from './components/relicChoice';
import {enEffectsPanel} from './components/effectsPanel';
import {enEndingMetrics} from './components/endingMetrics';
import {enEndingActions} from './components/endingActions';
import {enBossList} from './components/bossList';
import {enConsumables} from './components/consumables';
import {enMetaFooter} from './components/metaFooter';
import {enHotbar} from './components/hotbar';
import {enGameField} from './components/gameField';
import {enFieldObjectPopover} from './components/fieldObjectPopover';
import {enInteractionHint} from './components/interactionHint';
import {enDebugPanel} from './components/debugPanel';
import {enStarterEquipmentPanel} from './components/starterEquipmentPanel';
import {enStatRow} from './components/statRow';
import {enPortraitGallery} from './components/portraitGallery';
import {enDetailPopover} from './components/detailPopover';
import {enToast} from './components/toast';
import {enLogBuilder} from './system/logBuilder';
import {enItemMapper} from './system/itemMapper';
import {enStatNames} from './system/statNames';
import {enEnemyMapper} from './system/enemyMapper';
import {enAnimation} from './system/animation';
import {enGameSession} from './system/gameSession';
import {enActionValidations} from './system/actionValidations';
import {enEntityNames} from './system/entityNames';
import {enMapObjects} from './system/mapObjects';

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
    relicsPanel: enRelicsPanel,
    itemDetail: enItemDetail,
    equipmentPanel: enEquipmentPanel,
    skillsPanel: enSkillsPanel,
    relicChoice: enRelicChoice,
    effectsPanel: enEffectsPanel,
    endingMetrics: enEndingMetrics,
    endingActions: enEndingActions,
    bossList: enBossList,
    consumables: enConsumables,
    metaFooter: enMetaFooter,
    hotbar: enHotbar,
    gameField: enGameField,
    fieldObjectPopover: enFieldObjectPopover,
    interactionHint: enInteractionHint,
    debugPanel: enDebugPanel,
    starterEquipmentPanel: enStarterEquipmentPanel,
    statRow: enStatRow,
    portraitGallery: enPortraitGallery,
    detailPopover: enDetailPopover,
    toast: enToast,
  },
  system: {
    logBuilder: enLogBuilder,
    itemMapper: enItemMapper,
    statNames: enStatNames,
    enemyMapper: enEnemyMapper,
    animation: enAnimation,
    gameSession: enGameSession,
    actionValidations: enActionValidations,
    entityNames: enEntityNames,
    mapObjects: enMapObjects,
  },
};
