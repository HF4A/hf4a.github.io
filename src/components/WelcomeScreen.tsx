/**
 * WelcomeScreen - First-launch onboarding screen
 *
 * Scrollable welcome with Belta Creole sprinkled throughout.
 * Explains the app's purpose and basic usage.
 * Requires invite code registration before proceeding.
 */

import { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { authService } from '../services/authService';
import { APP_VERSION, BUILD_HASH } from '../version';

export function WelcomeScreen() {
  const { setHasSeenWelcome } = useSettingsStore();
  const [inviteCode, setInviteCode] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  // Check if already registered on mount
  useEffect(() => {
    if (authService.hasCredentials()) {
      setIsRegistered(true);
      const storedCode = authService.getInviteCode();
      if (storedCode) {
        setInviteCode(storedCode);
      }
    }
  }, []);

  const handleRegister = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setIsRegistering(true);
    setError(null);

    const result = await authService.register(inviteCode.trim());

    setIsRegistering(false);

    if (result.success) {
      setIsRegistered(true);
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  const handleContinue = () => {
    if (isRegistered) {
      setHasSeenWelcome(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#0a0a0f] overflow-y-auto"
      style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
    >
      {/* Scrollable content */}
      <div className="min-h-full flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#d4a84b]/30">
          <div className="px-6 py-4">
            <h1
              className="text-2xl font-bold tracking-widest uppercase text-center"
              style={{ color: '#d4a84b' }}
            >
              SHOWXATING
            </h1>
            <p className="text-center text-xs tracking-wider mt-1" style={{ color: '#707080' }}>
              HIGH FRONTIER 4 ALL CARD EXPLORER
            </p>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 py-8 space-y-8 max-w-lg mx-auto">
          {/* Welcome Section */}
          <section className="space-y-4">
            <h2 className="text-lg tracking-wider uppercase" style={{ color: '#d4a84b' }}>
              Oye, Beratna!
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#a0a0b0' }}>
              Welcome to da <span style={{ color: '#d4a84b' }}>SHOWXATING</span> system,
              kopeng. Dis tool help you see wa on da other side of yo cards,
              <span style={{ color: '#00d4ff' }}> sasa ke?</span>
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#a0a0b0' }}>
              You playing <span style={{ color: '#d4a84b' }}>High Frontier 4 All</span> and
              need to know wa on da flip side? Point yo camera, scan da cards,
              and we show you, <span style={{ color: '#00d4ff' }}>im easy!</span>
            </p>
          </section>

          {/* How to Use Section */}
          <section className="space-y-4">
            <h2 className="text-lg tracking-wider uppercase" style={{ color: '#d4a84b' }}>
              How to Use
            </h2>

            {/* Step 1 */}
            <div className="flex gap-4 items-start">
              <div
                className="w-8 h-8 flex-shrink-0 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                style={{ borderColor: '#d4a84b', color: '#d4a84b' }}
              >
                1
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#d4a84b' }}>
                  POINT YO CAMERA
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#707080' }}>
                  Lay out yo cards face up. Hold da device over dem so dey fit in da frame.
                  Multiple cards, no problem.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4 items-start">
              <div
                className="w-8 h-8 flex-shrink-0 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                style={{ borderColor: '#d4a84b', color: '#d4a84b' }}
              >
                2
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#d4a84b' }}>
                  HIT SCAN
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#707080' }}>
                  Press da big <span style={{ color: '#00d4ff' }}>SCAN</span> button.
                  System gonna find da cards and identify dem.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 items-start">
              <div
                className="w-8 h-8 flex-shrink-0 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                style={{ borderColor: '#d4a84b', color: '#d4a84b' }}
              >
                3
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#d4a84b' }}>
                  TAP TO FLIP
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#707080' }}>
                  Once identified, tap any card to see da other side.
                  Long-press to open full card details.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4 items-start">
              <div
                className="w-8 h-8 flex-shrink-0 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                style={{ borderColor: '#d4a84b', color: '#d4a84b' }}
              >
                4
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#d4a84b' }}>
                  BROWSE DA CATALOG
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#707080' }}>
                  Hit <span style={{ color: '#00d4ff' }}>CAT</span> in da top bar
                  to browse all cards. Filter by type, search by name.
                </p>
              </div>
            </div>
          </section>

          {/* Tips Section */}
          <section className="space-y-4">
            <h2 className="text-lg tracking-wider uppercase" style={{ color: '#d4a84b' }}>
              Tips, Ke?
            </h2>
            <ul className="space-y-2 text-xs" style={{ color: '#707080' }}>
              <li className="flex gap-2">
                <span style={{ color: '#d4a84b' }}>•</span>
                <span>Good lighting help da system see better</span>
              </li>
              <li className="flex gap-2">
                <span style={{ color: '#d4a84b' }}>•</span>
                <span>Keep cards flat and not overlapping</span>
              </li>
              <li className="flex gap-2">
                <span style={{ color: '#d4a84b' }}>•</span>
                <span>Scans saved in slots at bottom - up to 7</span>
              </li>
              <li className="flex gap-2">
                <span style={{ color: '#d4a84b' }}>•</span>
                <span>
                  <span style={{ color: '#00d4ff' }}>SYS</span> button got settings and diagnostics
                </span>
              </li>
            </ul>
          </section>

          {/* Alpha Notice */}
          <section className="p-4 border border-[#d4a84b]/30 rounded-lg bg-[#d4a84b]/5">
            <h3 className="text-sm font-semibold mb-2" style={{ color: '#d4a84b' }}>
              ALPHA BUILD
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: '#707080' }}>
              Dis still early, beratna. Some cards maybe na identify right.
              If you find bugs, use <span style={{ color: '#00d4ff' }}>SEND DIAGNOSTICS</span> in
              SYS panel to help us fix.
            </p>
          </section>
        </main>

        {/* Footer with Invite Code and CTA */}
        <footer className="sticky bottom-0 bg-[#0a0a0f]/95 backdrop-blur border-t border-[#d4a84b]/30 p-6 space-y-4">
          {/* Invite Code Section */}
          <div className="space-y-2">
            <label
              htmlFor="invite-code"
              className="block text-xs tracking-wider uppercase"
              style={{ color: '#707080' }}
            >
              {isRegistered ? 'REGISTERED' : 'ENTER INVITE CODE'}
            </label>
            <div className="flex gap-2">
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. ROSS2024"
                disabled={isRegistered || isRegistering}
                className="flex-1 px-4 py-3 text-sm tracking-wider uppercase bg-[#1a1a2f] border border-[#d4a84b]/30 rounded focus:outline-none focus:border-[#d4a84b] disabled:opacity-50"
                style={{ color: '#a0a0b0' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isRegistered) {
                    handleRegister();
                  }
                }}
              />
              {!isRegistered && (
                <button
                  onClick={handleRegister}
                  disabled={isRegistering || !inviteCode.trim()}
                  className="px-4 py-3 text-sm font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: '#d4a84b',
                    color: '#0a0a0f',
                  }}
                >
                  {isRegistering ? '...' : 'VERIFY'}
                </button>
              )}
            </div>
            {error && (
              <p className="text-xs" style={{ color: '#ff6b6b' }}>
                {error}
              </p>
            )}
            {isRegistered && (
              <p className="text-xs" style={{ color: '#4ade80' }}>
                ✓ Device registered, ready to scan
              </p>
            )}
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!isRegistered}
            className="w-full py-4 text-lg font-bold tracking-widest uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: isRegistered ? '#d4a84b' : '#3a3a4f',
              color: isRegistered ? '#0a0a0f' : '#707080',
            }}
          >
            {isRegistered ? "OKEY, LET'S GO" : 'ENTER CODE TO CONTINUE'}
          </button>
          <p className="text-center text-xs" style={{ color: '#707080' }}>
            Kowmang rise up, beratna! <span style={{ color: '#505060' }}>v{APP_VERSION}</span>
            <span style={{ color: '#404050' }}> • {BUILD_HASH}</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
