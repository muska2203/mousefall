# Content Directory

## Responsibility

All game content as JSON data files. This directory contains **pure data** — no code, no logic.

Content is loaded at app startup, validated against Zod schemas, and made available to the simulation layer via the content registry.

---

## Directory Structure

```
public/content/
├── README.md
│
├── entities/
│   ├── enemies/
│   │   ├── goblin.json        # Weak melee enemy, aggressive AI
│   │   ├── orc.json           # Tough melee enemy, aggressive AI
│   │   ├── skeleton.json      # Undead ranged enemy, aggressive AI
│   │   ├── troll.json         # Boss-tier enemy, aggressive AI
│   │   └── rat.json           # Weak passive enemy, passive AI
│   └── player/
│       └── player.json        # Player base stats
│
├── items/
│   ├── weapons/
│   │   ├── dagger.json        # Fast, low damage
│   │   ├── sword.json         # Balanced weapon
│   │   ├── axe.json           # Slow, high damage
│   │   └── staff.json         # Magic weapon
│   ├── armor/
│   │   ├── leather_armor.json # Light armor, low defense
│   │   ├── chain_mail.json    # Medium armor
│   │   └── plate_armor.json   # Heavy armor, high defense
│   └── consumables/
│       ├── health_potion.json # Restore HP
│       ├── mana_potion.json   # Restore MP (future)
│       └── scroll_teleport.json # Teleport to random position
│
├── abilities/
│   ├── slash.json             # Basic melee attack
│   ├── fireball.json          # Area damage spell
│   └── heal.json              # Self-heal ability
│
└── maps/
    ├── dungeon_floor.json     # Standard dungeon floor parameters
    ├── cave_floor.json        # Cave-style floor parameters
    └── boss_room.json         # Boss encounter room parameters
```

---

## File Format Rules

1. **One entity per file** — easier to diff, easier to mod
2. **Filename = entity ID** — `goblin.json` has `"id": "goblin"`
3. **IDs must be unique** across all content types
4. **All fields validated** by Zod schemas at load time
5. **No comments in JSON** — use `description` field for notes

---

## Entity File Format

```json
{
  "id": "goblin",
  "name": "Goblin",
  "symbol": "g",
  "spriteId": "enemy_goblin",
  "health": { "max": 15 },
  "combat": {
    "damage": 3,
    "armor": 0,
    "attackRange": 1
  },
  "ai": {
    "type": "aggressive",
    "sightRange": 6,
    "chaseRange": 10
  },
  "lootTable": ["gold_small", "health_potion"],
  "xpReward": 10
}
```

---

## Item File Format

```json
{
  "id": "health_potion",
  "name": "Health Potion",
  "description": "Restores 20 HP when consumed.",
  "symbol": "!",
  "spriteId": "item_health_potion",
  "type": "consumable",
  "stackable": true,
  "maxStack": 10,
  "consumable": {
    "effect": "heal",
    "value": 20
  }
}
```

---

## Map Parameters Format

```json
{
  "id": "dungeon_floor",
  "width": 50,
  "height": 50,
  "minRooms": 5,
  "maxRooms": 12,
  "minRoomSize": 4,
  "maxRoomSize": 10,
  "enemyDensity": 0.3,
  "itemDensity": 0.1,
  "enemyPool": ["goblin", "orc", "skeleton"],
  "itemPool": ["health_potion", "sword", "gold_small"]
}
```

---

## Modding

To add custom content:
1. Create a new JSON file in the appropriate subdirectory
2. Follow the format for that content type
3. Ensure the `id` is unique
4. Restart the game (content is loaded at startup)

To override existing content:
1. Edit the existing JSON file directly
2. Restart the game

**No code changes required for content additions.**

---

## Validation

All content is validated at startup using Zod schemas defined in `src/simulation/schemas/`.

If validation fails, the game shows a clear error message identifying the invalid file and field. The game will not start with invalid content.

---

## What Content Controls

- ✅ Entity stats (HP, damage, armor)
- ✅ AI behavior type and parameters
- ✅ Item effects and values
- ✅ Map generation parameters
- ✅ Loot tables
- ✅ XP rewards

## What Content Does NOT Control

- ❌ How combat damage is calculated (that's `simulation/systems/combat.ts`)
- ❌ How AI pathfinds (that's `simulation/ai/`)
- ❌ How items are rendered (that's `renderer/`)
- ❌ How the map is generated (that's `simulation/systems/mapgen.ts`)
