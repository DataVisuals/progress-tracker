import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock tokenUtils to prevent import issues in tests
vi.mock('./utils/tokenUtils', () => ({
  storeTokenExpiry: vi.fn(),
  clearTokenExpiry: vi.fn(),
  getTokenExpiry: vi.fn(),
  getTimeUntilExpiry: vi.fn(),
  isTokenExpiringSoon: vi.fn(),
  formatTimeUntilExpiry: vi.fn(),
  decodeToken: vi.fn(),
  isTokenExpired: vi.fn(),
  getStoredTokenExpiry: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });
// Export localStorageMock globally so tests can access it directly
global.localStorageMock = localStorageMock;
