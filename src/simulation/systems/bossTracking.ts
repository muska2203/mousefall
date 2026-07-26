/**
 * Трекинг боссов в Simulation.
 *
 * Пока в контенте нет настоящих боссов, здесь хранится захардкоженный список
 * шаблонов, которые Simulation считает боссами. При убийстве врага с таким
 * templateId его ID добавляется в runStats.defeatedBossIds.
 *
 * Когда боссы появятся в Content, этот список следует заменить на флаг
 * `isBoss` в шаблоне сущности или на чтение из Content Registry.
 */

/** Placeholder-шаблоны боссов. */
export const BOSS_TEMPLATE_IDS = [
  'cat_king',
  'owl_lord',
  'rat_king',
  'moth_queen',
] as const;

const BOSS_TEMPLATE_ID_SET = new Set<string>(BOSS_TEMPLATE_IDS);

/** Возвращает true, если templateId относится к боссу. */
export function isBossTemplateId(templateId: string): boolean {
  return BOSS_TEMPLATE_ID_SET.has(templateId);
}
