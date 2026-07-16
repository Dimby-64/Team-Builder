import { db } from "./db";
import { abilities } from "./data/abilities";
import { items } from "./data/items";
import { moves } from "./data/moves";
import { pokemon } from "./data/pokemon";
import { pokemonAbilities } from "./data/pokemon-abilities";

console.log("Seeding database...");

// Clear existing data
db.run("DELETE FROM team_member_moves");
db.run("DELETE FROM team_members");
db.run("DELETE FROM teams");
db.run("DELETE FROM pokemon_abilities");
db.run("DELETE FROM pokemon");
db.run("DELETE FROM moves");
db.run("DELETE FROM items");
db.run("DELETE FROM abilities");

// Seed abilities
const insertAbility = db.prepare(
  "INSERT INTO abilities (name, description) VALUES (?, ?)"
);
const abilityMap = new Map<string, number>();
for (const ability of abilities) {
  const result = insertAbility.run(ability.name, ability.description);
  abilityMap.set(ability.name, result.lastInsertRowid as number);
}
console.log(`Inserted ${abilities.length} abilities`);

// Seed items
const insertItem = db.prepare(
  "INSERT INTO items (name, description, category) VALUES (?, ?, ?)"
);
for (const item of items) {
  insertItem.run(item.name, item.description, item.category);
}
console.log(`Inserted ${items.length} items`);

// Seed moves
const insertMove = db.prepare(
  "INSERT INTO moves (name, type, category, power, accuracy, pp, description) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
for (const move of moves) {
  insertMove.run(move.name, move.type, move.category, move.power ?? null, move.accuracy ?? null, move.pp, move.description);
}
console.log(`Inserted ${moves.length} moves`);

// Seed pokemon
const insertPokemon = db.prepare(
  "INSERT INTO pokemon (dex_number, name, form, type1, type2, sprite_id, is_mega, is_regional, generation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
const pokemonMap = new Map<string, number>();
for (const p of pokemon) {
  const result = insertPokemon.run(
    p.dex_number,
    p.name,
    p.form ?? null,
    p.type1,
    p.type2 ?? null,
    p.sprite_id,
    p.is_mega ? 1 : 0,
    p.is_regional ? 1 : 0,
    p.generation
  );
  pokemonMap.set(p.name, result.lastInsertRowid as number);
}
console.log(`Inserted ${pokemon.length} pokemon`);

// Seed pokemon-ability mappings
const insertPokemonAbility = db.prepare(
  "INSERT OR IGNORE INTO pokemon_abilities (pokemon_id, ability_id, is_hidden) VALUES (?, ?, ?)"
);
let abilityLinkCount = 0;
for (const mapping of pokemonAbilities) {
  const pokemonId = pokemonMap.get(mapping.pokemon);
  if (!pokemonId) continue;
  for (const [abilityName, isHidden] of mapping.abilities) {
    const abilityId = abilityMap.get(abilityName);
    if (!abilityId) {
      console.warn(`  Ability not found: ${abilityName}`);
      continue;
    }
    insertPokemonAbility.run(pokemonId, abilityId, isHidden ? 1 : 0);
    abilityLinkCount++;
  }
}
console.log(`Inserted ${abilityLinkCount} pokemon-ability links`);

console.log("Done! Database seeded successfully.");
