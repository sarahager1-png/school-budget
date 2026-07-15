import { Component } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Layout from './components/Layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ClassesPage from './pages/ClassesPage.jsx';
import IncomePage from './pages/IncomePage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import CourierPage from './pages/CourierPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import HelpPage from './pages/HelpPage.jsx';
import SalariesPage from './pages/SalariesPage.jsx';
import SimulationsPage from './pages/SimulationsPage.jsx';
import TuitionPage from './pages/TuitionPage.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" style={{ padding: 32, fontFamily: 'Heebo, sans-serif', background: '#FFF0F0', minHeight: '100vh' }}>
          <h1 style={{ color: '#C00', fontSize: 24, marginBottom: 16 }}>שגיאת מערכת</h1>
          <pre style={{ background: '#fff', padding: 16, borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap', direction: 'ltr' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 20px', background: '#00B4CC', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            נסה שוב
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      dir="rtl"
      style={{ background: 'linear-gradient(135deg, #1A0B35 0%, #3D2570 60%, #00B4CC 100%)' }}
    >
      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-6 overflow-hidden shadow-lg">
        <img
          src="/logo.png"
          alt="לוגו"
          className="w-full h-full object-contain p-1"
          onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span style="font-size:2rem">🏫</span>'; }}
        />
      </div>
      <svg className="animate-spin w-8 h-8 text-white/60 mb-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-white/60 text-sm">טוען נתונים...</p>
    </div>
  );
}

function AppContent() {
  const { user, currentPage, loading, isSimpleMode } = useApp();

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  // simulations are budget-model only — hidden in simple-mode schools for every role
  // every role can otherwise navigate to every page (view-only for non-managers; writes are gated per-page + RLS)
  let page = isSimpleMode && currentPage === 'simulations' ? 'dashboard' : currentPage;

  const pages = {
    dashboard: <DashboardPage />,
    classes: <ClassesPage />,
    income: <IncomePage />,
    tuition: <TuitionPage />,
    expenses: <ExpensesPage />,
    courier: <CourierPage />,
    reports: <ReportsPage />,
    settings: <SettingsPage />,
    salaries: <SalariesPage />,
    simulations: <SimulationsPage />,
    help: <HelpPage />,
  };

  return (
    <Layout>
      {pages[page] || <DashboardPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
}
