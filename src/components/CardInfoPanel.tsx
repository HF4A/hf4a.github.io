/**
 * CardInfoPanel - Shared card metadata panel
 *
 * Used by both catalog CardDetailView and scan CardDetailModal.
 * Displays stats, abilities, related cards, and report issue link.
 *
 * No header/navigation - parent component handles that.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Card, CardStats } from '../types/card';
import { CARD_TYPE_LABELS, SPECTRAL_TYPE_LABELS, SPECIALTY_LABELS } from '../types/card';

// Stat display configuration
const STAT_LABELS: Record<string, string> = {
  mass: 'Mass',
  radHard: 'Rad-Hard',
  thrust: 'Thrust',
  fuelConsumption: 'Fuel',
  therms: 'Therms',
  isru: 'ISRU',
  loadLimit: 'Load Limit',
  afterburn: 'Afterburn',
  bonusPivots: 'Pivots',
};

const PRIMARY_STATS = ['mass', 'radHard', 'thrust', 'fuelConsumption', 'therms', 'isru', 'loadLimit'];
const BOOLEAN_STATS = ['push', 'solar', 'airEater', 'missile', 'raygun', 'buggy', 'powersat', 'hasGenerator', 'factoryLoadingOnly'];

const SUPPORT_LABELS: Record<string, string> = {
  generatorPush: '⟛ Gen',
  generatorElectric: 'e Gen',
  reactorFission: 'X Reactor',
  reactorFusion: '∿ Reactor',
  reactorAntimatter: '💣 Reactor',
  reactorAny: 'Any Reactor',
  solar: 'Solar',
};

function formatStatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined) return '—';
  return String(value);
}

export interface CardInfoPanelProps {
  card: Card;
  cards: Card[];
  /** Use showxating CSS variables for styling (scan mode) */
  useScanTheme?: boolean;
  /** Show links to related cards (only in catalog mode) */
  showCardLinks?: boolean;
}

export function CardInfoPanel({ card, cards, useScanTheme = false, showCardLinks = false }: CardInfoPanelProps) {
  const displayName = card.ocr?.name || card.name || 'Unknown Card';

  // Theme colors based on mode
  const theme = useScanTheme
    ? {
        gold: 'var(--showxating-gold)',
        goldDim: 'var(--showxating-gold-dim)',
        cyan: 'var(--showxating-cyan)',
        bg: '#1a1a2f',
        border: 'var(--showxating-gold-dim)',
        text: '#c0c0d0',
        muted: 'var(--showxating-gold-dim)',
      }
    : {
        gold: '#d4a84b',
        goldDim: '#a08040',
        cyan: '#00d4ff',
        bg: '#1a1a2f',
        border: '#d4a84b30',
        text: '#c0c0d0',
        muted: '#707080',
      };

  // Find related cards
  const relatedCards = useMemo(() => {
    if (!card.relatedCards) return undefined;
    return Object.values(card.relatedCards)
      .map((filename) => cards.find((c) => c.filename === filename))
      .filter((c): c is Card => c !== undefined);
  }, [card, cards]);

  return (
    <div className="space-y-6">
      {/* Type & Spectral Tags */}
      <div className="flex flex-wrap gap-2">
        <span
          className="px-3 py-1 text-xs tracking-wider uppercase border"
          style={{ backgroundColor: theme.gold, color: '#0a0a0f', borderColor: theme.gold }}
        >
          {CARD_TYPE_LABELS[card.type] || card.type}
        </span>
        {card.spreadsheet?.cardSubtype && (
          <span
            className="px-3 py-1 text-xs tracking-wider uppercase border"
            style={{ borderColor: `${theme.cyan}50`, color: theme.cyan }}
          >
            {card.spreadsheet.cardSubtype}
          </span>
        )}
        {card.ocr?.spectralType && (
          <span
            className="px-3 py-1 text-xs tracking-wider uppercase border"
            style={{ borderColor: theme.border, color: theme.goldDim }}
          >
            {(SPECTRAL_TYPE_LABELS as Record<string, string>)[card.ocr.spectralType] || card.ocr.spectralType}
          </span>
        )}
        {card.ocr?.cardId && (
          <span
            className="px-3 py-1 text-xs tracking-wider font-mono"
            style={{ color: theme.muted }}
          >
            {card.ocr.cardId}
          </span>
        )}
      </div>

      {/* Description */}
      {card.ocr?.description && (
        <Section title="Description" theme={theme}>
          <p style={{ color: theme.text }} className="leading-relaxed">
            {card.ocr.description}
          </p>
        </Section>
      )}

      {/* Primary Stats */}
      {card.ocr?.stats && (
        <Section title="Stats" theme={theme}>
          <div className="grid grid-cols-3 gap-2">
            {PRIMARY_STATS.map((key) => {
              const value = (card.ocr?.stats as CardStats)?.[key as keyof CardStats];
              if (value === undefined || value === null) return null;
              return (
                <div
                  key={key}
                  className="p-3 text-center border"
                  style={{ borderColor: theme.border, backgroundColor: theme.bg }}
                >
                  <div className="text-xs" style={{ color: theme.muted }}>
                    {STAT_LABELS[key] || key}
                  </div>
                  <div className="text-lg font-bold" style={{ color: theme.gold }}>
                    {formatStatValue(value)}
                  </div>
                </div>
              );
            })}
            {card.ocr?.stats?.afterburn !== undefined && card.ocr.stats.afterburn > 0 && (
              <div
                className="p-3 text-center border"
                style={{ borderColor: theme.border, backgroundColor: theme.bg }}
              >
                <div className="text-xs" style={{ color: theme.muted }}>
                  Afterburn
                </div>
                <div className="text-lg font-bold" style={{ color: '#ff8844' }}>
                  +{card.ocr.stats.afterburn}
                </div>
              </div>
            )}
            {card.ocr?.stats?.bonusPivots !== undefined && card.ocr.stats.bonusPivots > 0 && (
              <div
                className="p-3 text-center border"
                style={{ borderColor: theme.border, backgroundColor: theme.bg }}
              >
                <div className="text-xs" style={{ color: theme.muted }}>
                  Pivots
                </div>
                <div className="text-lg font-bold" style={{ color: theme.cyan }}>
                  +{card.ocr.stats.bonusPivots}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Radiator Dual-Side Stats */}
      {card.type === 'radiator' && card.ocr?.stats?.lightSideMass !== undefined && (
        <Section title="Radiator Sides" theme={theme}>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border" style={{ borderColor: theme.border, backgroundColor: theme.bg }}>
              <div className="text-xs mb-2 font-medium" style={{ color: theme.goldDim }}>Light Side</div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="text-xs" style={{ color: theme.muted }}>Mass</div>
                  <div style={{ color: theme.gold }}>{card.ocr.stats.lightSideMass}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: theme.muted }}>Rad</div>
                  <div style={{ color: theme.gold }}>{card.ocr.stats.lightSideRadHard}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: theme.muted }}>Therms</div>
                  <div style={{ color: theme.cyan }}>{card.ocr.stats.lightSideTherms}</div>
                </div>
              </div>
            </div>
            <div className="p-3 border" style={{ borderColor: theme.border, backgroundColor: theme.bg }}>
              <div className="text-xs mb-2 font-medium" style={{ color: theme.goldDim }}>Heavy Side</div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="text-xs" style={{ color: theme.muted }}>Mass</div>
                  <div style={{ color: theme.gold }}>{card.ocr.stats.heavySideMass}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: theme.muted }}>Rad</div>
                  <div style={{ color: theme.gold }}>{card.ocr.stats.heavySideRadHard}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: theme.muted }}>Therms</div>
                  <div style={{ color: '#ff8844' }}>{card.ocr.stats.heavySideTherms}</div>
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Boolean Capabilities */}
      {card.ocr?.stats && (
        (() => {
          const capabilities = BOOLEAN_STATS
            .filter((key) => (card.ocr?.stats as CardStats)?.[key as keyof CardStats] === true)
            .map((key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()));
          if (capabilities.length === 0) return null;
          return (
            <Section title="Capabilities" theme={theme}>
              <div className="flex flex-wrap gap-2">
                {capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="px-3 py-1 text-xs tracking-wider uppercase border"
                    style={{ borderColor: '#22c55e50', color: '#22c55e' }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </Section>
          );
        })()
      )}

      {/* Support Requirements */}
      {card.ocr?.supportRequirements && (
        (() => {
          const reqs = Object.entries(card.ocr.supportRequirements)
            .filter(([, value]) => value === true)
            .map(([key]) => SUPPORT_LABELS[key] || key);
          if (reqs.length === 0) return null;
          return (
            <Section title="Requires" theme={theme}>
              <div className="flex flex-wrap gap-2">
                {reqs.map((req) => (
                  <span
                    key={req}
                    className="px-3 py-1 text-xs tracking-wider uppercase border"
                    style={{ borderColor: '#eab30850', color: '#eab308' }}
                  >
                    {req}
                  </span>
                ))}
              </div>
            </Section>
          );
        })()
      )}

      {/* Ability */}
      {card.ocr?.ability && (
        <Section title="Ability" theme={theme}>
          <p
            className="leading-relaxed p-3 border"
            style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}
          >
            {card.ocr.ability}
          </p>
        </Section>
      )}

      {/* Colonist Info */}
      {(card.spreadsheet?.colonistType || card.spreadsheet?.specialty || card.spreadsheet?.ideology) && (
        <Section title="Colonist" theme={theme}>
          <div className="flex flex-wrap gap-2">
            {card.spreadsheet?.colonistType && (
              <span
                className="px-3 py-1 text-xs tracking-wider uppercase border"
                style={{
                  borderColor: card.spreadsheet.colonistType === 'Robot' ? `${theme.cyan}50` : '#f5920050',
                  color: card.spreadsheet.colonistType === 'Robot' ? theme.cyan : '#f59200',
                }}
              >
                {card.spreadsheet.colonistType}
              </span>
            )}
            {card.spreadsheet?.specialty && (
              <span
                className="px-3 py-1 text-xs tracking-wider uppercase border"
                style={{ borderColor: '#8b5cf650', color: '#8b5cf6' }}
              >
                {SPECIALTY_LABELS[card.spreadsheet.specialty as keyof typeof SPECIALTY_LABELS] || card.spreadsheet.specialty}
              </span>
            )}
            {card.spreadsheet?.ideology && (
              <span
                className="px-3 py-1 text-xs tracking-wider uppercase border"
                style={{ borderColor: `${theme.goldDim}50`, color: theme.goldDim }}
              >
                {card.spreadsheet.ideology}
              </span>
            )}
          </div>
        </Section>
      )}

      {/* Promotion */}
      {card.spreadsheet?.promotionColony && (
        <Section title="Promotion" theme={theme}>
          <span
            className="px-3 py-1 text-xs tracking-wider uppercase border"
            style={{ borderColor: '#3b82f650', color: '#3b82f6' }}
          >
            {card.spreadsheet.promotionColony}
          </span>
        </Section>
      )}

      {/* Generator Type */}
      {card.ocr?.stats?.generatorType && (
        <Section title="Generator Type" theme={theme}>
          <span
            className="px-3 py-1 text-xs tracking-wider uppercase border"
            style={{ borderColor: '#eab30850', color: '#eab308' }}
          >
            {card.ocr.stats.generatorType === 'push' ? '⟛ Push Generator' : 'e Electric Generator'}
          </span>
        </Section>
      )}

      {/* Reactor Type */}
      {card.ocr?.stats?.reactorType && (
        <Section title="Reactor Type" theme={theme}>
          <span
            className="px-3 py-1 text-xs tracking-wider uppercase border"
            style={{
              borderColor:
                card.ocr.stats.reactorType === 'X' ? '#f9731650' :
                card.ocr.stats.reactorType === 'wave' ? `${theme.cyan}50` :
                '#ef444450',
              color:
                card.ocr.stats.reactorType === 'X' ? '#f97316' :
                card.ocr.stats.reactorType === 'wave' ? theme.cyan :
                '#ef4444',
            }}
          >
            {card.ocr.stats.reactorType === 'X' ? 'X Fission' :
             card.ocr.stats.reactorType === 'wave' ? '∿ Fusion' :
             '💣 Antimatter'}
          </span>
        </Section>
      )}

      {/* Future */}
      {card.spreadsheet?.future && (
        <Section title="Future" theme={theme}>
          <p
            className="leading-relaxed p-3 border text-sm"
            style={{ borderColor: '#8b5cf630', backgroundColor: theme.bg, color: theme.goldDim }}
          >
            {card.spreadsheet.future}
          </p>
        </Section>
      )}

      {/* Related Cards */}
      {relatedCards && relatedCards.length > 0 && (
        <Section title="Related Cards" theme={theme}>
          <div className="flex flex-wrap gap-2">
            {relatedCards.map((related) => (
              showCardLinks ? (
                <Link
                  key={related.id}
                  to={`/catalog/card/${related.id}`}
                  className="px-3 py-1 text-xs tracking-wider uppercase border transition-colors hover:bg-[#d4a84b]/10"
                  style={{ borderColor: theme.border, color: theme.goldDim }}
                >
                  {related.ocr?.name || related.name || related.id}
                  {related.side && (
                    <span
                      className="ml-2 w-3 h-3 rounded-full inline-block"
                      style={{
                        backgroundColor:
                          related.side.toLowerCase() === 'white' ? '#fff' :
                          related.side.toLowerCase() === 'black' ? '#1a1a2f' :
                          '#4a4a5f',
                        border: `1px solid ${theme.border}`,
                      }}
                    />
                  )}
                </Link>
              ) : (
                <span
                  key={related.id}
                  className="px-3 py-1 text-xs tracking-wider uppercase border"
                  style={{ borderColor: theme.border, color: theme.goldDim }}
                >
                  {related.ocr?.name || related.name || related.id}
                  {related.side && ` (${related.side})`}
                </span>
              )
            ))}
          </div>
        </Section>
      )}

      {/* Report Issue */}
      <div className="pt-4 border-t" style={{ borderColor: theme.border }}>
        <a
          href={`https://docs.google.com/forms/d/e/1FAIpQLSfG1ylpJXQVvn2Q3yEQQzEgD6e1nX-Tsgf6WxNVmaow1p2_kw/viewform?usp=pp_url&entry.325757878=${encodeURIComponent(displayName)}&entry.93108582=${encodeURIComponent(window.location.href)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs tracking-wider uppercase transition-colors"
          style={{ color: theme.muted }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Report Issue
        </a>
      </div>
    </div>
  );
}

// Section helper component
interface SectionProps {
  title: string;
  theme: { goldDim: string };
  children: React.ReactNode;
}

function Section({ title, theme, children }: SectionProps) {
  return (
    <div>
      <h2
        className="text-xs tracking-wider uppercase mb-2"
        style={{ color: theme.goldDim }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
