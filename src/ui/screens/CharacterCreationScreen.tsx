/**
 * Экран создания персонажа.
 *
 * Состоит из трёх колонок через ThreeColumnLayout.
 * Левая: HeroPanel с распределением очков.
 * Центральная: PortraitGallery.
 * Правая: StarterEquipmentPanel, информация, кнопка старта.
 */

import {useState, useCallback} from 'react';
import type {CharacterConfig} from '@presentation/gameSession';
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

const PORTRAITS: PortraitItem[] = [
  {
    id: 'witcher',
    name: 'Белый Хвост',
    desc: 'Охотник на чудовищ и мечник-алхимик.',
    img: '/assets/portraits/witcher-ready.png',
  },
  {
    id: 'halfling-mage',
    name: 'Сырный Мерлин',
    desc: 'Хитрый заклинатель, обращающий сыр в ману.',
    img: '/assets/portraits/halfling-mage-ready.png',
  },
  {
    id: 'paladin',
    name: 'Сир Чеддар',
    desc: 'Благородный рыцарь Сырного Ордена.',
    img: '/assets/portraits/paladin-ready.png',
  },
  {
    id: 'elven-ranger',
    name: 'Тонкоух',
    desc: 'Лучник из глубин Сырных Лесов.',
    img: '/assets/portraits/elven-ranger-ready.png',
  },
  {
    id: 'orc-barbarian',
    name: 'Клыкохвост',
    desc: 'Яростный воин с сырными клыками.',
    img: '/assets/portraits/orc-barbarian-ready.png',
  },
  {
    id: 'samurai',
    name: 'Усатый Сэнсэй',
    desc: 'Мастер сырного клинка.',
    img: '/assets/portraits/samurai-ready.png',
  },
  {
    id: 'necromancer',
    name: 'Мышь-Косторез',
    desc: 'Тёмный некромант, повелитель плесени.',
    img: '/assets/portraits/necromancer-ready.png',
  },
];

const STARTER_SLOTS: Omit<StarterSlot, 'selectedId' | 'onSelect'>[] = [
  {
    label: 'Оружие',
    items: [
      {
        id: 'common_splinter_blade',
        name: 'Ржавый сырорез',
        icon: '/assets/items/common_splinter_blade.png',
        fallback: '🗡',
        damage: 4,
      },
      {
        id: 'common_school_wand',
        name: 'Треснувшая спица',
        icon: '/assets/items/common_school_wand.png',
        fallback: '🪄',
        damage: 2,
      },
    ],
  },
  {
    label: 'Броня',
    items: [
      {
        id: 'common_tin_plate',
        name: 'Жестяная кираса',
        icon: '/assets/items/common_tin_plate.png',
        fallback: '🥋',
      },
      {
        id: 'common_patch_cloak',
        name: 'Потёртый плащ пыльника',
        icon: '/assets/items/common_patch_cloak.png',
        fallback: '👘',
      },
    ],
  },
  {
    label: 'Амулет',
    items: [
      {
        id: 'common_knotted_fang',
        name: 'Кривой клык',
        icon: '/assets/items/common_knotted_fang.png',
        fallback: '🦷',
      },
      {
        id: 'common_glass_bead',
        name: 'Тусклая бусина',
        icon: '/assets/items/common_glass_bead.png',
        fallback: '🧿',
      },
    ],
  },
];

const FIRST_PORTRAIT = PORTRAITS[0] ?? {id: 'witcher', name: 'Белый Хвост', desc: '', img: '/assets/portraits/witcher-ready.png'};

export function CharacterCreationScreen({onStartGame}: Props) {
  const [portraitId, setPortraitId] = useState('witcher');
  const [strength, setStrength] = useState(0);
  const [intelligence, setIntelligence] = useState(0);
  const [agility, setAgility] = useState(0);
  const [luck, setLuck] = useState(0);
  const [weaponId, setWeaponId] = useState('common_splinter_blade');
  const [armorId, setArmorId] = useState('common_tin_plate');
  const [amuletId, setAmuletId] = useState('common_knotted_fang');
  const [seedInput, setSeedInput] = useState('');

  const spent = strength + intelligence + agility + luck;
  const remaining = POINTS_BUDGET - spent;
  // Все стартовые слоты имеют дефолтные значения, поэтому проверка на непустость избыточна
  const isValid = remaining === 0;

  const selectedPortrait = PORTRAITS.find((p) => p.id === portraitId) ?? FIRST_PORTRAIT;

  const handleStart = useCallback(() => {
    if (!isValid) return;

    const config: CharacterConfig = {
      classId: portraitId,
      // TODO: добавить распределение очков vitality в UI
      attributes: {strength, agility, vitality: 0, intelligence, luck},
      startingEquipment: [weaponId, armorId, amuletId],
      portraitId,
    };

    const parsedSeed = parseInt(seedInput, 10);
    const seed = seedInput && !Number.isNaN(parsedSeed) ? parsedSeed : Date.now() & 0xffffffff;
    onStartGame(config, seed);
  }, [isValid, portraitId, strength, agility, intelligence, luck, weaponId, armorId, amuletId, seedInput, onStartGame]);

  const heroStats: HeroStat[] = [
    {type: 'alloc', icon: '💪', name: 'Сила', value: strength, onChange: setStrength, canIncrease: remaining > 0},
    {type: 'alloc', icon: '✨', name: 'Интеллект', value: intelligence, onChange: setIntelligence, canIncrease: remaining > 0},
    {type: 'alloc', icon: '🐾', name: 'Ловкость', value: agility, onChange: setAgility, canIncrease: remaining > 0},
    {type: 'alloc', icon: '🍀', name: 'Удача', value: luck, onChange: setLuck, canIncrease: remaining > 0},
    {type: 'readonly', icon: '🎯', name: 'Крит шанс', value: '5%'},
    {type: 'readonly', icon: '💥', name: 'Крит x', value: '1.5x'},
  ];

  const statAllocHeader = (
    <>
      <div className="cm-welcome-section-title">Распределение очков</div>
      <div className="cm-welcome-points">
        Свободно очков: <span className="cm-welcome-points-val">{remaining}</span>
      </div>
    </>
  );

  const starterSlots: StarterSlot[] = [
    {...STARTER_SLOTS[0] as StarterSlot, selectedId: weaponId, onSelect: setWeaponId},
    {...STARTER_SLOTS[1] as StarterSlot, selectedId: armorId, onSelect: setArmorId},
    {...STARTER_SLOTS[2] as StarterSlot, selectedId: amuletId, onSelect: setAmuletId},
  ];

  const leftColumn = (
    <HeroPanel
      portraitSrc={selectedPortrait.img}
      portraitAlt={selectedPortrait.name}
      level={1}
      hp={100}
      maxHp={100}
      mana={30}
      maxMana={30}
      stats={heroStats}
    >
      {statAllocHeader}
    </HeroPanel>
  );

  const centerColumn = (
    <Panel title="Выбор внешности" titleId="portrait-title" fill>
      <PortraitGallery portraits={PORTRAITS} selectedId={portraitId} onSelect={setPortraitId} />
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
