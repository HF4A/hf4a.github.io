/**
 * SlotContextMenu - Long-press dialog for scan slots
 *
 * Shows [CLEAR] and [SEND] buttons when user long-presses a scan slot.
 * [SEND] is greyed out as future functionality.
 */

import { ScanSlot } from '../store/showxatingStore';

interface SlotContextMenuProps {
  slotId: ScanSlot;
  position: { x: number; y: number };
  onClear: () => void;
  onSend: () => void;
  onClose: () => void;
}

export function SlotContextMenu({
  slotId,
  position,
  onClear,
  onClose,
}: SlotContextMenuProps) {
  // Calculate position - show above the slot if near bottom of screen
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(10, Math.min(position.x - 60, window.innerWidth - 130)),
    bottom: window.innerHeight - position.y + 10,
    zIndex: 100,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[99]"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        style={menuStyle}
        className="bg-[#0a0a0f] border border-[var(--showxating-gold-dim)] rounded-lg overflow-hidden shadow-lg"
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-[var(--showxating-gold-dim)]/30 bg-black/50">
          <span className="hud-text text-xs text-[var(--showxating-gold)]">
            {slotId.toUpperCase()}
          </span>
        </div>

        {/* Actions */}
        <div className="p-2 space-y-1">
          {/* CLEAR button */}
          <button
            onClick={() => {
              onClear();
              onClose();
            }}
            className="w-full px-4 py-2 text-xs tracking-wider uppercase border border-[var(--showxating-gold-dim)] text-[var(--showxating-gold)] hover:bg-[var(--showxating-gold)]/10 transition-colors rounded"
          >
            CLEAR
          </button>

          {/* SEND button - greyed out */}
          <button
            disabled
            className="w-full px-4 py-2 text-xs tracking-wider uppercase border border-[var(--showxating-gold-dim)]/30 text-[var(--showxating-gold-dim)]/40 cursor-not-allowed rounded"
          >
            SEND
          </button>
        </div>
      </div>
    </>
  );
}
