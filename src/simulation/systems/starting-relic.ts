/**
 * Выдача стартовой реликвии, выбранной на экране создания персонажа.
 *
 * Вызывается ТОЛЬКО из GameSimulation.createNewGame — после applyCharacterConfig
 * (который сбрасывает player.relics) и createStartingEquipment.
 * Выдача идёт через стандартный интент GRANT_RELIC, чтобы модификаторы
 * и правила реликвии регистрировались так же, как при получении в забеге.
 */

import type {GameState, PlayerEntity} from '@simulation/types';
import {tryGetPlayerTemplate} from '@content/registry';
import {ExecutionBuilder} from '@simulation/systems/actions/types';
import {executeIntent} from '@simulation/systems/intents/execute-intent';
import type {CharacterConfig} from '@simulation/characterCreation';

/**
 * Выдаёт игроку стартовую реликвию из конфига создания персонажа.
 *
 * Реликвия выдаётся, только если её ID входит в starterRelicPool выбранного
 * шаблона игрока; чужой или несуществующий ID тихо игнорируется — конфиг
 * приходит из UI, который предлагает только реликвии из валидного пула.
 */
export function grantStarterRelic(
  state: GameState,
  player: PlayerEntity,
  config: CharacterConfig,
): void {
  const relicId = config.starterRelicId;
  if (!relicId) return;

  const pool = tryGetPlayerTemplate(config.templateId)?.starterRelicPool ?? [];
  if (!pool.includes(relicId)) return;

  // Локальный builder для синтетического корневого события (по образцу createStartingEquipment).
  // Сам builder не сохраняется — он нужен только как родитель для интента.
  const builder = new ExecutionBuilder({
    type: 'ACTION_APPLIED', isFieldEvent: false,
    action: { type: 'END_TURN', entityId: player.id },
  });

  executeIntent(
    state,
    {
      type: 'GRANT_RELIC',
      entityId: player.id,
      templateId: relicId,
    },
    builder,
    builder.root,
  );
}
