import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { isPlanClosed, planFromSnapshot, totalsFromSnapshot } from './efficiency.js';

// האם שנת התקציב נסגרה בחתימה. מרגע הסגירה אסור שיהיו שינויים — לא בהצעות
// הייעול ולא במספרי התלמידים — ולכן כל מסך עריכה נועל את עצמו לפי הדגל הזה.
// האכיפה עצמה יושבת במסד (migration_v20_freeze_closed_year.sql); כאן זו
// שכבת הממשק, כדי שהמשתמשת תראה נעילה במקום שגיאה בשמירה.
export function useBudgetClosed(schoolId, budgetYearId) {
  const [state, setState] = useState({ closed: false, loading: true, summary: null });

  useEffect(() => {
    setState({ closed: false, loading: true, summary: null });
    if (!schoolId || !budgetYearId) return;
    let cancelled = false;
    supabase.from('budget_approvals')
      .select('summary')
      .eq('school_id', schoolId)
      .eq('budget_year_id', budgetYearId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // טבלה שעוד לא הוקמה במוסד — נחשב "לא סגור", בלי להקפיץ שגיאה
        if (error) console.error(error);
        const summary = data?.summary ?? null;
        setState({ closed: isPlanClosed(summary), loading: false, summary });
      })
      .catch(err => { console.error(err); if (!cancelled) setState({ closed: false, loading: false, summary: null }); });
    return () => { cancelled = true; };
  }, [schoolId, budgetYearId]);

  // פתיחה מחדש — לאדמין הרשת בלבד. מנקה את שדות הסנפשוט הקפוא (suggestions/
  // total/classes וכו') כדי שהשנה תחזור למצב פתוח לעריכה — אבל שומרת את
  // draftParams (הכוונון שנשמר בתוך אותו סנפשוט) כדי שמסך הייעול לא יחזור
  // לברירות המחדל הרשתיות סתם כי פתחנו מחדש.
  const reopen = async () => {
    const reopenedSummary = state.summary?.draftParams ? { draftParams: state.summary.draftParams } : null;
    const { error } = await supabase.from('budget_approvals')
      .update({ summary: reopenedSummary, updated_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('budget_year_id', budgetYearId);
    if (error) return { error };
    setState(s => ({ ...s, closed: false, summary: reopenedSummary }));
    return {};
  };

  return {
    ...state,
    reopen,
    plan: planFromSnapshot(state.summary),
    totals: totalsFromSnapshot(state.summary),
  };
}
