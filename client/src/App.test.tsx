import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AppLayout, AuthContext } from './App';

vi.mock('./api/client', () => ({
  apiClient: {
    categories: { list: vi.fn().mockResolvedValue([]) },
    workEntries: { getByWeek: vi.fn().mockResolvedValue([]) },
  },
}));

function renderApp(route = '/', isAuthenticated = false) {
  return render(
    <AuthContext.Provider value={{ isAuthenticated, setAuthenticated: () => {} }}>
      <MemoryRouter initialEntries={[route]}>
        <AppLayout />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('App routing', () => {
  it('redirects unauthenticated users to /login', () => {
    renderApp('/calendar', false);
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  });

  it('shows calendar page for authenticated users at /calendar', () => {
    renderApp('/calendar', true);
    expect(document.querySelector('.calendar-page')).toBeTruthy();
  });

  it('redirects unknown routes to /calendar', () => {
    renderApp('/nonexistent', true);
    expect(document.querySelector('.calendar-page')).toBeTruthy();
  });

  it('shows login page at /login', () => {
    renderApp('/login');
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  });

  it('shows register page at /register', () => {
    renderApp('/register');
    expect(screen.getByRole('heading', { name: '注册' })).toBeInTheDocument();
  });

  it('shows OKR page for authenticated users', () => {
    renderApp('/okr', true);
    expect(document.querySelector('.okr-page')).toBeTruthy();
  });

  it('shows inspiration page for authenticated users', () => {
    renderApp('/inspiration', true);
    expect(document.querySelector('.inspiration-page')).toBeTruthy();
  });

  it('shows category management page for authenticated users', async () => {
    renderApp('/categories', true);
    await waitFor(() => {
      expect(screen.getByText('🏷️ 分类管理')).toBeInTheDocument();
    });
  });

  it('hides navigation bar on login page', () => {
    renderApp('/login');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows navigation bar on authenticated pages', () => {
    renderApp('/calendar', true);
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();
  });
});
