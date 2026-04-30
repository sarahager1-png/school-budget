import { createContext, useContext, useState } from 'react';
import { DEFAULT_CONSTANTS } from '../data/constants.js';
import {
  mockSchool, mockBudgetYears, mockClasses, mockIncomeSources,
  mockExpenseCategories, mockExpenses, mockExpenseRequests, mockUsers, mockUsersList,
} from '../data/mockData.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [school, setSchool] = useState(mockSchool);
  const [budgetYears, setBudgetYears] = useState(mockBudgetYears);
  const [currentYear, setCurrentYear] = useState(mockBudgetYears[0]);
  const [constants, setConstants] = useState(DEFAULT_CONSTANTS);
  const [classes, setClasses] = useState(mockClasses);
  const [incomeSources, setIncomeSources] = useState(mockIncomeSources);
  const [expenseCategories] = useState(mockExpenseCategories);
  const [expenses, setExpenses] = useState(mockExpenses);
  const [expenseRequests, setExpenseRequests] = useState(mockExpenseRequests);
  const [usersList, setUsersList] = useState(mockUsersList);

  const login = (role) => {
    setUser(mockUsers[role]);
    setCurrentPage(role === 'courier' ? 'courier' : 'dashboard');
  };

  const logout = () => {
    setUser(null);
    setCurrentPage('dashboard');
  };

  const navigate = (page) => setCurrentPage(page);

  // Classes CRUD
  const addClass = (cls) => setClasses(prev => [...prev, { ...cls, id: `c${Date.now()}` }]);
  const updateClass = (id, data) => setClasses(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  const deleteClass = (id) => setClasses(prev => prev.filter(c => c.id !== id));

  // Income CRUD
  const addIncomeSource = (src) => setIncomeSources(prev => [...prev, { ...src, id: `i${Date.now()}` }]);
  const updateIncomeSource = (id, data) => setIncomeSources(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  const deleteIncomeSource = (id) => setIncomeSources(prev => prev.filter(s => s.id !== id));

  // Expenses CRUD
  const addExpense = (exp) => setExpenses(prev => [...prev, { ...exp, id: `e${Date.now()}` }]);
  const updateExpense = (id, data) => setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  const deleteExpense = (id) => setExpenses(prev => prev.filter(e => e.id !== id));

  // Expense Requests
  const addExpenseRequest = (req) => setExpenseRequests(prev => [...prev, { ...req, id: `er${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] }]);
  const updateExpenseRequest = (id, data) => setExpenseRequests(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));

  // Budget Years
  const addBudgetYear = (yr) => setBudgetYears(prev => [...prev, { ...yr, id: `year-${Date.now()}` }]);
  const activateBudgetYear = (id) => {
    setBudgetYears(prev => prev.map(y => ({ ...y, isActive: y.id === id })));
    setCurrentYear(budgetYears.find(y => y.id === id));
  };

  // Users
  const addUser = (usr) => setUsersList(prev => [...prev, { ...usr, id: `u${Date.now()}` }]);
  const deleteUser = (id) => setUsersList(prev => prev.filter(u => u.id !== id));

  return (
    <AppContext.Provider value={{
      user, login, logout,
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
