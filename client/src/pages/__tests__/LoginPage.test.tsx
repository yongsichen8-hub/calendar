import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../LoginPage';
import { AuthContext } from '../../App';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    auth: {
      login: vi.fn(),
    },
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLoginPage(setAuthenticated = vi.fn()) {
  return render(
    <AuthContext.Provider value={{ isAuthenticated: false, setAuthenticated }}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with username, password inputs and login button', () => {
    renderLoginPage();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('renders link to register page', () => {
    renderLoginPage();
    expect(screen.getByText('去注册')).toHaveAttribute('href', '/register');
  });

  it('calls apiClient.auth.login and navigates on success', async () => {
    const setAuthenticated = vi.fn();
    vi.mocked(apiClient.auth.login).mockResolvedValue({
      user: { id: 1, username: 'testuser', createdAt: '' },
      token: 'tok',
    });

    renderLoginPage(setAuthenticated);

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(apiClient.auth.login).toHaveBeenCalledWith('testuser', 'pass123');
      expect(setAuthenticated).toHaveBeenCalledWith(true);
      expect(mockNavigate).toHaveBeenCalledWith('/calendar');
    });
  });

  it('displays error message on login failure', async () => {
    vi.mocked(apiClient.auth.login).mockRejectedValue(new Error('用户名或密码错误'));

    renderLoginPage();

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'bad' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong1' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('用户名或密码错误');
    });
  });

  it('disables button while loading', async () => {
    let resolveLogin!: (v: { user: { id: number; username: string; createdAt: string }; token: string }) => void;
    vi.mocked(apiClient.auth.login).mockImplementation(
      () => new Promise((r) => { resolveLogin = r; }),
    );

    renderLoginPage();

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'u' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'p' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登录中...' })).toBeDisabled();
    });

    resolveLogin!({ user: { id: 1, username: 'u', createdAt: '' }, token: 't' });
  });
});
