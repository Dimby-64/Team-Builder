export function normalizeMoveName(name: string): string {
  return name.toLowerCase().replace(/[\s-]/g, "");
}

// sprite_id → exact PokeAPI pokemon slug for forms that don't follow standard naming
export const pokeApiSlugOverrides: Record<string, string> = {
  "128-paldea-combat": "tauros-paldea-combat-breed",
  "128-paldea-blaze":  "tauros-paldea-blaze-breed",
  "128-paldea-aqua":   "tauros-paldea-aqua-breed",
  "479-heat":          "rotom-heat",
  "479-wash":          "rotom-wash",
  "479-frost":         "rotom-frost",
  "479-fan":           "rotom-fan",
  "479-mow":           "rotom-mow",
  "670-eternal":       "floette-eternal",
  "745-midday":        "lycanroc-midday",
  "745-midnight":      "lycanroc-midnight",
  "745-dusk":          "lycanroc-dusk",
  "711":               "gourgeist-average",
  "778":               "mimikyu-disguised",
  "866":               "mr-rime",
  "877":               "morpeko-full-belly",
  "902":               "basculegion-male",
  "925":               "maushold-family-of-four",
  "964":               "palafin-zero",
  "668":               "pyroar-male",
  "678":               "meowstic-male",
  "678-mega":          "meowstic-male-mega",
  "681":               "aegislash-shield",
};

export type PokemonSlugInput = {
  name: string;
  is_mega: number | boolean;
  is_regional: number | boolean;
  sprite_id: string;
};

export function getPokemonSlug(pokemon: PokemonSlugInput): string {
  if (pokeApiSlugOverrides[pokemon.sprite_id]) return pokeApiSlugOverrides[pokemon.sprite_id];
  if (pokemon.is_mega) {
    const withoutMega = pokemon.name.replace(/^Mega /, "").toLowerCase().split(" ");
    return withoutMega.length > 1
      ? `${withoutMega[0]}-mega-${withoutMega[1]}`
      : `${withoutMega[0]}-mega`;
  }
  if (pokemon.is_regional) {
    const formPrefixes: Record<string, string> = {
      "Alolan ": "alola", "Galarian ": "galar", "Hisuian ": "hisui", "Paldean ": "paldea",
    };
    for (const [prefix, regionSlug] of Object.entries(formPrefixes)) {
      if (pokemon.name.startsWith(prefix)) {
        return `${pokemon.name.slice(prefix.length).toLowerCase()}-${regionSlug}`;
      }
    }
  }
  return pokemon.name.toLowerCase();
}
