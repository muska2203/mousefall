import type {ScreensEndingTranslations} from '@i18n/schema';

export const ruEnding = {
  heroCardTitle: 'Карточка героя',
  equipmentTitle: 'Снаряжение',
  duration: 'Длительность',
  turns: 'Ходов',
  enemiesKilled: 'Убито противников',
  maxFloorReached: 'Достигнут уровень лабиринта',
  chestsOpened: 'Открыто сундуков',
  itemsCollected: 'Подобрано предметов',
  victorySubtitle: 'Все противники повержены, забег завершен успешно.',
  defeatSubtitle: 'HP опустилось до нуля, забег завершен.',
  unknownBoss: 'Неизвестный босс',
  statStrength: 'Сила',
  statIntelligence: 'Интеллект',
  statDexterity: 'Ловкость',
  statVitality: 'Выносливость',
  slotWeapon: 'Оружие',
  slotArmor: 'Броня',
  slotAmulet: 'Амулет',
} as const satisfies ScreensEndingTranslations;
