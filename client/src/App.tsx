import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import NavigationBar from './components/NavigationBar';
import ReminderPopup from './components/ReminderPopup';
import CalendarPage from './pages/CalendarPage';
import OKRPage from './pages/OKRPage';
import InspirationPage from './pages/InspirationPage';
import LedgerPage from './pages/LedgerPage';
import CategoryManagementPage from './pages/CategoryManagementPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { useReminder } from './hooks/useReminder';
import { apiClient } from './api/client';
import { getWeekRange } from './utils/dateUtils';
import type { WorkEntry } from './types';

export interface AuthContextValue {
  isAuthenticated: boolean;
  setAuthenticated: (v: boolean) => void;
}

export const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  setAuthenticated: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

const AUTH_ROUTES = ['/login', '/register'];

function buildFilledSlots(entries: WorkEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    set.add(`${e.date}_${e.timeSlot}`);
  }
  return set;
}

export function AppLayout() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const showNav = !AUTH_ROUTES.includes(location.pathname);

  // Track filled slots for reminder service — refresh periodically
  const [filledSlots, setFilledSlots] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchFilledSlots = () => {
      const weekRange = getWeekRange(new Date());
      apiClient.workEntries
        .getByWeek(weekRange.start)
        .then((entries) => setFilledSlots(buildFilledSlots(entries)))
        .catch(() => {/* ignore */});
    };

    fetchFilledSlots();
    const intervalId = setInterval(fetchFilledSlots, 60_000); // refresh every minute
    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  const { activeReminder, snooze, skip, dismiss } = useReminder(filledSlots, isAuthenticated);

  return (
    <div className="app-layout">
      {showNav && <NavigationBar />}
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/okr"
            element={
              <ProtectedRoute>
                <OKRPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inspiration"
            element={
              <ProtectedRoute>
                <InspirationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ledger"
            element={
              <ProtectedRoute>
                <LedgerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoryManagementPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/calendar" replace />} />
        </Routes>
      </main>
      {activeReminder && (
        <ReminderPopup
          timeSlot={activeReminder.timeSlot}
          onFillNow={dismiss}
          onSnooze={snooze}
          onSkip={skip}
        />
      )}
    </div>
  );
}

function App() {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const authValue = useMemo(
    () => ({ isAuthenticated, setAuthenticated }),
    [isAuthenticated],
  );

  return (
    <AuthContext.Provider value={authValue}>
      <AppLayout />
    </AuthContext.Provider>
  );
}

export default App;
