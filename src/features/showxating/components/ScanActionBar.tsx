/**
 * ScanActionBar - Bottom action bar with scan slots
 *
 * Layout: Scrollable [S7] [S6] [S5] [S4] [S3] [S2] [S1] | [SCAN/LIVE]
 * - SCAN button triggers capture
 * - S1-S7 show captured scans (S1 = most recent)
 * - Tap slot to view that capture
 * - Long-press slot to show context menu (CLEAR/SEND)
 * - Active slot is highlighted
 */

import { useState, useRef, useCallback } from 'react';
import { useShowxatingStore, ScanSlot } from '../store/showxatingStore';
import { SlotContextMenu } from './SlotContextMenu';

interface ScanActionBarProps {
  onScan: () => void;
  disabled?: boolean;
}

type SlotId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7';

interface ContextMenuState {
  slotId: SlotId;
  position: { x: number; y: number };
}

export function ScanActionBar({ onScan, disabled }: ScanActionBarProps) {
  const { activeSlot, setActiveSlot, scanSlots, isCapturing, removeSlot } = useShowxatingStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const slots: { id: SlotId; label: string }[] = [
    { id: 's7', label: 'S7' },
    { id: 's6', label: 'S6' },
    { id: 's5', label: 'S5' },
    { id: 's4', label: 'S4' },
    { id: 's3', label: 'S3' },
    { id: 's2', label: 'S2' },
    { id: 's1', label: 'S1' },
  ];

  const handlePointerDown = useCallback((e: React.PointerEvent, slotId: SlotId) => {
    const scan = scanSlots[slotId];
    if (!scan) return;

    longPressTriggeredRef.current = false;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top,
    };

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setContextMenu({ slotId, position });
    }, 500); // 500ms for long press
  }, [scanSlots]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleClick = useCallback((slotId: ScanSlot, hasContent: boolean) => {
    // Don't navigate if long press was triggered
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (hasContent) {
      setActiveSlot(slotId);
    }
  }, [setActiveSlot]);

  const handleClear = useCallback(() => {
    if (contextMenu) {
      removeSlot(contextMenu.slotId);
    }
  }, [contextMenu, removeSlot]);

  const handleSend = useCallback(() => {
    // Future functionality
    console.log('[ScanActionBar] Send slot - future functionality');
  }, []);

  return (
    <div className="flex items-center gap-3">
      {/* Scrollable slots container - right-aligned */}
      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex items-center justify-end gap-2 min-w-min px-1">
          {/* History slots - only render slots with content, S1 on right next to LIVE */}
          {slots
            .filter(({ id }) => scanSlots[id] !== null)
            .map(({ id, label }) => {
              const scan = scanSlots[id]!;
              const isActive = activeSlot === id;

              return (
                <button
                  key={id}
                  onClick={() => handleClick(id, true)}
                  onPointerDown={(e) => handlePointerDown(e, id)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onPointerCancel={handlePointerUp}
                  className={`
                    relative w-11 h-11 flex-shrink-0 rounded-lg border-2 transition-all touch-manipulation
                    ${isActive
                      ? 'border-[var(--showxating-cyan)] bg-[var(--showxating-cyan)]/20'
                      : 'border-[var(--showxating-gold-dim)] bg-black/50 hover:border-[var(--showxating-gold)]'
                    }
                  `}
                >
                  {/* Thumbnail preview */}
                  <img
                    src={scan.imageDataUrl}
                    alt={label}
                    className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] object-cover rounded opacity-60 pointer-events-none"
                  />
                  {/* Slot label */}
                  <span
                    className={`
                      absolute inset-0 flex items-center justify-center
                      hud-text text-xs font-bold pointer-events-none
                      ${isActive ? 'text-[var(--showxating-cyan)]' : 'text-[var(--showxating-gold-dim)]'}
                    `}
                  >
                    {label}
                  </span>
                  {/* Card count badge */}
                  {scan.cards.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--showxating-cyan)] flex items-center justify-center text-[10px] text-black font-bold pointer-events-none">
                      {scan.cards.length}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-[var(--showxating-gold-dim)]/30 flex-shrink-0" />

      {/* SCAN / LIVE button */}
      {activeSlot === 'live' ? (
        <button
          onClick={onScan}
          disabled={disabled || isCapturing}
          className={`
            showxating-btn showxating-btn-primary px-5 py-3 flex-shrink-0
            ${isCapturing ? 'animate-pulse' : ''}
          `}
        >
          {isCapturing ? 'SCANNING...' : 'SCAN'}
        </button>
      ) : (
        <button
          onClick={() => setActiveSlot('live')}
          className="showxating-btn px-5 py-3 flex-shrink-0"
        >
          LIVE
        </button>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <SlotContextMenu
          slotId={contextMenu.slotId}
          position={contextMenu.position}
          onClear={handleClear}
          onSend={handleSend}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
