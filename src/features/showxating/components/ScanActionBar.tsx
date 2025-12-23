/**
 * ScanActionBar - Bottom action bar with scan slots
 *
 * Layout: [S3] [S2] [S1] [SCAN]
 * - SCAN button triggers capture
 * - S1/S2/S3 show captured scans (S1 = most recent)
 * - Tap slot to view that capture
 * - Active slot is highlighted
 */

import { useShowxatingStore, ScanSlot } from '../store/showxatingStore';

interface ScanActionBarProps {
  onScan: () => void;
  disabled?: boolean;
}

export function ScanActionBar({ onScan, disabled }: ScanActionBarProps) {
  const { activeSlot, setActiveSlot, scanSlots, isCapturing } = useShowxatingStore();

  const slots: { id: ScanSlot; label: string }[] = [
    { id: 's3', label: 'S3' },
    { id: 's2', label: 'S2' },
    { id: 's1', label: 'S1' },
  ];

  return (
    <div className="flex items-center justify-center gap-3">
      {/* History slots */}
      {slots.map(({ id, label }) => {
        const scan = scanSlots[id as 's1' | 's2' | 's3'];
        const isActive = activeSlot === id;
        const hasContent = scan !== null;

        return (
          <button
            key={id}
            onClick={() => hasContent && setActiveSlot(id)}
            disabled={!hasContent}
            className={`
              relative w-12 h-12 rounded-lg border-2 transition-all
              ${isActive
                ? 'border-[var(--showxating-cyan)] bg-[var(--showxating-cyan)]/20'
                : hasContent
                ? 'border-[var(--showxating-gold-dim)] bg-black/50 hover:border-[var(--showxating-gold)]'
                : 'border-[var(--showxating-gold-dim)]/30 bg-black/30 opacity-50 cursor-not-allowed'
              }
            `}
          >
            {/* Thumbnail preview */}
            {scan && (
              <img
                src={scan.imageDataUrl}
                alt={label}
                className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] object-cover rounded opacity-60"
              />
            )}
            {/* Slot label */}
            <span
              className={`
                absolute inset-0 flex items-center justify-center
                hud-text text-xs font-bold
                ${isActive ? 'text-[var(--showxating-cyan)]' : 'text-[var(--showxating-gold-dim)]'}
              `}
            >
              {label}
            </span>
            {/* Card count badge */}
            {scan && scan.cards.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--showxating-cyan)] flex items-center justify-center text-[10px] text-black font-bold">
                {scan.cards.length}
              </span>
            )}
          </button>
        );
      })}

      {/* Divider */}
      <div className="w-px h-8 bg-[var(--showxating-gold-dim)]/30 mx-1" />

      {/* SCAN / LIVE button */}
      {activeSlot === 'live' ? (
        <button
          onClick={onScan}
          disabled={disabled || isCapturing}
          className={`
            showxating-btn showxating-btn-primary px-6 py-3
            ${isCapturing ? 'animate-pulse' : ''}
          `}
        >
          {isCapturing ? 'SCANNING...' : 'SCAN'}
        </button>
      ) : (
        <button
          onClick={() => setActiveSlot('live')}
          className="showxating-btn px-6 py-3"
        >
          LIVE
        </button>
      )}
    </div>
  );
}
