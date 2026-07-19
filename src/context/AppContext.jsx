import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { DEFAULT_CONSTANTS, MANAGERS } from '../data/constants.js';
import { withKind } from '../lib/categoryKinds.js';

const AppContext = createContext(null);

function mapConstantsFromDB(row) {
  return {
    schoolWeeks: row.school_weeks,
    fullClassStudentThreshold: row.full_class_student_threshold,
    halfClassStudentThreshold: row.half_class_student_threshold,
    fullClassMinistryHours: row.full_class_ministry_hours,
    halfClassMinistryHours: row.half_class_ministry_hours,
    ministryHourlyRate: Number(row.ministry_hourly_rate),
    actualWeeklyHours: row.actual_weekly_hours,
    actualHourlyRate: Number(row.actual_hourly_rate),
    ofekSalary: row.ofek_salary ?? null,
    incomePerStudent: Number(row.income_per_student),
    incomePerStudentBooks: Number(row.income_per_student_books ?? 280),
    expensePerStudent: Number(row.expense_per_student),
    professionalDevPerClass: Number(row.professional_dev_per_class),
    principalMonthlySalary: Number(row.principal_monthly_salary),
    incomePerStudentCaharon: Number(row.income_per_student_caharon ?? 0),
    expensePerStudentCaharon: Number(row.expense_per_student_caharon ?? 0),
    ministryGrantPerStudent: Number(row.ministry_grant_per_student ?? 360),
  };
}

function mapConstantsToDB(c) {
  return {
    school_weeks: c.schoolWeeks,
    full_class_student_threshold: c.fullClassStudentThreshold,
    half_class_student_threshold: c.halfClassStudentThreshold,
    full_class_ministry_hours: c.fullClassMinistryHours,
    half_class_ministry_hours: c.halfClassMinistryHours,
    ministry_hourly_rate: c.ministryHourlyRate,
    actual_weekly_hours: c.actualWeeklyHours,
    actual_hourly_rate: c.actualHourlyRate,
    ofek_salary: c.ofekSalary ?? null,
    income_per_student: c.incomePerStudent,
    income_per_student_books: c.incomePerStudentBooks,
    expense_per_student: c.expensePerStudent,
    professional_dev_per_class: c.professionalDevPerClass,
    principal_monthly_salary: c.principalMonthlySalary,
    income_per_student_caharon: c.incomePerStudentCaharon,
    expense_per_student_caharon: c.expensePerStudentCaharon,
    ministry_grant_per_student: c.ministryGrantPerStudent,
  };
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [school, setSchoolState] = useState(null);
  const [budgetYears, setBudgetYears] = useState([]);
  const [currentYear, setCurrentYear] = useState(null);
  const [constants, setConstantsState] = useState(DEFAULT_CONSTANTS);
  const [classes, setClasses] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseRequests, setExpenseRequests] = useState([]);
  const [usersList, setUsersList] = useState([]);
  // Message shown on the login page after a bounced OAuth login (no profile)
  const [authNotice, setAuthNotice] = useState('');
  // Set only after loadDataForYear finished — expenses/constants in state really belong to this year.
  // Guards the salary self-heal from firing on the default constants before the real ones load.
  const [yearDataInfo, setYearDataInfo] = useState(null);

  // ── Toasts: feedback after every action ─────────────────────
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const notify = useCallback((message, type = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === 'error' ? 4500 : 2500);
  }, []);
  const saveFailed = useCallback((error) => {
    console.error(error);
    notify('הפעולה לא נשמרה — בדקי את החיבור ונסי שוב', 'error');
  }, [notify]);

  const loadDataForYear = useCallback(async (schoolId, yearId) => {
    setYearDataInfo(null);
    const [classesRes, incomeRes, expensesRes, requestsRes, constRes] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', schoolId).eq('budget_year_id', yearId),
      supabase.from('income_sources').select('*').eq('school_id', schoolId).eq('budget_year_id', yearId),
      supabase.from('expenses').select('*').eq('school_id', schoolId).eq('budget_year_id', yearId),
      supabase.from('expense_requests').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('financial_constants').select('*').eq('budget_year_id', yearId).maybeSingle(),
    ]);

    setClasses((classesRes.data ?? []).map(c => ({
      id: c.id, name: c.name, gradeLevel: c.grade_level,
      section: c.section, studentCount: c.student_count, notes: c.notes,
    })));
    setIncomeSources((incomeRes.data ?? []).map(s => ({
      id: s.id, name: s.name, amount: Number(s.amount), type: s.type, notes: s.notes,
    })));
    setExpenses((expensesRes.data ?? []).map(e => ({
      id: e.id, categoryId: e.category_id, name: e.name, amount: Number(e.amount),
      period: e.period, status: e.status, isRecurring: e.is_recurring, notes: e.notes,
    })));
    setExpenseRequests((requestsRes.data ?? []).map(r => ({
      id: r.id, expenseId: r.expense_id, name: r.name, amount: Number(r.amount),
      status: r.status, assignedTo: r.assigned_to, notes: r.notes,
      receiptUrl: r.receipt_url,
      createdAt: r.created_at?.split('T')[0],
      paidAt: r.paid_at?.split('T')[0] ?? null,
    })));
    // No constants row yet for this year → fall back to defaults, never to a stale year
    setConstantsState(constRes.data ? mapConstantsFromDB(constRes.data) : DEFAULT_CONSTANTS);
    setYearDataInfo({ yearId, hasConstantsRow: !!constRes.data });
  }, []);

  const loadSupabaseData = useCallback(async (supabaseUser) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      return { error: { message: 'החשבון הזה עדיין לא חובר לבית הספר. פני לשרה הגר · 0503339770 ונחבר אותו מיד.' } };
    }

    setUser({
      id: profile.id,
      name: profile.full_name ?? profile.name,
      email: supabaseUser.email,
      role: profile.role,
      schoolId: profile.school_id,
      initials: profile.initials,
    });
    // couriers land on their own screen
    if (profile.role === 'courier') setCurrentPage('courier');

    const [schoolRes, yearsRes, catsRes, usersRes] = await Promise.all([
      supabase.from('schools').select('*').eq('id', profile.school_id).single(),
      supabase.from('budget_years').select('*').eq('school_id', profile.school_id).order('year', { ascending: false }),
      supabase.from('expense_categories').select('*').eq('school_id', profile.school_id).order('sort_order'),
      supabase.from('profiles').select('id, name, role, initials').eq('school_id', profile.school_id),
    ]);

    if (schoolRes.data) {
      setSchoolState({
        id: schoolRes.data.id,
        name: schoolRes.data.name,
        logoUrl: schoolRes.data.logo_url,
        mode: schoolRes.data.mode === 'simple' ? 'simple' : 'full',
      });
    }
    if (catsRes.data) {
      setExpenseCategories(catsRes.data.map(c => withKind({ id: c.id, name: c.name, color: c.color, kind: c.kind })));
    }
    if (usersRes.data) {
      setUsersList(usersRes.data);
    }
    if (yearsRes.data) {
      const mapped = yearsRes.data.map(y => ({
        id: y.id, year: y.year, label: y.label,
        startDate: y.start_date, endDate: y.end_date,
        isActive: y.is_active, status: y.status,
      }));
      setBudgetYears(mapped);
      const active = mapped.find(y => y.isActive) || mapped[0];
      if (active) {
        setCurrentYear(active);
        await loadDataForYear(profile.school_id, active.id);
      }
    }
    return { error: null };
  }, [loadDataForYear]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadSupabaseData(session.user)
          .then(res => { if (res?.error) setAuthNotice(res.error.message); })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setSchoolState(null);
        setBudgetYears([]);
        setCurrentYear(null);
        setClasses([]);
        setIncomeSources([]);
        setExpenseCategories([]);
        setExpenses([]);
        setExpenseRequests([]);
        setUsersList([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadSupabaseData]);

  // ── Auth ─────────────────────────────────────────────────────

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    const result = await loadSupabaseData(data.user);
    if (result?.error) return { error: result.error };
    setLoading(false);
    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSchoolState(null);
    setBudgetYears([]);
    setCurrentYear(null);
    setClasses([]);
    setIncomeSources([]);
    setExpenseCategories([]);
    setExpenses([]);
    setExpenseRequests([]);
    setUsersList([]);
    setCurrentPage('dashboard');
  };

  const navigate = (page) => setCurrentPage(page);

  // ── Classes ──────────────────────────────────────────────────

  const addClass = async (cls) => {
    const { data, error } = await supabase.from('classes').insert({
      school_id: user.schoolId,
      budget_year_id: currentYear.id,
      name: cls.name, grade_level: cls.gradeLevel,
      section: cls.section, student_count: cls.studentCount, notes: cls.notes,
    }).select().single();
    if (error || !data) return saveFailed(error);
    setClasses(prev => [...prev, {
      id: data.id, name: data.name, gradeLevel: data.grade_level,
      section: data.section, studentCount: data.student_count, notes: data.notes,
    }]);
    notify('הכיתה נוספה ✓');
  };

  const updateClass = async (id, cls) => {
    const { error } = await supabase.from('classes').update({
      name: cls.name, grade_level: cls.gradeLevel,
      section: cls.section, student_count: cls.studentCount, notes: cls.notes,
    }).eq('id', id);
    if (error) return saveFailed(error);
    setClasses(prev => prev.map(c => c.id === id ? { ...c, ...cls } : c));
    notify('הכיתה עודכנה ✓');
  };

  const deleteClass = async (id) => {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) return saveFailed(error);
    setClasses(prev => prev.filter(c => c.id !== id));
    notify('הכיתה נמחקה');
  };

  // ── Income Sources ───────────────────────────────────────────

  const addIncomeSource = async (src) => {
    const { data, error } = await supabase.from('income_sources').insert({
      school_id: user.schoolId, budget_year_id: currentYear.id,
      name: src.name, amount: src.amount, type: src.type, notes: src.notes,
    }).select().single();
    if (error || !data) return saveFailed(error);
    setIncomeSources(prev => [...prev, {
      id: data.id, name: data.name, amount: Number(data.amount), type: data.type, notes: data.notes,
    }]);
    notify('מקור ההכנסה נוסף ✓');
  };

  const updateIncomeSource = async (id, src) => {
    const { error } = await supabase.from('income_sources').update({
      name: src.name, amount: src.amount, type: src.type, notes: src.notes,
    }).eq('id', id);
    if (error) return saveFailed(error);
    setIncomeSources(prev => prev.map(s => s.id === id ? { ...s, ...src } : s));
    notify('מקור ההכנסה עודכן ✓');
  };

  const deleteIncomeSource = async (id) => {
    const { error } = await supabase.from('income_sources').delete().eq('id', id);
    if (error) return saveFailed(error);
    setIncomeSources(prev => prev.filter(s => s.id !== id));
    notify('מקור ההכנסה נמחק');
  };

  // ── Expenses ─────────────────────────────────────────────────

  const addExpense = async (exp) => {
    const { data, error } = await supabase.from('expenses').insert({
      school_id: user.schoolId, budget_year_id: currentYear.id,
      category_id: exp.categoryId, name: exp.name, amount: exp.amount,
      period: exp.period, is_recurring: exp.isRecurring, status: exp.status, notes: exp.notes,
    }).select().single();
    if (error || !data) return saveFailed(error);
    setExpenses(prev => [...prev, {
      id: data.id, categoryId: data.category_id, name: data.name, amount: Number(data.amount),
      period: data.period, status: data.status, isRecurring: data.is_recurring, notes: data.notes,
    }]);
    notify('ההוצאה נוספה ✓');
  };

  const updateExpense = async (id, exp) => {
    const { error } = await supabase.from('expenses').update({
      category_id: exp.categoryId, name: exp.name, amount: exp.amount,
      period: exp.period, is_recurring: exp.isRecurring, status: exp.status, notes: exp.notes,
    }).eq('id', id);
    if (error) return saveFailed(error);
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...exp } : e));
    // שכר מנהלת נערך גם מכאן — שומרים את הקבוע בהגדרות מסונכרן, מקור אמת אחד
    if (exp.name === 'שכר מנהלת' && exp.period === 'monthly' && currentYear) {
      await supabase.from('financial_constants')
        .update({ principal_monthly_salary: exp.amount })
        .eq('budget_year_id', currentYear.id);
      setConstantsState(prev => ({ ...prev, principalMonthlySalary: exp.amount }));
    }
    notify('ההוצאה עודכנה ✓');
  };

  const deleteExpense = async (id) => {
    const removed = expenses.find(e => e.id === id);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return saveFailed(error);
    setExpenses(prev => prev.filter(e => e.id !== id));
    // מחיקת שכר מנהלת מאפסת את הקבוע — אחרת הריפוי האוטומטי ירשום אותו מחדש בכניסה הבאה
    if (removed?.name === 'שכר מנהלת' && currentYear) {
      await supabase.from('financial_constants')
        .update({ principal_monthly_salary: 0 })
        .eq('budget_year_id', currentYear.id);
      setConstantsState(prev => ({ ...prev, principalMonthlySalary: 0 }));
    }
    notify('ההוצאה נמחקה');
  };

  // ── Expense Requests ─────────────────────────────────────────

  const addExpenseRequest = async (req) => {
    const courier = usersList.find(u => u.role === 'courier');
    const { data, error } = await supabase.from('expense_requests').insert({
      school_id: user.schoolId,
      expense_id: req.expenseId, name: req.name, amount: req.amount,
      status: 'pending', assigned_to: courier?.id ?? null, notes: req.notes,
    }).select().single();
    if (error || !data) return saveFailed(error);
    setExpenseRequests(prev => [{
      id: data.id, expenseId: data.expense_id, name: data.name, amount: Number(data.amount),
      status: data.status, assignedTo: data.assigned_to, notes: data.notes,
      receiptUrl: null, createdAt: data.created_at?.split('T')[0], paidAt: null,
    }, ...prev]);
    notify('הבקשה נשלחה לשליח ✓');
  };

  const updateExpenseRequest = async (id, updates) => {
    const dbUpdates = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.receiptUrl !== undefined) dbUpdates.receipt_url = updates.receiptUrl;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.status === 'paid') dbUpdates.paid_at = new Date().toISOString();
    if (updates.status === 'completed') dbUpdates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('expense_requests').update(dbUpdates).eq('id', id);
    if (error) return saveFailed(error);
    setExpenseRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    notify('הבקשה עודכנה ✓');
  };

  // ── Budget Years ─────────────────────────────────────────────

  const addBudgetYear = async (yr) => {
    const { data, error } = await supabase.from('budget_years').insert({
      school_id: user.schoolId,
      year: yr.year, label: yr.label,
      start_date: yr.startDate, end_date: yr.endDate,
      is_active: false, status: 'active',
    }).select().single();
    if (error || !data) return saveFailed(error);

    // Copy this year's financial constants into the new year, so the
    // numbers don't silently reset to defaults when the year is opened.
    await supabase.from('financial_constants').insert({
      ...mapConstantsToDB(constants),
      school_id: user.schoolId,
      budget_year_id: data.id,
    });

    setBudgetYears(prev => [{
      id: data.id, year: data.year, label: data.label,
      startDate: data.start_date, endDate: data.end_date,
      isActive: false, status: 'active',
    }, ...prev]);
    notify('שנת התקציב נוספה ✓');
  };

  const activateBudgetYear = async (id) => {
    const { error: e1 } = await supabase.from('budget_years').update({ is_active: false }).eq('school_id', user.schoolId);
    const { error: e2 } = await supabase.from('budget_years').update({ is_active: true }).eq('id', id);
    if (e1 || e2) return saveFailed(e1 || e2);
    const year = budgetYears.find(y => y.id === id);
    setBudgetYears(prev => prev.map(y => ({ ...y, isActive: y.id === id })));
    setCurrentYear(year);
    if (year) await loadDataForYear(user.schoolId, id);
  };

  // ── Users ────────────────────────────────────────────────────

  const deleteUser = async (id) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) return saveFailed(error);
    setUsersList(prev => prev.filter(u => u.id !== id));
    notify('המשתמש הוסר');
  };

  // ── Constants ────────────────────────────────────────────────

  // שכר מנהלת: ממלאים פעם אחת בהגדרות ← נרשם/מתעדכן אוטומטית
  // כהוצאה חודשית בקטגוריית השכר (ונספר ×12 בכל התחשיבים).
  const syncPrincipalSalaryExpense = async (monthlyAmount) => {
    if (!monthlyAmount || monthlyAmount <= 0) return;
    const salaryCat = expenseCategories.find(c => c.kind === 'salary');
    if (!salaryCat) return;
    const existing = expenses.find(e => e.name === 'שכר מנהלת');
    if (existing) {
      if (existing.amount === monthlyAmount && existing.period === 'monthly') return;
      await updateExpense(existing.id, { ...existing, amount: monthlyAmount, period: 'monthly' });
    } else {
      await addExpense({
        categoryId: salaryCat.id, name: 'שכר מנהלת', amount: monthlyAmount,
        period: 'monthly', isRecurring: true, status: 'approved',
        notes: 'מתעדכן אוטומטית מההגדרות',
      });
    }
  };

  // ריפוי עצמי: הסכום נזרע ב-DB בהקמת בית הספר, אבל ההוצאה נרשמה עד כה רק
  // בשמירת קבועים בהגדרות — בתי ספר שלא שמרו מעולם לא ראו שכר מנהלת בהוצאות.
  // לביטול: מאפסים את שכר המנהלת בהגדרות (0), ואז לא נרשם דבר.
  const salaryHealed = useRef(null);
  useEffect(() => {
    if (!user || !currentYear || school?.mode === 'simple') return;
    if (!MANAGERS.includes(user.role)) return;
    // רק אחרי שנתוני השנה נטענו בפועל, ורק כשיש שורת קבועים אמיתית ב-DB —
    // אחרת האפקט רץ על ברירות המחדל ורושם שכר שגוי / כפול (קרה באשקלון 19/7)
    if (!yearDataInfo || yearDataInfo.yearId !== currentYear.id || !yearDataInfo.hasConstantsRow) return;
    if (salaryHealed.current === currentYear.id) return;
    if (expenseCategories.length === 0) return;
    if (!(constants.principalMonthlySalary > 0)) return;
    salaryHealed.current = currentYear.id;
    if (expenses.some(e => e.name === 'שכר מנהלת')) return;
    if (!expenseCategories.some(c => c.kind === 'salary')) return;
    syncPrincipalSalaryExpense(constants.principalMonthlySalary);
  }, [user, currentYear, school, constants, expenses, expenseCategories, yearDataInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const setConstants = async (newConstants) => {
    setConstantsState(newConstants);
    if (!currentYear) return;
    const dbData = {
      ...mapConstantsToDB(newConstants),
      school_id: user.schoolId,
      budget_year_id: currentYear.id,
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase
      .from('financial_constants')
      .select('id')
      .eq('budget_year_id', currentYear.id)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from('financial_constants').update(dbData).eq('id', existing.id)
      : await supabase.from('financial_constants').insert(dbData);
    if (error) return saveFailed(error);
    await syncPrincipalSalaryExpense(newConstants.principalMonthlySalary);
    notify('הקבועים נשמרו ✓');
  };

  // ── School ───────────────────────────────────────────────────

  const setSchool = async (schoolData) => {
    setSchoolState(prev => ({ ...prev, ...schoolData }));
    if (!school) return;
    const dbData = {};
    if (schoolData.name !== undefined) dbData.name = schoolData.name;
    if (schoolData.logoUrl !== undefined) dbData.logo_url = schoolData.logoUrl;
    if (schoolData.mode !== undefined) dbData.mode = schoolData.mode;
    let { error } = await supabase.from('schools').update(dbData).eq('id', school.id);
    // DB not migrated to v2 yet (no mode column) — save the rest, don't lose name/logo
    if (error && dbData.mode !== undefined && /mode/.test(error.message || '')) {
      delete dbData.mode;
      ({ error } = await supabase.from('schools').update(dbData).eq('id', school.id));
    }
    if (error) return saveFailed(error);
    notify('פרטי בית הספר נשמרו ✓');
  };

  const isSimpleMode = school?.mode === 'simple';

  return (
    <AppContext.Provider value={{
      user, login, logout, loading, authNotice,
      currentPage, navigate,
      school, setSchool, isSimpleMode,
      budgetYears, addBudgetYear, activateBudgetYear,
      currentYear, setCurrentYear,
      constants, setConstants,
      classes, addClass, updateClass, deleteClass,
      incomeSources, addIncomeSource, updateIncomeSource, deleteIncomeSource,
      expenseCategories,
      expenses, addExpense, updateExpense, deleteExpense,
      expenseRequests, addExpenseRequest, updateExpenseRequest,
      usersList, deleteUser,
      toasts, notify,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
