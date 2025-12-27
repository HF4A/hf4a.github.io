/**
 * ApiLogsModal - Shows API response logs in a readable format
 *
 * Displays scan logs with structured API response data
 * for debugging card detection issues.
 */

import { motion } from 'framer-motion';
import { useLogsStore, LogEntry } from '../../../store/logsStore';

interface ApiLogsModalProps {
  onClose: () => void;
}

interface ApiResponseData {
  success?: boolean;
  cardCount?: number;
  cards?: Array<{
    type: string;
    name: string;
    side: string;
    confidence: number;
    bbox?: [number, number, number, number];
  }>;
  gridRows?: number;
  gridCols?: number;
  model?: string;
  tokens?: { input: number; output: number };
  latency?: number;
}

export function ApiLogsModal({ onClose }: ApiLogsModalProps) {
  const logs = useLogsStore((s) => s.logs);

  // Filter to scan logs (API responses)
  const scanLogs = logs.filter((l) => l.level === 'scan');

  // Get the most recent scan log with API response data
  const recentScanLogs = scanLogs.slice(-5).reverse();

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--showxating-gold-dim)]">
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs tracking-wider uppercase border transition-colors"
          style={{
            borderColor: 'var(--showxating-gold-dim)',
            color: 'var(--showxating-gold)',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
        >
          ← CLOSE
        </button>
        <span
          className="text-xs tracking-wider uppercase"
          style={{
            color: 'var(--showxating-gold)',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
        >
          API LOGS
        </span>
        <div style={{ width: 70 }} />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {recentScanLogs.length === 0 ? (
          <div className="text-center py-8">
            <span className="hud-text hud-text-dim">NO SCAN LOGS</span>
          </div>
        ) : (
          <div className="space-y-4">
            {recentScanLogs.map((logEntry) => (
              <LogEntryCard key={logEntry.id} entry={logEntry} />
            ))}
          </div>
        )}

        {/* All logs section */}
        <div className="mt-8 border-t border-[var(--showxating-gold-dim)] pt-4">
          <h2
            className="text-xs tracking-wider uppercase mb-3"
            style={{ color: 'var(--showxating-gold-dim)' }}
          >
            ALL RECENT LOGS ({logs.length})
          </h2>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {logs.slice(-20).reverse().map((logEntry) => (
              <div
                key={logEntry.id}
                className="text-[10px] p-1.5 bg-black/50 rounded border border-[var(--showxating-gold-dim)]/30"
              >
                <span
                  className={`font-mono ${
                    logEntry.level === 'error'
                      ? 'text-red-400'
                      : logEntry.level === 'warn'
                        ? 'text-yellow-400'
                        : logEntry.level === 'scan'
                          ? 'text-[var(--showxating-cyan)]'
                          : 'text-[var(--showxating-gold)]'
                  }`}
                >
                  [{logEntry.level.toUpperCase()}]
                </span>{' '}
                <span className="text-[var(--showxating-gold)]">
                  {new Date(logEntry.timestamp).toLocaleTimeString()}
                </span>{' '}
                <span className="text-[var(--showxating-gold-dim)]">
                  {logEntry.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LogEntryCard({ entry }: { entry: LogEntry }) {
  const apiResponse = entry.data?.apiResponse as ApiResponseData | undefined;
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--showxating-cyan)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <span
          className="text-xs tracking-wider"
          style={{ color: 'var(--showxating-cyan)' }}
        >
          {timestamp}
        </span>
        {apiResponse?.latency && (
          <span
            className="text-[10px] px-2 py-0.5 rounded bg-black/50"
            style={{ color: 'var(--showxating-gold)' }}
          >
            {apiResponse.latency}ms
          </span>
        )}
      </div>

      {/* Message */}
      <p
        className="text-sm mb-3"
        style={{ color: 'var(--showxating-gold)' }}
      >
        {entry.message}
      </p>

      {/* API Response Details */}
      {apiResponse && (
        <div className="space-y-2">
          {/* Summary row */}
          <div className="flex gap-4 text-[10px]">
            <span style={{ color: 'var(--showxating-gold-dim)' }}>
              GRID: {apiResponse.gridRows || '?'}×{apiResponse.gridCols || '?'}
            </span>
            <span style={{ color: 'var(--showxating-gold-dim)' }}>
              MODEL: {apiResponse.model || 'unknown'}
            </span>
            {apiResponse.tokens && (
              <span style={{ color: 'var(--showxating-gold-dim)' }}>
                TOKENS: {apiResponse.tokens.input}→{apiResponse.tokens.output}
              </span>
            )}
          </div>

          {/* Cards table */}
          {apiResponse.cards && apiResponse.cards.length > 0 && (
            <div className="mt-2">
              <p
                className="text-[10px] tracking-wider uppercase mb-1"
                style={{ color: 'var(--showxating-gold-dim)' }}
              >
                DETECTED CARDS ({apiResponse.cards.length}):
              </p>
              <div className="bg-black/50 rounded border border-[var(--showxating-gold-dim)]/30 overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-[var(--showxating-gold-dim)]/30">
                      <th className="text-left p-1.5" style={{ color: 'var(--showxating-gold-dim)' }}>
                        #
                      </th>
                      <th className="text-left p-1.5" style={{ color: 'var(--showxating-gold-dim)' }}>
                        TYPE
                      </th>
                      <th className="text-left p-1.5" style={{ color: 'var(--showxating-gold-dim)' }}>
                        NAME
                      </th>
                      <th className="text-left p-1.5" style={{ color: 'var(--showxating-gold-dim)' }}>
                        SIDE
                      </th>
                      <th className="text-right p-1.5" style={{ color: 'var(--showxating-gold-dim)' }}>
                        CONF
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiResponse.cards.map((card, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-[var(--showxating-gold-dim)]/20 last:border-0"
                      >
                        <td className="p-1.5" style={{ color: 'var(--showxating-cyan)' }}>
                          {idx + 1}
                        </td>
                        <td className="p-1.5" style={{ color: 'var(--showxating-gold)' }}>
                          {card.type}
                        </td>
                        <td className="p-1.5" style={{ color: 'var(--showxating-gold)' }}>
                          {card.name}
                        </td>
                        <td className="p-1.5" style={{ color: 'var(--showxating-gold-dim)' }}>
                          {card.side}
                        </td>
                        <td className="p-1.5 text-right" style={{ color: 'var(--showxating-gold)' }}>
                          {Math.round(card.confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
