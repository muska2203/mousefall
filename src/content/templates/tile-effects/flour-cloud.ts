import type {TileEffectTemplateInput} from '../../schemas';

// Взвешанная мука: блокирует обзор сквозь себя (как дым) и скрывает сущностей
// на своей клетке (concealsEntities — видны только с дистанции ≤ 1).
// Горючая и взрывоопасная: при наложении burning детонирует и расходуется
// (обобщённая реакция tile-effect-explosion-reaction). Поджог — правилами
// fire_damage_ignites_flour / fire_tile_damage_ignites_flour (копии масляных).
export const flourCloud = {
  "id": "flour_cloud",
  "layer": "aboveGround",
  "duration": 4,
  "renderOrder": 1,
  "blocksLOS": true,
  "concealsEntities": true,
  "ruleIds": [
    "fire_damage_ignites_flour",
    "fire_tile_damage_ignites_flour"
  ],
  "canHaveStatus": [
    "burning"
  ],
  "explosion": {
    "triggerStatus": "burning",
    "damage": 5,
    "radius": 1,
    "consumesEffect": true,
    "tags": ["damage.magical.fire"]
  }
} satisfies TileEffectTemplateInput;
