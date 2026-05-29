/**
 * Экран создания персонажа.
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel с распределением очков.
 * Центральная: PortraitGallery.
 * Правая: StarterEquipmentPanel, информация, кнопка старта.
 */

import {useState, useCallback, useMemo} from 'react';
import type {CharacterConfig} from '@presentation/gameSession';
import {GameSession} from '@presentation/gameSession';
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

function getStarterItemInfo(id: string) {
  return GameSession.getStarterItemInfo(id);
}

export function CharacterCreationScreen({onStartGame}: Props) {
  const templates = useMemo(() => {
    try {
      return GameSession.getAvailablePlayerTemplates();
    } catch {
      return [];
    }
  }, []);

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

  const firstTemplateId = templates[0]?.id ?? 'witcher';

  const [selectedTemplateId, setSelectedTemplateId] = useState(firstTemplateId);
  const [strength, setStrength] = useState(0);
  const [intelligence, setIntelligence] = useState(0);
  const [agility, setAgility] = useState(0);
  const [vitality, setVitality] = useState(0);
  const [weaponId, setWeaponId] = useState('common_splinter_blade');
  const [armorId, setArmorId] = useState('common_tin_plate');
  const [amuletId, setAmuletId] = useState('common_knotted_fang');
  const [seedInput, setSeedInput] = useState('');

  const spent = strength + intelligence + agility + vitality;
  const remaining = POINTS_BUDGET - spent;
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
      name: 'Сила',
      value: strength,
      onChange: setStrength,
      canIncrease: remaining > 0,
      flavorText: 'Грубая сила — лучший аргумент в споре.',
      detailLines: [
        'Увеличивает физический урон от оружия.',
        'Влияет на шанс пробить броню врага.',
        'Немного увеличивает максимальный переносимый вес.',
      ],
    },
    {
      type: 'alloc',
      icon: '✨',
      name: 'Интеллект',
      value: intelligence,
      onChange: setIntelligence,
      canIncrease: remaining > 0,
      flavorText: 'Знания — сила, но молния из пальцев тоже ничего.',
      detailLines: [
        'Усиливает магические способности и заклинания.',
        'Увеличивает максимальный запас маны.',
        'Повышает шанс критического удара умениями.',
      ],
    },
    {
      type: 'alloc',
      icon: '🐾',
      name: 'Ловкость',
      value: agility,
      onChange: setAgility,
      canIncrease: remaining > 0,
      flavorText: 'Быстрее ветра, тише тени, злее бабушки с тапком.',
      detailLines: [
        'Повышает шанс уклонения от атак.',
        'Увеличивает точность и шанс критического попадания.',
        'Влияет на скорость передвижения по полю боя.',
      ],
    },
    {
      type: 'alloc',
      icon: '❤️',
      name: 'Выносливость',
      value: vitality,
      onChange: setVitality,
      canIncrease: remaining > 0,
      flavorText: 'Жить — значит терпеть. И есть побольше.',
      detailLines: [
        'Увеличивает максимальное здоровье (HP).',
        'Повышает сопротивление отрицательным эффектам.',
        'Улучшает восстановление здоровья между боями.',
      ],
    },
  ];

  const statAllocHeader = (
    <>
      <div className="cm-welcome-section-title">Распределение очков</div>
      <div className="cm-welcome-points">
        Свободно очков: <span className="cm-welcome-points-val">{remaining}</span>
      </div>
    </>
  );

  const weaponItemsWithDamage = useMemo(() => {
    return STARTER_WEAPON_IDS.map((id) => {
      const base = getStarterItemInfo(id);
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
      label: 'Оружие',
      selectedId: weaponId,
      onSelect: setWeaponId,
      items: weaponItemsWithDamage,
    },
    {
      label: 'Броня',
      selectedId: armorId,
      onSelect: setArmorId,
      items: STARTER_ARMOR_IDS.map(getStarterItemInfo),
    },
    {
      label: 'Амулет',
      selectedId: amuletId,
      onSelect: setAmuletId,
      items: STARTER_AMULET_IDS.map(getStarterItemInfo),
    },
  ];

  const leftColumn = (
    <HeroPanel
      portraitSrc={selectedPortrait?.img ?? '/assets/portraits/witcher-ready.png'}
      portraitAlt={selectedPortrait?.name ?? 'Герой'}
      level={previewStats?.level ?? 1}
      hp={previewStats?.hp ?? 100}
      maxHp={previewStats?.maxHp ?? 100}
      stats={heroStats}
    >
      {statAllocHeader}
    </HeroPanel>
  );

  const centerColumn = (
    <Panel title="Выбор внешности" titleId="portrait-title" fill>
      <PortraitGallery portraits={portraits} selectedId={selectedTemplateId} onSelect={setSelectedTemplateId} />
    </Panel>
  );

  const rightColumn = (
    <>
      <StarterEquipmentPanel slots={starterSlots} />

      <Panel title="Параметры забега" titleId="params-title">
        <div className="cm-welcome-info-body">
          <label className="cm-welcome-seed-label">
            <span className="cm-welcome-seed-label__text">Сид карты</span>
            <input
              className="cm-welcome-seed-input"
              type="text"
              inputMode="numeric"
              placeholder="Случайный"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              aria-label="Сид карты (число). Оставьте пустым для случайного."
            />
          </label>
        </div>
      </Panel>

      <Panel title="Информация" titleId="info-title">
        <div className="cm-welcome-info-body">
          <button className="cm-btn cm-btn--secondary" type="button" onClick={() => alert('Подсказки по игре — в разработке')}>
            Подсказки по игре
          </button>
          <button className="cm-btn cm-btn--secondary" type="button" onClick={() => alert('Devlog — в разработке')}>
            Devlog
          </button>
        </div>
      </Panel>

      <div className="cm-welcome-start-wrap">
        <button className="cm-btn cm-btn--primary cm-welcome-start" type="button" onClick={handleStart} disabled={!isValid}>
          Начать забег
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
