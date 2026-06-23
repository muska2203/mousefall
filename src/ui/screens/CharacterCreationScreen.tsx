/**
 * Экран создания персонажа.
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel с распределением очков.
 * Центральная: PortraitGallery.
 * Правая: StarterEquipmentPanel, информация, кнопка старта.
 */

import {useState, useCallback, useMemo, useEffect} from 'react';
import { useTranslation } from '@i18n/hooks';
import type {CharacterConfig} from '@presentation/gameSession';
import {GameSession} from '@presentation/gameSession';
import { useSettingsStore } from '@ui/store/settings';
import {ThreeColumnLayout} from '@ui/components/ThreeColumnLayout';
import {HeroPanel} from '@ui/components/HeroPanel';
import type {HeroStat} from '@ui/components/HeroPanel';
import {PortraitGallery} from '@ui/components/PortraitGallery';
import type {PortraitItem} from '@ui/components/PortraitGallery';
import {StarterEquipmentPanel} from '@ui/components/StarterEquipmentPanel';
import type {StarterSlot} from '@ui/components/StarterEquipmentPanel';
import {Panel} from '@ui/components/Panel';

interface Props {
  onStartGame: (config: CharacterConfig, seed: number) => void;
}

const POINTS_BUDGET = 10;

const STARTER_WEAPON_IDS = ['common_splinter_blade', 'common_school_wand'];
const STARTER_ARMOR_IDS = ['common_tin_plate', 'common_patch_cloak'];
const STARTER_AMULET_IDS = ['common_knotted_fang', 'common_glass_bead'];

function getStarterItemInfo(id: string, locale: 'ru' | 'en') {
  return GameSession.getStarterItemInfo(id, locale);
}

export function CharacterCreationScreen({onStartGame}: Props) {
  const { t } = useTranslation('screens');
  const locale = useSettingsStore((s) => s.locale);
  const templates = useMemo(() => {
    try {
      return GameSession.getAvailablePlayerTemplates(locale);
    } catch {
      return [];
    }
  }, [locale]);

  const portraits: PortraitItem[] = useMemo(
    () =>
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        desc: t.description,
        img: t.portraitImg,
      })),
    [templates],
  );

  const firstTemplate = templates[0];
  const firstTemplateId = firstTemplate?.id ?? 'witcher';

  const [selectedTemplateId, setSelectedTemplateId] = useState(firstTemplateId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? firstTemplate;
  const templateBaseStats = selectedTemplate?.baseStats ?? { str: 0, dex: 0, int: 0, vit: 0 };

  const [strength, setStrength] = useState(templateBaseStats.str);
  const [intelligence, setIntelligence] = useState(templateBaseStats.int);
  const [agility, setAgility] = useState(templateBaseStats.dex);
  const [vitality, setVitality] = useState(templateBaseStats.vit);

  // Сбрасываем характеристики к стартовым значениям выбранного шаблона при его смене
  useEffect(() => {
    setStrength(templateBaseStats.str);
    setIntelligence(templateBaseStats.int);
    setAgility(templateBaseStats.dex);
    setVitality(templateBaseStats.vit);
  }, [selectedTemplateId, templateBaseStats.str, templateBaseStats.dex, templateBaseStats.int, templateBaseStats.vit]);

  const [weaponId, setWeaponId] = useState('common_splinter_blade');
  const [armorId, setArmorId] = useState('common_tin_plate');
  const [amuletId, setAmuletId] = useState('common_knotted_fang');
  const [seedInput, setSeedInput] = useState('');

  const currentSum = strength + intelligence + agility + vitality;
  const remaining = POINTS_BUDGET - currentSum;
  const isValid = remaining === 0;

  const selectedPortrait = portraits.find((p) => p.id === selectedTemplateId) ?? portraits[0];

  const previewStats = useMemo(() => {
    try {
      return GameSession.previewCharacterStats({
        templateId: selectedTemplateId,
        attributes: {strength, agility, vitality, intelligence, luck: 0},
        startingEquipment: [weaponId, armorId, amuletId],
      });
    } catch {
      return null;
    }
  }, [selectedTemplateId, strength, agility, vitality, intelligence, weaponId, armorId, amuletId]);

  const handleStart = useCallback(() => {
    if (!isValid) return;

    const config: CharacterConfig = {
      templateId: selectedTemplateId,
      attributes: {strength, agility, vitality, intelligence, luck: 0},
      startingEquipment: [weaponId, armorId, amuletId],
    };

    const parsedSeed = parseInt(seedInput, 10);
    const seed = seedInput && !Number.isNaN(parsedSeed) ? parsedSeed : Date.now() & 0xffffffff;
    onStartGame(config, seed);
  }, [isValid, selectedTemplateId, strength, agility, vitality, intelligence, weaponId, armorId, amuletId, seedInput, onStartGame]);

  const heroStats: HeroStat[] = [
    {
      type: 'alloc',
      icon: '💪',
      name: t('characterCreation.statStrength'),
      value: strength,
      onChange: setStrength,
      canIncrease: remaining > 0,
      min: templateBaseStats.str,
      flavorText: t('characterCreation.statStrengthFlavor'),
      detailLines: [
        t('characterCreation.statStrengthDetail1'),
        t('characterCreation.statStrengthDetail2'),
        t('characterCreation.statStrengthDetail3'),
      ],
    },
    {
      type: 'alloc',
      icon: '✨',
      name: t('characterCreation.statIntelligence'),
      value: intelligence,
      onChange: setIntelligence,
      canIncrease: remaining > 0,
      min: templateBaseStats.int,
      flavorText: t('characterCreation.statIntelligenceFlavor'),
      detailLines: [
        t('characterCreation.statIntelligenceDetail1'),
        t('characterCreation.statIntelligenceDetail2'),
        t('characterCreation.statIntelligenceDetail3'),
      ],
    },
    {
      type: 'alloc',
      icon: '🐾',
      name: t('characterCreation.statDexterity'),
      value: agility,
      onChange: setAgility,
      canIncrease: remaining > 0,
      min: templateBaseStats.dex,
      flavorText: t('characterCreation.statDexterityFlavor'),
      detailLines: [
        t('characterCreation.statDexterityDetail1'),
        t('characterCreation.statDexterityDetail2'),
        t('characterCreation.statDexterityDetail3'),
      ],
    },
    {
      type: 'alloc',
      icon: '❤️',
      name: t('characterCreation.statVitality'),
      value: vitality,
      onChange: setVitality,
      canIncrease: remaining > 0,
      min: templateBaseStats.vit,
      flavorText: t('characterCreation.statVitalityFlavor'),
      detailLines: [
        t('characterCreation.statVitalityDetail1'),
        t('characterCreation.statVitalityDetail2'),
        t('characterCreation.statVitalityDetail3'),
      ],
    },
  ];

  const statAllocHeader = (
    <>
      <div className="cm-welcome-section-title">{t('characterCreation.statsTitle')}</div>
      <div className="cm-welcome-points">
        {t('characterCreation.freePoints')}<span className="cm-welcome-points-val">{remaining}</span>
      </div>
    </>
  );

  const weaponItemsWithDamage = useMemo(() => {
    return STARTER_WEAPON_IDS.map((id) => {
      const base = getStarterItemInfo(id, locale);
      try {
        const stats = GameSession.previewCharacterStats({
          templateId: selectedTemplateId,
          attributes: {strength, agility, vitality, intelligence, luck: 0},
          startingEquipment: [id, armorId, amuletId],
        });
        return {...base, damage: stats.damage};
      } catch {
        return base;
      }
    });
  }, [selectedTemplateId, strength, agility, vitality, intelligence, armorId, amuletId]);

  const starterSlots: StarterSlot[] = [
    {
      label: t('characterCreation.slotWeapon'),
      selectedId: weaponId,
      onSelect: setWeaponId,
      items: weaponItemsWithDamage,
    },
    {
      label: t('characterCreation.slotArmor'),
      selectedId: armorId,
      onSelect: setArmorId,
      items: STARTER_ARMOR_IDS.map((id) => getStarterItemInfo(id, locale)),
    },
    {
      label: t('characterCreation.slotAmulet'),
      selectedId: amuletId,
      onSelect: setAmuletId,
      items: STARTER_AMULET_IDS.map((id) => getStarterItemInfo(id, locale)),
    },
  ];

  const leftColumn = (
    <HeroPanel
      portraitSrc={selectedPortrait?.img ?? '/assets/portraits/witcher-ready.png'}
      portraitAlt={selectedPortrait?.name ?? t('characterCreation.portraitAlt')}
      level={previewStats?.level ?? 1}
      hp={previewStats?.hp ?? 100}
      maxHp={previewStats?.maxHp ?? 100}
      ap={previewStats?.ap}
      maxAp={previewStats?.maxAp}
      stats={heroStats}
    >
      {statAllocHeader}
    </HeroPanel>
  );

  const centerColumn = (
    <Panel title={t('characterCreation.appearanceTitle')} titleId="portrait-title" fill>
      <PortraitGallery portraits={portraits} selectedId={selectedTemplateId} onSelect={setSelectedTemplateId} />
    </Panel>
  );

  const rightColumn = (
    <>
      <StarterEquipmentPanel slots={starterSlots} />

      <Panel title={t('characterCreation.runSettingsTitle')} titleId="params-title">
        <div className="cm-welcome-info-body">
          <label className="cm-welcome-seed-label">
            <span className="cm-welcome-seed-label__text">{t('characterCreation.seedLabel')}</span>
            <input
              className="cm-welcome-seed-input"
              type="text"
              inputMode="numeric"
              placeholder={t('characterCreation.seedPlaceholder')}
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              aria-label={t('characterCreation.seedAriaLabel')}
            />
          </label>
        </div>
      </Panel>

      <Panel title={t('characterCreation.infoTitle')} titleId="info-title">
        <div className="cm-welcome-info-body">
          <button className="cm-btn cm-btn--secondary" type="button" onClick={() => alert(t('characterCreation.hintsAlert'))}>
            {t('characterCreation.hintsButton')}
          </button>
          <button className="cm-btn cm-btn--secondary" type="button" onClick={() => alert(t('characterCreation.devlogAlert'))}>
            Devlog
          </button>
        </div>
      </Panel>

      <div className="cm-welcome-start-wrap">
        <button className="cm-btn cm-btn--primary cm-welcome-start" type="button" onClick={handleStart} disabled={!isValid}>
          {t('characterCreation.startRun')}
        </button>
      </div>
    </>
  );

  return (
    <ThreeColumnLayout
      variant="default"
      left={leftColumn}
      center={centerColumn}
      right={rightColumn}
    />
  );
}
