import { useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { shareDiagnostics } from '../features/showxating/services/exportDiagnostics';
import { useScanSlotsStore } from '../features/showxating/store/showxatingStore';

interface SysPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SysPanel({ isOpen, onClose }: SysPanelProps) {
  const { defaultMode, defaultScanResult, setDefaultMode, setDefaultScanResult } = useSettingsStore();
  const { scanSlots } = useScanSlotsStore();
  const [isExporting, setIsExporting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleFactoryReset = () => {
    // Clear all localStorage
    localStorage.clear();
    // Force reload to show welcome screen
    window.location.reload();
  };

  // Count total scans
  const slotOrder = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] as const;
  const scansCount = slotOrder.filter(id => scanSlots[id] !== null).length;

  const handleSendDiagnostics = async () => {
    if (scansCount === 0) {
      alert('No scans to export. Capture some cards first!');
      return;
    }

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
      <div
        className="fixed inset-0 bg-black/70 z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 left-0 w-80 max-w-[90vw] h-full bg-[#0a0a0f] border-r border-[#d4a84b]/30 z-50 overflow-y-auto"
        style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#d4a84b]/30">
          <h2
            className="text-lg font-semibold tracking-wider uppercase"
            style={{ color: '#d4a84b' }}
          >
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
            <label
              className="block text-xs tracking-wider uppercase"
              style={{ color: '#a08040' }}
            >
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
            <label
              className="block text-xs tracking-wider uppercase"
              style={{ color: '#a08040' }}
            >
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
                VISIBLE
              </button>
              <button
                onClick={() => setDefaultScanResult('opposite')}
                className={`flex-1 px-3 py-2 text-xs tracking-wider uppercase border transition-colors ${
                  defaultScanResult === 'opposite'
                    ? 'bg-[#d4a84b] text-[#0a0a0f] border-[#d4a84b]'
                    : 'border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10'
                }`}
              >
                OPPOSITE
              </button>
            </div>
          </div>

          {/* Diagnostics Section */}
          <div className="space-y-2">
            <label
              className="block text-xs tracking-wider uppercase"
              style={{ color: '#a08040' }}
            >
              DIAGNOSTICS
            </label>
            {/* SEND DIAGNOSTICS button */}
            <button
              onClick={handleSendDiagnostics}
              disabled={isExporting || scansCount === 0}
              className={`w-full px-3 py-2 text-xs tracking-wider uppercase border transition-colors ${
                isExporting || scansCount === 0
                  ? 'border-[#d4a84b]/20 text-[#d4a84b]/30 cursor-not-allowed'
                  : 'border-[#d4a84b]/50 text-[#a08040] hover:bg-[#d4a84b]/10'
              }`}
            >
              {isExporting ? 'EXPORTING...' : `SEND DIAGNOSTICS${scansCount > 0 ? ` (${scansCount})` : ''}`}
            </button>
            {/* RECORD TELEMETRY button - disabled */}
            <button
              disabled
              className="w-full px-3 py-2 text-xs tracking-wider uppercase border border-[#d4a84b]/20 text-[#d4a84b]/30 cursor-not-allowed"
            >
              RECORD TELEMETRY
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-[#d4a84b]/20 pt-4">
            <label
              className="block text-xs tracking-wider uppercase mb-3"
              style={{ color: '#a08040' }}
            >
              SYSTEM STATUS
            </label>

            {/* System info */}
            <div className="space-y-2 text-xs" style={{ color: '#707080' }}>
              <div className="flex justify-between">
                <span style={{ color: '#a08040' }}>VERSION</span>
                <span style={{ color: '#d4a84b' }}>0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#a08040' }}>BUILD</span>
                <span style={{ color: '#d4a84b' }}>2024.12.22</span>
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
            <label
              className="block text-xs tracking-wider uppercase mb-3"
              style={{ color: '#a08040' }}
            >
              MAINTENANCE
            </label>

            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full px-3 py-2 text-xs tracking-wider uppercase border border-[#ff3b3b]/50 text-[#ff3b3b]/70 hover:bg-[#ff3b3b]/10 transition-colors"
              >
                BLOW DA AIRLOCKS
              </button>
            ) : (
              <div className="space-y-3 p-3 border border-[#ff3b3b]/50 bg-[#ff3b3b]/5 rounded">
                <p className="text-xs" style={{ color: '#ff3b3b' }}>
                  Oye, beratna! Dis gonna vent all yo data to da void, sasa ke?
                  All scans, settings, ereything go tumang.
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
                    VENT IT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
