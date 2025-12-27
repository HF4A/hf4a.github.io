import { useState } from 'react';
import {
  useSettingsStore,
  CARD_TYPE_GROUPS,
  CARD_TYPE_LABELS,
} from '../store/settingsStore';
import { useLogsStore } from '../store/logsStore';
import { shareDiagnostics, exportDiagnosticsZip } from '../features/showxating/services/exportDiagnostics';
import { uploadDiagnostics, isAvailable as isFeedbackAvailable } from '../services/feedbackService';
import { useScanSlotsStore } from '../features/showxating/store/showxatingStore';
import { useCorrectionsStore } from '../features/showxating/store/correctionsStore';
import { APP_VERSION, BUILD_DATE } from '../version';
import type { CardType } from '../types/card';

interface SysPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SysPanel({ isOpen, onClose }: SysPanelProps) {
  const { defaultMode, defaultScanResult, activeCardTypes, setDefaultMode, setDefaultScanResult, toggleCardType } =
    useSettingsStore();
  const { scanSlots } = useScanSlotsStore();
  const correctionsCount = useCorrectionsStore((state) => Object.keys(state.corrections).length);
  const logsCount = useLogsStore((state) => state.logs.length);
  const [isExporting, setIsExporting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCardTypes, setShowCardTypes] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);

  const handleFactoryReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  const slotOrder = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] as const;
  const scansCount = slotOrder.filter((id) => scanSlots[id] !== null).length;

  const handleSendDiagnostics = () => {
    // Show modal if feedback service is available, otherwise fall back to share
    if (isFeedbackAvailable()) {
      setShowDiagnosticsModal(true);
    } else {
      // Direct share/download when not authenticated
      handleDirectShare();
    }
  };

  const handleDirectShare = async () => {
    setIsExporting(true);
    try {
      await shareDiagnostics();
    } catch (err) {
      console.error('[SysPanel] Failed to export diagnostics:', err);
      alert('Failed to export diagnostics. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed top-0 left-0 w-80 max-w-[90vw] h-full bg-[#0a0a0f] border-r border-[#d4a84b]/30 z-50 overflow-y-auto"
        style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#d4a84b]/30">
          <h2 className="text-lg font-semibold tracking-wider uppercase" style={{ color: '#d4a84b' }}>
            SYSTEM
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs tracking-wider uppercase border border-[#d4a84b]/50 hover:bg-[#d4a84b]/10 transition-colors"
            style={{ color: '#a08040' }}
          >
            CLOSE
          </button>
        </div>

        {/* Settings */}
        <div className="p-4 space-y-6">
          {/* Default Launch Mode */}
          <div className="space-y-2">
            <label className="block text-xs tracking-wider uppercase" style={{ color: '#a08040' }}>
              DEFAULT LAUNCH MODE
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDefaultMode('scan')}
                className={`flex-1 px-3 py-2 text-xs tracking-wider uppercase border transition-colors ${
                  defaultMode === 'scan'
                    ? 'bg-[#d4a84b] text-[#0a0a0f] border-[#d4a84b]'
                    : 'border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10'
                }`}
              >
                SCAN
              </button>
              <button
                onClick={() => setDefaultMode('catalog')}
                className={`flex-1 px-3 py-2 text-xs tracking-wider uppercase border transition-colors ${
                  defaultMode === 'catalog'
                    ? 'bg-[#d4a84b] text-[#0a0a0f] border-[#d4a84b]'
                    : 'border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10'
                }`}
              >
                CATALOG
              </button>
            </div>
          </div>

          {/* Default Scan Result */}
          <div className="space-y-2">
            <label className="block text-xs tracking-wider uppercase" style={{ color: '#a08040' }}>
              DEFAULT SCAN RESULT
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDefaultScanResult('visible')}
                className={`flex-1 px-3 py-2 text-xs tracking-wider uppercase border transition-colors ${
                  defaultScanResult === 'visible'
                    ? 'bg-[#d4a84b] text-[#0a0a0f] border-[#d4a84b]'
                    : 'border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10'
                }`}
              >
                FRONT
              </button>
              <button
                onClick={() => setDefaultScanResult('opposite')}
                className={`flex-1 px-3 py-2 text-xs tracking-wider uppercase border transition-colors ${
                  defaultScanResult === 'opposite'
                    ? 'bg-[#d4a84b] text-[#0a0a0f] border-[#d4a84b]'
                    : 'border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10'
                }`}
              >
                BACK
              </button>
            </div>
          </div>

          {/* Active Card Types */}
          <div className="space-y-2">
            <label className="block text-xs tracking-wider uppercase" style={{ color: '#a08040' }}>
              CARD FILTER
            </label>
            <button
              onClick={() => setShowCardTypes(true)}
              className="w-full px-3 py-2 text-xs tracking-wider uppercase border border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10 transition-colors text-left flex justify-between items-center"
            >
              <span>ACTIVE CARD TYPES</span>
              <span style={{ color: '#d4a84b' }}>{activeCardTypes.length} ACTIVE</span>
            </button>
          </div>

          {/* Diagnostics Section */}
          <div className="space-y-2">
            <label className="block text-xs tracking-wider uppercase" style={{ color: '#a08040' }}>
              DIAGNOSTICS
            </label>
            <button
              onClick={handleSendDiagnostics}
              disabled={isExporting}
              className={`w-full px-3 py-2 text-xs tracking-wider uppercase border transition-colors ${
                isExporting
                  ? 'border-[#d4a84b]/20 text-[#d4a84b]/30 cursor-not-allowed'
                  : 'border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10'
              }`}
            >
              {isExporting
                ? 'EXPORTING...'
                : `SEND DIAGNOSTICS (${scansCount}S/${correctionsCount}C)`}
            </button>
            <button
              onClick={() => setShowLogs(true)}
              className="w-full px-3 py-2 text-xs tracking-wider uppercase border border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10 transition-colors text-left flex justify-between items-center"
            >
              <span>VIEW LOGS</span>
              <span style={{ color: '#d4a84b' }}>{logsCount}</span>
            </button>
          </div>

          {/* System Status */}
          <div className="border-t border-[#d4a84b]/20 pt-4">
            <label className="block text-xs tracking-wider uppercase mb-3" style={{ color: '#a08040' }}>
              SYSTEM STATUS
            </label>
            <div className="space-y-2 text-xs" style={{ color: '#707080' }}>
              <div className="flex justify-between">
                <span style={{ color: '#a08040' }}>VERSION</span>
                <span style={{ color: '#d4a84b' }}>{APP_VERSION}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#a08040' }}>BUILD</span>
                <span style={{ color: '#d4a84b' }}>{BUILD_DATE}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#a08040' }}>STATUS</span>
                <span style={{ color: '#00d4ff' }}>ONLINE</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#a08040' }}>TIME</span>
                <span style={{ color: '#d4a84b' }}>{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Factory Reset Section */}
          <div className="border-t border-[#d4a84b]/20 pt-4">
            <label className="block text-xs tracking-wider uppercase mb-3" style={{ color: '#a08040' }}>
              MAINTENANCE
            </label>

            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full px-3 py-2 text-xs tracking-wider uppercase border border-[#ff3b3b]/50 text-[#ff3b3b]/70 hover:bg-[#ff3b3b]/10 transition-colors"
              >
                WIPE THE CORE
              </button>
            ) : (
              <div className="space-y-3 p-3 border border-[#ff3b3b]/50 bg-[#ff3b3b]/5 rounded">
                <p className="text-xs" style={{ color: '#ff3b3b' }}>
                  Oye, kopeng! Dis gonna wipe da whole core, sasa ke? All scans, settings, corrections -
                  ereything go poof.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 px-3 py-2 text-xs tracking-wider uppercase border border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10 transition-colors"
                  >
                    NA, WAIT
                  </button>
                  <button
                    onClick={handleFactoryReset}
                    className="flex-1 px-3 py-2 text-xs tracking-wider uppercase border border-[#ff3b3b] bg-[#ff3b3b]/20 text-[#ff3b3b] hover:bg-[#ff3b3b]/30 transition-colors"
                  >
                    WIPE IT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Types Popup */}
      {showCardTypes && (
        <CardTypesPopup
          activeTypes={activeCardTypes}
          onToggle={toggleCardType}
          onClose={() => setShowCardTypes(false)}
        />
      )}

      {/* Logs Viewer */}
      {showLogs && <LogViewer onClose={() => setShowLogs(false)} />}

      {/* Diagnostics Upload Modal */}
      {showDiagnosticsModal && (
        <DiagnosticsUploadModal
          onClose={() => setShowDiagnosticsModal(false)}
          scansCount={scansCount}
          correctionsCount={correctionsCount}
        />
      )}
    </>
  );
}

interface CardTypesPopupProps {
  activeTypes: CardType[];
  onToggle: (type: CardType) => void;
  onClose: () => void;
}

function CardTypesPopup({ activeTypes, onToggle, onClose }: CardTypesPopupProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div
        className="relative bg-[#0a0a0f] border border-[#d4a84b]/50 rounded-lg max-w-sm w-full max-h-[80vh] overflow-hidden"
        style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4a84b]/30">
          <h3 className="text-sm tracking-wider uppercase" style={{ color: '#d4a84b' }}>
            ACTIVE CARD TYPES
          </h3>
          <button
            onClick={onClose}
            className="text-xs tracking-wider uppercase"
            style={{ color: '#a08040' }}
          >
            DONE
          </button>
        </div>

        {/* Card Types List */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {CARD_TYPE_GROUPS.map((group) => (
            <div key={group.name}>
              <h4
                className="text-[10px] tracking-wider uppercase mb-2"
                style={{ color: '#707080' }}
              >
                {group.name}
              </h4>
              <div className="space-y-1">
                {group.types.map((type) => {
                  const isActive = activeTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => onToggle(type)}
                      className={`w-full px-3 py-2 text-xs tracking-wider uppercase border text-left transition-colors flex items-center justify-between ${
                        isActive
                          ? 'bg-[#d4a84b]/20 border-[#d4a84b] text-[#d4a84b]'
                          : 'border-[#d4a84b]/30 text-[#a08040]/50 hover:bg-[#d4a84b]/5'
                      }`}
                    >
                      <span>{CARD_TYPE_LABELS[type]}</span>
                      <span>{isActive ? '●' : '○'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LogViewerProps {
  onClose: () => void;
}

function LogViewer({ onClose }: LogViewerProps) {
  const logs = useLogsStore((state) => state.logs);
  const clearLogs = useLogsStore((state) => state.clearLogs);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return '#ff3b3b';
      case 'warn':
        return '#ffaa00';
      case 'scan':
        return '#00d4ff';
      case 'match':
        return '#00ff88';
      case 'correct':
        return '#ff88ff';
      default:
        return '#a08040';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      <div
        className="relative bg-[#050508] border border-[#d4a84b]/30 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden"
        style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[#d4a84b]/30"
          style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
        >
          <h3 className="text-sm tracking-wider uppercase" style={{ color: '#d4a84b' }}>
            SYSTEM LOG
          </h3>
          <div className="flex gap-2">
            <button
              onClick={clearLogs}
              className="text-xs tracking-wider uppercase px-2 py-1 border border-[#ff3b3b]/30 text-[#ff3b3b]/70 hover:bg-[#ff3b3b]/10"
            >
              CLEAR
            </button>
            <button onClick={onClose} className="text-xs tracking-wider uppercase" style={{ color: '#a08040' }}>
              CLOSE
            </button>
          </div>
        </div>

        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
          }}
        />

        {/* Log entries */}
        <div className="p-4 overflow-y-auto max-h-[60vh] text-xs space-y-1">
          {logs.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#707080' }}>
              NO LOG ENTRIES
            </div>
          ) : (
            [...logs].reverse().map((entry) => (
              <div key={entry.id} className="flex gap-2">
                <span style={{ color: '#505060' }}>{formatTime(entry.timestamp)}</span>
                <span style={{ color: getLevelColor(entry.level) }}>[{entry.level.toUpperCase()}]</span>
                <span style={{ color: '#a0a0b0' }}>{entry.message}</span>
                {entry.data && (
                  <span style={{ color: '#606070' }}>{JSON.stringify(entry.data)}</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 border-t border-[#d4a84b]/20 text-[10px]"
          style={{ color: '#505060', fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
        >
          {logs.length} ENTRIES • MAX 100
        </div>
      </div>
    </div>
  );
}

interface DiagnosticsUploadModalProps {
  onClose: () => void;
  scansCount: number;
  correctionsCount: number;
}

function DiagnosticsUploadModal({ onClose, scansCount, correctionsCount }: DiagnosticsUploadModalProps) {
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error' | 'sharing'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpload = async () => {
    setStatus('uploading');
    setErrorMessage(null);

    try {
      const zipBlob = await exportDiagnosticsZip();
      const result = await uploadDiagnostics(zipBlob, comment.trim() || undefined);

      if (result.success) {
        setStatus('success');
        // Auto-close after brief success message
        setTimeout(() => onClose(), 2000);
      } else {
        // Upload failed, try share fallback
        console.warn('[DiagnosticsUpload] Upload failed, falling back to share:', result.error);
        setStatus('sharing');
        await shareDiagnostics();
        onClose();
      }
    } catch (err) {
      console.error('[DiagnosticsUpload] Error:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleFallbackShare = async () => {
    setStatus('sharing');
    try {
      await shareDiagnostics();
      onClose();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Share failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      <div
        className="relative bg-[#0a0a0f] border border-[#d4a84b]/50 rounded-lg max-w-sm w-full"
        style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4a84b]/30">
          <h3 className="text-sm tracking-wider uppercase" style={{ color: '#d4a84b' }}>
            SEND DIAGNOSTICS
          </h3>
          <button
            onClick={onClose}
            disabled={status === 'uploading'}
            className="text-xs tracking-wider uppercase disabled:opacity-50"
            style={{ color: '#a08040' }}
          >
            CLOSE
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status messages */}
          {status === 'success' && (
            <div className="p-3 rounded border border-[#00d4ff] bg-[#00d4ff]/10">
              <span className="text-xs tracking-wider uppercase" style={{ color: '#00d4ff' }}>
                UPLOADED SUCCESSFULLY - THANK YOU!
              </span>
            </div>
          )}
          {status === 'error' && (
            <div className="p-3 rounded border border-red-500 bg-red-500/10">
              <span className="text-xs tracking-wider uppercase text-red-400">
                ERROR: {errorMessage}
              </span>
            </div>
          )}

          {/* Summary */}
          <div className="space-y-2 text-xs" style={{ color: '#a08040' }}>
            <div className="flex justify-between">
              <span>SCANS</span>
              <span style={{ color: '#d4a84b' }}>{scansCount}</span>
            </div>
            <div className="flex justify-between">
              <span>CORRECTIONS</span>
              <span style={{ color: '#d4a84b' }}>{correctionsCount}</span>
            </div>
          </div>

          {/* Comment field */}
          <div>
            <label className="block text-[10px] tracking-wider uppercase mb-2" style={{ color: '#a08040' }}>
              NOTES (OPTIONAL)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Any context about what you were testing, issues encountered..."
              rows={3}
              className="w-full px-3 py-2 bg-black/50 border rounded text-sm resize-none"
              style={{
                borderColor: '#d4a84b50',
                color: '#d4a84b',
                fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
                fontSize: '14px',
              }}
              disabled={status !== 'idle'}
            />
            <p className="text-[10px] tracking-wider uppercase mt-1 text-right" style={{ color: '#707080' }}>
              {comment.length}/500
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#d4a84b]/30 space-y-2">
          <button
            onClick={handleUpload}
            disabled={status !== 'idle'}
            className="w-full py-2 rounded border transition-colors disabled:opacity-50"
            style={{
              borderColor: '#00d4ff',
              backgroundColor: status === 'idle' ? '#00d4ff' : 'transparent',
              color: status === 'idle' ? '#0a0a0f' : '#00d4ff',
            }}
          >
            <span className="text-xs tracking-wider uppercase">
              {status === 'uploading' ? 'UPLOADING...' :
               status === 'sharing' ? 'OPENING SHARE...' :
               status === 'success' ? 'UPLOADED!' : 'UPLOAD TO SERVER'}
            </span>
          </button>
          {status === 'error' && (
            <button
              onClick={handleFallbackShare}
              className="w-full py-2 rounded border transition-colors hover:bg-[#d4a84b]/10"
              style={{ borderColor: '#d4a84b50', color: '#a08040' }}
            >
              <span className="text-xs tracking-wider uppercase">SHARE VIA DEVICE</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
