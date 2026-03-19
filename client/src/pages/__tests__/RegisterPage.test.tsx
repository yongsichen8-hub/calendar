import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterPage from '../RegisterPage';
import { AuthContext } from '../../App';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: {
    auth: {
      register: vi.fn(),
    },
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderRegisterPage(setAuthenticated = vi.fn()) {
  return render(
    <AuthContext.Provider value={{ isAuthenticated: false, setAuthenticated }}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders register form with username, password, confirm password inputs and register button', () => {
    renderRegisterPage();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注册' })).toBeInTheDocument();
  });

  it('renders link to login page', () => {
    renderRegisterPage();
    expect(screen.getByText('去登录')).toHaveAttribute('href', '/login');
  });

  it('shows error when passwords do not match', async () => {
    renderRegisterPage();

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pass123' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'pass456' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('两次密码输入不一致');
    });
    expect(apiClient.auth.register).not.toHaveBeenCalled();
  });

  it('calls apiClient.auth.register and navigates on success', async () => {
    const setAuthenticated = vi.fn();
    vi.mocked(apiClient.auth.register).mockResolvedValue({
      user: { id: 1, username: 'newuser', createdAt: '' },
      token: 'tok',
    });

    renderRegisterPage(setAuthenticated);

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pass123' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(apiClient.auth.register).toHaveBeenCalledWith('newuser', 'pass123');
      expect(setAuthenticated).toHaveBeenCalledWith(true);
      expect(mockNavigate).toHaveBeenCalledWith('/calendar');
    });
  });

  it('displays error message on register failure', async () => {
    vi.mocked(apiClient.auth.register).mockRejectedValue(new Error('用户名已存在'));

    renderRegisterPage();

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'taken' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pass123' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('用户名已存在');
    });
  });

  it('disables button while loading', async () => {
    let resolveRegister!: (v: { user: { id: number; username: string; createdAt: string }; token: string }) => void;
    vi.mocked(apiClient.auth.register).mockImplementation(
      () => new Promise((r) => { resolveRegister = r; }),
    );

    renderRegisterPage();

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'u' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'p12345' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'p12345' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '注册中...' })).toBeDisabled();
    });

    resolveRegister!({ user: { id: 1, username: 'u', createdAt: '' }, token: 't' });
  });
});
