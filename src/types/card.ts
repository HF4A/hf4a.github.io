export type CardType =
  | 'thruster'
  | 'reactor'
  | 'generator'
  | 'radiator'
  | 'robonaut'
  | 'refinery'
  | 'colonist'
  | 'bernal'
  | 'freighter'
  | 'gw-thruster'
  | 'crew'
  | 'contract'
  | 'spaceborn'
  | 'exodus'
  | 'unknown';

export type SpectralType = 'C' | 'D' | 'H' | 'M' | 'S' | 'V' | 'G' | 'K' | 'Y';

export type CardSide = 'white' | 'black' | 'purple' | 'blue' | 'yellow';

export type SupportIcon =
  | 'reactor'
  | 'generator'
  | 'radiator'
  | 'crew'
  | 'robonaut'
  | 'refinery'
  | 'gear'
  | 'snowflake'
  | 'buggy'
  | 'smelter';

export interface CardStats {
  mass?: number;
  radHard?: number;
  thrust?: number;
  isru?: number;
  powerOutput?: string;
  efficiency?: string;
  loadLimit?: number;
}

export interface CardOCR {
  name: string;
  cardId?: string;
  description?: string;
  stats?: CardStats;
  spectralType?: SpectralType | string | null;
  supportIcons?: string[];
  rawText?: string;
  type?: string;
  contractType?: string;
  victoryPoints?: number;
  destination?: string;
  fulfilledAbility?: string;
  flavorText?: string;
}

export interface Card {
  id: string;
  type: CardType;
  typeRaw?: string;
  number?: string;
  side?: CardSide | string;
  sideRaw?: string;
  name: string;
  nameRaw?: string;
  filename: string;
  relativePath?: string;
  directory?: string;
  size?: number;
  checksum?: string;
  ocr?: CardOCR;
  cardGroupId?: string;
  upgradeChain?: CardSide[];
  relatedCards?: Record<string, string>;
}

export interface FilterState {
  cardTypes: CardType[];
  spectralTypes: SpectralType[];
  sides: CardSide[];
  massRange: { min: number; max: number } | null;
  radHardRange: { min: number; max: number } | null;
  isruRange: { min: number; max: number } | null;
  searchQuery: string;
  showUpgradedSide: boolean;
}

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  thruster: 'Thruster',
  reactor: 'Reactor',
  generator: 'Generator',
  radiator: 'Radiator',
  robonaut: 'Robonaut',
  refinery: 'Refinery',
  colonist: 'Colonist',
  bernal: 'Bernal',
  freighter: 'Freighter',
  'gw-thruster': 'GW Thruster',
  crew: 'Crew',
  contract: 'Contract',
  spaceborn: 'Spaceborn',
  exodus: 'Exodus',
  unknown: 'Unknown',
};

export const SPECTRAL_TYPE_LABELS: Record<SpectralType, string> = {
  C: 'C - Carbonaceous',
  D: 'D - Dark',
  H: 'H - Hydrous',
  M: 'M - Metallic',
  S: 'S - Siliceous',
  V: 'V - Volcanic',
  G: 'G',
  K: 'K',
  Y: 'Y',
};
