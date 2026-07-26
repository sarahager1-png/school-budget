import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase.js';
import {
  buildSuggestionRows, selectedSuggestions, sumSavings, normalizeSuggestionKey,
} from './efficiency.js';

// תוכנית הייעול שנשמרה (budget_approvals) יחד עם הסכומים שלה — כך שדף הבית,
// מסך הסיכום והמסמך החתום מציגים בדיוק את אותה שורה תחתונה.
// selectedKeys === null = עוד לא נשמרה בחירה, ואז ברירת המחדל היא שכל ההצעות נבחרו.
export function useSuggestionPlan({
  classes, expenses, expenseCategories, constants, schoolId, budgetYearId, enabled = true,
}) {
  const [selectedKeys, setSelectedKeys] = useState(null);

  useEffect(() => {
    setSelectedKeys(null);
    if (!enabled || !schoolId || !budgetYearId) return;
    let cancelled = false;
    supabase.from('budget_approvals')
      .select('selected_suggestion_keys')
      .eq('school_id', schoolId)
      .eq('budget_year_id', budgetYearId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // טבלה שעוד לא הוקמה במוסד היא מצב ידוע — נופלים לברירת המחדל בשקט
        if (error) console.error(error);
        if (data?.selected_suggestion_keys) {
          setSelectedKeys(new Set(data.selected_suggestion_keys.map(normalizeSuggestionKey)));
        }
      })
      .catch(err => console.error(err)); // תקלת רשת — נשארים בברירת המחדל
    return () => { cancelled = true; };
  }, [enabled, schoolId, budgetYearId]);

  const suggestions = useMemo(
    () => (enabled ? buildSuggestionRows(classes, expenses, expenseCategories, constants) : []),
    [enabled, classes, expenses, expenseCategories, constants],
  );
  const selected = useMemo(
    () => selectedSuggestions(suggestions, selectedKeys),
    [suggestions, selectedKeys],
  );

  return { suggestions, selected, total: sumSavings(selected) };
}
