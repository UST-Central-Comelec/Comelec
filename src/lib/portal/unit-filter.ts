type UnitMember = { affiliation: string; college: string | null };

export function matchesUnit(member: UnitMember, unit?: string) {
  return !unit || (unit === "central" ? member.affiliation === "central" : member.affiliation === "local" && member.college === unit);
}

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])));
    row = next;
  }
  return row[b.length];
}

/** Full names and abbreviations rank first; small typos show nearby matches. */
export function rankUnitLabels(options: readonly string[], query: string): string[] {
  const search = query.trim().toLowerCase();
  if (!search) return [...options];
  return options.map((label, index) => {
    const text = label.toLowerCase();
    const abbreviation = text.match(/\(([^)]+)\)$/)?.[1];
    let score = Infinity;
    if (text === search || abbreviation === search) score = 0;
    else if (text.startsWith(search) || abbreviation?.startsWith(search)) score = 1;
    else if (text.includes(search)) score = 2;
    else if (search.length >= 3) {
      const candidates = [text.replace(/\s*\([^)]+\)$/, ""), ...text.split(/[^a-z0-9]+/).filter(Boolean)];
      const nearest = Math.min(...candidates.map(candidate => distance(search, candidate)));
      if (nearest <= Math.max(1, Math.floor(search.length * .25))) score = 3 + nearest;
    }
    return { label, score, index };
  }).filter(option => Number.isFinite(option.score)).sort((a, b) => a.score - b.score || a.index - b.index).map(option => option.label);
}
