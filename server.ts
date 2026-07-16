import { db } from "./src/db";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function staticFile(path: string): Response | null {
  const full = join(import.meta.dir, "public", path);
  if (!existsSync(full)) return null;
  const ext = path.slice(path.lastIndexOf(".")) || "";
  const mime = MIME[ext] ?? "application/octet-stream";
  return new Response(readFileSync(full), {
    headers: { "Content-Type": mime },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound(msg = "Not found"): Response {
  return json({ error: msg }, 404);
}

function normalizeMoveName(name: string): string {
  return name.toLowerCase().replace(/[\s-]/g, "");
}

// sprite_id → exact PokeAPI pokemon slug for forms that don't follow standard naming
const pokeApiSlugOverrides: Record<string, string> = {
  "128-paldea-combat": "tauros-paldea-combat-breed",
  "128-paldea-blaze":  "tauros-paldea-blaze-breed",
  "128-paldea-aqua":   "tauros-paldea-aqua-breed",
  "479-heat":          "rotom-heat",
  "479-wash":          "rotom-wash",
  "479-frost":         "rotom-frost",
  "479-fan":           "rotom-fan",
  "479-mow":           "rotom-mow",
  "670-eternal":       "floette-eternal",
  "745-midday":        "lycanroc",
  "745-midnight":      "lycanroc-midnight",
  "745-dusk":          "lycanroc-dusk",
};

type PokemonRow = { name: string; is_mega: number; is_regional: number; sprite_id: string };

function pokemonToPokeApiSlug(pokemon: PokemonRow): string {
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

function getPokeApiSlug(pokemon: { dex_number: number; name: string; is_mega: number; is_regional: number; sprite_id: string }): string {
  if (pokeApiSlugOverrides[pokemon.sprite_id]) return pokeApiSlugOverrides[pokemon.sprite_id];
  if (pokemon.is_mega) {
    return String(pokemon.dex_number);
  }
  if (pokemon.is_regional) {
    const formPrefixes: Record<string, string> = {
      "Alolan ": "alola",
      "Galarian ": "galar",
      "Hisuian ": "hisui",
      "Paldean ": "paldea",
    };
    for (const [prefix, regionSlug] of Object.entries(formPrefixes)) {
      if (pokemon.name.startsWith(prefix)) {
        const baseName = pokemon.name.slice(prefix.length).toLowerCase();
        return `${baseName}-${regionSlug}`;
      }
    }
  }
  return String(pokemon.dex_number);
}

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // ── API ──────────────────────────────────────────────────────────────────

    if (pathname === "/api/pokemon" && method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      const type = url.searchParams.get("type") ?? "";
      const gen = url.searchParams.get("gen") ?? "";
      const mega = url.searchParams.get("mega") ?? "";

      let sql = "SELECT * FROM pokemon WHERE 1=1";
      const params: (string | number)[] = [];

      if (q) {
        sql += " AND name LIKE ?";
        params.push(`%${q}%`);
      }
      if (type) {
        sql += " AND (type1 = ? OR type2 = ?)";
        params.push(type, type);
      }
      if (gen) {
        sql += " AND generation = ?";
        params.push(Number(gen));
      }
      if (mega === "false") {
        sql += " AND is_mega = 0 AND is_regional = 0";
      } else if (mega === "mega") {
        sql += " AND is_mega = 1";
      } else if (mega === "regional") {
        sql += " AND is_regional = 1";
      }

      sql += " ORDER BY dex_number, is_mega, is_regional";

      const rows = db.prepare(sql).all(...params);
      return json(rows);
    }

    const learnableMatch = pathname.match(/^\/api\/pokemon\/(\d+)\/learnable-moves$/);
    if (learnableMatch && method === "GET") {
      const id = learnableMatch[1];
      const pokemon = db.prepare("SELECT * FROM pokemon WHERE id = ?").get(id) as {
        dex_number: number; name: string; is_mega: number; is_regional: number; sprite_id: string;
      } | null;
      if (!pokemon) return notFound();

      const cached = db.prepare("SELECT 1 FROM pokemon_moves_cached WHERE pokemon_id = ?").get(id);
      if (cached) {
        const moves = db.prepare(`
          SELECT m.* FROM moves m
          JOIN pokemon_learnable_moves plm ON plm.move_id = m.id
          WHERE plm.pokemon_id = ?
          ORDER BY m.name
        `).all(id);
        return json(moves);
      }

      const slug = getPokeApiSlug(pokemon);
      try {
        const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
        if (!pokeRes.ok) throw new Error(`PokeAPI ${pokeRes.status}`);
        const pokeData = await pokeRes.json() as { moves: Array<{ move: { name: string } }> };

        const learnableSlugs = new Set(pokeData.moves.map(m => normalizeMoveName(m.move.name)));
        const allMoves = db.prepare("SELECT id, name FROM moves").all() as { id: number; name: string }[];
        const learnableIds = allMoves
          .filter(m => learnableSlugs.has(normalizeMoveName(m.name)))
          .map(m => m.id);

        const insert = db.prepare("INSERT OR IGNORE INTO pokemon_learnable_moves (pokemon_id, move_id) VALUES (?, ?)");
        for (const moveId of learnableIds) insert.run(id, moveId);
        db.prepare("INSERT OR REPLACE INTO pokemon_moves_cached (pokemon_id) VALUES (?)").run(id);

        const moves = learnableIds.length > 0
          ? db.prepare(`SELECT * FROM moves WHERE id IN (${learnableIds.map(() => "?").join(",")}) ORDER BY name`).all(...learnableIds)
          : [];
        return json(moves);
      } catch (e) {
        console.error("PokeAPI fetch failed for", slug, e);
        return json(db.prepare("SELECT * FROM moves ORDER BY name").all());
      }
    }

    const moveLearnerMatch = pathname.match(/^\/api\/moves\/(\d+)\/learners$/);
    if (moveLearnerMatch && method === "GET") {
      const id = moveLearnerMatch[1];
      const move = db.prepare("SELECT * FROM moves WHERE id = ?").get(id) as { id: number; name: string } | null;
      if (!move) return notFound();

      const cached = db.prepare("SELECT 1 FROM move_learners_cached WHERE move_id = ?").get(id);
      if (cached) {
        return json(db.prepare(`
          SELECT p.* FROM pokemon p
          JOIN pokemon_learnable_moves plm ON plm.pokemon_id = p.id
          WHERE plm.move_id = ?
          ORDER BY p.dex_number, p.is_mega, p.is_regional
        `).all(id));
      }

      const moveSlug = move.name.toLowerCase().replace(/\s+/g, "-").replace(/'/g, "");
      const altSlug = move.name.toLowerCase().replace(/[\s-]/g, "");
      try {
        let pokeRes = await fetch(`https://pokeapi.co/api/v2/move/${moveSlug}`);
        if (!pokeRes.ok) pokeRes = await fetch(`https://pokeapi.co/api/v2/move/${altSlug}`);
        if (!pokeRes.ok) throw new Error(`PokeAPI move ${pokeRes.status}`);

        const pokeData = await pokeRes.json() as { learned_by_pokemon: Array<{ name: string }> };
        const learnableSlugs = new Set(pokeData.learned_by_pokemon.map(p => p.name));

        const allPokemon = db.prepare("SELECT * FROM pokemon").all() as Array<{ id: number; dex_number: number; name: string; is_mega: number; is_regional: number; sprite_id: string }>;
        const matchedIds = allPokemon
          .filter(p => {
            const slug = pokemonToPokeApiSlug(p);
            if (learnableSlugs.has(slug)) return true;
            // Base-form pokemon may appear in PokeAPI as form-specific slugs
            // (e.g. "lycanroc" in our DB vs "lycanroc-midday"/"lycanroc-dusk" in PokeAPI).
            // Match if any learnable slug is a form variant of our slug.
            if (!p.is_mega && !p.is_regional) {
              for (const s of learnableSlugs) {
                if (s.startsWith(slug + "-")) return true;
              }
            }
            return false;
          })
          .map(p => p.id);

        const insertLearnable = db.prepare("INSERT OR IGNORE INTO pokemon_learnable_moves (pokemon_id, move_id) VALUES (?, ?)");
        for (const pokemonId of matchedIds) insertLearnable.run(pokemonId, id);
        db.prepare("INSERT OR REPLACE INTO move_learners_cached (move_id) VALUES (?)").run(id);

        const pokemon = matchedIds.length > 0
          ? db.prepare(`SELECT * FROM pokemon WHERE id IN (${matchedIds.map(() => "?").join(",")}) ORDER BY dex_number, is_mega, is_regional`).all(...matchedIds)
          : [];
        return json(pokemon);
      } catch (e) {
        console.error("PokeAPI move learners failed for", moveSlug, e);
        return json([]);
      }
    }

    const abilityLearnerMatch = pathname.match(/^\/api\/abilities\/(\d+)\/learners$/);
    if (abilityLearnerMatch && method === "GET") {
      const id = abilityLearnerMatch[1];
      const ability = db.prepare("SELECT * FROM abilities WHERE id = ?").get(id);
      if (!ability) return notFound();
      return json(db.prepare(`
        SELECT p.* FROM pokemon p
        JOIN pokemon_abilities pa ON pa.pokemon_id = p.id
        WHERE pa.ability_id = ?
        ORDER BY p.dex_number, p.is_mega, p.is_regional
      `).all(id));
    }

    if (pathname.startsWith("/api/pokemon/") && method === "GET") {
      const id = pathname.split("/")[3];
      const p = db.prepare("SELECT * FROM pokemon WHERE id = ?").get(id);
      if (!p) return notFound();
      const abilities = db.prepare(`
        SELECT a.*, pa.is_hidden
        FROM abilities a
        JOIN pokemon_abilities pa ON pa.ability_id = a.id
        WHERE pa.pokemon_id = ?
        ORDER BY pa.is_hidden
      `).all(id);
      return json({ ...p as object, abilities });
    }

    if (pathname === "/api/moves" && method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      const type = url.searchParams.get("type") ?? "";
      const category = url.searchParams.get("category") ?? "";

      let sql = "SELECT * FROM moves WHERE 1=1";
      const params: (string | number)[] = [];
      if (q) { sql += " AND name LIKE ?"; params.push(`%${q}%`); }
      if (type) { sql += " AND type = ?"; params.push(type); }
      if (category) { sql += " AND category = ?"; params.push(category); }
      sql += " ORDER BY name";

      return json(db.prepare(sql).all(...params));
    }

    if (pathname === "/api/items" && method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      const category = url.searchParams.get("category") ?? "";
      let sql = "SELECT * FROM items WHERE 1=1";
      const params: (string | number)[] = [];
      if (q) { sql += " AND name LIKE ?"; params.push(`%${q}%`); }
      if (category) { sql += " AND category = ?"; params.push(category); }
      sql += " ORDER BY category, name";
      return json(db.prepare(sql).all(...params));
    }

    if (pathname === "/api/abilities" && method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      let sql = "SELECT * FROM abilities WHERE 1=1";
      const params: (string | number)[] = [];
      if (q) { sql += " AND name LIKE ?"; params.push(`%${q}%`); }
      sql += " ORDER BY name";
      return json(db.prepare(sql).all(...params));
    }

    // Teams
    if (pathname === "/api/teams" && method === "GET") {
      const teams = db.prepare("SELECT * FROM teams ORDER BY updated_at DESC").all();
      return json(teams);
    }

    if (pathname === "/api/teams" && method === "POST") {
      const body = await req.json() as { name?: string };
      const name = body.name?.trim() || "My Team";
      const result = db.prepare(
        "INSERT INTO teams (name) VALUES (?)"
      ).run(name);
      const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(result.lastInsertRowid);
      return json(team, 201);
    }

    const teamMatch = pathname.match(/^\/api\/teams\/(\d+)$/);
    if (teamMatch) {
      const teamId = teamMatch[1];

      if (method === "GET") {
        const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(teamId);
        if (!team) return notFound();
        const members = db.prepare(`
          SELECT
            tm.*,
            p.name AS pokemon_name, p.type1, p.type2, p.sprite_id, p.dex_number,
            i.name AS item_name, i.description AS item_description,
            a.name AS ability_name, a.description AS ability_description
          FROM team_members tm
          JOIN pokemon p ON p.id = tm.pokemon_id
          LEFT JOIN items i ON i.id = tm.item_id
          LEFT JOIN abilities a ON a.id = tm.ability_id
          WHERE tm.team_id = ?
          ORDER BY tm.slot
        `).all(teamId);
        const membersWithMoves = members.map((m: any) => {
          const moves = db.prepare(`
            SELECT mv.*, tmm.move_slot
            FROM team_member_moves tmm
            JOIN moves mv ON mv.id = tmm.move_id
            WHERE tmm.member_id = ?
            ORDER BY tmm.move_slot
          `).all(m.id);
          return { ...m, moves };
        });
        return json({ ...team as object, members: membersWithMoves });
      }

      if (method === "PUT") {
        const body = await req.json() as {
          name?: string;
          members?: Array<{
            slot: number;
            pokemon_id: number;
            nickname?: string;
            ability_id?: number;
            item_id?: number;
            moves?: Array<{ move_slot: number; move_id: number }>;
          }>;
        };
        const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(teamId);
        if (!team) return notFound();

        if (body.name) {
          db.prepare("UPDATE teams SET name = ?, updated_at = datetime('now') WHERE id = ?")
            .run(body.name.trim(), teamId);
        }

        if (body.members) {
          for (const member of body.members) {
            db.prepare("DELETE FROM team_members WHERE team_id = ? AND slot = ?")
              .run(teamId, member.slot);

            if (member.pokemon_id) {
              const result = db.prepare(`
                INSERT INTO team_members (team_id, slot, pokemon_id, nickname, ability_id, item_id)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(
                teamId, member.slot, member.pokemon_id,
                member.nickname ?? null, member.ability_id ?? null, member.item_id ?? null
              );
              const memberId = result.lastInsertRowid;

              if (member.moves) {
                for (const move of member.moves) {
                  db.prepare(`
                    INSERT OR REPLACE INTO team_member_moves (member_id, move_slot, move_id)
                    VALUES (?, ?, ?)
                  `).run(memberId, move.move_slot, move.move_id);
                }
              }
            }
          }
          db.prepare("UPDATE teams SET updated_at = datetime('now') WHERE id = ?").run(teamId);
        }

        const updated = db.prepare("SELECT * FROM teams WHERE id = ?").get(teamId);
        return json(updated);
      }

      if (method === "DELETE") {
        db.prepare("DELETE FROM teams WHERE id = ?").run(teamId);
        return json({ success: true });
      }
    }

    // ── Static files ─────────────────────────────────────────────────────────
    if (pathname === "/" || pathname === "/index.html") {
      return staticFile("index.html") ?? notFound();
    }
    const filePath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    const file = staticFile(filePath);
    return file ?? notFound();
  },
});

console.log("TeamBuilder running at http://localhost:3000");
