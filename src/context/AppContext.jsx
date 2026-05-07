import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode } from '../lib/supabase.js';
import { DEFAULT_CONSTANTS } from '../data/constants.js';
import {
  mockSchool, mockBudgetYears, mockClasses, mockIncomeSources,
  mockExpenseCategories, mockExpenses, mockExpenseRequests, mockUsers, mockUsersList,
} from '../data/mockData.js';

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
    incomePerStudent: Number(row.income_per_student),
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
    income_per_student: c.incomePerStudent,
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

  const loadMockData = useCallback((role) => {
    setUser(mockUsers[role]);
    setSchoolState(mockSchool);
    setBudgetYears(mockBudgetYears);
    setCurrentYear(mockBudgetYears[0]);
    setConstantsState(DEFAULT_CONSTANTS);
    setClasses(mockClasses);
    setIncomeSources(mockIncomeSources);
    setExpenseCategories(mockExpenseCategories);
    setExpenses(mockExpenses);
    setExpenseRequests(mockExpenseRequests);
    setUsersList(mockUsersList);
  }, []);

  const loadDataForYear = useCallback(async (schoolId, yearId) => {
    const [classesRes, incomeRes, expensesRes, requestsRes, constRes] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', schoolId).eq('budget_year_id', yearId),
      supabase.from('income_sources').select('*').eq('school_id', schoolId).eq('budget_year_id', yearId),
      supabase.from('expenses').select('*').eq('school_id', schoolId).eq('budget_year_id', yearId),
      supabase.from('expense_requests').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('financial_constants').select('*').eq('budget_year_id', yearId).maybeSingle(),
    ]);

    if (classesRes.data) {
      setClasses(classesRes.data.map(c => ({
        id: c.id, name: c.name, gradeLevel: c.grade_level,
        section: c.section, studentCount: c.student_count, notes: c.notes,
      })));
    }
    if (incomeRes.data) {
      setIncomeSources(incomeRes.data.map(s => ({
        id: s.id, name: s.name, amount: Number(s.amount), type: s.type, notes: s.notes,
      })));
    }
    if (expensesRes.data) {
      setExpenses(expensesRes.data.map(e => ({
        id: e.id, categoryId: e.category_id, name: e.name, amount: Number(e.amount),
        period: e.period, status: e.status, isRecurring: e.is_recurring, notes: e.notes,
      })));
    }
    if (requestsRes.data) {
      setExpenseRequests(requestsRes.data.map(r => ({
        id: r.id, expenseId: r.expense_id, name: r.name, amount: Number(r.amount),
        status: r.status, assignedTo: r.assigned_to, notes: r.notes,
        receiptUrl: r.receipt_url,
        createdAt: r.created_at?.split('T')[0],
        paidAt: r.paid_at?.split('T')[0] ?? null,
      })));
    }
    if (constRes.data) {
      setConstantsState(mapConstantsFromDB(constRes.data));
    }
  }, []);

  const loadSupabaseData = useCallback(async (supabaseUser) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    if (!profile) {
      return { error: profileError || { message: 'המשתמש לא נמצא בטבלת profiles — בדקי שהשורה קיימת ב-Supabase' } };
    }

    setUser({
      id: profile.id,
      name: profile.full_name ?? profile.name,
      email: supabaseUser.email,
      role: profile.role,
      schoolId: profile.school_id,
      initials: profile.initials,
    });

    const [schoolRes, yearsRes, catsRes, usersRes] = await Promise.all([
      supabase.from('schools').select('*').eq('id', profile.school_id).single(),
      supabase.from('budget_years').select('*').eq('school_id', profile.school_id).order('year', { ascending: false }),
      supabase.from('expense_categories').select('*').eq('school_id', profile.school_id).order('sort_order'),
      supabase.from('profiles').select('id, name, role, initials').eq('school_id', profile.school_id),
    ]);

    if (schoolRes.data) {
      setSchoolState({ id: schoolRes.data.id, name: schoolRes.data.name, logoUrl: schoolRes.data.logo_url });
    }
    if (catsRes.data) {
      setExpenseCategories(catsRes.data.map(c => ({ id: c.id, name: c.name, color: c.color })));
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
    if (isMockMode) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadSupabaseData(session.user).finally(() => setLoading(false));
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

  const login = async (emailOrRole, password) => {
    if (isMockMode) {
      loadMockData(emailOrRole);
      setCurrentPage(emailOrRole === 'courier' ? 'courier' : 'dashboard');
      return { error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: emailOrRole, password });
    if (error) return { error };
    const result = await loadSupabaseData(data.user);
    if (result?.error) return { error: result.error };
    setLoading(false);
    return { error: null };
  };

  const logout = async () => {
    if (!isMockMode) await supabase.auth.signOut();
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
    if (isMockMode) {
      setClasses(prev => [...prev, { ...cls, id: `c${Date.now()}` }]);
      return;
    }
    const { data, error } = await supabase.from('classes').insert({
      school_id: user.schoolId,
      budget_year_id: currentYear.id,
      name: cls.name, grade_level: cls.gradeLevel,
      section: cls.section, student_count: cls.studentCount, notes: cls.notes,
    }).select().single();
    if (!error && data) {
      setClasses(prev => [...prev, {
        id: data.id, name: data.name, gradeLevel: data.grade_level,
        section: data.section, studentCount: data.student_count, notes: data.notes,
      }]);
    }
  };

  const updateClass = async (id, cls) => {
    if (isMockMode) {
      setClasses(prev => prev.map(c => c.id === id ? { ...c, ...cls } : c));
      return;
    }
    const { error } = await supabase.from('classes').update({
      name: cls.name, grade_level: cls.gradeLevel,
      section: cls.section, student_count: cls.studentCount, notes: cls.notes,
    }).eq('id', id);
    if (!error) setClasses(prev => prev.map(c => c.id === id ? { ...c, ...cls } : c));
  };

  const deleteClass = async (id) => {
    if (isMockMode) {
      setClasses(prev => prev.filter(c => c.id !== id));
      return;
    }
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) setClasses(prev => prev.filter(c => c.id !== id));
  };

  // ── Income Sources ───────────────────────────────────────────

  const addIncomeSource = async (src) => {
    if (isMockMode) {
      setIncomeSources(prev => [...prev, { ...src, id: `i${Date.now()}` }]);
      return;
    }
    const { data, error } = await supabase.from('income_sources').insert({
      school_id: user.schoolId, budget_year_id: currentYear.id,
      name: src.name, amount: src.amount, type: src.type, notes: src.notes,
    }).select().single();
    if (!error && data) {
      setIncomeSources(prev => [...prev, {
        id: data.id, name: data.name, amount: Number(data.amount), type: data.type, notes: data.notes,
      }]);
    }
  };

  const updateIncomeSource = async (id, src) => {
    if (isMockMode) {
      setIncomeSources(prev => prev.map(s => s.id === id ? { ...s, ...src } : s));
      return;
    }
    const { error } = await supabase.from('income_sources').update({
      name: src.name, amount: src.amount, type: src.type, notes: src.notes,
    }).eq('id', id);
    if (!error) setIncomeSources(prev => prev.map(s => s.id === id ? { ...s, ...src } : s));
  };

  const deleteIncomeSource = async (id) => {
    if (isMockMode) {
      setIncomeSources(prev => prev.filter(s => s.id !== id));
      return;
    }
    const { error } = await supabase.from('income_sources').delete().eq('id', id);
    if (!error) setIncomeSources(prev => prev.filter(s => s.id !== id));
  };

  // ── Expenses ─────────────────────────────────────────────────

  const addExpense = async (exp) => {
    if (isMockMode) {
      setExpenses(prev => [...prev, { ...exp, id: `e${Date.now()}` }]);
      return;
    }
    const { data, error } = await supabase.from('expenses').insert({
      school_id: user.schoolId, budget_year_id: currentYear.id,
      category_id: exp.categoryId, name: exp.name, amount: exp.amount,
      period: exp.period, is_recurring: exp.isRecurring, status: exp.status, notes: exp.notes,
    }).select().single();
    if (!error && data) {
      setExpenses(prev => [...prev, {
        id: data.id, categoryId: data.category_id, name: data.name, amount: Number(data.amount),
        period: data.period, status: data.status, isRecurring: data.is_recurring, notes: data.notes,
      }]);
    }
  };

  const updateExpense = async (id, exp) => {
    if (isMockMode) {
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...exp } : e));
      return;
    }
    const { error } = await supabase.from('expenses').update({
      category_id: exp.categoryId, name: exp.name, amount: exp.amount,
      period: exp.period, is_recurring: exp.isRecurring, status: exp.status, notes: exp.notes,
    }).eq('id', id);
    if (!error) setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...exp } : e));
  };

  const deleteExpense = async (id) => {
    if (isMockMode) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      return;
    }
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // ── Expense Requests ─────────────────────────────────────────

  const addExpenseRequest = async (req) => {
    if (isMockMode) {
      setExpenseRequests(prev => [
        { ...req, id: `er${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] },
        ...prev,
      ]);
      return;
    }
    const courier = usersList.find(u => u.role === 'courier');
    const { data, error } = await supabase.from('expense_requests').insert({
      school_id: user.schoolId,
      expense_id: req.expenseId, name: req.name, amount: req.amount,
      status: 'pending', assigned_to: courier?.id ?? null, notes: req.notes,
    }).select().single();
    if (!error && data) {
      setExpenseRequests(prev => [{
        id: data.id, expenseId: data.expense_id, name: data.name, amount: Number(data.amount),
        status: data.status, assignedTo: data.assigned_to, notes: data.notes,
        receiptUrl: null, createdAt: data.created_at?.split('T')[0], paidAt: null,
      }, ...prev]);
    }
  };

  const updateExpenseRequest = async (id, updates) => {
    if (isMockMode) {
      setExpenseRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      return;
    }
    const dbUpdates = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.receiptUrl !== undefined) dbUpdates.receipt_url = updates.receiptUrl;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.status === 'paid') dbUpdates.paid_at = new Date().toISOString();
    if (updates.status === 'completed') dbUpdates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('expense_requests').update(dbUpdates).eq('id', id);
    if (!error) setExpenseRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // ── Budget Years ─────────────────────────────────────────────

  const addBudgetYear = async (yr) => {
    if (isMockMode) {
      setBudgetYears(prev => [{ ...yr, id: `year-${Date.now()}` }, ...prev]);
      return;
    }
    const { data, error } = await supabase.from('budget_years').insert({
      school_id: user.schoolId,
      year: yr.year, label: yr.label,
      start_date: yr.startDate, end_date: yr.endDate,
      is_active: false, status: 'active',
    }).select().single();
    if (!error && data) {
      setBudgetYears(prev => [{
        id: data.id, year: data.year, label: data.label,
        startDate: data.start_date, endDate: data.end_date,
        isActive: false, status: 'active',
      }, ...prev]);
    }
  };

  const activateBudgetYear = async (id) => {
    if (isMockMode) {
      setBudgetYears(prev => prev.map(y => ({ ...y, isActive: y.id === id })));
      setCurrentYear(budgetYears.find(y => y.id === id));
      return;
    }
    await supabase.from('budget_years').update({ is_active: false }).eq('school_id', user.schoolId);
    await supabase.from('budget_years').update({ is_active: true }).eq('id', id);
    const year = budgetYears.find(y => y.id === id);
    setBudgetYears(prev => prev.map(y => ({ ...y, isActive: y.id === id })));
    setCurrentYear(year);
    if (year) await loadDataForYear(user.schoolId, id);
  };

  // ── Users ────────────────────────────────────────────────────

  const addUser = (usr) => {
    if (isMockMode) {
      setUsersList(prev => [...prev, { ...usr, id: `u${Date.now()}` }]);
    }
    // Real mode: users must be created via Supabase Dashboard or an invite system
  };

  const deleteUser = async (id) => {
    if (isMockMode) {
      setUsersList(prev => prev.filter(u => u.id !== id));
      return;
    }
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) setUsersList(prev => prev.filter(u => u.id !== id));
  };

  // ── Constants ────────────────────────────────────────────────

  const setConstants = async (newConstants) => {
    setConstantsState(newConstants);
    if (isMockMode || !currentYear) return;
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
    if (existing) {
      await supabase.from('financial_constants').update(dbData).eq('id', existing.id);
    } else {
      await supabase.from('financial_constants').insert(dbData);
    }
  };

  // ── School ───────────────────────────────────────────────────

  const setSchool = async (schoolData) => {
    setSchoolState(prev => ({ ...prev, ...schoolData }));
    if (isMockMode || !school) return;
    await supabase.from('schools').update({
      name: schoolData.name,
      logo_url: schoolData.logoUrl,
    }).eq('id', school.id);
  };

  return (
    <AppContext.Provider value={{
      user, login, logout, loading,
      currentPage, navigate,
      school, setSchool,
      budgetYears, addBudgetYear, activateBudgetYear,
      currentYear, setCurrentYear,
      constants, setConstants,
      classes, addClass, updateClass, deleteClass,
      incomeSources, addIncomeSource, updateIncomeSource, deleteIncomeSource,
      expenseCategories,
      expenses, addExpense, updateExpense, deleteExpense,
      expenseRequests, addExpenseRequest, updateExpenseRequest,
      usersList, addUser, deleteUser,
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
