import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const client = axios.create({
  baseURL: API_BASE,
});

// Add token to all requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on login failures - let the login component handle it
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    // Only logout on 401 (not authenticated), not on 403 (not authorized)
    // 401 = token expired/invalid -> logout
    // 403 = user doesn't have permission -> show error but stay logged in
    if (!isLoginRequest && error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Generic methods
  get: (url) => client.get(url),
  post: (url, data) => client.post(url, data),
  put: (url, data) => client.put(url, data),
  delete: (url) => client.delete(url),

  // Auth
  login: (email, password) => client.post('/auth/login', { email, password }),
  register: (email, name, password) => client.post('/auth/register', { email, name, password }),
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

  // User Management
  getUsers: () => client.get('/users'),
  updateUserRole: (userId, role) => client.put(`/users/${userId}/role`, { role }),
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

  // Consistency Report
  getConsistencyReport: () => client.get('/admin/consistency-report'),

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
};

export default api;
