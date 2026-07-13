// Semantic category kinds — the calculations engine works with these,
// never with raw category ids (which differ per school project).
// The DB column expense_categories.kind is the source of truth;
// inferKind() is the fallback for rows created before migration v2.

export const KINDS = {
  salary:    { label: 'שכר' },
  building:  { label: 'בניין ותחזוקה' },
  events:    { label: 'פעילויות ואירועים' },
  equipment: { label: 'ציוד ותשתיות' },
  profdev:   { label: 'פיתוח מקצועי' },
  other:     { label: 'אחר' },
};

const RULES = [
  ['salary',    ['שכר']],
  ['profdev',   ['פיתוח']],
  ['building',  ['בניין', 'בנין', 'אחזק', 'תחזוק', 'תפעול']],
  ['equipment', ['קיץ', 'ציוד', 'ריהוט', 'תשתי']],
  ['events',    ['אירוע', 'ארוע', 'חג', 'מסיב', 'פעיל']],
];

export function inferKind(name = '') {
  for (const [kind, words] of RULES) {
    if (words.some(w => name.includes(w))) return kind;
  }
  return 'other';
}

export function withKind(cat) {
  return { ...cat, kind: cat.kind || inferKind(cat.name) };
}

// { categoryId: kind } lookup for a categories array
export function kindMap(categories = []) {
  return Object.fromEntries(categories.map(c => [c.id, c.kind || inferKind(c.name)]));
}
