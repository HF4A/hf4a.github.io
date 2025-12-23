/**
 * Logs Store
 *
 * Persistent logging system with circular buffer for debugging.
 * Logs are displayed in a Belter-themed terminal view.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'scan' | 'match' | 'correct';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 100;

interface LogsStore {
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string, data?: Record<string, unknown>) => void;
  clearLogs: () => void;
  getLogs: () => LogEntry[];
}

// Generate unique ID for log entry
function generateLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useLogsStore = create<LogsStore>()(
  persist(
    (set, get) => ({
      logs: [],

      addLog: (level, message, data) => {
        const entry: LogEntry = {
          id: generateLogId(),
          timestamp: Date.now(),
          level,
          message,
          data,
        };

        set((state) => {
          const newLogs = [...state.logs, entry];
          // Keep only the most recent MAX_LOG_ENTRIES
          if (newLogs.length > MAX_LOG_ENTRIES) {
            return { logs: newLogs.slice(-MAX_LOG_ENTRIES) };
          }
          return { logs: newLogs };
        });

        // Also log to console in development
        if (import.meta.env.DEV) {
          const prefix = `[${level.toUpperCase()}]`;
          if (data) {
            console.log(prefix, message, data);
          } else {
            console.log(prefix, message);
          }
        }
      },

      clearLogs: () => set({ logs: [] }),

      getLogs: () => get().logs,
    }),
    {
      name: 'showxating-logs',
    }
  )
);

// Convenience logging functions
export const log = {
  info: (message: string, data?: Record<string, unknown>) =>
    useLogsStore.getState().addLog('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    useLogsStore.getState().addLog('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) =>
    useLogsStore.getState().addLog('error', message, data),
  debug: (message: string, data?: Record<string, unknown>) =>
    useLogsStore.getState().addLog('debug', message, data),
  scan: (message: string, data?: Record<string, unknown>) =>
    useLogsStore.getState().addLog('scan', message, data),
  match: (message: string, data?: Record<string, unknown>) =>
    useLogsStore.getState().addLog('match', message, data),
  correct: (message: string, data?: Record<string, unknown>) =>
    useLogsStore.getState().addLog('correct', message, data),
};
