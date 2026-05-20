// /**
//  * Сериализация сохранения/загрузки.
//  *
//  * Преобразует GameState в/из JSON-строк для персистентности.
//  * Валидирует при загрузке с помощью Zod-схем.
//  *
//  * Правила:
//  * - serialize() никогда не выбрасывает исключений
//  * - deserialize() выбрасывает SaveVersionError или SaveCorruptError при неудаче
//  * - Состояние RNG всегда сохраняется (критично для детерминизма)
//  * - savedAt — только метаданные, никогда не используется в симуляции
//  */
//
// import type { GameState } from './types';
// import { SaveFileSchema } from './schemas/saveSchemas';
// import type { SaveFile } from './schemas/saveSchemas';
// import { SAVE_VERSION } from '../utils/constants';
//
// // ─────────────────────────────────────────────
// // Ошибки
// // ─────────────────────────────────────────────
//
// export class SaveVersionError extends Error {
//   constructor(public readonly found: number, public readonly expected: number) {
//     super(`Save version mismatch: found v${found}, expected v${expected}`);
//     this.name = 'SaveVersionError';
//   }
// }
//
// export class SaveCorruptError extends Error {
//   constructor(details: string) {
//     super(`Save file is corrupt: ${details}`);
//     this.name = 'SaveCorruptError';
//   }
// }
//
// // ─────────────────────────────────────────────
// // Сериализация
// // ─────────────────────────────────────────────
//
// /**
//  * Сериализует GameState в JSON-строку.
//  * Оборачивает состояние в конверт SaveFile с метаданными.
//  */
// export function serialize(gameState: GameState): string {
//
//   // Конвертация Map → массив кортежей для JSON
//   const serializedGameState = {
//     ...gameState,
//
//     entities: Array.from(
//         gameState.entities.entries(),
//     ),
//   };
//
//   const saveFile: SaveFile = {
//     version: SAVE_VERSION,
//
//     savedAt: new Date().toISOString(),
//
//     floorNumber: gameState.floor,
//
//     turnNumber: gameState.turn.,
//
//     gameState: serializedGameState,
//   };
//
//   return JSON.stringify(saveFile);
// }
//
// // ─────────────────────────────────────────────
// // Десериализация
// // ─────────────────────────────────────────────
//
// /**
//  * Десериализует JSON-строку обратно в GameState.
//  *
//  * @throws SaveVersionError, если версия сохранения не совпадает
//  * @throws SaveCorruptError, если JSON невалиден или схема не прошла валидацию
//  */
// export function deserialize(json: string): GameState {
//   let raw: unknown;
//
//   try {
//     raw = JSON.parse(json);
//   } catch {
//     throw new SaveCorruptError('Invalid JSON');
//   }
//
//   if (typeof raw !== 'object' || raw === null) {
//     throw new SaveCorruptError(
//         'Root value is not an object',
//     );
//   }
//
//   const rawObj = raw as Record<string, unknown>;
//
//   // Проверка версии перед полной валидацией
//   const version = rawObj['version'];
//
//   if (typeof version !== 'number') {
//     throw new SaveCorruptError(
//         'Missing version field',
//     );
//   }
//
//   if (version !== SAVE_VERSION) {
//     const migrated = migrateIfNeeded(
//         rawObj,
//         version,
//     );
//
//     return validateAndExtract(migrated);
//   }
//
//   return validateAndExtract(rawObj);
// }
//
// // ─────────────────────────────────────────────
// // Валидация + извлечение
// // ─────────────────────────────────────────────
//
// function validateAndExtract(
//     raw: unknown,
// ): GameState {
//
//   const parsed = SaveFileSchema.safeParse(raw);
//
//   if (!parsed.success) {
//
//     const issues = parsed.error.issues
//         .map(issue =>
//             `${issue.path.join('.')}: ${issue.message}`,
//         )
//         .join('\n');
//
//     throw new SaveCorruptError(
//         `Schema validation failed:\n${issues}`,
//     );
//   }
//
//   const serializedState = parsed.data.gameState;
//
//   // Конвертация массива кортежей → Map
//   return {
//     ...serializedState,
//
//     entities: new Map(
//         serializedState.entities,
//     ),
//   };
// }
//
// // ─────────────────────────────────────────────
// // Миграция
// // ─────────────────────────────────────────────
//
// type MigrationFn = (state: Record<string, unknown>) => Record<string, unknown>;
//
// /**
//  * Таблица миграций версий.
//  * Добавляйте записи при увеличении SAVE_VERSION.
//  *
//  * Ключ = целевая версия (версия, К которой мигрируем).
//  * Значение = функция миграции, преобразующая данные предыдущей версии.
//  */
// const migrations: Record<number, MigrationFn> = {
//   // Example:
//   // 2: (v1) => ({ ...v1, gameState: { ...v1.gameState, newField: defaultValue } }),
// };
//
// function migrateIfNeeded(
//   raw: Record<string, unknown>,
//   fromVersion: number,
// ): Record<string, unknown> {
//   let current = raw;
//   let version = fromVersion;
//
//   while (version < SAVE_VERSION) {
//     const nextVersion = version + 1;
//     const migrate = migrations[nextVersion];
//
//     if (!migrate) {
//       throw new SaveVersionError(fromVersion, SAVE_VERSION);
//     }
//
//     current = migrate(current);
//     version = nextVersion;
//   }
//
//   return current;
// }
