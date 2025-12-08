import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

// Query keys for cache management
export const queryKeys = {
  projectData: (projectId) => ['projectData', projectId],
  projectMetrics: (projectId) => ['projectMetrics', projectId],
  projectDataTimeTravel: (projectId, timestamp) => ['projectData', projectId, 'timeTravel', timestamp],
};

/**
 * Hook to fetch project data (metric periods)
 * @param {number|null} projectId - The project ID to fetch data for
 * @param {Object} options - Additional options
 * @param {boolean} options.enabled - Whether the query should run
 */
export function useProjectData(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.projectData(projectId),
    queryFn: async () => {
      const response = await api.getProjectData(projectId);
      return response.data;
    },
    enabled: enabled && !!projectId,
  });
}

/**
 * Hook to fetch project metrics
 * @param {number|null} projectId - The project ID to fetch metrics for
 * @param {Object} options - Additional options
 * @param {boolean} options.enabled - Whether the query should run
 */
export function useProjectMetrics(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.projectMetrics(projectId),
    queryFn: async () => {
      const response = await api.getProjectMetrics(projectId);
      return response.data;
    },
    enabled: enabled && !!projectId,
  });
}

/**
 * Hook to fetch project data at a specific point in time (time travel)
 * @param {number|null} projectId - The project ID
 * @param {string|null} timestamp - The timestamp to travel to
 * @param {Object} options - Additional options
 */
export function useProjectDataTimeTravel(projectId, timestamp, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.projectDataTimeTravel(projectId, timestamp),
    queryFn: async () => {
      const response = await api.getProjectDataTimeTravel(projectId, timestamp);
      return response.data;
    },
    enabled: enabled && !!projectId && !!timestamp,
    staleTime: Infinity, // Time travel data doesn't change
  });
}

/**
 * Hook to get the query client for manual cache operations
 * Use this to invalidate queries after mutations
 */
export function useInvalidateProjectQueries() {
  const queryClient = useQueryClient();

  return {
    // Invalidate all project data queries for a specific project
    invalidateProjectData: (projectId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectData(projectId) });
    },
    // Invalidate project metrics for a specific project
    invalidateProjectMetrics: (projectId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMetrics(projectId) });
    },
    // Invalidate all project-related queries for a specific project
    invalidateProject: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['projectData', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectMetrics', projectId] });
    },
    // Invalidate all project queries (useful after bulk operations)
    invalidateAllProjects: () => {
      queryClient.invalidateQueries({ queryKey: ['projectData'] });
      queryClient.invalidateQueries({ queryKey: ['projectMetrics'] });
    },
  };
}
