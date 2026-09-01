import type {TileEffectTemplateInput} from '../../schemas';

// Кровавая лужа: всякий, кто заходит на лужу или оказывается в ней при
// появлении, получает кровотечение на 2 хода (кровавая ветка, §4.3
// docs/game-design/bleed-builds-concept.md). Механика — копия water/wet,
// но bleed вешается напрямую, без статуса-маркера.
export const bloodPuddle = {
  "id": "blood_puddle",
  "layer": "cover",
  "duration": 4,
  "renderOrder": 1,
  "ruleIds": [
    "blood_puddle_applies_bleeding",
    "blood_puddle_applies_bleeding_on_spawn"
  ],
  "canHaveStatus": []
} satisfies TileEffectTemplateInput;
