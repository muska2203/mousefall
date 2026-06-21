/**
 * Debug-панель для тестирования.
 *
 * Рендерится через createPortal в document.body, чтобы гарантированно
 * находиться поверх игрового поля и не конфликтовать с PixiJS canvas.
 * Доступна только в dev-сборке.
 */

import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from '@i18n/hooks';
import {GameSession} from '@presentation/gameSession';

export type SpawnType = 'item' | 'enemy' | 'door' | 'stairs';

type TilePosition = {
  x: number;
  y: number;
};

interface Props {
  session: GameSession;
  hoveredTile: TilePosition | null;
  playerPosition: TilePosition;
  pendingSpawn: {spawnType: SpawnType; templateId: string} | null;
  onRequestSpawn: (spawnType: SpawnType, templateId: string) => void;
  onCancelSpawn: () => void;
}

const ITEM_TYPE_ORDER: Record<string, number> = {
  weapon: 0,
  armor: 1,
  amulet: 2,
  consumable: 3,
  key: 4,
  gold: 5,
};

export function DebugPanel({
  session,
  hoveredTile,
  playerPosition,
  pendingSpawn,
  onRequestSpawn,
  onCancelSpawn,
}: Props) {
  const {t} = useTranslation('components');
  const locale = session.getLocale();

  const items = useMemo(() => GameSession.getAllItems(locale), [locale]);
  const entities = useMemo(() => GameSession.getAllEntities(locale), [locale]);
  const doors = useMemo(() => GameSession.getAllDoors(locale), [locale]);
  const stairs = useMemo(() => GameSession.getAllStairs(locale), [locale]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const orderA = ITEM_TYPE_ORDER[a.type] ?? 99;
      const orderB = ITEM_TYPE_ORDER[b.type] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const [spawnType, setSpawnType] = useState<SpawnType>('item');

  const spawnTemplates = useMemo(() => {
    switch (spawnType) {
      case 'item':
        return items;
      case 'enemy':
        return entities;
      case 'door':
        return doors;
      case 'stairs':
        return stairs;
    }
  }, [spawnType, items, entities, doors, stairs]);

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [spawnTemplateId, setSpawnTemplateId] = useState<string>('');

  useEffect(() => {
    setSelectedItemId(prev => sortedItems.find(i => i.id === prev)?.id ?? sortedItems[0]?.id ?? '');
  }, [sortedItems]);

  useEffect(() => {
    setSpawnTemplateId(prev => spawnTemplates.find(t => t.id === prev)?.id ?? spawnTemplates[0]?.id ?? '');
  }, [spawnTemplates]);

  const handleSpawnTypeChange = (type: SpawnType) => {
    setSpawnType(type);
  };

  const handleAddItem = () => {
    if (!selectedItemId) return;
    session.debugAddItem(selectedItemId);
  };

  const handleSpawn = () => {
    if (!spawnTemplateId) return;
    onRequestSpawn(spawnType, spawnTemplateId);
  };

  const spawnTypeLabels: Record<SpawnType, string> = {
    item: t('debugPanel.spawnTypeItem'),
    enemy: t('debugPanel.spawnTypeEnemy'),
    door: t('debugPanel.spawnTypeDoor'),
    stairs: t('debugPanel.spawnTypeStairs'),
  };

  const panel = (
    <div
      className="cm-debug-panel"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="cm-debug-panel__title">{t('debugPanel.title')}</h3>

      <div className="cm-debug-panel__section">
        <label className="cm-debug-panel__label">{t('debugPanel.giveItemLabel')}</label>
        <select
          className="cm-debug-panel__select"
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
        >
          {sortedItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.type})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="cm-debug-panel__button"
          onClick={handleAddItem}
        >
          {t('debugPanel.addToInventoryButton')}
        </button>
      </div>

      <div className="cm-debug-panel__section">
        <label className="cm-debug-panel__label">{t('debugPanel.spawnObjectLabel')}</label>
        <select
          className="cm-debug-panel__select"
          value={spawnType}
          onChange={(e) => handleSpawnTypeChange(e.target.value as SpawnType)}
          disabled={pendingSpawn !== null}
        >
          {(Object.keys(spawnTypeLabels) as SpawnType[]).map((type) => (
            <option key={type} value={type}>
              {spawnTypeLabels[type]}
            </option>
          ))}
        </select>

        <select
          className="cm-debug-panel__select"
          value={spawnTemplateId}
          onChange={(e) => setSpawnTemplateId(e.target.value)}
          disabled={pendingSpawn !== null}
        >
          {spawnTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>

        {pendingSpawn ? (
          <div className="cm-debug-panel__hint">
            {t('debugPanel.selectTileHint')}
          </div>
        ) : null}

        <button
          type="button"
          className="cm-debug-panel__button"
          onClick={handleSpawn}
          disabled={pendingSpawn !== null}
        >
          {pendingSpawn ? t('debugPanel.spawnButtonPending') : t('debugPanel.spawnButtonIdle')}
        </button>
        {pendingSpawn ? (
          <button
            type="button"
            className="cm-debug-panel__button"
            onClick={onCancelSpawn}
          >
            {t('debugPanel.cancelButton')}
          </button>
        ) : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
