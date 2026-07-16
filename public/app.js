// ── State ─────────────────────────────────────────────────────────────────
const state = {
  team: Array(6).fill(null), // each: { pokemonId, nickname, abilityId, itemId, moves: [null,null,null,null] }
  activeSlot: null,          // 0–5
  activeMoveSlot: null,      // 0–3 (when picking a move)
  activeTeamId: null,
  currentTab: "pokemon",
  // Cached data
  allPokemon: [],
  allMoves: [],
  allItems: [],
  allAbilities: [],
  // Filters
  pokemonSearch: "",
  pokemonType: "",
  pokemonGen: "",
  pokemonForm: "",
  moveSearch: "",
  moveType: "",
  moveCategory: "",
  itemSearch: "",
  itemCategory: "",
  abilitySearch: "",
  // Move modal learnable-moves state
  learnableMoveIds: null,   // null = not loaded / unavailable; [] or [...] = loaded
  learnableMovesLoading: false,
  showAllMoves: false,
};

// ── Mega stone map (sprite_id → item name) ───────────────────────────────
const megaStoneMap = {
  "3-mega": "Venusaurite",    "6-mega-x": "Charizardite X", "6-mega-y": "Charizardite Y",
  "9-mega": "Blastoisinite",  "15-mega": "Beedrillite",     "18-mega": "Pidgeotite",
  "26-mega-x": "Raichunite X","26-mega-y": "Raichunite Y",  "36-mega": "Clefablite",
  "65-mega": "Alakazite",     "71-mega": "Victreebelite",   "80-mega": "Slowbronite",
  "94-mega": "Gengarite",     "115-mega": "Kangaskhanite",  "121-mega": "Starminite",
  "127-mega": "Pinsirite",    "130-mega": "Gyaradosite",    "142-mega": "Aerodactylite",
  "149-mega": "Dragoninite",  "154-mega": "Meganiumite",    "160-mega": "Feraligite",
  "181-mega": "Ampharosite",  "208-mega": "Steelixite",     "212-mega": "Scizorite",
  "214-mega": "Heracronite",  "227-mega": "Skarmorite",     "229-mega": "Houndoominite",
  "248-mega": "Tyranitarite", "254-mega": "Sceptilite",     "257-mega": "Blazikenite",
  "260-mega": "Swampertite",  "282-mega": "Gardevoirite",   "302-mega": "Sablenite",
  "303-mega": "Mawilite",     "306-mega": "Aggronite",      "308-mega": "Medichamite",
  "310-mega": "Manectite",    "319-mega": "Sharpedonite",   "323-mega": "Cameruptite",
  "334-mega": "Altarianite",  "354-mega": "Banettite",      "358-mega": "Chimechite",
  "359-mega": "Absolite",     "362-mega": "Glalitite",      "376-mega": "Metagrossite",
  "398-mega": "Staraptite",   "428-mega": "Lopunnite",      "445-mega": "Garchompite",
  "448-mega": "Lucarionite",  "460-mega": "Abomasite",      "475-mega": "Galladite",
  "478-mega": "Froslassite",  "500-mega": "Emboarite",      "530-mega": "Excadrite",
  "531-mega": "Audinite",     "545-mega": "Scolipite",      "560-mega": "Scraftinite",
  "604-mega": "Eelektrossite","609-mega": "Chandelurite",   "623-mega": "Golurkite",
  "652-mega": "Chesnaughtite","655-mega": "Delphoxite",     "658-mega": "Greninjite",
  "668-mega": "Pyroarite",    "678-mega": "Meowsticite",    "687-mega": "Malamarite",
  "689-mega": "Barbaracite",  "691-mega": "Dragalgite",     "701-mega": "Hawluchanite",
  "740-mega": "Crabominite",  "780-mega": "Drampanite",     "870-mega": "Falinksite",
  "952-mega": "Scovillainite","970-mega": "Glimmoranite",
};

function regionLabel(form) {
  if (!form) return "FORM";
  const f = form.toLowerCase();
  if (f.includes("paldea")) return "PALDEA";
  if (f.includes("alola")) return "ALOLA";
  if (f.includes("galar")) return "GALAR";
  if (f.includes("hisui")) return "HISUI";
  return form.toUpperCase();
}

// ── Natures ───────────────────────────────────────────────────────────────
const NATURES = {
  "Hardy":   null,          "Docile":   null,          "Serious":  null,
  "Bashful": null,          "Quirky":   null,
  "Adamant": ["atk","spa"], "Lonely":   ["atk","def"], "Brave":    ["atk","spe"],
  "Naughty": ["atk","spd"],
  "Bold":    ["def","atk"], "Impish":   ["def","spa"], "Relaxed":  ["def","spe"],
  "Lax":     ["def","spd"],
  "Modest":  ["spa","atk"], "Mild":     ["spa","def"], "Quiet":    ["spa","spe"],
  "Rash":    ["spa","spd"],
  "Calm":    ["spd","atk"], "Gentle":   ["spd","def"], "Sassy":    ["spd","spe"],
  "Careful": ["spd","spa"],
  "Timid":   ["spe","atk"], "Hasty":    ["spe","def"], "Jolly":    ["spe","spa"],
  "Naive":   ["spe","spd"],
};

const STAT_LABELS = { hp:"HP", atk:"Attack", def:"Defense", spa:"Sp. Atk", spd:"Sp. Def", spe:"Speed" };
const STAT_ORDER  = ["hp","atk","def","spa","spd","spe"];
const STAT_POINTS_MAX   = 32;
const STAT_POINTS_TOTAL = 66;
const statsCache = new Map();

function calcStat(base, pts, key, natureName) {
  const nat = NATURES[natureName];
  const mult = nat ? (nat[0] === key ? 1.1 : nat[1] === key ? 0.9 : 1) : 1;
  if (key === "hp") return base + pts + 75;
  return Math.floor((base + pts + 20) * mult);
}

function statBarColor(v) {
  if (v <  50) return "#f44336";
  if (v <  70) return "#ff7043";
  if (v <  90) return "#ffc107";
  if (v < 110) return "#8bc34a";
  if (v < 140) return "#4caf50";
  return "#00bcd4";
}

async function getBaseStats(pokemon) {
  const key = pokemon.sprite_id;
  if (statsCache.has(key)) return statsCache.get(key);
  const apiId = key.includes("-") ? formatSpriteId(key) : key;
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiId}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const map = { hp:"hp", attack:"atk", defense:"def", "special-attack":"spa", "special-defense":"spd", speed:"spe" };
    const stats = {};
    for (const s of data.stats) { const k = map[s.stat.name]; if (k) stats[k] = s.base_stat; }
    statsCache.set(key, stats);
    return stats;
  } catch {
    statsCache.set(key, null);
    return null;
  }
}

// ── Sprite URL ────────────────────────────────────────────────────────────
function spriteUrl(pokemon) {
  const id = pokemon.sprite_id;
  const formId = id.includes("-") ? formatSpriteId(id) : id;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${formId}.png`;
}

function formatSpriteId(id) {
  // Maps sprite_id to PokeAPI form IDs — verified against https://pokeapi.co/api/v2/pokemon?limit=1500
  const megaMap = {
    // Gen 1 XY megas
    "3-mega": 10033, "6-mega-x": 10034, "6-mega-y": 10035, "9-mega": 10036,
    "65-mega": 10037, "94-mega": 10038, "115-mega": 10039, "127-mega": 10040,
    "130-mega": 10041, "142-mega": 10042,
    // Gen 2 XY megas
    "181-mega": 10045, "212-mega": 10046, "214-mega": 10047,
    "229-mega": 10048, "248-mega": 10049,
    // Gen 3 XY/ORAS megas
    "257-mega": 10050, "282-mega": 10051, "303-mega": 10052, "306-mega": 10053,
    "308-mega": 10054, "310-mega": 10055, "354-mega": 10056, "359-mega": 10057,
    "445-mega": 10058, "448-mega": 10059, "460-mega": 10060, "302-mega": 10066,
    "334-mega": 10067, "475-mega": 10068, "531-mega": 10069, "319-mega": 10070,
    "80-mega": 10071, "208-mega": 10072, "18-mega": 10073, "362-mega": 10074,
    "376-mega": 10076, "323-mega": 10087, "428-mega": 10088,
    "15-mega": 10090, "254-mega": 10065, "260-mega": 10064, "366-mega": 10066,
    // Custom megas (Pokemon Champions) — IDs from PokeAPI
    "26-mega-x": 10304, "26-mega-y": 10305, "36-mega": 10278, "71-mega": 10279,
    "121-mega": 10280, "149-mega": 10281, "154-mega": 10282, "160-mega": 10283,
    "227-mega": 10284, "358-mega": 10306, "398-mega": 10308, "478-mega": 10285,
    "500-mega": 10286, "530-mega": 10287, "545-mega": 10288, "560-mega": 10289,
    "604-mega": 10290, "609-mega": 10291, "623-mega": 10313, "652-mega": 10292,
    "655-mega": 10293, "658-mega": 10294, "668-mega": 10295, "678-mega": 10314,
    "687-mega": 10297, "689-mega": 10298, "691-mega": 10299, "701-mega": 10300,
    "740-mega": 10315, "780-mega": 10302, "870-mega": 10303,
    "952-mega": 10320, "970-mega": 10321,
    // 724-mega (Decidueye) not in PokeAPI — falls back to dex number
  };
  const regional = {
    "26-alola": 10100, "38-alola": 10104, "59-hisui": 10230,
    "80-galar": 10165, "128-paldea-combat": 10250, "128-paldea-blaze": 10251,
    "128-paldea-aqua": 10252, "157-hisui": 10233, "199-galar": 10172,
    "479-heat": 10008, "479-wash": 10009, "479-frost": 10010,
    "479-fan": 10011, "479-mow": 10012,
    "503-hisui": 10236, "571-hisui": 10239, "618-galar": 10180,
    "670-eternal": 10061, "706-hisui": 10242, "713-hisui": 10243,
    "724-hisui": 10244, "745-midnight": 10126, "745-dusk": 10152,
  };
  if (megaMap[id]) return megaMap[id];
  if (regional[id]) return regional[id];
  return id.split("-")[0];
}

// ── API helpers ───────────────────────────────────────────────────────────
async function api(path) {
  const res = await fetch(path);
  return res.json();
}

async function loadAll() {
  const [pokemon, moves, items, abilities] = await Promise.all([
    api("/api/pokemon"),
    api("/api/moves"),
    api("/api/items"),
    api("/api/abilities"),
  ]);
  state.allPokemon = pokemon;
  state.allMoves = moves;
  state.allItems = items;
  state.allAbilities = abilities;
  render();
}

// ── Type badge HTML ───────────────────────────────────────────────────────
function typeBadge(type) {
  return `<span class="type-badge type-${type}">${type}</span>`;
}

// ── Render: Team Slots ────────────────────────────────────────────────────
function renderTeamSlots() {
  const container = document.getElementById("teamSlots");
  container.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const member = state.team[i];
    const isActive = state.activeSlot === i;
    const card = document.createElement("div");
    card.className = `slot-card ${!member ? "empty" : ""} ${isActive ? "active" : ""}`;
    card.dataset.slot = i;

    const numEl = document.createElement("div");
    numEl.className = "slot-number";
    numEl.textContent = i + 1;
    card.appendChild(numEl);

    if (member) {
      const pokemon = state.allPokemon.find(p => p.id === member.pokemonId) ||
                       allPokemonById[member.pokemonId];
      if (pokemon) {
        const img = document.createElement("img");
        img.src = spriteUrl(pokemon);
        img.alt = pokemon.name;
        img.onerror = () => { img.src = fallbackSprite(pokemon); };
        card.appendChild(img);

        const name = document.createElement("div");
        name.className = "slot-pokemon-name";
        name.textContent = member.nickname || pokemon.name;
        card.appendChild(name);

        const types = document.createElement("div");
        types.className = "slot-types";
        types.innerHTML = typeBadge(pokemon.type1) + (pokemon.type2 ? typeBadge(pokemon.type2) : "");
        card.appendChild(types);

        if (member.itemId) {
          const item = state.allItems.find(it => it.id === member.itemId);
          if (item) {
            const itemEl = document.createElement("div");
            itemEl.className = "slot-item-name";
            itemEl.textContent = item.name;
            card.appendChild(itemEl);
          }
        }

        const removeBtn = document.createElement("span");
        removeBtn.className = "slot-remove";
        removeBtn.textContent = "×";
        removeBtn.title = "Remove Pokémon";
        removeBtn.onclick = (e) => { e.stopPropagation(); removeFromSlot(i); };
        card.appendChild(removeBtn);
      }
    } else {
      const ph = document.createElement("div");
      ph.className = "slot-placeholder";
      ph.innerHTML = `<span class="slot-plus">+</span><span>Slot ${i + 1}</span>`;
      card.appendChild(ph);
    }

    card.addEventListener("click", () => selectSlot(i));
    container.appendChild(card);
  }
}

function fallbackSprite(pokemon) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.dex_number}.png`;
}

// ── Render: Browser ───────────────────────────────────────────────────────
function renderBrowser() {
  const tab = state.currentTab;
  const list = document.getElementById("browserList");
  list.innerHTML = "";

  if (tab === "pokemon") {
    renderPokemonGrid(list);
  } else if (tab === "moves") {
    renderMovesList(list, state.allMoves, state.moveSearch, state.moveType, state.moveCategory, (move) => {
      openLearnersModal("move", move.id, move.name, move.description);
    });
  } else if (tab === "items") {
    renderItemsList(list, state.allItems, state.itemSearch, state.itemCategory);
  } else if (tab === "abilities") {
    renderAbilitiesList(list, state.allAbilities, state.abilitySearch, (ab) => {
      openLearnersModal("ability", ab.id, ab.name, ab.description);
    });
  }
}

function renderPokemonGrid(container) {
  let filtered = state.allPokemon;
  const { pokemonSearch, pokemonType, pokemonGen, pokemonForm } = state;

  if (pokemonSearch) {
    const q = pokemonSearch.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
  }
  if (pokemonType) {
    filtered = filtered.filter(p => p.type1 === pokemonType || p.type2 === pokemonType);
  }
  if (pokemonGen) {
    filtered = filtered.filter(p => p.generation === Number(pokemonGen));
  }
  if (pokemonForm === "false") {
    filtered = filtered.filter(p => !p.is_mega && !p.is_regional);
  } else if (pokemonForm === "mega") {
    filtered = filtered.filter(p => p.is_mega);
  } else if (pokemonForm === "regional") {
    filtered = filtered.filter(p => p.is_regional);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No Pokémon found.</div>';
    return;
  }

  const grid = document.createElement("div");
  grid.className = "pokemon-grid";

  for (const p of filtered) {
    const card = document.createElement("div");
    card.className = "pokemon-card";
    const inTeam = state.team.some(m => m && m.pokemonId === p.id);
    if (inTeam) card.classList.add("selected");

    const img = document.createElement("img");
    img.src = spriteUrl(p);
    img.alt = p.name;
    img.loading = "lazy";
    img.onerror = () => { img.src = fallbackSprite(p); };

    const name = document.createElement("div");
    name.className = "poke-name";
    name.textContent = p.name;

    const types = document.createElement("div");
    types.className = "poke-types";
    types.innerHTML = typeBadge(p.type1) + (p.type2 ? typeBadge(p.type2) : "");

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(types);

    if (p.is_mega) {
      const badge = document.createElement("span");
      badge.className = "badge-mega";
      badge.textContent = "MEGA";
      card.appendChild(badge);
    } else if (p.is_regional) {
      const badge = document.createElement("span");
      badge.className = "badge-regional";
      badge.textContent = regionLabel(p.form);
      card.appendChild(badge);
    }

    card.addEventListener("click", () => addPokemonToTeam(p));
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function renderMovesList(container, moves, search, type, category, onSelect) {
  let filtered = moves;
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(m => m.name.toLowerCase().includes(q)); }
  if (type) filtered = filtered.filter(m => m.type === type);
  if (category) filtered = filtered.filter(m => m.category === category);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No moves found.</div>';
    return;
  }

  for (const move of filtered) {
    const el = document.createElement("div");
    el.className = "move-list-item";

    const catSpan = document.createElement("span");
    catSpan.className = `move-category ${move.category}`;
    catSpan.textContent = move.category[0].toUpperCase();

    const typeBadgeEl = document.createElement("div");
    typeBadgeEl.innerHTML = typeBadge(move.type);

    const name = document.createElement("span");
    name.className = "move-name";
    name.textContent = move.name;

    const stats = document.createElement("span");
    stats.className = "move-stats";
    const pw = move.power ?? "—";
    const acc = move.accuracy ?? "—";
    stats.textContent = `${pw} / ${acc}%`;

    el.appendChild(catSpan);
    el.appendChild(typeBadgeEl);
    el.appendChild(name);
    el.appendChild(stats);
    el.title = move.description;

    if (onSelect) el.addEventListener("click", () => onSelect(move));
    container.appendChild(el);
  }
}

function renderItemsList(container, items, search, category) {
  let filtered = items;
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(i => i.name.toLowerCase().includes(q)); }
  if (category) filtered = filtered.filter(i => i.category === category);

  for (const item of filtered) {
    const el = document.createElement("div");
    el.className = "item-list-item";

    const catBadge = document.createElement("span");
    catBadge.className = "item-category-badge";
    catBadge.textContent = item.category;

    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = item.name;

    el.appendChild(catBadge);
    el.appendChild(name);
    el.title = item.description;
    container.appendChild(el);
  }
}

function renderAbilitiesList(container, abilities, search, onSelect) {
  let filtered = abilities;
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)); }

  for (const ab of filtered) {
    const el = document.createElement("div");
    el.className = `ability-list-item ${onSelect ? "clickable" : ""}`;

    const name = document.createElement("span");
    name.className = "ability-name";
    name.textContent = ab.name;

    el.appendChild(name);
    el.title = ab.description;
    if (onSelect) el.addEventListener("click", () => onSelect(ab));
    container.appendChild(el);
  }
}

// ── Render: Detail Panel ──────────────────────────────────────────────────
// ── Stats Section ─────────────────────────────────────────────────────────
async function renderStatsSection(pokemon, member) {
  const section = document.createElement("div");
  section.className = "stats-section";

  const sLabel = document.createElement("div");
  sLabel.className = "section-label";
  sLabel.textContent = "Stats";
  section.appendChild(sLabel);

  // Nature picker row
  const natRow = document.createElement("div");
  natRow.className = "nature-row";
  const natLabel = document.createElement("span");
  natLabel.className = "nature-label";
  natLabel.textContent = "Nature:";
  const natSelect = document.createElement("select");
  natSelect.className = "nature-select";
  for (const n of Object.keys(NATURES)) {
    const nat = NATURES[n];
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = nat ? `${n} (+${nat[0].toUpperCase()}, −${nat[1].toUpperCase()})` : `${n} (neutral)`;
    if (n === member.nature) opt.selected = true;
    natSelect.appendChild(opt);
  }
  natRow.appendChild(natLabel);
  natRow.appendChild(natSelect);
  section.appendChild(natRow);

  // Loading placeholder
  const loadingEl = document.createElement("div");
  loadingEl.className = "stats-loading";
  loadingEl.textContent = "Loading base stats…";
  section.appendChild(loadingEl);

  const baseStats = await getBaseStats(pokemon);
  loadingEl.remove();

  if (!baseStats) {
    const errEl = document.createElement("div");
    errEl.style.cssText = "font-size:12px;color:var(--text-dim);padding:8px 0";
    errEl.textContent = "Base stats unavailable for this form.";
    section.appendChild(errEl);
    return section;
  }

  if (!member.statPoints) member.statPoints = { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 };

  // Stats table
  const table = document.createElement("div");
  table.className = "stats-table";
  section.appendChild(table);

  // Remaining counter
  const remEl = document.createElement("div");
  remEl.className = "points-remaining";

  const rowRefs = {};

  function refresh() {
    const used = STAT_ORDER.reduce((s, k) => s + (member.statPoints[k] || 0), 0);
    const rem = Math.max(0, STAT_POINTS_TOTAL - used);
    remEl.textContent = `Points remaining: ${rem}`;
    remEl.className = "points-remaining" + (used > STAT_POINTS_TOTAL ? " over-budget" : "");
    for (const k of STAT_ORDER) {
      const { base, finalEl, ptsInput, slider } = rowRefs[k];
      const nat = NATURES[member.nature];
      const boosted = nat && nat[0] === k;
      const nerfed  = nat && nat[1] === k;
      const val = calcStat(base, member.statPoints[k] || 0, k, member.nature);
      finalEl.textContent = val + (boosted ? " +" : nerfed ? " −" : "");
      finalEl.className = "stat-final" + (boosted ? " boosted" : nerfed ? " nerfed" : "");
    }
  }

  for (const k of STAT_ORDER) {
    const base = baseStats[k] || 0;
    const row  = document.createElement("div");
    row.className = "stat-row";

    // Label
    const lbl = document.createElement("div");
    lbl.className = "stat-label";
    lbl.textContent = STAT_LABELS[k];
    row.appendChild(lbl);

    // Base value
    const baseEl = document.createElement("div");
    baseEl.className = "stat-base";
    baseEl.textContent = base;
    row.appendChild(baseEl);

    // Bar
    const barWrap = document.createElement("div");
    barWrap.className = "stat-bar-wrap";
    const bar = document.createElement("div");
    bar.className = "stat-bar-inner";
    bar.style.width  = Math.min(100, (base / 200) * 100) + "%";
    bar.style.backgroundColor = statBarColor(base);
    barWrap.appendChild(bar);
    row.appendChild(barWrap);

    // Points input
    const ptsInput = document.createElement("input");
    ptsInput.type  = "number";
    ptsInput.className = "stat-points-input";
    ptsInput.min   = 0;
    ptsInput.max   = STAT_POINTS_MAX;
    ptsInput.value = member.statPoints[k] || 0;

    // Slider
    const slider = document.createElement("input");
    slider.type  = "range";
    slider.className = "stat-slider";
    slider.min   = 0;
    slider.max   = STAT_POINTS_MAX;
    slider.value = member.statPoints[k] || 0;

    // Final value
    const finalEl = document.createElement("div");
    finalEl.className = "stat-final";

    function makeUpdate(statKey, inp, sld) {
      return (raw) => {
        const current = member.statPoints[statKey] || 0;
        const used = STAT_ORDER.reduce((s, k) => s + (member.statPoints[k] || 0), 0);
        const rem = STAT_POINTS_TOTAL - used;
        const maxAllowed = Math.min(STAT_POINTS_MAX, current + rem);
        const v = Math.max(0, Math.min(maxAllowed, Math.round(raw)));
        member.statPoints[statKey] = v;
        inp.value = v;
        sld.value = v;
        refresh();
      };
    }
    const update = makeUpdate(k, ptsInput, slider);
    ptsInput.addEventListener("change", () => update(parseFloat(ptsInput.value) || 0));
    slider.addEventListener("input",   () => update(parseFloat(slider.value)   || 0));

    row.appendChild(ptsInput);
    row.appendChild(slider);
    row.appendChild(finalEl);
    table.appendChild(row);
    rowRefs[k] = { base, finalEl, ptsInput, slider };
  }

  section.appendChild(remEl);

  natSelect.addEventListener("change", () => {
    member.nature = natSelect.value;
    refresh();
  });

  refresh();
  return section;
}

async function renderDetailPanel() {
  const panel = document.getElementById("detailPanel");
  const slot = state.activeSlot;

  if (slot === null || !state.team[slot]) {
    panel.innerHTML = `
      <div class="detail-empty">
        <div class="big-icon">⚔️</div>
        <p>Select a team slot to configure.</p>
        <p style="font-size:12px;margin-top:4px;">Click a Pokémon in the browser to add it to the active slot.</p>
      </div>
    `;
    return;
  }

  const member = state.team[slot];
  const pokemon = allPokemonById[member.pokemonId];
  if (!pokemon) return;

  // Fetch abilities for this pokemon
  const pokemonData = await api(`/api/pokemon/${pokemon.id}`);
  const pokemonAbilities = pokemonData.abilities || [];

  panel.innerHTML = "";

  // Header
  const header = document.createElement("div");
  header.className = "detail-header";
  const img = document.createElement("img");
  img.src = spriteUrl(pokemon);
  img.alt = pokemon.name;
  img.onerror = () => { img.src = fallbackSprite(pokemon); };

  const info = document.createElement("div");
  info.className = "detail-info";
  info.innerHTML = `
    <h2>${pokemon.name}</h2>
    <div class="detail-types">${typeBadge(pokemon.type1)}${pokemon.type2 ? typeBadge(pokemon.type2) : ""}</div>
    <div class="dex-number">#${String(pokemon.dex_number).padStart(4, "0")} · Gen ${pokemon.generation}${pokemon.is_mega ? " · Mega" : ""}${pokemon.is_regional ? ` · ${pokemon.form}` : ""}</div>
    <input class="nickname-input" id="nicknameInput" type="text" placeholder="Nickname (optional)" value="${member.nickname || ""}" />
  `;
  header.appendChild(img);
  header.appendChild(info);
  panel.appendChild(header);

  document.getElementById("nicknameInput").addEventListener("input", (e) => {
    state.team[slot].nickname = e.target.value;
    renderTeamSlots();
  });

  // Ability picker
  const abilitySection = document.createElement("div");
  abilitySection.className = "ability-picker";

  const abilityLabel = document.createElement("div");
  abilityLabel.className = "section-label";
  abilityLabel.textContent = "Ability";
  abilitySection.appendChild(abilityLabel);

  const abilityOptions = document.createElement("div");
  abilityOptions.className = "ability-options";

  const abilityDesc = document.createElement("div");
  abilityDesc.className = "ability-description";

  if (pokemonAbilities.length === 0) {
    abilityOptions.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">No specific abilities on record — all abilities available</span>';
  } else {
    for (const ab of pokemonAbilities) {
      const chip = document.createElement("div");
      chip.className = `ability-chip ${ab.is_hidden ? "hidden-ability" : ""} ${member.abilityId === ab.id ? "selected" : ""}`;
      chip.textContent = ab.name;
      chip.title = ab.description;
      chip.addEventListener("click", () => {
        member.abilityId = ab.id;
        abilityDesc.textContent = ab.description;
        abilityOptions.querySelectorAll(".ability-chip").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        renderTeamSlots();
      });
      if (member.abilityId === ab.id) abilityDesc.textContent = ab.description;
      abilityOptions.appendChild(chip);
    }
  }
  abilitySection.appendChild(abilityOptions);
  abilitySection.appendChild(abilityDesc);
  panel.appendChild(abilitySection);

  // Item picker
  const itemSection = document.createElement("div");
  itemSection.className = "item-picker";
  const itemLabel = document.createElement("div");
  itemLabel.className = "section-label";
  itemLabel.textContent = "Held Item";
  itemSection.appendChild(itemLabel);

  const currentItem = member.itemId ? state.allItems.find(i => i.id === member.itemId) : null;
  const isMegaLocked = pokemon.is_mega && megaStoneMap[pokemon.sprite_id];
  const itemCurrent = document.createElement("div");
  itemCurrent.className = "item-current" + (isMegaLocked ? " item-locked" : "");
  itemCurrent.innerHTML = `
    <span style="font-size:18px">${isMegaLocked ? "🔒" : "🎒"}</span>
    <div style="flex:1">
      <div class="item-current-name">${currentItem ? currentItem.name : "No item"}</div>
      <div class="item-current-desc">${currentItem ? currentItem.description : "Click to select a held item"}</div>
    </div>
    ${!isMegaLocked && currentItem ? `<span style="color:var(--text-dim);cursor:pointer;font-size:18px" id="clearItem">×</span>` : ""}
  `;
  if (!isMegaLocked) {
    itemCurrent.addEventListener("click", (e) => {
      if (e.target.id === "clearItem") {
        member.itemId = null;
        renderDetailPanel();
        renderTeamSlots();
      } else {
        openItemModal(slot);
      }
    });
  }
  itemSection.appendChild(itemCurrent);
  panel.appendChild(itemSection);

  // Move slots
  const moveSection = document.createElement("div");
  moveSection.className = "move-slots";
  const moveLabel = document.createElement("div");
  moveLabel.className = "section-label";
  moveLabel.textContent = "Moveset";
  moveSection.appendChild(moveLabel);

  const moveGrid = document.createElement("div");
  moveGrid.className = "move-slot-grid";

  for (let mi = 0; mi < 4; mi++) {
    const moveId = member.moves[mi];
    const move = moveId ? state.allMoves.find(m => m.id === moveId) : null;
    const slotEl = document.createElement("div");
    slotEl.className = "move-slot";

    const numEl = document.createElement("div");
    numEl.className = "move-slot-num";
    numEl.textContent = `Move ${mi + 1}`;
    slotEl.appendChild(numEl);

    if (move) {
      const nameEl = document.createElement("div");
      nameEl.className = "move-slot-name";
      nameEl.textContent = move.name;

      const meta = document.createElement("div");
      meta.className = "move-slot-meta";
      meta.innerHTML = `<span class="move-category ${move.category}">${move.category[0].toUpperCase()}</span>${typeBadge(move.type)}<span class="move-slot-power">${move.power ?? "—"} / ${move.accuracy ?? "—"}%</span>`;

      slotEl.appendChild(nameEl);
      slotEl.appendChild(meta);

      const clearBtn = document.createElement("span");
      clearBtn.className = "move-slot-clear";
      clearBtn.textContent = "×";
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        member.moves[mi] = null;
        renderDetailPanel();
      });
      slotEl.appendChild(clearBtn);
    } else {
      const empty = document.createElement("div");
      empty.className = "move-slot-empty";
      empty.textContent = "— Click to select —";
      slotEl.appendChild(empty);
    }

    slotEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("move-slot-clear")) return;
      openMoveModal(slot, mi);
    });
    moveGrid.appendChild(slotEl);
  }

  moveSection.appendChild(moveGrid);
  panel.appendChild(moveSection);

  // Stats section (async — fetches base stats from PokeAPI)
  const statsSection = await renderStatsSection(pokemon, member);
  panel.appendChild(statsSection);
}

// ── Learners Modal ────────────────────────────────────────────────────────
async function openLearnersModal(type, id, name, description) {
  document.getElementById("learnersModalTitle").textContent = name;
  document.getElementById("learnersModalDesc").textContent = description || "";
  document.getElementById("learnersModalCount").textContent = "";
  document.getElementById("learnersModal").style.display = "flex";

  const container = document.getElementById("learnersModalList");
  container.innerHTML = '<div class="loading">Loading Pokémon…</div>';

  try {
    const endpoint = type === "move"
      ? `/api/moves/${id}/learners`
      : `/api/abilities/${id}/learners`;
    const pokemon = await api(endpoint);

    container.innerHTML = "";
    document.getElementById("learnersModalCount").textContent =
      pokemon.length ? `${pokemon.length} Pokémon` : "";

    if (pokemon.length === 0) {
      container.innerHTML = '<div class="empty-state">No Pokémon found.</div>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "pokemon-grid";

    for (const p of pokemon) {
      const card = document.createElement("div");
      card.className = "pokemon-card";

      const img = document.createElement("img");
      img.src = spriteUrl(p);
      img.alt = p.name;
      img.loading = "lazy";
      img.onerror = () => { img.src = fallbackSprite(p); };

      const nameEl = document.createElement("div");
      nameEl.className = "poke-name";
      nameEl.textContent = p.name;

      const types = document.createElement("div");
      types.className = "poke-types";
      types.innerHTML = typeBadge(p.type1) + (p.type2 ? typeBadge(p.type2) : "");

      card.appendChild(img);
      card.appendChild(nameEl);
      card.appendChild(types);
      grid.appendChild(card);
    }

    container.appendChild(grid);
  } catch {
    container.innerHTML = '<div class="empty-state">Failed to load Pokémon.</div>';
  }
}

// ── Team actions ──────────────────────────────────────────────────────────
function addPokemonToTeam(pokemon) {
  let targetSlot = state.activeSlot;
  if (targetSlot === null || state.team[targetSlot]) {
    // Find first empty slot
    targetSlot = state.team.findIndex(m => m === null);
    if (targetSlot === -1) {
      alert("Your team is full! Remove a Pokémon first.");
      return;
    }
  }

  let autoItemId = null;
  if (pokemon.is_mega && megaStoneMap[pokemon.sprite_id]) {
    const stone = state.allItems.find(i => i.name === megaStoneMap[pokemon.sprite_id]);
    if (stone) autoItemId = stone.id;
  }
  state.team[targetSlot] = {
    pokemonId: pokemon.id,
    nickname: "",
    abilityId: null,
    itemId: autoItemId,
    moves: [null, null, null, null],
    nature: "Hardy",
    statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  };
  state.activeSlot = targetSlot;
  renderTeamSlots();
  renderBrowser();
  renderDetailPanel();
}

function removeFromSlot(slot) {
  state.team[slot] = null;
  if (state.activeSlot === slot) state.activeSlot = null;
  renderTeamSlots();
  renderBrowser();
  renderDetailPanel();
}

function selectSlot(slot) {
  state.activeSlot = slot;
  renderTeamSlots();
  renderDetailPanel();
}

// ── Modals ────────────────────────────────────────────────────────────────
async function openMoveModal(slot, moveSlot) {
  state.activeMoveSlot = moveSlot;
  state.learnableMoveIds = null;
  state.learnableMovesLoading = true;
  state.showAllMoves = false;
  document.getElementById("moveModalTitle").textContent = `Move ${moveSlot + 1}`;
  document.getElementById("moveModalSearch").value = "";
  document.getElementById("moveModalType").value = "";
  document.getElementById("moveModalShowAll").checked = false;
  document.getElementById("moveModal").style.display = "flex";
  renderMoveModalList();

  const member = state.team[slot];
  if (member) {
    try {
      const data = await api(`/api/pokemon/${member.pokemonId}/learnable-moves`);
      state.learnableMoveIds = data.map(m => m.id);
    } catch {
      state.learnableMoveIds = null;
    }
  }
  state.learnableMovesLoading = false;
  renderMoveModalList();
}

function renderMoveModalList() {
  const search = document.getElementById("moveModalSearch").value.toLowerCase();
  const type = document.getElementById("moveModalType").value;
  const container = document.getElementById("moveModalList");
  container.innerHTML = "";

  if (state.learnableMovesLoading) {
    container.innerHTML = '<div class="loading">Loading learnable moves…</div>';
    return;
  }

  let filtered = state.allMoves;

  if (!state.showAllMoves && state.learnableMoveIds !== null) {
    const learnableSet = new Set(state.learnableMoveIds);
    filtered = filtered.filter(m => learnableSet.has(m.id));
  }

  if (search) filtered = filtered.filter(m => m.name.toLowerCase().includes(search));
  if (type) filtered = filtered.filter(m => m.type === type);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No moves found.</div>';
    return;
  }

  renderMovesList(container, filtered, "", "", "", (move) => {
    const slot = state.activeSlot;
    const mi = state.activeMoveSlot;
    if (slot !== null && mi !== null) {
      state.team[slot].moves[mi] = move.id;
      document.getElementById("moveModal").style.display = "none";
      renderDetailPanel();
    }
  });
}

function openItemModal(slot) {
  document.getElementById("itemModalSearch").value = "";
  document.getElementById("itemModalCategory").value = "";
  renderItemModalList(slot);
  document.getElementById("itemModal").style.display = "flex";
}

function renderItemModalList(slot) {
  const search = document.getElementById("itemModalSearch").value.toLowerCase();
  const category = document.getElementById("itemModalCategory").value;
  const container = document.getElementById("itemModalList");
  container.innerHTML = "";

  let filtered = state.allItems;
  if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search));
  if (category) filtered = filtered.filter(i => i.category === category);

  for (const item of filtered) {
    const el = document.createElement("div");
    el.className = "item-list-item";
    el.style.cursor = "pointer";

    const catBadge = document.createElement("span");
    catBadge.className = "item-category-badge";
    catBadge.textContent = item.category;

    const nameEl = document.createElement("div");
    nameEl.style.flex = "1";
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = item.name;
    const desc = document.createElement("div");
    desc.style.cssText = "font-size:11px;color:var(--text-muted);margin-top:2px";
    desc.textContent = item.description;
    nameEl.appendChild(name);
    nameEl.appendChild(desc);

    el.appendChild(catBadge);
    el.appendChild(nameEl);
    el.addEventListener("click", () => {
      if (state.activeSlot !== null) {
        state.team[state.activeSlot].itemId = item.id;
        document.getElementById("itemModal").style.display = "none";
        renderDetailPanel();
        renderTeamSlots();
      }
    });
    container.appendChild(el);
  }
}

// ── Save / Load ───────────────────────────────────────────────────────────
async function saveTeam() {
  const name = document.getElementById("teamNameInput").value.trim() || "My Team";

  // Build members payload
  const members = state.team
    .map((m, i) => m ? { slot: i + 1, ...m } : null)
    .filter(Boolean)
    .map(m => ({
      slot: m.slot,
      pokemon_id: m.pokemonId,
      nickname: m.nickname || null,
      ability_id: m.abilityId || null,
      item_id: m.itemId || null,
      moves: m.moves
        .map((moveId, mi) => moveId ? { move_slot: mi + 1, move_id: moveId } : null)
        .filter(Boolean),
    }));

  let res;
  if (state.activeTeamId) {
    res = await fetch(`/api/teams/${state.activeTeamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, members }),
    });
  } else {
    const createRes = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const created = await createRes.json();
    state.activeTeamId = created.id;
    res = await fetch(`/api/teams/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, members }),
    });
  }

  if (res.ok) {
    const btn = document.getElementById("saveTeamBtn");
    btn.textContent = "✓ Saved!";
    setTimeout(() => { btn.textContent = "💾 Save"; }, 1500);
  }
}

async function loadTeams() {
  const teams = await api("/api/teams");
  const container = document.getElementById("teamsListContainer");
  container.innerHTML = "";

  if (teams.length === 0) {
    container.innerHTML = '<div class="empty-state">No saved teams yet.</div>';
    return;
  }

  const list = document.createElement("div");
  list.className = "teams-list";

  for (const team of teams) {
    const el = document.createElement("div");
    el.className = "team-list-item";

    const name = document.createElement("div");
    name.className = "team-list-name";
    name.textContent = team.name;

    const date = document.createElement("div");
    date.className = "team-list-date";
    date.textContent = new Date(team.updated_at).toLocaleDateString();

    const del = document.createElement("span");
    del.className = "team-list-delete";
    del.textContent = "🗑";
    del.title = "Delete team";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${team.name}"?`)) {
        await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
        el.remove();
        if (state.activeTeamId === team.id) {
          state.activeTeamId = null;
        }
      }
    });

    el.appendChild(name);
    el.appendChild(date);
    el.appendChild(del);
    el.addEventListener("click", () => loadTeamIntoEditor(team.id));
    list.appendChild(el);
  }
  container.appendChild(list);
}

async function loadTeamIntoEditor(teamId) {
  const data = await api(`/api/teams/${teamId}`);
  state.activeTeamId = teamId;
  state.team = Array(6).fill(null);
  document.getElementById("teamNameInput").value = data.name;

  for (const member of data.members) {
    const slotIdx = member.slot - 1;
    state.team[slotIdx] = {
      pokemonId: member.pokemon_id,
      nickname: member.nickname || "",
      abilityId: member.ability_id,
      itemId: member.item_id,
      moves: [null, null, null, null],
      nature: member.nature || "Hardy",
      statPoints: member.statPoints || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    };
    for (const mv of member.moves) {
      state.team[slotIdx].moves[mv.move_slot - 1] = mv.move_id;
    }
  }

  state.activeSlot = null;
  document.getElementById("loadModal").style.display = "none";
  renderTeamSlots();
  renderDetailPanel();
}

function clearTeam() {
  if (!state.team.some(m => m !== null)) return;
  if (!confirm("Clear all team members?")) return;
  state.team = Array(6).fill(null);
  state.activeSlot = null;
  state.activeTeamId = null;
  document.getElementById("teamNameInput").value = "My Team";
  renderTeamSlots();
  renderBrowser();
  renderDetailPanel();
}

// ── Lookup helper ─────────────────────────────────────────────────────────
let allPokemonById = {};

// ── Init ──────────────────────────────────────────────────────────────────
function render() {
  // Build lookup
  allPokemonById = {};
  for (const p of state.allPokemon) allPokemonById[p.id] = p;

  renderTeamSlots();
  renderBrowser();
  renderDetailPanel();
}

// ── Event listeners ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Browser tabs
  document.querySelectorAll(".browser-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".browser-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      state.currentTab = tab.dataset.tab;

      // Show/hide filters
      const filterPanels = {
        pokemon: "pokemonFilters",
        moves: "movesFilters",
        items: "itemsFilters",
        abilities: "abilitiesFilters",
      };
      Object.entries(filterPanels).forEach(([t, id]) => {
        document.getElementById(id).style.display = t === state.currentTab ? "" : "none";
      });

      renderBrowser();
    });
  });

  // Pokemon filters
  document.getElementById("pokemonSearch").addEventListener("input", (e) => {
    state.pokemonSearch = e.target.value;
    renderBrowser();
  });
  document.getElementById("typeFilter").addEventListener("change", (e) => {
    state.pokemonType = e.target.value;
    renderBrowser();
  });
  document.getElementById("genFilter").addEventListener("change", (e) => {
    state.pokemonGen = e.target.value;
    renderBrowser();
  });
  document.getElementById("formFilter").addEventListener("change", async (e) => {
    state.pokemonForm = e.target.value;
    // Reload pokemon with appropriate filters
    const mega = e.target.value;
    state.allPokemon = await api(`/api/pokemon${mega ? `?mega=${mega}` : ""}`);
    for (const p of state.allPokemon) allPokemonById[p.id] = p;
    renderBrowser();
  });

  // Move filters
  document.getElementById("moveSearch").addEventListener("input", (e) => {
    state.moveSearch = e.target.value;
    renderBrowser();
  });
  document.getElementById("moveTypeFilter").addEventListener("change", (e) => {
    state.moveType = e.target.value;
    renderBrowser();
  });
  document.getElementById("moveCategoryFilter").addEventListener("change", (e) => {
    state.moveCategory = e.target.value;
    renderBrowser();
  });

  // Item filters
  document.getElementById("itemSearch").addEventListener("input", (e) => {
    state.itemSearch = e.target.value;
    renderBrowser();
  });
  document.getElementById("itemCategoryFilter").addEventListener("change", (e) => {
    state.itemCategory = e.target.value;
    renderBrowser();
  });

  // Ability filters
  document.getElementById("abilitySearch").addEventListener("input", (e) => {
    state.abilitySearch = e.target.value;
    renderBrowser();
  });

  // Header buttons
  document.getElementById("saveTeamBtn").addEventListener("click", saveTeam);
  document.getElementById("clearTeamBtn").addEventListener("click", clearTeam);
  document.getElementById("loadTeamBtn").addEventListener("click", () => {
    loadTeams();
    document.getElementById("loadModal").style.display = "flex";
  });

  // Load modal
  document.getElementById("closeLoadModal").addEventListener("click", () => {
    document.getElementById("loadModal").style.display = "none";
  });
  document.getElementById("loadModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("loadModal")) {
      document.getElementById("loadModal").style.display = "none";
    }
  });

  // Move modal
  document.getElementById("closeMoveModal").addEventListener("click", () => {
    document.getElementById("moveModal").style.display = "none";
  });
  document.getElementById("moveModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("moveModal")) {
      document.getElementById("moveModal").style.display = "none";
    }
  });
  document.getElementById("moveModalSearch").addEventListener("input", renderMoveModalList);
  document.getElementById("moveModalType").addEventListener("change", renderMoveModalList);
  document.getElementById("moveModalShowAll").addEventListener("change", (e) => {
    state.showAllMoves = e.target.checked;
    renderMoveModalList();
  });

  // Item modal
  document.getElementById("closeItemModal").addEventListener("click", () => {
    document.getElementById("itemModal").style.display = "none";
  });
  document.getElementById("itemModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("itemModal")) {
      document.getElementById("itemModal").style.display = "none";
    }
  });
  document.getElementById("itemModalSearch").addEventListener("input", () => renderItemModalList(state.activeSlot));
  document.getElementById("itemModalCategory").addEventListener("change", () => renderItemModalList(state.activeSlot));

  // Learners modal
  document.getElementById("closeLearnersModal").addEventListener("click", () => {
    document.getElementById("learnersModal").style.display = "none";
  });
  document.getElementById("learnersModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("learnersModal")) {
      document.getElementById("learnersModal").style.display = "none";
    }
  });

  // Bootstrap
  loadAll();
});
