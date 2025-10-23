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
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  login: (email, password) => client.post('/auth/login', { email, password }),
  register: (email, name, password) => client.post('/auth/register', { email, name, password }),

  // Projects
  getProjects: () => client.get('/projects'),
  createProject: (data) => client.post('/projects', data),
  deleteProject: (id) => client.delete(`/projects/${id}`),

  // Metrics
  getProjectMetrics: (projectId) => client.get(`/projects/${projectId}/metrics`),
  createMetric: (projectId, data) => client.post(`/projects/${projectId}/metrics`, data),
  updateMetric: (id, data) => client.put(`/metrics/${id}`, data),
  deleteMetric: (id) => client.delete(`/metrics/${id}`),

  // Data
  getProjectData: (projectId) => client.get(`/projects/${projectId}/data`),
  getMetricPeriods: (metricId) => client.get(`/metrics/${metricId}/periods`),
  createPeriod: (data) => client.post('/metric-periods', data),
  updatePeriod: (id, data) => client.put(`/metric-periods/${id}`, data),
  patchPeriod: (id, data) => client.patch(`/metric-periods/${id}`, data),

  // Comments
  getPeriodComments: (periodId) => client.get(`/periods/${periodId}/comments`),
  createComment: (periodId, data) => client.post(`/periods/${periodId}/comments`, data),
  deleteComment: (id) => client.delete(`/comments/${id}`),

  // CRAIDs
  getProjectCRAIDs: (projectId, type) => client.get(`/projects/${projectId}/craids${type ? `?type=${type}` : ''}`),
  createCRAID: (projectId, data) => client.post(`/projects/${projectId}/craids`, data),
  updateCRAID: (id, data) => client.put(`/craids/${id}`, data),
  deleteCRAID: (id) => client.delete(`/craids/${id}`),
};

export default api;
