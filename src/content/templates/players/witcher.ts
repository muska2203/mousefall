import type {PlayerTemplateInput} from '../../schemas';

export const witcher = {
  "id": "witcher",
  "maxAp": 2,
  "portraitImg": "/assets/portraits/witcher-ready.png",
  "isDefault": true,
  "baseStats": {
    "str": 4,
    "dex": 2,
    "int": 0,
    "vit": 4
  },
  "starterEquipment": [
    "unarmed",
    "armor_light_patch_cloak",
    "amulet_bead_glass"
    // "weapon_sword_splinter_blade"
  ],
  "starterRelicPool": [
    "relic_blood_echo",
    "relic_blood_fuel",
    "relic_blood_leech",
    "relic_blood_pact",
    "relic_blood_reaper",
    "relic_blood_rupture",
  ],
  "innateAbilities": ["search"]
} satisfies PlayerTemplateInput;
