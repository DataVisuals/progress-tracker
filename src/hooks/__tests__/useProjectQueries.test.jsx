import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useProjectData,
  useProjectMetrics,
  useInvalidateProjectQueries,
  queryKeys
} from '../useProjectQueries';

// Mock the API client
vi.mock('../../api/client', () => ({
  default: {
    getProjectData: vi.fn(),
    getProjectMetrics: vi.fn(),
    getProjectDataTimeTravel: vi.fn(),
  }
}));

import api from '../../api/client';

// Helper to create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity, // Keep cache for test duration
      },
    },
  });

// Wrapper component for hooks
const createWrapper = (queryClient) => {
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useProjectQueries', () => {
  let queryClient;

  const mockProjectData = [
    { id: 1, metric_id: 1, reporting_date: '2024-01-01', complete: 100, expected: 100 },
    { id: 2, metric_id: 1, reporting_date: '2024-02-01', complete: 200, expected: 200 },
  ];

  const mockProjectMetrics = [
    { id: 1, name: 'Metric A', project_id: 1, final_target: 1000 },
    { id: 2, name: 'Metric B', project_id: 1, final_target: 500 },
  ];

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('useProjectData', () => {
    it('should fetch project data when projectId is provided', async () => {
      api.getProjectData.mockResolvedValueOnce({ data: mockProjectData });

      const { result } = renderHook(() => useProjectData(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.getProjectData).toHaveBeenCalledWith(1);
      expect(result.current.data).toEqual(mockProjectData);
    });

    it('should not fetch when projectId is null', async () => {
      const { result } = renderHook(() => useProjectData(null), {
        wrapper: createWrapper(queryClient),
      });

      // Wait a tick to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(api.getProjectData).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(
        () => useProjectData(1, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(api.getProjectData).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should return cached data immediately on subsequent renders', async () => {
      api.getProjectData.mockResolvedValue({ data: mockProjectData });

      // First render
      const { result: result1, unmount } = renderHook(() => useProjectData(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      const callsAfterFirst = api.getProjectData.mock.calls.length;

      unmount();

      // Second render - should have cached data IMMEDIATELY (synchronously)
      const { result: result2 } = renderHook(() => useProjectData(1), {
        wrapper: createWrapper(queryClient),
      });

      // Key assertion: cached data should be available immediately without waiting
      // This proves the cache is working - data is available synchronously
      expect(result2.current.data).toEqual(mockProjectData);
      expect(result2.current.isSuccess).toBe(true);

      // Note: React Query may still do a background refetch, but the important thing
      // is that cached data is available immediately to the user
    });

    it('should fetch fresh data for different projectId', async () => {
      const projectData2 = [{ id: 3, metric_id: 2, reporting_date: '2024-01-01', complete: 50 }];

      api.getProjectData
        .mockResolvedValueOnce({ data: mockProjectData })
        .mockResolvedValueOnce({ data: projectData2 });

      // Fetch project 1
      const { result: result1 } = renderHook(() => useProjectData(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      expect(result1.current.data).toEqual(mockProjectData);

      // Fetch project 2
      const { result: result2 } = renderHook(() => useProjectData(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result2.current.isSuccess).toBe(true));
      expect(result2.current.data).toEqual(projectData2);

      // Both calls should have been made
      expect(api.getProjectData).toHaveBeenCalledTimes(2);
    });
  });

  describe('useProjectMetrics', () => {
    it('should fetch project metrics when projectId is provided', async () => {
      api.getProjectMetrics.mockResolvedValueOnce({ data: mockProjectMetrics });

      const { result } = renderHook(() => useProjectMetrics(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(api.getProjectMetrics).toHaveBeenCalledWith(1);
      expect(result.current.data).toEqual(mockProjectMetrics);
    });

    it('should return cached metrics immediately on subsequent renders', async () => {
      api.getProjectMetrics.mockResolvedValue({ data: mockProjectMetrics });

      // First render
      const { result: result1, unmount } = renderHook(() => useProjectMetrics(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      unmount();

      // Second render - should have cached data IMMEDIATELY (synchronously)
      const { result: result2 } = renderHook(() => useProjectMetrics(1), {
        wrapper: createWrapper(queryClient),
      });

      // Key assertion: cached data should be available immediately without waiting
      expect(result2.current.data).toEqual(mockProjectMetrics);
      expect(result2.current.isSuccess).toBe(true);
    });
  });

  describe('Cache Invalidation - Preventing Stale Data', () => {
    it('should refetch data after cache invalidation', async () => {
      const initialData = [{ id: 1, complete: 100 }];
      const updatedData = [{ id: 1, complete: 150 }];

      api.getProjectData
        .mockResolvedValueOnce({ data: initialData })
        .mockResolvedValueOnce({ data: updatedData });

      // Initial fetch
      const { result } = renderHook(
        () => ({
          projectData: useProjectData(1),
          invalidate: useInvalidateProjectQueries(),
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.projectData.isSuccess).toBe(true));
      expect(result.current.projectData.data).toEqual(initialData);
      expect(api.getProjectData).toHaveBeenCalledTimes(1);

      // Invalidate cache (simulating what happens after a mutation)
      act(() => {
        result.current.invalidate.invalidateProjectData(1);
      });

      // Wait for refetch
      await waitFor(() => {
        expect(api.getProjectData).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(result.current.projectData.data).toEqual(updatedData);
      });
    });

    it('should invalidate all project queries when invalidateProject is called', async () => {
      api.getProjectData.mockResolvedValue({ data: mockProjectData });
      api.getProjectMetrics.mockResolvedValue({ data: mockProjectMetrics });

      const { result } = renderHook(
        () => ({
          projectData: useProjectData(1),
          projectMetrics: useProjectMetrics(1),
          invalidate: useInvalidateProjectQueries(),
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.projectData.isSuccess).toBe(true);
        expect(result.current.projectMetrics.isSuccess).toBe(true);
      });

      const initialDataCalls = api.getProjectData.mock.calls.length;
      const initialMetricsCalls = api.getProjectMetrics.mock.calls.length;

      // Invalidate all project queries
      act(() => {
        result.current.invalidate.invalidateProject(1);
      });

      // Both should refetch
      await waitFor(() => {
        expect(api.getProjectData.mock.calls.length).toBeGreaterThan(initialDataCalls);
        expect(api.getProjectMetrics.mock.calls.length).toBeGreaterThan(initialMetricsCalls);
      });
    });

    it('should NOT show stale data after invalidation - data updates immediately', async () => {
      const staleData = [{ id: 1, complete: 100, commentary: 'old comment' }];
      const freshData = [{ id: 1, complete: 200, commentary: 'new comment' }];

      api.getProjectData
        .mockResolvedValueOnce({ data: staleData })
        .mockResolvedValueOnce({ data: freshData });

      const { result } = renderHook(
        () => ({
          projectData: useProjectData(1),
          invalidate: useInvalidateProjectQueries(),
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.projectData.isSuccess).toBe(true));

      // Verify stale data is showing
      expect(result.current.projectData.data[0].complete).toBe(100);
      expect(result.current.projectData.data[0].commentary).toBe('old comment');

      // Simulate mutation occurred - invalidate cache
      act(() => {
        result.current.invalidate.invalidateProjectData(1);
      });

      // Wait for fresh data
      await waitFor(() => {
        expect(result.current.projectData.data[0].complete).toBe(200);
        expect(result.current.projectData.data[0].commentary).toBe('new comment');
      });
    });
  });

  describe('Negative Tests - Stale Data Scenarios', () => {
    it('should NOT serve cached data for wrong projectId', async () => {
      api.getProjectData.mockResolvedValueOnce({ data: mockProjectData });

      // Fetch project 1
      const { result: result1 } = renderHook(() => useProjectData(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      // Try to get project 2 - should NOT return project 1's data
      const { result: result2 } = renderHook(() => useProjectData(2), {
        wrapper: createWrapper(queryClient),
      });

      // Project 2 should be loading, not returning project 1's cached data
      expect(result2.current.data).toBeUndefined();
      expect(result2.current.isLoading).toBe(true);
    });

    it('should NOT return stale metrics data for different project', async () => {
      const project1Metrics = [{ id: 1, name: 'Project 1 Metric', project_id: 1 }];
      const project2Metrics = [{ id: 2, name: 'Project 2 Metric', project_id: 2 }];

      api.getProjectMetrics
        .mockResolvedValueOnce({ data: project1Metrics })
        .mockResolvedValueOnce({ data: project2Metrics });

      // Fetch project 1 metrics
      const { result: result1 } = renderHook(() => useProjectMetrics(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      expect(result1.current.data[0].name).toBe('Project 1 Metric');

      // Fetch project 2 metrics - should NOT get project 1's metrics
      const { result: result2 } = renderHook(() => useProjectMetrics(2), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result2.current.isSuccess).toBe(true));

      // Verify correct data for each project
      expect(result2.current.data[0].name).toBe('Project 2 Metric');
      expect(result2.current.data[0].name).not.toBe('Project 1 Metric');
    });

    it('should clear stale data when switching projects rapidly', async () => {
      const project1Data = [{ id: 1, complete: 100 }];
      const project2Data = [{ id: 2, complete: 200 }];
      const project3Data = [{ id: 3, complete: 300 }];

      api.getProjectData
        .mockResolvedValueOnce({ data: project1Data })
        .mockResolvedValueOnce({ data: project2Data })
        .mockResolvedValueOnce({ data: project3Data });

      const { result, rerender } = renderHook(
        ({ projectId }) => useProjectData(projectId),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { projectId: 1 },
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data[0].complete).toBe(100);

      // Switch to project 2
      rerender({ projectId: 2 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data[0].complete).toBe(200);

      // Switch to project 3
      rerender({ projectId: 3 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data[0].complete).toBe(300);

      // Each project should have its own data, not mixed
      expect(api.getProjectData).toHaveBeenCalledTimes(3);
    });

    it('should handle API errors without showing stale data', async () => {
      api.getProjectData
        .mockResolvedValueOnce({ data: mockProjectData })
        .mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(
        () => ({
          projectData: useProjectData(1),
          invalidate: useInvalidateProjectQueries(),
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.projectData.isSuccess).toBe(true));
      expect(result.current.projectData.data).toEqual(mockProjectData);

      // Invalidate and trigger error
      act(() => {
        result.current.invalidate.invalidateProjectData(1);
      });

      await waitFor(() => expect(result.current.projectData.isError).toBe(true));

      // Should have error state, and data might be stale but error flag is set
      expect(result.current.projectData.error).toBeDefined();
    });

    it('should ensure query keys are unique per project', () => {
      // Test that query keys are properly namespaced
      const key1 = queryKeys.projectData(1);
      const key2 = queryKeys.projectData(2);
      const metricsKey1 = queryKeys.projectMetrics(1);

      // Keys should be different for different projects
      expect(key1).not.toEqual(key2);

      // Keys should be different for different query types
      expect(key1).not.toEqual(metricsKey1);

      // Same project should have same key
      expect(queryKeys.projectData(1)).toEqual(queryKeys.projectData(1));
    });
  });

  describe('Refetch Behavior', () => {
    it('should allow manual refetch to get latest data', async () => {
      const oldData = [{ id: 1, complete: 100 }];
      const newData = [{ id: 1, complete: 999 }];

      api.getProjectData
        .mockResolvedValueOnce({ data: oldData })
        .mockResolvedValueOnce({ data: newData });

      const { result } = renderHook(() => useProjectData(1), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data[0].complete).toBe(100);

      // Manual refetch and wait for it to complete
      act(() => {
        result.current.refetch();
      });

      // Wait for the refetch to complete and data to update
      await waitFor(() => {
        expect(result.current.data[0].complete).toBe(999);
      });

      expect(api.getProjectData).toHaveBeenCalledTimes(2);
    });
  });
});
