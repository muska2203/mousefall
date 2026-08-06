import type {PlayerTemplateInput} from '../../schemas';

export const elvenRanger = {
  "id": "elven-ranger",
  "maxAp": 2,
  "portraitImg": "/assets/portraits/elven-ranger-ready.png",
  "starterEquipment": [
    "common_splinter_blade",
    "common_school_wand",
    "common_tin_plate",
    "common_patch_cloak",
    "common_knotted_fang",
    "common_glass_bead"
  ]
} satisfies PlayerTemplateInput;
