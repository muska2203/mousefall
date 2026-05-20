// @ts-nocheck
/**
 * Zustand-стор игры.
 *
 * Мост между слоем симуляции и React UI.
 *
 * Ответственность:
 * - Хранить текущий GameState
 * - Хранить ожидающие доменные события (для анимаций/обратной связи UI)
 * - Предоставлять действия, вызывающие функции симуляции и обновляющие состояние
 * - Предоставлять действия сохранения/загрузки
 *
 * Правила:
 * - Стор НИКОГДА не содержит игровую логику — делегирует в simulation/
 * - Стор НИКОГДА не мутирует GameState напрямую — это делают функции симуляции
 * - Рендерер читает из стора (только чтение)
 * - UI отправляет действия в стор
 * - События очищаются после того, как UI их обработал
 *
 * Компромисс: Zustand vs. Redux
 * - Zustand: меньше шаблонного кода, проще для соло-разработки, нет разделения action/reducer
 * - Redux: лучшие devtools, time-travel debugging, более структурировано
 * - Решение: Zustand подходит для этого масштаба; добавить Redux, если вырастет команда
 */

import { create } from 'zustand';
import type { GameState, GameEvent } from '../simulation/types';
import { createNewGameState } from '../simulation/state';
import { processPlayerMove, processPlayerWait, processPlayerUseItem } from '../simulation/turn';
import { serialize, deserialize } from '../simulation/serialization';
import { SAVE_KEY_PREFIX, AUTOSAVE_SLOT } from '../utils/constants';

// ─────────────────────────────────────────────
// Форма стора
// ─────────────────────────────────────────────

export type GameStoreState = {
  /** Текущее игровое состояние. Null до начала игры. */
  gameState: GameState | null;

  /** Доменные события от последнего шага симуляции. Потребляются UI для анимаций. */
  pendingEvents: GameEvent[];

  /** Загружается ли контент в данный момент. */
  isLoading: boolean;

  /** Сообщение об ошибке, если что-то пошло не так. */
  error: string | null;
};

export type GameStoreActions = {
  /** Начать новую игру с опциональным сидом. */
  startNewGame: (seed?: number) => void;

  /** Обработать действие перемещения игрока. */
  movePlayer: (dx: number, dy: number) => void;

  meleeAttack: (dx: number, dy: number) => void;

  /** Обработать действие ожидания игрока. */
  waitPlayer: () => void;

  /** Использовать предмет из инвентаря игрока. */
  useItem: (itemInstanceId: string) => void;

  /** Очистить ожидающие события после их обработки UI. */
  clearEvents: () => void;

  /** Сохранить текущую игру в слот. */
  saveGame: (slot?: number) => void;

  /** Загрузить игру из слота. */
  loadGame: (slot?: number) => void;

  /** Установить состояние загрузки. */
  setLoading: (loading: boolean) => void;

  /** Установить состояние ошибки. */
  setError: (error: string | null) => void;
};

export type GameStore = GameStoreState & GameStoreActions;

// ─────────────────────────────────────────────
// Реализация стора
// ─────────────────────────────────────────────

// export const useGameStore = create<GameStore>((set, get) => ({
//   // ── Начальное состояние ──────────────────────────────────────────────
//   gameState:     null,
//   pendingEvents: [],
//   isLoading:     false,
//   error:         null,
//
//   // ── Действия ─────────────────────────────────────────────────────────
//
//   startNewGame: (seed?: number) => {
//     const gameState = createNewGameState(seed);
//     // TODO: вызвать generateMap() и применить к состоянию перед установкой
//     set({ gameState, pendingEvents: [], error: null });
//   },
//
//   movePlayer: (dx: number, dy: number) => {
//     const { gameState } = get();
//     if (!gameState) return;
//
//     // Симуляция мутирует состояние на месте и возвращает события
//     const events = processPlayerMove(gameState, dx, dy);
//
//     // Триггер перерисовки созданием новой ссылки
//     set({ gameState: { ...gameState }, pendingEvents: events });
//   },
//
//   waitPlayer: () => {
//     const { gameState } = get();
//     if (!gameState) return;
//
//     const events = processPlayerWait(gameState);
//     set({ gameState: { ...gameState }, pendingEvents: events });
//   },
//
//   useItem: (itemInstanceId: string) => {
//     const { gameState } = get();
//     if (!gameState) return;
//
//     const events = processPlayerUseItem(gameState, itemInstanceId);
//     if (events.length > 0) {
//       set({ gameState: { ...gameState }, pendingEvents: events });
//     }
//   },
//
//   clearEvents: () => {
//     set({ pendingEvents: [] });
//   },
//
//   saveGame: (slot = AUTOSAVE_SLOT) => {
//     const { gameState } = get();
//     if (!gameState) return;
//
//     try {
//       const json = serialize(gameState);
//       localStorage.setItem(`${SAVE_KEY_PREFIX}${slot}`, json);
//     } catch (err) {
//       set({ error: `Failed to save: ${String(err)}` });
//     }
//   },
//
//   loadGame: (slot = AUTOSAVE_SLOT) => {
//     try {
//       const json = localStorage.getItem(`${SAVE_KEY_PREFIX}${slot}`);
//       if (!json) {
//         set({ error: `No save found in slot ${slot}` });
//         return;
//       }
//
//       const gameState = deserialize(json);
//       set({ gameState, pendingEvents: [], error: null });
//     } catch (err) {
//       set({ error: `Failed to load: ${String(err)}` });
//     }
//   },
//
//   setLoading: (isLoading: boolean) => set({ isLoading }),
//
//   setError: (error: string | null) => set({ error }),
// }));
//
// // // ─────────────────────────────────────────────
// // Селекторы (мемоизированные чтения для React-компонентов)
// // ─────────────────────────────────────────────
//
// /** Выбрать сущность игрока. Возвращает null, если игра не активна. */
// export const selectPlayer = (s: GameStore) => s.gameState?.player ?? null;
//
// /** Выбрать всех врагов. Возвращает пустой массив, если игра не активна. */
// export const selectEnemies = (s: GameStore) => s.gameState?.enemies ?? [];
//
// /** Выбрать все предметы на полу. Возвращает пустой массив, если игра не активна. */
// export const selectItems = (s: GameStore) => s.gameState?.items ?? [];
//
// /** Выбрать текущую фазу игры. */
// export const selectPhase = (s: GameStore) => s.gameState?.phase ?? null;
//
// /** Выбрать текущий номер этажа. */
// export const selectFloor = (s: GameStore) => s.gameState?.floor ?? 0;
//
// /** Выбрать ожидающие события. */
// export const selectPendingEvents = (s: GameStore) => s.pendingEvents;
