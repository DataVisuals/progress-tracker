import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../Login';
import { api } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    login: vi.fn(),
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

describe('Login', () => {
  const mockOnLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Rendering', () => {
    it('should render login button', () => {
      render(<Login onLogin={mockOnLogin} />);

      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    it('should not show modal initially', () => {
      render(<Login onLogin={mockOnLogin} />);

      expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument();
    });
  });

  describe('Modal Interaction', () => {
    it('should open modal when login button is clicked', async () => {
      const user = userEvent.setup();

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      });
    });

    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup();

      render(<Login onLogin={mockOnLogin} />);

      // Open modal
      await user.click(screen.getByText('Login'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close|×/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
      });
    });

    it('should close modal when clicking outside', async () => {
      const user = userEvent.setup();

      render(<Login onLogin={mockOnLogin} />);

      // Open modal
      await user.click(screen.getByText('Login'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      });

      // Click on overlay
      const overlay = document.querySelector('.modal-overlay');
      await user.click(overlay);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error when submitting empty form', async () => {
      const user = userEvent.setup();

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email.*required/i)).toBeInTheDocument();
      });
    });

    it('should show error for invalid email format', async () => {
      const user = userEvent.setup();

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    it('should show error when password is missing', async () => {
      const user = userEvent.setup();

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password.*required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Successful Login', () => {
    it('should call API with correct credentials', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'editor'
      };
      const mockResponse = {
        data: {
          user: mockUser,
          token: 'mock-jwt-token'
        }
      };

      api.login.mockResolvedValue(mockResponse);

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should store token in localStorage on successful login', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'editor'
      };
      const mockResponse = {
        data: {
          user: mockUser,
          token: 'mock-jwt-token'
        }
      };

      api.login.mockResolvedValue(mockResponse);

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'mock-jwt-token');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
      });
    });

    it('should call onLogin callback with user data', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'editor'
      };
      const mockResponse = {
        data: {
          user: mockUser,
          token: 'mock-jwt-token'
        }
      };

      api.login.mockResolvedValue(mockResponse);

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith(mockUser);
      });
    });

    it('should close modal after successful login', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'editor'
      };
      const mockResponse = {
        data: {
          user: mockUser,
          token: 'mock-jwt-token'
        }
      };

      api.login.mockResolvedValue(mockResponse);

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
      });
    });
  });

  describe('Failed Login', () => {
    it('should show error message on invalid credentials', async () => {
      const user = userEvent.setup();

      api.login.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Invalid email or password' }
        }
      });

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'wrong@example.com');
      await user.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });

    it('should show error message on network error', async () => {
      const user = userEvent.setup();

      api.login.mockRejectedValue(new Error('Network error'));

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error|connection failed/i)).toBeInTheDocument();
      });
    });

    it('should not call onLogin on failed login', async () => {
      const user = userEvent.setup();

      api.login.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Invalid credentials' }
        }
      });

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'wrong@example.com');
      await user.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid/i)).toBeInTheDocument();
      });

      expect(mockOnLogin).not.toHaveBeenCalled();
    });

    it('should not store token on failed login', async () => {
      const user = userEvent.setup();

      api.login.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Invalid credentials' }
        }
      });

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'wrong@example.com');
      await user.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid/i)).toBeInTheDocument();
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('token', expect.anything());
    });

    it('should keep modal open on failed login', async () => {
      const user = userEvent.setup();

      api.login.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Invalid credentials' }
        }
      });

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'wrong@example.com');
      await user.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid/i)).toBeInTheDocument();
      });

      // Modal should still be open
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while login is in progress', async () => {
      const user = userEvent.setup();

      // Create a promise that never resolves to keep loading state
      let resolveLogin;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      api.login.mockReturnValue(loginPromise);

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/loading|signing in/i)).toBeInTheDocument();
      });

      // Clean up
      resolveLogin({
        data: {
          user: { id: 1, email: 'test@example.com', name: 'Test', role: 'editor' },
          token: 'token'
        }
      });
    });

    it('should disable submit button while loading', async () => {
      const user = userEvent.setup();

      let resolveLogin;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      api.login.mockReturnValue(loginPromise);

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      // Clean up
      resolveLogin({
        data: {
          user: { id: 1, email: 'test@example.com', name: 'Test', role: 'editor' },
          token: 'token'
        }
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility when eye icon is clicked', async () => {
      const user = userEvent.setup();

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const passwordInput = screen.getByPlaceholderText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleButton = screen.getByRole('button', { name: /show|hide password/i });
      await user.click(toggleButton);

      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should submit form when Enter is pressed in email field', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'editor'
      };

      api.login.mockResolvedValue({
        data: { user: mockUser, token: 'token' }
      });

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(api.login).toHaveBeenCalled();
      });
    });

    it('should close modal when Escape is pressed', async () => {
      const user = userEvent.setup();

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
      });
    });
  });

  describe('Security', () => {
    it('should clear password field on failed login', async () => {
      const user = userEvent.setup();

      api.login.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Invalid credentials' }
        }
      });

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid/i)).toBeInTheDocument();
      });

      // Password should be cleared for security
      expect(passwordInput).toHaveValue('');
    });

    it('should not expose password in any error messages', async () => {
      const user = userEvent.setup();

      api.login.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Invalid credentials' }
        }
      });

      render(<Login onLogin={mockOnLogin} />);

      await user.click(screen.getByText('Login'));

      await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Password'), 'secretpassword');

      const submitButton = screen.getByRole('button', { name: /sign in|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid/i)).toBeInTheDocument();
      });

      // Ensure password is not visible in error message
      expect(screen.queryByText(/secretpassword/i)).not.toBeInTheDocument();
    });
  });
});
