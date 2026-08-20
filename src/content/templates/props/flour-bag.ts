import type {PropTemplateInput} from '../../schemas';

// Мешок с мукой: при уничтожении рассыпается облаком взвешанной муки
// (правила prop_contains_flour_* в global-rules.ts, копии масляных);
// горящий мешок при уничтожении детонирует.
export const flourBag = {
  "id": "flour_bag",
  "maxHp": 3,
  "armor": 0,
  "blocksMovement": true,
  "blocksLOS": false,
  "propKind": "sack",
  "tags": [
    "prop.sack",
    "contains.flour",
    "flammable"
  ],
  "canHaveStatus": [
    "burning"
  ]
} satisfies PropTemplateInput;
