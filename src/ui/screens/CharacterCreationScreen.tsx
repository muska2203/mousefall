/**
 * Экран создания персонажа.
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel с распределением очков.
 * Центральная: PortraitGallery.
 * Правая: StarterEquipmentPanel, информация, кнопка старта.
 */

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from '@i18n/hooks';
import type {CharacterConfig} from '@presentation/gameSession';
import {GameSession} from '@presentation/gameSession';
import type {ToastItem} from '@presentation/types';
import {useSettingsStore} from '@ui/store/settings';
import {ThreeColumnLayout} from '@ui/components/ThreeColumnLayout';
import type {HeroStat} from '@ui/components/HeroPanel';
import {HeroPanel} from '@ui/components/HeroPanel';
import type {PortraitItem} from '@ui/components/PortraitGallery';
import {PortraitGallery} from '@ui/components/PortraitGallery';
import type {StarterSlot} from '@ui/components/StarterEquipmentPanel';
import {StarterEquipmentPanel} from '@ui/components/StarterEquipmentPanel';
import {Panel} from '@ui/components/Panel';
import {ToastContainer} from '@ui/components/ToastContainer';

interface Props {
  onStartGame: (config: CharacterConfig, seed: number) => void;
}

function getStarterItemInfo(id: string, locale: 'ru' | 'en') {
  return GameSession.getStarterItemInfo(id, locale);
}

export function CharacterCreationScreen({onStartGame}: Props) {
  const { t } = useTranslation('screens');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
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
  const firstTemplateId = firstTemplate?.id ?? GameSession.getDefaultPlayerTemplateId(locale);

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

  const starterEquipment = useMemo(
    () => GameSession.getStarterEquipmentIds(selectedTemplateId),
    [selectedTemplateId],
  );

  const [weaponId, setWeaponId] = useState(starterEquipment.weapon[0] ?? '');
  const [armorId, setArmorId] = useState(starterEquipment.armor[0] ?? '');
  const [amuletId, setAmuletId] = useState(starterEquipment.amulet[0] ?? '');
  const [seedInput, setSeedInput] = useState('');

  // Сбрасываем выбранное снаряжение на первое доступное при смене шаблона
  useEffect(() => {
    setWeaponId(starterEquipment.weapon[0] ?? '');
    setArmorId(starterEquipment.armor[0] ?? '');
    setAmuletId(starterEquipment.amulet[0] ?? '');
  }, [starterEquipment]);

  const currentSum = strength + intelligence + agility + vitality;
  const remaining = GameSession.getAttributePointsBudget() - currentSum;
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

  const showInfoToast = useCallback(
    (message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((prev) => [
        ...prev,
        {id, kind: 'info', title: t('characterCreation.infoTitle'), message, duration: 3000},
      ]);
    },
    [t],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const heroStats: HeroStat[] = [
    {
      type: 'alloc',
      icon: GameSession.resolveStatIcon('str'),
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
      icon: GameSession.resolveStatIcon('int'),
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
      icon: GameSession.resolveStatIcon('dex'),
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
      icon: GameSession.resolveStatIcon('vit'),
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
    return starterEquipment.weapon.map((id) => {
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
  }, [selectedTemplateId, starterEquipment.weapon, strength, agility, vitality, intelligence, armorId, amuletId, locale]);

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
      items: starterEquipment.armor.map((id) => getStarterItemInfo(id, locale)),
    },
    {
      label: t('characterCreation.slotAmulet'),
      selectedId: amuletId,
      onSelect: setAmuletId,
      items: starterEquipment.amulet.map((id) => getStarterItemInfo(id, locale)),
    },
  ];

  const leftColumn = (
    <HeroPanel
      portraitSrc={GameSession.getPlayerPortraitSrc(selectedTemplateId)}
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
          <button className="cm-btn cm-btn--secondary" type="button" onClick={() => showInfoToast(t('characterCreation.hintsAlert'))}>
            {t('characterCreation.hintsButton')}
          </button>
          <button className="cm-btn cm-btn--secondary" type="button" onClick={() => showInfoToast(t('characterCreation.devlogAlert'))}>
            {t('characterCreation.devlogButton')}
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
    <>
      <ThreeColumnLayout
        variant="default"
        left={leftColumn}
        center={centerColumn}
        right={rightColumn}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
