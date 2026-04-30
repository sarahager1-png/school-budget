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
            style={{ marginTop: 16, padding: '8px 20px', background: '#0FA3B1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            נסה שוב
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, currentPage } = useApp();

  if (!user) return <LoginPage />;

  const pages = {
    dashboard: <DashboardPage />,
    classes: <ClassesPage />,
    income: <IncomePage />,
    expenses: <ExpensesPage />,
    courier: <CourierPage />,
    reports: <ReportsPage />,
    settings: <SettingsPage />,
    help: <HelpPage />,
  };

  return (
    <Layout>
      {pages[currentPage] || <DashboardPage />}
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
