export type Tag = { name: string; description: string };

export const tags: Tag[] = [
  { name: "Bard", description: "Tempo control — Speed manipulation to swing the pace of battle in your favor." },
  { name: "Ritualist", description: "Trick Room setter — inverts turn order to let slow, bulky attackers move first." },
  { name: "Paladin", description: "Redirector or healer — draws attacks away from allies, or keeps the team topped up." },
  { name: "Barbarian", description: "Snowballing sweeper — boosts its own stats to overwhelm with raw power." },
  { name: "Fighter", description: "Wallbreaker — high offensive stats paired with a raw power-boosting ability." },
  { name: "Rogue", description: "Pivot — switches out after acting to keep momentum on your side." },
  { name: "Wizard", description: "Spread caster — hits the whole field with a big multi-target attack." },
  { name: "Druid", description: "Field control — weather/terrain setter, or sets/clears entry hazards." },
  { name: "Warlock", description: "Status disruptor — bulky enough to spread status conditions safely." },
  { name: "Wildcard", description: "Utility and gimmick — a trait that fundamentally changes what the mon is mid-battle." },
];
