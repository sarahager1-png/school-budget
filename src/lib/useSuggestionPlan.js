import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase.js';
import {
  buildSuggestionRows, selectedSuggestions, sumSavings, normalizeSuggestionKey, planFromSnapshot,
} from './efficiency.js';

// תוכנית הייעול שנשמרה (budget_approvals) יחד עם הסכומים שלה — כך שדף הבית,
// מסך הסיכום והמסמך החתום מציגים בדיוק את אותה שורה תחתונה.
// selectedKeys === null = עוד לא נשמרה בחירה, ואז ברירת המחדל היא שכל ההצעות נבחרו.
// אחרי סגירה (חתימה) מוחזר הסנפשוט הקפוא כמות שהוא — ר' planFromSnapshot.
export function useSuggestionPlan({
  classes, expenses, expenseCategories, constants, schoolId, budgetYearId, enabled = true,
}) {
  const [selectedKeys, setSelectedKeys] = useState(null);
  const [frozen, setFrozen] = useState(null);
  const [draftParams, setDraftParams] = useState(null);

  useEffect(() => {
    setSelectedKeys(null);
    setFrozen(null);
    setDraftParams(null);
    if (!enabled || !schoolId || !budgetYearId) return;
    let cancelled = false;
    supabase.from('budget_approvals')
      .select('selected_suggestion_keys, summary')
      .eq('school_id', schoolId)
      .eq('budget_year_id', budgetYearId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // טבלה שעוד לא הוקמה במוסד היא מצב ידוע — נופלים לברירת המחדל בשקט
        if (error) console.error(error);
        setFrozen(planFromSnapshot(data?.summary));
        setDraftParams(data?.summary?.draftParams || null);
        if (data?.selected_suggestion_keys) {
          setSelectedKeys(new Set(data.selected_suggestion_keys.map(normalizeSuggestionKey)));
        }
      })
      .catch(err => console.error(err)); // תקלת רשת — נשארים בברירת המחדל
    return () => { cancelled = true; };
  }, [enabled, schoolId, budgetYearId]);

  // draftParams — הכוונון שנעשה במסך הייעול (שכר לימוד, שעות וכו'), כדי שדף
  // הבית יראה את אותם סכומים כמו מסך הייעול והסיכום, לא ברירת מחדל רשתית
  const suggestions = useMemo(
    () => (enabled ? buildSuggestionRows(classes, expenses, expenseCategories, constants, draftParams || {}, selectedKeys ? [...selectedKeys] : []) : []),
    [enabled, classes, expenses, expenseCategories, constants, draftParams, selectedKeys],
  );
  const selected = useMemo(
    () => selectedSuggestions(suggestions, selectedKeys),
    [suggestions, selectedKeys],
  );

  // תקציב סגור לא מחושב מחדש — מחזירים את מה שנחתם
  if (frozen) return frozen;
  return { suggestions, selected, total: sumSavings(selected), frozen: false };
}
