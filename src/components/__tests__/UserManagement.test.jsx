import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserManagement from '../UserManagement';
import { api } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    getUsers: vi.fn(),
    getProjects: vi.fn(),
    updateUserRole: vi.fn(),
    deleteUser: vi.fn(),
    updateUser: vi.fn(),
    adminResetPassword: vi.fn(),
    getProjectPermissions: vi.fn(),
    grantProjectPermission: vi.fn(),
    revokeProjectPermission: vi.fn(),
    checkNameAvailability: vi.fn(),
    register: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

// Mock react-select
vi.mock('react-select', () => ({
  default: ({ value, onChange, options, ...props }) => (
    <select
      data-testid="select"
      value={value?.value}
      onChange={(e) => {
        const option = options.find(o => o.value === e.target.value);
        onChange(option);
      }}
      {...props}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}));

describe('UserManagement', () => {
  const mockOnClose = vi.fn();

  // System admin user (current user)
  const systemAdminUser = {
    userId: 1,
    email: 'sysadmin@test.com',
    name: 'System Admin',
    role: 'admin',
    is_system_admin: 1
  };

  // Regular admin user (current user)
  const regularAdminUser = {
    userId: 2,
    email: 'admin@test.com',
    name: 'Regular Admin',
    role: 'admin',
    is_system_admin: 0
  };

  // Sample users
  const mockUsers = [
    { id: 1, email: 'sysadmin@test.com', name: 'System Admin', role: 'admin', is_system_admin: 1 },
    { id: 2, email: 'admin@test.com', name: 'Regular Admin', role: 'admin', is_system_admin: 0 },
    { id: 3, email: 'pm@test.com', name: 'PM User', role: 'pm', is_system_admin: 0 }
  ];

  // Sample spaces
  const mockSpaces = [
    { id: 1, name: 'Space One' },
    { id: 2, name: 'Space Two' }
  ];

  // Sample space assignments
  const mockSpaceAssignments = [
    { space_id: 1, space_name: 'Space One' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    api.getUsers.mockResolvedValue({ data: mockUsers });
    api.getProjects.mockResolvedValue({ data: [] });
    api.get.mockImplementation((url) => {
      if (url === '/api/spaces-for-assignment') {
        return Promise.resolve({ data: mockSpaces });
      }
      if (url.includes('/space-assignments')) {
        return Promise.resolve({ data: mockSpaceAssignments });
      }
      return Promise.resolve({ data: [] });
    });
  });

  describe('User List Rendering', () => {
    it('should render user list', async () => {
      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('System Admin')).toBeInTheDocument();
        expect(screen.getByText('Regular Admin')).toBeInTheDocument();
        expect(screen.getByText('PM User')).toBeInTheDocument();
      });
    });

    it('should display system admin badge for system admins', async () => {
      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        // Should show 'sys admin' badge for system admin users
        expect(screen.getByText('sys admin')).toBeInTheDocument();
      });
    });

    it('should display search functionality', async () => {
      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      const searchInput = await screen.findByPlaceholderText('Search by name or email...');
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('System Admin Toggle', () => {
    it('should show system admin toggle button for admin users when logged in as system admin', async () => {
      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        // Regular Admin should have a star toggle button
        const starButtons = screen.getAllByTitle(/system admin/i);
        expect(starButtons.length).toBeGreaterThan(0);
      });
    });

    it('should NOT show system admin toggle when logged in as regular admin', async () => {
      render(<UserManagement currentUser={regularAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Regular Admin')).toBeInTheDocument();
      });

      // Regular admin should not see star toggle buttons
      const starButtons = screen.queryAllByTitle(/system admin/i);
      expect(starButtons.length).toBe(0);
    });
  });

  describe('Space Assignment Panel', () => {
    it('should show space assignment panel when selecting a regular admin as system admin', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Regular Admin')).toBeInTheDocument();
      });

      // Click on Regular Admin row to select
      const regularAdminRow = screen.getByText('Regular Admin').closest('tr');
      await user.click(regularAdminRow);

      await waitFor(() => {
        // Should show the space assignment section with "Assigned Spaces (X)" heading
        expect(screen.getByRole('heading', { name: /assigned spaces/i })).toBeInTheDocument();
      });
    });

    it('should show system admin note when selecting a system admin user', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('System Admin')).toBeInTheDocument();
      });

      // Click on System Admin row
      const sysAdminRow = screen.getByText('System Admin').closest('tr');
      await user.click(sysAdminRow);

      await waitFor(() => {
        // Should show system admin note, not space assignments
        expect(screen.getByText(/full access to all spaces/i)).toBeInTheDocument();
      });
    });

    it('should show project permissions when selecting a PM user', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('PM User')).toBeInTheDocument();
      });

      // Click on PM User row
      const pmRow = screen.getByText('PM User').closest('tr');
      await user.click(pmRow);

      await waitFor(() => {
        // Should show permissions section for PM - look for the Current Permissions heading
        expect(screen.getByText('Current Permissions')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Behavior', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: '×' });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking overlay', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument();
      });

      const overlay = document.querySelector('.modal-overlay');
      await user.click(overlay);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Add User', () => {
    it('should show add user button', async () => {
      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('+ Add')).toBeInTheDocument();
      });
    });

    it('should open add user modal when clicking add button', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('+ Add')).toBeInTheDocument();
      });

      await user.click(screen.getByText('+ Add'));

      await waitFor(() => {
        expect(screen.getByText('Add New User')).toBeInTheDocument();
      });
    });
  });

  describe('User Actions', () => {
    it('should show delete button for users other than current user', async () => {
      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        // Should have delete buttons for other users (not the current user)
        const deleteButtons = screen.getAllByText('Delete');
        expect(deleteButtons.length).toBeGreaterThan(0);
      });
    });

    it('should show reset password button for users other than current user', async () => {
      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        // Should have reset password buttons for other users
        const resetButtons = screen.getAllByText('Reset PW');
        expect(resetButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter users by name', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('System Admin')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      await user.type(searchInput, 'PM');

      await waitFor(() => {
        expect(screen.getByText('PM User')).toBeInTheDocument();
        expect(screen.queryByText('System Admin')).not.toBeInTheDocument();
      });
    });

    it('should filter users by email', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('System Admin')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      await user.type(searchInput, 'admin@');

      await waitFor(() => {
        expect(screen.getByText('Regular Admin')).toBeInTheDocument();
        expect(screen.queryByText('PM User')).not.toBeInTheDocument();
      });
    });
  });

  describe('Emails Export', () => {
    it('should show emails export button', async () => {
      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Emails')).toBeInTheDocument();
      });
    });

    it('should open emails modal when clicking emails button', async () => {
      const user = userEvent.setup();

      render(<UserManagement currentUser={systemAdminUser} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Emails')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Emails'));

      await waitFor(() => {
        expect(screen.getByText(/all user emails/i)).toBeInTheDocument();
      });
    });
  });
});
