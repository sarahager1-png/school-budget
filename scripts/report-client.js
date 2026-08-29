// המסמך המרכז — הצד האינטראקטיבי. רץ גם בקובץ העצמאי שב-reports/ וגם בתוך
// מבט רשת, עם אותו קוד בדיוק. מניח שבסקופ כבר קיימים המנוע (calculations.js),
// שורות הסעיפים (report-rows.mjs) והקבועים — כולם מוטמעים בזמן הבנייה.
//
// mountReport(root, cfg):
//   cfg.state      — { classes, incomeSources, expenses, constants }  (נערך במקום)
//   cfg.original   — אותו מבנה, כפי שהגיע מהמסד. משמש להשוואה ולאיפוס.
//   cfg.categories — קטגוריות ההוצאה של אותו בית ספר
//   cfg.onSave     — אופציונלי: שמירת תרחיש. מחזיר Promise.
//   cfg.onApply    — אופציונלי: החלה על מערכת בית הספר. מחזיר Promise.
//
// כל עריכה מחשבת מחדש דרך המנוע — אין כאן חשבון משלה.

function mountReport(root, cfg) {
  const S = cfg.state;
  S.removed = S.removed || { classes: [], income: [], expenses: [] };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const num = (v) => Number(v) || 0;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CLASS_TYPE_LABEL = { full: 'תקן מלא', half: 'חצי תקן', none: 'ללא תקן' };

  // השדות שההנהלה יכולה לכוון. שאר הקבועים נשארים כפי שהם במסד.
  const BASIS = [
    ['actualHourlyRate', 'תעריף שעת הוראה בפועל', '₪'],
    ['actualWeeklyHours', 'שעות הוראה לכיתה בחודש'],
    ['ministryHourlyRate', 'תעריף שעת תקן — משרד החינוך', '₪'],
    ['fullClassStudentThreshold', 'סף כיתה מלאה (תלמידים)'],
    ['halfClassStudentThreshold', 'סף חצי תקן (תלמידים)'],
    ['ministryGrantPerStudent', 'תוספת כללית לתלמיד', '₪'],
    ['incomePerStudent', 'שכר לימוד לתלמיד', '₪'],
    ['incomePerStudentTalan', 'תל"ן לתלמיד', '₪'],
    ['expensePerStudent', 'הוצאה לתלמיד', '₪'],
    ['counselingHoursPerClass', 'שעות ייעוץ לכיתה בחודש'],
    ['clubsMonthlyExpensePerClass', 'תוספת חוגים לכיתה בחודש', '₪'],
    ['professionalDevPerClass', 'פיתוח מקצועי לכיתה', '₪'],
  ];

  // הצעות הייעול — נבנות מחדש בכל שינוי, כי שינוי במספרי התלמידים משנה
  // אילו הצעות בכלל אפשריות. הסימון נשמר לפי מפתח ההצעה.
  // אותה נורמליזציה כמו במסך הסיכום — מפתחות שנשמרו בגרסה ישנה של המנוע
  // חייבים לעבור דרכה, אחרת הבחירה השמורה לא תזוהה ותיראה כאילו לא נבחר דבר.
  let selected = cfg.selectedKeys == null ? null : new Set(cfg.selectedKeys.map(normalizeSuggestionKey));
  const suggestions = () => (cfg.mode === 'simple' ? []
    : buildSuggestionRows(S.classes.map(c => ({ ...c, studentCount: num(c.studentCount) })),
        S.expenses, cfg.categories, S.constants, cfg.draftParams || {}));
  const isPicked = (k) => selected == null || selected.has(k);
  // המסמך מציג את ההצעות שנבחרו בלבד. הרשימה המלאה נפתחת לצורך שינוי הבחירה
  // ואינה מודפסת — מי שקורא את המסמך רואה מה הוחלט, לא את כל מה שהוצע.
  let showAllSuggestions = false;

  const totals = () => (cfg.mode === 'simple'
    ? Object.assign(calculateSimpleTotals(S.incomeSources, S.expenses), { totalStudents: 0 })
    : calculateSchoolTotals(S.classes, S.incomeSources, S.expenses, S.constants, cfg.categories));

  const changed = () => JSON.stringify([S.classes, S.incomeSources, S.expenses, S.constants])
    !== JSON.stringify([cfg.original.classes, cfg.original.incomeSources, cfg.original.expenses, cfg.original.constants]);

  // ── ציור ──
  // כל סכום מוצג גם כממוצע חודשי — ההנהלה חושבת בתזרים, לא רק בשנה
  const monthly = (v) => (Number(v) || 0) / 12;
  // שדה עריכה על המסך, ערך מעוצב בהדפסה — input מדפיס את הערך הגולמי שלו
  const editable = (inputHtml, printText) =>
    `${inputHtml}<span class="print-val">${esc(printText)}</span>`;
  function valueCell(v) { return `<td class="num muted-cell">${nis(monthly(v))}</td><td class="num">${nis(v)}</td>`; }

  function rowHtml(r, kindAttr) {
    const removable = r.incomeIndex != null || r.expenseIndex != null;
    const idx = r.incomeIndex != null ? r.incomeIndex : r.expenseIndex;
    const kind = r.incomeIndex != null ? 'income' : 'expense';
    return `
      <tr class="line${(r.items || []).length ? ' group' : ''}${removable ? ' editable' : ''}">
        <td>${esc(r.label)}${removable ? `
          <button class="x no-print" data-remove="${kind}" data-index="${idx}" title="הסרת הסעיף">✕</button>` : ''}</td>
        ${removable
          ? `<td class="num muted-cell">${nis(monthly(r.value))}</td><td class="num">${editable(`<input class="cell" type="number" step="1" value="${Math.round(r.value)}" data-edit="${kind}-amount" data-index="${idx}">`, nis(r.value))}</td>`
          : valueCell(r.value)}
      </tr>${(r.items || []).map(it => `
      <tr class="sub">
        <td>${esc(it.label)}<button class="x no-print" data-remove="expense" data-index="${it.expenseIndex}" title="הסרת הסעיף">✕</button></td>
        <td class="num muted-cell">${nis(monthly(it.value))}</td>
        <td class="num">${editable(`<input class="cell" type="number" step="1" value="${Math.round(it.value)}" data-edit="expense-amount" data-index="${it.expenseIndex}">`, nis(it.value))}</td>
      </tr>`).join('')}`;
  }

  function classRowsHtml() {
    return S.classes.map((c, i) => {
      const b = calculateClassBudget({ ...c, studentCount: num(c.studentCount) }, S.constants);
      return `
      <tr>
        <td>${editable(`<input class="cell wide" value="${esc(c.name)}" data-edit="class-name" data-index="${i}">`, c.name)}</td>
        <td>${editable(`<input class="cell narrow" value="${esc(c.gradeLevel || '')}" data-edit="class-grade" data-index="${i}">`, c.gradeLevel || '—')}</td>
        <td class="num">${editable(`<input class="cell narrow" type="number" min="0" step="1" value="${num(c.studentCount)}" data-edit="class-students" data-index="${i}">`, String(num(c.studentCount)))}</td>
        <td>${CLASS_TYPE_LABEL[getClassType(num(c.studentCount), S.constants)]}</td>
        <td class="num">${b.ministryWeeklyHours}</td>
        <td class="num">${nis(b.ministryIncome)}</td>
        <td class="num">${nis(b.studentIncome + b.talanIncome + b.ministryGrantIncome)}</td>
        <td class="num pos">${nis(b.totalIncome)}</td>
        <td class="num">${nis(b.actualOperatingCost)}</td>
        <td class="num">${nis(b.counselingCost + b.clubsExpense + b.studentExpenses + b.profDevExpense)}</td>
        <td class="num neg">${nis(b.totalExpenses)}</td>
        <td class="num ${b.balance < 0 ? 'neg' : 'pos'}">${nis(b.balance)}
          <button class="x no-print" data-remove="class" data-index="${i}" title="הסרת הכיתה">✕</button></td>
      </tr>`;
    }).join('');
  }

  function render() {
    const t = totals();
    const d = { mode: cfg.mode, classes: S.classes.map(c => ({ ...c, studentCount: num(c.studentCount) })),
      incomeSources: S.incomeSources, expenses: S.expenses, categories: cfg.categories, constants: S.constants };

    root.innerHTML = `
      <div class="doc-toolbar no-print">
        <button data-act="print">הדפסה / שמירה כ-PDF</button>
        ${cfg.onSave ? '<button data-act="save">שמירת התרחיש</button>' : ''}
        ${cfg.onApply ? '<button class="warn" data-act="apply">החלה על המערכת</button>' : ''}
      </div>

      <div class="doc-banner ${changed() ? '' : 'hidden'}">
        <b>תרחיש</b> — המספרים במסמך שונו ואינם זהים לנתוני המערכת.
        <button class="link no-print" data-act="reset">איפוס לנתוני המערכת</button>
      </div>

      <div class="doc-head">
        <div class="bh"><span>ב"ה</span><span>${new Date().toLocaleDateString('he-IL')}</span></div>
        <h1>תקציב שנתי — מסמך מרכז</h1>
        <p class="sub-title">${esc(cfg.name)} · ${esc(cfg.yearLabel)}</p>
        ${cfg.mode === 'simple' ? '<p class="counts">מעקב פשוט — סכומים כלל-בית-ספריים</p>'
          : `<p class="counts">${S.classes.length} כיתות · ${t.totalStudents} תלמידים</p>`}
      </div>

      <div class="kpis">
        <div class="kpi inc"><span>סה"כ הכנסות</span><b>${nis(t.totalIncome)}</b></div>
        <div class="kpi exp"><span>סה"כ הוצאות</span><b>${nis(t.totalExpenses)}</b></div>
        <div class="kpi bal ${t.balance < 0 ? 'neg' : 'pos'}"><span>${t.balance < 0 ? 'גירעון' : 'עודף'}</span><b>${nis(t.balance)}</b></div>
      </div>

      ${cfg.mode === 'simple' ? '' : `
      <div class="ratios">
        <div><span>ממוצע תלמידים לכיתה</span><b>${S.classes.length ? (t.totalStudents / S.classes.length).toFixed(1) : '—'}</b></div>
        <div><span>הכנסה לתלמיד</span><b>${t.totalStudents ? nis(t.totalIncome / t.totalStudents) : '—'}</b></div>
        <div><span>הוצאה לתלמיד</span><b>${t.totalStudents ? nis(t.totalExpenses / t.totalStudents) : '—'}</b></div>
        <div><span>כיסוי ההוצאות מההכנסות</span><b>${t.totalExpenses ? Math.round(t.totalIncome / t.totalExpenses * 100) + '%' : '—'}</b></div>
        <div><span>פער מול תקן משרד החינוך</span><b class="${t.ministryGap > 0 ? 'neg' : 'pos'}">${nis(t.ministryGap)}</b></div>
        <div><span>עלות הוראה לכיתה בשנה</span><b>${S.classes.length ? nis(t.totalClassActualCost / S.classes.length) : '—'}</b></div>
      </div>`}

      <h2>הכנסות — כל הסעיפים</h2>
      <table>
        <thead><tr><th>סעיף</th><th class="num">ממוצע לחודש</th><th class="num">לשנה</th></tr></thead>
        <tbody>
          ${rowsIncome(d, t).map(r => rowHtml(r)).join('')}
          <tr class="total"><td>סה"כ הכנסות</td><td class="num muted-cell">${nis(monthly(t.totalIncome))}</td><td class="num pos">${nis(t.totalIncome)}</td></tr>
        </tbody>
      </table>
      <button class="add no-print" data-act="add-income">+ הוספת סעיף הכנסה</button>

      <h2>הוצאות — כל הסעיפים</h2>
      <table>
        <thead><tr><th>סעיף</th><th class="num">ממוצע לחודש</th><th class="num">לשנה</th></tr></thead>
        <tbody>
          ${rowsExpense(d, t).map(r => rowHtml(r)).join('')}
          <tr class="total"><td>סה"כ הוצאות</td><td class="num muted-cell">${nis(monthly(t.totalExpenses))}</td><td class="num neg">${nis(t.totalExpenses)}</td></tr>
        </tbody>
      </table>
      <button class="add no-print" data-act="add-expense">+ הוספת סעיף הוצאה</button>

      <table class="bottom-line">
        <tbody><tr class="total">
          <td>${t.balance < 0 ? 'גירעון שנתי' : 'עודף שנתי'}</td>
          <td class="num muted-cell">${nis(monthly(t.balance))}</td>
          <td class="num ${t.balance < 0 ? 'neg' : 'pos'}">${nis(t.balance)}</td>
        </tr></tbody>
      </table>

      ${(() => {
        // הצעות הייעול — רק אם המנוע מצא כאלה. הסימון קובע מה נספר, ומצב
        // התקציב שאחריהן מוצג בשורה נפרדת כדי שההנהלה תראה את שתי התמונות.
        const sug = suggestions();
        if (!sug.length) return '';
        const picked = sug.filter(s => isPicked(s.key));
        const saving = picked.reduce((n, s) => n + s.saving, 0);
        const after = t.balance + saving;
        const shown = showAllSuggestions ? sug : picked;
        if (!shown.length && !showAllSuggestions) {
          return `
      <h2>הצעות ייעול</h2>
      <p class="empty-note">לא נבחרו הצעות ייעול.
        <button class="link no-print" data-act="toggle-sug">להצגת ${sug.length} ההצעות שהמערכת מציעה</button>
      </p>`;
        }
        return `
      <h2>הצעות הייעול שנבחרו${showAllSuggestions ? ' — כל ההצעות' : ''}</h2>
      <p class="no-print sug-toggle">
        <button class="link" data-act="toggle-sug">${showAllSuggestions
          ? 'הצגת הנבחרות בלבד'
          : `שינוי הבחירה — הצגת כל ${sug.length} ההצעות`}</button>
      </p>
      <table>
        <thead><tr><th>הצעה</th><th class="num">לחודש</th><th class="num">חיסכון לשנה</th></tr></thead>
        <tbody>
          ${shown.map(s => `
          <tr class="${isPicked(s.key) ? '' : 'unpicked'}">
            <td>${showAllSuggestions
              ? `<label><input type="checkbox" data-pick="${esc(s.key)}"${isPicked(s.key) ? ' checked' : ''}> ${esc(s.label)}</label>`
              : esc(s.label)}</td>
            <td class="num muted-cell">+${nis(monthly(s.saving))}</td>
            <td class="num pos">+${nis(s.saving)}</td>
          </tr>`).join('')}
          <tr class="total"><td>סה"כ הצעות שנבחרו (${picked.length} מתוך ${sug.length} אפשריות)</td><td class="num muted-cell">+${nis(monthly(saving))}</td><td class="num pos">+${nis(saving)}</td></tr>
          <tr class="total"><td>מצב התקציב לאחר יישום ההצעות</td><td class="num muted-cell">${nis(monthly(after))}</td><td class="num ${after < 0 ? 'neg' : 'pos'}">${nis(after)}</td></tr>
        </tbody>
      </table>`;
      })()}

      ${cfg.mode === 'simple' ? '' : `
      <h2>מצבת הכיתות</h2>
      <div class="table-scroll"><table class="classes-table">
        <thead><tr>
          <th>כיתה</th><th>שכבה</th><th class="num">תל׳</th><th>תקן</th>
          <th class="num">ש׳ תקן</th><th class="num">הכנסת משרד</th><th class="num">הורים ותוספת</th><th class="num">סה"כ הכנסות</th>
          <th class="num">עלות הוראה</th><th class="num">שאר ההוצאות</th><th class="num">סה"כ הוצאות</th><th class="num">יתרה</th>
        </tr></thead>
        <tbody>
          ${classRowsHtml()}
          <tr class="total">
            <td colspan="2">סה"כ ${S.classes.length} כיתות</td>
            <td class="num">${t.totalStudents}</td>
            <td colspan="2"></td>
            <td class="num">${nis(t.totalMinistryIncome)}</td>
            <td class="num">${nis(t.totalStudentIncome + t.totalTalanIncome + t.totalMinistryGrantIncome)}</td>
            <td class="num pos">${nis(t.totalMinistryIncome + t.totalStudentIncome + t.totalTalanIncome + t.totalMinistryGrantIncome)}</td>
            <td class="num">${nis(t.totalClassActualCost)}</td>
            <td class="num">${nis(t.totalCounselingCost + t.totalClubsExpense + t.totalStudentExpenses + t.totalProfDev)}</td>
            <td class="num neg">${nis(t.totalClassActualCost + t.totalCounselingCost + t.totalClubsExpense + t.totalStudentExpenses + t.totalProfDev)}</td>
            <td class="num ${t.ministryGap > 0 ? 'neg' : 'pos'}">${nis(-t.ministryGap)}</td>
          </tr>
        </tbody>
      </table></div>
      <p class="table-note">שורת הסיכום כוללת רק את מה שמתחלק לכיתות. הכנסות כלל-בית-ספריות
        (${nis(t.additionalIncome)}) והוצאות שאינן פר כיתה (${nis(t.otherExpenses)}) נספרות בטבלאות שלמעלה
        ואינן כאן — ולכן היתרה בשורה הזאת אינה יתרת בית הספר.</p>
      <button class="add no-print" data-act="add-class">+ הוספת כיתה</button>

      <h2>בסיס החישוב</h2>
      <div class="basis">
        ${BASIS.map(([k, label, money]) => `
          <div><span>${label}</span>
            ${editable(`<input class="cell narrow" type="number" step="1" value="${num(S.constants[k])}" data-edit="const" data-key="${k}">`, money ? nis(S.constants[k]) : String(num(S.constants[k])))}</div>`).join('')}
      </div>`}

      <h2>הערות</h2>
      ${cfg.notes ? `<div class="saved-note">${esc(cfg.notes)}</div>` : ''}
      <div class="notes-lines">
        <p class="no-print">מקום לכתיבה — אפשר להקליד כאן לפני ההדפסה, או להשאיר ריק ולכתוב ביד.</p>
        ${'<div class="line" contenteditable="true"></div>'.repeat(6)}
      </div>

      <div class="signs">
        <div class="sign"><span>חתימת המנהלת${cfg.principalName ? ' — ' + esc(cfg.principalName) : ''}</span><div class="rule"></div></div>
        <div class="sign"><span>חתימת השליח${cfg.courierName ? ' — ' + esc(cfg.courierName) : ''}</span><div class="rule"></div></div>
      </div>`;
  }

  // ── עריכה ──
  root.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-edit]');
    if (!el) return;
    const i = Number(el.dataset.index);
    switch (el.dataset.edit) {
      case 'class-students': S.classes[i].studentCount = num(el.value); break;
      case 'class-name': S.classes[i].name = el.value; return;   // טקסט בלבד — אין צורך לצייר מחדש
      case 'class-grade': S.classes[i].gradeLevel = el.value; return;
      case 'income-amount': S.incomeSources[i].amount = num(el.value); break;
      case 'expense-amount': {
        // הוזן סכום שנתי; סעיף שמוגדר חודשי נשמר חזרה כסכום לחודש
        const e = S.expenses[i];
        e.amount = e.period === 'monthly' ? num(el.value) / 12 : num(el.value);
        break;
      }
      case 'const': S.constants[el.dataset.key] = num(el.value); break;
      default: return;
    }
    // ציור מחדש שומר על המיקוד ועל מיקום הסמן, אחרת אי אפשר להקליד ברצף
    const key = el.dataset.edit + ':' + (el.dataset.index ?? el.dataset.key);
    const pos = el.selectionStart;
    render();
    const back = root.querySelector(`[data-edit="${el.dataset.edit}"]` +
      (el.dataset.key ? `[data-key="${el.dataset.key}"]` : `[data-index="${el.dataset.index}"]`));
    if (back) { back.focus(); try { back.setSelectionRange(pos, pos); } catch { /* number input */ } }
    void key;
  });

  root.addEventListener('change', (ev) => {
    const pick = ev.target.closest('[data-pick]');
    if (!pick) return;
    // null = הכול נבחר. ברגע שמורידים סימון ראשון הופכים לרשימה מפורשת.
    if (selected == null) selected = new Set(suggestions().map(s => s.key));
    if (pick.checked) selected.add(pick.dataset.pick); else selected.delete(pick.dataset.pick);
    S.selectedKeys = [...selected];
    render();
  });

  root.addEventListener('click', async (ev) => {
    const rm = ev.target.closest('[data-remove]');
    if (rm) {
      const i = Number(rm.dataset.index);
      const bucket = { class: 'classes', income: 'incomeSources', expense: 'expenses' }[rm.dataset.remove];
      const removedKey = { class: 'classes', income: 'income', expense: 'expenses' }[rm.dataset.remove];
      const row = S[bucket][i];
      if (row?.id) S.removed[removedKey].push(row.id);   // כדי שההחלה תדע למחוק גם במסד
      S[bucket].splice(i, 1);
      return render();
    }

    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (!act) return;

    if (act === 'reset') {
      S.classes = clone(cfg.original.classes);
      S.incomeSources = clone(cfg.original.incomeSources);
      S.expenses = clone(cfg.original.expenses);
      S.constants = clone(cfg.original.constants);
      S.removed = { classes: [], income: [], expenses: [] };
      return render();
    }
    if (act === 'add-class') {
      S.classes.push({ name: 'כיתה חדשה', gradeLevel: '', studentCount: 0 });
      return render();
    }
    if (act === 'add-income') {
      const name = prompt('שם סעיף ההכנסה');
      if (!name) return;
      S.incomeSources.push({ name, amount: num(prompt('סכום לשנה', '0')) });
      return render();
    }
    if (act === 'add-expense') {
      const name = prompt('שם סעיף ההוצאה');
      if (!name) return;
      const amount = num(prompt('סכום', '0'));
      const monthly = confirm('האם הסכום הוא לחודש?  אישור = לחודש, ביטול = לשנה');
      const cat = cfg.categories[0];
      S.expenses.push({ name, amount, period: monthly ? 'monthly' : 'yearly', categoryId: cat?.id });
      return render();
    }
    if (act === 'toggle-sug') { showAllSuggestions = !showAllSuggestions; return render(); }
    if (act === 'print') return window.print();
    if (act === 'save' && cfg.onSave) return busy(ev.target, () => cfg.onSave(S), 'נשמר ✓');
    if (act === 'apply' && cfg.onApply) {
      if (!confirm('הנתונים ייכתבו למערכת של בית הספר והמנהלת תראה אותם. להמשיך?')) return;
      return busy(ev.target, () => cfg.onApply(S), 'הוחל ✓');
    }
  });

  async function busy(btn, fn, okText) {
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = 'רגע...';
    try {
      await fn();
      btn.textContent = okText;
    } catch (e) {
      btn.textContent = 'לא נשמר — ' + (e?.message || 'שגיאה');
    }
    setTimeout(() => { btn.textContent = original; btn.disabled = false; render(); }, 2200);
  }

  render();
  return { render, state: S };
}
