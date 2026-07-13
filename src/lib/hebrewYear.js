// Hebrew year label for a school year that starts in September of `gregYear`.
// 2025 → תשפ"ו (5786), 2026 → תשפ"ז ... works for any year in the ת' millennium.
const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

export function hebrewYearLabel(gregYear) {
  let n = gregYear + 3761 - 5000; // e.g. 2025 → 786
  let s = '';
  while (n >= 400) { s += 'ת'; n -= 400; }
  s += HUNDREDS[Math.floor(n / 100)];
  n %= 100;
  // avoid יה/יו (spell as טו/טז)
  if (n === 15) { s += 'טו'; n = 0; }
  else if (n === 16) { s += 'טז'; n = 0; }
  else {
    s += TENS[Math.floor(n / 10)];
    n %= 10;
    s += ONES[n];
  }
  // gershayim before the last letter
  if (s.length >= 2) s = s.slice(0, -1) + '"' + s.slice(-1);
  return s;
}

export function schoolYearLabel(gregYear) {
  return `שנת ${hebrewYearLabel(gregYear)} (${gregYear}-${gregYear + 1})`;
}
