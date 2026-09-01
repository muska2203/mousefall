import type {ItemTemplateInput} from '../../../schemas';

// Ритуальный надрез (кровавая ветка, план bleed-builds, этап 5): self-эффект
// applyStatus — наносит себе ритуальную рану (кровотечение на 3 хода) и входит
// в боевой транс (empowered: +2 к урону на 2 хода). Таргетинг по клетке
// не требуется. Стак ограничен (maxStack 2) — расходник с ценой в виде
// собственного кровотечения, а не массовый расходник вроде зелья здоровья.
// Числа черновые — балансный проход roadMap 1.4.
export const ritualCut = {
  "id": "ritual_cut",
  "icon": "/assets/items/ritual_cut.png",
  "fallback": "🔪",
  "type": "consumable",
  "stackable": true,
  "maxStack": 2,
  "value": 20,
  "consumable": {
    "effect": "applyStatus",
    "statuses": [
      { "statusType": "bleeding", "duration": 3 },
      { "statusType": "empowered", "duration": 2 }
    ]
  },
  "apCost": 1
} satisfies ItemTemplateInput;
