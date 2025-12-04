import axios from 'axios';
import { storeTokenExpiry, clearTokenExpiry } from '../utils/tokenUtils';

const API_BASE = 'http://localhost:3001/api';

const client = axios.create({
  baseURL: API_BASE,
});

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise = null;

// Add token to all requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors with token refresh retry
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry on login or refresh failures
    const isLoginRequest = originalRequest?.url?.includes('/auth/login');
    const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');

    // Check if user is currently logged in (has a token)
    const hasToken = !!localStorage.getItem('token');

    // If 401 error and user was logged in, try to refresh token
    if (error.response?.status === 401 && hasToken && !isLoginRequest && !isRefreshRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // If already refreshing, wait for that promise
        if (isRefreshing && refreshPromise) {
          await refreshPromise;
          // Token should be updated now, retry the original request
          return client(originalRequest);
        }

        // Start refresh process
        isRefreshing = true;
        refreshPromise = refreshToken();

        const newToken = await refreshPromise;

        if (newToken) {
          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          // Retry the original request
          return client(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Refresh failed, logout user
        handleLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    // If we get here and it's a 401 with a token, logout
    if (error.response?.status === 401 && hasToken && !isLoginRequest) {
      handleLogout();
    }

    return Promise.reject(error);
  }
);

/**
 * Attempt to refresh the authentication token
 * @returns {Promise<string|null>} - New token or null if refresh failed
 */
async function refreshToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const response = await axios.post(
      `${API_BASE}/auth/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const { token: newToken, user } = response.data;

    // Update localStorage with new token and user data
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(user));
    storeTokenExpiry(newToken);

    console.log('Token refreshed successfully');
    return newToken;
  } catch (err) {
    console.error('Failed to refresh token:', err);
    return null;
  }
}

/**
 * Handle logout - clear storage and redirect
 */
function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('loginTime');
  clearTokenExpiry();

  // Dispatch custom event so App can update state
  window.dispatchEvent(new CustomEvent('auth:logout'));

  // Redirect to home
  window.location.href = '/';
}

// Export refresh function for proactive use
export { refreshToken };

export const api = {
  // Generic methods
  get: (url) => client.get(url),
  post: (url, data) => client.post(url, data),
  put: (url, data) => client.put(url, data),
  delete: (url) => client.delete(url),

  // Auth
  login: (email, password) => client.post('/auth/login', { email, password }),
  register: (email, name, password) => client.post('/auth/register', { email, name, password }),
  checkNameAvailability: (name, excludeUserId) => {
    const params = new URLSearchParams({ name });
    if (excludeUserId) params.append('excludeUserId', excludeUserId);
    return client.get(`/auth/check-name?${params.toString()}`);
  },
  changePassword: (currentPassword, newPassword) => client.post('/auth/change-password', { currentPassword, newPassword }),
  updateProfile: (name, email) => client.put('/auth/profile', { name, email }),

  // Projects
  getProjects: () => client.get('/projects'),
  createProject: (data) => client.post('/projects', data),
  updateProject: (id, data) => client.put(`/projects/${id}`, data),
  deleteProject: (id) => client.delete(`/projects/${id}`),

  // Metrics
  getProjectMetrics: (projectId) => client.get(`/projects/${projectId}/metrics`),
  createMetric: (projectId, data) => client.post(`/projects/${projectId}/metrics`, data),
  updateMetric: (id, data) => client.put(`/metrics/${id}`, data),
  deleteMetric: (id) => client.delete(`/metrics/${id}`),
  reorderMetrics: (projectId, metricOrder) => client.put(`/projects/${projectId}/metrics/reorder`, { metricOrder }),

  // Data
  getProjectData: (projectId) => client.get(`/projects/${projectId}/data`),
  getProjectDataTimeTravel: (projectId, timestamp) => client.get(`/projects/${projectId}/data/time-travel?timestamp=${encodeURIComponent(timestamp)}`),
  revertProjectData: (projectId, timestamp) => client.post(`/projects/${projectId}/data/revert`, { timestamp }),
  getMetricPeriods: (metricId) => client.get(`/metrics/${metricId}/periods`),
  createPeriod: (data) => client.post('/metric-periods', data),
  updatePeriod: (id, data) => client.put(`/metric-periods/${id}`, data),
  patchPeriod: (id, data) => client.patch(`/metric-periods/${id}`, data),
  deletePeriod: (id) => client.delete(`/metric-periods/${id}`),

  // Comments
  getPeriodComments: (periodId) => client.get(`/periods/${periodId}/comments`),
  createComment: (periodId, data) => client.post(`/periods/${periodId}/comments`, data),
  updateComment: (id, data) => client.put(`/comments/${id}`, data),
  deleteComment: (id) => client.delete(`/comments/${id}`),
  getCommentsByUser: () => client.get('/comments/by-user'),

  // CRAIDs
  getProjectCRAIDs: (projectId, type) => client.get(`/projects/${projectId}/craids${type ? `?type=${type}` : ''}`),
  createCRAID: (projectId, data) => client.post(`/projects/${projectId}/craids`, data),
  updateCRAID: (id, data) => client.put(`/craids/${id}`, data),
  deleteCRAID: (id) => client.delete(`/craids/${id}`),

  // Audit Log
  getAuditLog: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return client.get(`/audit${queryString ? `?${queryString}` : ''}`);
  },
  getAuditTimeline: (days = 14) => client.get(`/audit/timeline?days=${days}`),

  // User Management
  getUsers: () => client.get('/users'),
  updateUser: (userId, data) => client.put(`/users/${userId}`, data),
  updateUserRole: (userId, role) => client.put(`/users/${userId}/role`, { role }),
  adminResetPassword: (userId, newPassword) => client.post(`/users/${userId}/reset-password`, { newPassword }),
  deleteUser: (userId) => client.delete(`/users/${userId}`),

  // Project Permissions
  getProjectPermissions: (projectId) => client.get(`/projects/${projectId}/permissions`),
  grantProjectPermission: (projectId, userId) => client.post(`/projects/${projectId}/permissions`, { user_id: userId }),
  revokeProjectPermission: (projectId, userId) => client.delete(`/projects/${projectId}/permissions/${userId}`),

  // Project Links
  getProjectLinks: (projectId) => client.get(`/projects/${projectId}/links`),
  createProjectLink: (projectId, data) => client.post(`/projects/${projectId}/links`, data),
  updateProjectLink: (id, data) => client.put(`/project-links/${id}`, data),
  deleteProjectLink: (id) => client.delete(`/project-links/${id}`),

  // Project Dependencies
  getProjectDependencies: (projectId) => client.get(`/projects/${projectId}/dependencies`),
  addProjectDependency: (projectId, dependsOnProjectId) => client.post(`/projects/${projectId}/dependencies`, { depends_on_project_id: dependsOnProjectId }),
  removeProjectDependency: (projectId, dependencyId) => client.delete(`/projects/${projectId}/dependencies/${dependencyId}`),

  // Feedback
  getFeedback: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return client.get(`/feedback${queryString ? `?${queryString}` : ''}`);
  },
  createFeedback: (data) => client.post('/feedback', data),
  updateFeedback: (id, data) => client.put(`/feedback/${id}`, data),
  respondToFeedback: (id, response) => client.put(`/feedback/${id}/respond`, { response }),
  resolveFeedback: (id) => client.put(`/feedback/${id}/resolve`),
  editFeedbackResponse: (id, response) => client.put(`/feedback/${id}/edit-response`, { response }),
  getMyProjectsFeedback: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return client.get(`/feedback/my-projects${queryString ? `?${queryString}` : ''}`);
  },

  // Import/Export
  downloadImportTemplate: () => client.get('/import/template', { responseType: 'blob' }),
  importData: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Spaces
  getSpaces: () => client.get('/spaces'),
  createSpace: (data) => client.post('/spaces', data),
  updateSpace: (id, data) => client.put(`/spaces/${id}`, data),
  deleteSpace: (id) => client.delete(`/spaces/${id}`),

  // User Preferences
  updateDefaultSpace: (spaceId) => client.put('/auth/default-space', { default_space_id: spaceId }),
};

export default api;
