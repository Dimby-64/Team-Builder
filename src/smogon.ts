import { normalizeMoveName } from "./pokeapi";
import type { PokemonSlugInput } from "./pokeapi";

// Standard singles tiers give broad coverage of what's actually played;
// the National Dex tiers are the only modern format where Mega Evolution
// (and most pre-gen9 Pokémon) are legal at all, so real mega usage data
// only shows up there.
const TIERS = [
  "gen9ou", "gen9uu", "gen9ru", "gen9nu", "gen9pu", "gen9ubers", "gen9lc",
  "gen9nationaldex", "gen9nationaldexuu", "gen9nationaldexubers",
];

// A move counts as "commonly used" for a Pokémon if it shows up on at least
// this share of that Pokémon's recorded sets, summed across every tier above.
const COMMON_MOVE_SHARE = 0.01;

function toId(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// sprite_id -> Showdown/Smogon toID, for forms that don't follow standard naming
const showdownIdOverrides: Record<string, string> = {
  "128-paldea-combat": "taurospaldeacombat",
  "128-paldea-blaze":  "taurospaldeablaze",
  "128-paldea-aqua":   "taurospaldeaaqua",
  "479-heat":          "rotomheat",
  "479-wash":          "rotomwash",
  "479-frost":         "rotomfrost",
  "479-fan":           "rotomfan",
  "479-mow":           "rotommow",
  "670-eternal":       "floetteeternal",
  "745-midday":        "lycanroc",
  "745-midnight":      "lycanrocmidnight",
  "745-dusk":          "lycanrocdusk",
};

export function getShowdownId(pokemon: PokemonSlugInput): string {
  if (showdownIdOverrides[pokemon.sprite_id]) return showdownIdOverrides[pokemon.sprite_id];
  if (pokemon.is_mega) {
    const withoutMega = pokemon.name.replace(/^Mega /, "").toLowerCase().split(" ");
    const base = withoutMega[0];
    const suffix = withoutMega.length > 1 ? withoutMega[1] : "";
    return toId(`${base}mega${suffix}`);
  }
  if (pokemon.is_regional) {
    const formPrefixes: Record<string, string> = {
      "Alolan ": "alola", "Galarian ": "galar", "Hisuian ": "hisui", "Paldean ": "paldea",
    };
    for (const [prefix, region] of Object.entries(formPrefixes)) {
      if (pokemon.name.startsWith(prefix)) {
        return toId(pokemon.name.slice(prefix.length) + region);
      }
    }
  }
  return toId(pokemon.name);
}

async function latestStatsMonth(): Promise<string> {
  const res = await fetch("https://www.smogon.com/stats/");
  if (!res.ok) throw new Error(`Smogon stats index ${res.status}`);
  const html = await res.text();
  const months = [...html.matchAll(/(\d{4}-\d{2})\//g)].map(m => m[1]);
  if (months.length === 0) throw new Error("No month folders found in Smogon stats index");
  return months.sort().at(-1)!;
}

type ChaosFile = { data: Record<string, { Moves: Record<string, number> }> };

// showdownId -> (normalized move id -> summed usage weight across all tiers it appears in)
async function fetchUsageByShowdownId(): Promise<Map<string, Map<string, number>>> {
  const month = await latestStatsMonth();
  console.log(`Fetching Smogon usage stats for ${month} (${TIERS.length} tiers)...`);

  const usage = new Map<string, Map<string, number>>();
  for (const tier of TIERS) {
    const url = `https://www.smogon.com/stats/${month}/chaos/${tier}-1500.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json() as ChaosFile;
      for (const [name, entry] of Object.entries(json.data)) {
        const id = toId(name);
        const moveWeights = usage.get(id) ?? new Map<string, number>();
        for (const [moveId, weight] of Object.entries(entry.Moves)) {
          if (!moveId) continue; // Smogon includes an empty-string bucket for "no move revealed"
          moveWeights.set(moveId, (moveWeights.get(moveId) ?? 0) + weight);
        }
        usage.set(id, moveWeights);
      }
      console.log(`  ${tier}: ${Object.keys(json.data).length} Pokémon`);
    } catch (e) {
      console.error(`  FAILED ${tier}:`, (e as Error).message);
    }
  }
  return usage;
}

// showdownId -> set of our own move names (from src/data/moves.ts) that are
// "commonly used" on that Pokémon per Smogon usage stats.
export async function fetchCommonMovesByShowdownId(
  allMoves: { id: number; name: string }[],
): Promise<Map<string, Set<string>>> {
  const usage = await fetchUsageByShowdownId();
  const result = new Map<string, Set<string>>();

  for (const [showdownId, moveWeights] of usage) {
    const total = [...moveWeights.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    const commonNormalizedIds = new Set<string>();
    for (const [moveId, weight] of moveWeights) {
      if (weight / total >= COMMON_MOVE_SHARE) commonNormalizedIds.add(moveId);
    }
    const matchedNames = new Set<string>();
    for (const m of allMoves) {
      if (commonNormalizedIds.has(normalizeMoveName(m.name))) matchedNames.add(m.name);
    }
    result.set(showdownId, matchedNames);
  }
  return result;
}
