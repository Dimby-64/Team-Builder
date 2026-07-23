import { db } from "./db";
import { normalizeMoveName, getPokemonSlug } from "./pokeapi";

type PokemonRow = {
  id: number;
  dex_number: number;
  name: string;
  type1: string;
  type2: string | null;
  is_mega: number;
  is_regional: number;
  sprite_id: string;
};

// ── Step 1: fetch + cache base stats and movepools from PokeAPI ─────────────

async function ensureStatsAndMoves(pokemon: PokemonRow, allMoves: { id: number; name: string }[]) {
  const hasStats = db.prepare("SELECT 1 FROM pokemon_stats WHERE pokemon_id = ?").get(pokemon.id);
  const hasMovesCache = db.prepare("SELECT 1 FROM pokemon_moves_cached WHERE pokemon_id = ?").get(pokemon.id);
  if (hasStats && hasMovesCache) return;

  const slug = getPokemonSlug(pokemon);
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    if (!res.ok) throw new Error(`PokeAPI ${res.status}`);
    const data = await res.json() as {
      stats: Array<{ base_stat: number; stat: { name: string } }>;
      moves: Array<{ move: { name: string } }>;
    };

    if (!hasStats) {
      const byName = new Map(data.stats.map(s => [s.stat.name, s.base_stat]));
      db.prepare(`
        INSERT OR REPLACE INTO pokemon_stats (pokemon_id, hp, attack, defense, sp_atk, sp_def, speed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        pokemon.id,
        byName.get("hp") ?? 0,
        byName.get("attack") ?? 0,
        byName.get("defense") ?? 0,
        byName.get("special-attack") ?? 0,
        byName.get("special-defense") ?? 0,
        byName.get("speed") ?? 0,
      );
    }

    if (!hasMovesCache) {
      const learnableSlugs = new Set(data.moves.map(m => normalizeMoveName(m.move.name)));
      const learnableIds = allMoves
        .filter(m => learnableSlugs.has(normalizeMoveName(m.name)))
        .map(m => m.id);
      const insert = db.prepare("INSERT OR IGNORE INTO pokemon_learnable_moves (pokemon_id, move_id) VALUES (?, ?)");
      for (const moveId of learnableIds) insert.run(pokemon.id, moveId);
      db.prepare("INSERT OR REPLACE INTO pokemon_moves_cached (pokemon_id) VALUES (?)").run(pokemon.id);
    }

    console.log(`  fetched ${pokemon.name} (${slug})`);
  } catch (e) {
    console.error(`  FAILED ${pokemon.name} (${slug}):`, (e as Error).message);
  }
}

// ── Step 2: tagging rules ────────────────────────────────────────────────────

const BARD_MOVES = ["Tailwind", "Icy Wind", "Electroweb", "Scary Face", "Bleakwind Storm", "Sticky Web", "Cotton Spore", "Bulldoze", "Mud Shot"];
const RITUALIST_MOVES = ["Trick Room"];
const PALADIN_MOVES = ["Follow Me", "Rage Powder", "Wide Guard", "Quick Guard", "Pollen Puff", "Wish", "Life Dew", "Aromatherapy", "Heal Pulse", "Heal Bell"];
const PALADIN_ABILITIES = ["Storm Drain", "Lightning Rod", "Levitate"];
const BARBARIAN_MOVES = ["Swords Dance", "Nasty Plot", "Dragon Dance", "Shell Smash", "Calm Mind", "Bulk Up", "Coil", "Hone Claws", "Work Up", "No Retreat", "Quiver Dance", "Tidy Up", "Fillet Away", "Belly Drum"];
const FIGHTER_ABILITIES = ["Sheer Force", "Adaptability", "Tinted Lens", "Technician", "Guts", "Tough Claws", "Iron Fist", "Strong Jaw", "Huge Power", "Pure Power", "Mega Launcher", "Skill Link", "Aerilate", "Pixilate", "Refrigerate", "Sharpness", "Hustle", "Reckless", "Analytic", "Sniper", "Fire Mane", "Dragonize"];
const ROGUE_MOVES = ["U-turn", "Volt Switch", "Flip Turn", "Parting Shot", "Baton Pass"];
const WIZARD_MOVES = ["Blizzard", "Discharge", "Heat Wave", "Muddy Water", "Earthquake", "Hyper Voice", "Dazzling Gleam", "Astral Barrage", "Boomburst", "Clanging Scales", "Diamond Storm", "Eruption", "Glacial Lance", "Lava Plume", "Make It Rain", "Petal Blizzard", "Rock Slide", "Sludge Wave", "Surf"];
const DRUID_ABILITIES = ["Drought", "Drizzle", "Sand Stream", "Sand Spit", "Snow Warning", "Electric Surge", "Grassy Surge", "Psychic Surge", "Misty Surge"];
const DRUID_MOVES = ["Stealth Rock", "Spikes", "Toxic Spikes", "Sticky Web", "Rapid Spin", "Defog", "Court Change", "Tidy Up"];
const WARLOCK_MOVES = ["Will-O-Wisp", "Toxic", "Spore", "Thunder Wave", "Nuzzle", "Glare", "Hypnosis", "Sleep Powder", "Yawn"];
const WILDCARD_ABILITIES = ["Imposter", "Forecast", "Flower Gift", "Zen Mode", "Schooling", "Battle Bond", "Illusion", "Trace", "Zero to Hero", "Stance Change", "Hunger Switch", "Protean"];
const WILDCARD_MOVES = ["Transform", "Trick", "Switcheroo", "Metronome"];

function any(set: Set<string>, list: string[]): boolean {
  return list.some(m => set.has(m));
}

function count(set: Set<string>, list: string[]): number {
  return list.filter(m => set.has(m)).length;
}

// A Pokémon can qualify for several tags at once; only the MAX_TAGS_PER_POKEMON
// best-fitting ones are kept. "Best fit" = a score combining how many of a tag's
// qualifying moves/abilities the Pokémon actually has, and (for stat-gated tags)
// how far past the threshold its stats are. Ability matches (and single
// decisive moves like Trick Room, or Curse on a Ghost-type) count for more than
// an ordinary move match, since they're a binary defining trait rather than one
// of several interchangeable options. Every 20 points of stat margin beyond a
// tag's threshold is worth one more point, so a mon that clears a bar by a mile
// outranks one that barely squeaks by.
const ABILITY_WEIGHT = 3;
const MOVE_WEIGHT = 1;
const STAT_MARGIN_UNIT = 20;

function marginBonus(margin: number | undefined): number {
  return margin !== undefined && margin > 0 ? Math.floor(margin / STAT_MARGIN_UNIT) : 0;
}

const MAX_TAGS_PER_POKEMON = 2;

type Stats = { hp: number; attack: number; defense: number; sp_atk: number; sp_def: number; speed: number };

function computeTags(
  pokemon: PokemonRow,
  moveNames: Set<string>,
  abilityNames: Set<string>,
  stats: Stats | undefined,
): string[] {
  const candidates: { name: string; score: number }[] = [];
  const offense = stats ? Math.max(stats.attack, stats.sp_atk) : undefined;
  const bulk = stats ? stats.hp + stats.defense + stats.sp_def : undefined;

  const bardMoveMatches = count(moveNames, BARD_MOVES);
  const bardHasPrankster = abilityNames.has("Prankster");
  const bardBulky = bulk !== undefined && offense !== undefined && bulk > offense;
  if (bardMoveMatches >= 1 && (bardHasPrankster || bardBulky)) {
    candidates.push({
      name: "Bard",
      score: bardMoveMatches * MOVE_WEIGHT
        + (bardHasPrankster ? ABILITY_WEIGHT : 0)
        + (bardBulky ? marginBonus(bulk! - offense!) : 0),
    });
  }

  if (moveNames.has("Trick Room")) {
    candidates.push({ name: "Ritualist", score: ABILITY_WEIGHT });
  }

  const paladinMoveMatches = count(moveNames, PALADIN_MOVES);
  const paladinAbilityMatches = count(abilityNames, PALADIN_ABILITIES);
  if (paladinMoveMatches >= 1 || paladinAbilityMatches >= 1) {
    candidates.push({
      name: "Paladin",
      score: paladinMoveMatches * MOVE_WEIGHT + paladinAbilityMatches * ABILITY_WEIGHT,
    });
  }

  const barbarianMoveMatches = count(moveNames, BARBARIAN_MOVES);
  if (barbarianMoveMatches >= 1 && offense !== undefined && offense >= 100) {
    candidates.push({
      name: "Barbarian",
      score: barbarianMoveMatches * MOVE_WEIGHT + marginBonus(offense - 100),
    });
  }

  const fighterAbilityMatches = count(abilityNames, FIGHTER_ABILITIES);
  if (offense !== undefined && offense >= 110 && fighterAbilityMatches >= 1 && !any(moveNames, BARBARIAN_MOVES)) {
    candidates.push({
      name: "Fighter",
      score: fighterAbilityMatches * ABILITY_WEIGHT + marginBonus(offense - 110),
    });
  }

  const rogueMoveMatches = count(moveNames, ROGUE_MOVES);
  if (rogueMoveMatches >= 1) {
    candidates.push({ name: "Rogue", score: rogueMoveMatches * MOVE_WEIGHT });
  }

  const wizardMoveMatches = count(moveNames, WIZARD_MOVES);
  const wizardBulkOk = bulk !== undefined && bulk < 260;
  const wizardHasTelepathy = abilityNames.has("Telepathy");
  if ((wizardMoveMatches >= 1 && wizardBulkOk) || wizardHasTelepathy) {
    candidates.push({
      name: "Wizard",
      score: (wizardMoveMatches >= 1 && wizardBulkOk ? wizardMoveMatches * MOVE_WEIGHT + marginBonus(260 - bulk!) : 0)
        + (wizardHasTelepathy ? ABILITY_WEIGHT : 0),
    });
  }

  const druidAbilityMatches = count(abilityNames, DRUID_ABILITIES);
  const druidMoveMatches = count(moveNames, DRUID_MOVES);
  if (druidAbilityMatches >= 1 || druidMoveMatches >= 1) {
    candidates.push({
      name: "Druid",
      score: druidAbilityMatches * ABILITY_WEIGHT + druidMoveMatches * MOVE_WEIGHT,
    });
  }

  const warlockMoveMatches = count(moveNames, WARLOCK_MOVES);
  if (warlockMoveMatches >= 1 && offense !== undefined && offense < 100) {
    candidates.push({
      name: "Warlock",
      score: warlockMoveMatches * MOVE_WEIGHT + marginBonus(100 - offense),
    });
  }

  const isGhost = pokemon.type1 === "Ghost" || pokemon.type2 === "Ghost";
  const wildcardAbilityMatches = count(abilityNames, WILDCARD_ABILITIES);
  const wildcardMoveMatches = count(moveNames, WILDCARD_MOVES);
  const curseGhost = moveNames.has("Curse") && isGhost;
  if (wildcardAbilityMatches >= 1 || wildcardMoveMatches >= 1 || curseGhost) {
    candidates.push({
      name: "Wildcard",
      score: wildcardAbilityMatches * ABILITY_WEIGHT + wildcardMoveMatches * MOVE_WEIGHT + (curseGhost ? ABILITY_WEIGHT : 0),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, MAX_TAGS_PER_POKEMON).map(c => c.name);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const pokemonList = db.prepare("SELECT id, dex_number, name, type1, type2, is_mega, is_regional, sprite_id FROM pokemon").all() as PokemonRow[];
  const allMoves = db.prepare("SELECT id, name FROM moves").all() as { id: number; name: string }[];

  console.log(`Fetching stats + movepools for ${pokemonList.length} Pokémon (only uncached ones hit the network)...`);
  for (const p of pokemonList) {
    const alreadyCached = db.prepare("SELECT 1 FROM pokemon_stats WHERE pokemon_id = ?").get(p.id)
      && db.prepare("SELECT 1 FROM pokemon_moves_cached WHERE pokemon_id = ?").get(p.id);
    await ensureStatsAndMoves(p, allMoves);
    if (!alreadyCached) await new Promise(r => setTimeout(r, 150));
  }

  console.log("Computing tags...");
  const tagRows = db.prepare("SELECT id, name FROM tags").all() as { id: number; name: string }[];
  const tagIdByName = new Map(tagRows.map(t => [t.name, t.id]));

  const abilityRows = db.prepare(`
    SELECT pa.pokemon_id, a.name
    FROM pokemon_abilities pa
    JOIN abilities a ON a.id = pa.ability_id
  `).all() as { pokemon_id: number; name: string }[];
  const abilitiesByPokemon = new Map<number, Set<string>>();
  for (const row of abilityRows) {
    const set = abilitiesByPokemon.get(row.pokemon_id) ?? new Set<string>();
    set.add(row.name);
    abilitiesByPokemon.set(row.pokemon_id, set);
  }

  const moveRows = db.prepare(`
    SELECT plm.pokemon_id, m.name
    FROM pokemon_learnable_moves plm
    JOIN moves m ON m.id = plm.move_id
  `).all() as { pokemon_id: number; name: string }[];
  const movesByPokemon = new Map<number, Set<string>>();
  for (const row of moveRows) {
    const set = movesByPokemon.get(row.pokemon_id) ?? new Set<string>();
    set.add(row.name);
    movesByPokemon.set(row.pokemon_id, set);
  }

  const statsRows = db.prepare("SELECT * FROM pokemon_stats").all() as Array<Stats & { pokemon_id: number }>;
  const statsByPokemon = new Map(statsRows.map(s => [s.pokemon_id, s]));

  db.run("DELETE FROM pokemon_tags");
  const insertTag = db.prepare("INSERT OR IGNORE INTO pokemon_tags (pokemon_id, tag_id) VALUES (?, ?)");

  const counts = new Map<string, number>();
  for (const p of pokemonList) {
    const moveNames = movesByPokemon.get(p.id) ?? new Set<string>();
    const abilityNames = abilitiesByPokemon.get(p.id) ?? new Set<string>();
    const stats = statsByPokemon.get(p.id);
    const tags = computeTags(p, moveNames, abilityNames, stats);
    for (const tagName of tags) {
      const tagId = tagIdByName.get(tagName);
      if (!tagId) continue;
      insertTag.run(p.id, tagId);
      counts.set(tagName, (counts.get(tagName) ?? 0) + 1);
    }
  }

  console.log("\nTag counts:");
  for (const t of tagRows) {
    console.log(`  ${t.name}: ${counts.get(t.name) ?? 0}`);
  }
  console.log("\nDone.");
}

main();
