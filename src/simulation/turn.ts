// /**
//  * Оркестрация ходов.
//  *
//  * Это главная точка входа для обработки действия игрока.
//  * Координирует: действие игрока → ход ИИ → очистку состояния.
//  *
//  * Правила:
//  * - Этот модуль НЕ реализует игровую логику — делегирует в systems/
//  * - Собирает все события от всех систем и возвращает их вместе
//  * - Управляет переходами фаз хода
//  */
//
// import type { GameState, GameEvent } from './types';
// import { moveEntity } from './systems/movement';
// import { processAllEnemies } from './ai/index';
//
// // ─────────────────────────────────────────────
// // Действия игрока
// // ─────────────────────────────────────────────
//
// /**
//  * Обработать действие перемещения игрока.
//  * Если перемещение валидно, переключает на ход ИИ и обрабатывает всех врагов.
//  * Возвращает все события за полный ход (игрок + ИИ).
//  */
// // TODO: Переименовать в processPlayerAction, чтобы принимал экшн, параметры и определял handler. После выполнения action проверять, остались ли ещё ходы у персонажа, и вызывать ИИ, если нет.
// // TODO: Убрать изменение хода из moveEntity.
// // TODO: Этот processPlayerAction должен вернуть граф действия персонажа и, возможно, список графов действий окружения.
// // export function executeTurn(state: GameState) {
// //   const builder = new ExecutionBuilder();
//
// //   executePlayerAction(state, builder);
// //   executeEnemyActions(state, builder);
// //   executeEnvironment(state, builder);
//
// //   return builder.build();
// // }
// // class ExecutionBuilder {
// //   roots: ExecutionNode[] = [];
//
// //   addRoot(event: GameEvent): ExecutionNode {
// //     const node = {
// //       event,
// //       children: [],
// //     };
//
// //     this.roots.push(node);
//
// //     return node;
// //   }
//
// //   addChild(
// //     parent: ExecutionNode,
// //     event: GameEvent,
// //   ): ExecutionNode {
//
// //     const node = {
// //       event,
// //       children: [],
// //     };
//
// //     parent.children.push(node);
//
// //     return node;
// //   }
// // }
//
// // type ExecutionNode = {
// //   event: GameEvent;
// //   children: ExecutionNode[];
// // };
// export function processPlayerMove(
//   state: GameState,
//   dx: number,
//   dy: number,
// ): GameEvent[] {
//
//   if (state.turn !== 'player' || state.phase !== 'playing') {
//     return [];
//   }
//
//   const events: GameEvent[] = [];
//
//   // Player acts
//   const moveEvents = moveEntity(state, state.player.id, dx, dy);
//   events.push(...moveEvents);
//
//   // If player turn ended (move was valid), process AI
//   if ((state.turn as GameState['turn']) === 'ai') {
//     const aiEvents = processAllEnemies(state);
//     events.push(...aiEvents);
//     // AI turn ends, return to player
//     state.turn = 'player';
//     state.turnNumber += 1;
//     events.push({ type: 'TURN_ENDED', turnNumber: state.turnNumber });
//   }
//
//   return events;
// }
//
// /**
//  * Обработать действие ожидания игрока (пропуск хода).
//  * Всегда завершает ход игрока и запускает ИИ.
//  */
// export function processPlayerWait(state: GameState): GameEvent[] {
//   if (state.turn !== 'player' || state.phase !== 'playing') return [];
//
//   const events: GameEvent[] = [];
//
//   state.turn = 'ai';
//
//   const aiEvents = processAllEnemies(state);
//   events.push(...aiEvents);
//
//   state.turn = 'player';
//   state.turnNumber += 1;
//   events.push({ type: 'TURN_ENDED', turnNumber: state.turnNumber });
//
//   return events;
// }
//
// /**
//  * Обработать действие использования предмета игроком.
//  * Завершает ход игрока, если предмет был успешно использован.
//  */
// export function processPlayerUseItem(
//   state: GameState,
//   itemInstanceId: string,
// ): GameEvent[] {
//   if (state.turn !== 'player' || state.phase !== 'playing') return [];
//
//   // TODO: implement in inventory system
//   // const events = useItem(state, state.player.id, itemInstanceId);
//   // if (events.length > 0) { ... process AI turn ... }
//   return [];
// }
