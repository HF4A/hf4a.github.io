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

export type SpectralType = 'C' | 'D' | 'H' | 'M' | 'S' | 'V' | 'G' | 'K' | 'Y' | 'Any';

export type CardSide = 'white' | 'black' | 'purple' | 'blue' | 'yellow';

export type FuelType = 'Water' | 'Isotope' | 'Any';

export type ReactorType = 'X' | 'wave' | 'bomb'; // X = fission, ∿ = wave/fusion, 💣 = bomb/antimatter

export type ColonistType = 'Robot' | 'Human';

export type Specialty = 'Engineer' | 'Miner' | 'Prospector' | 'Scientist' | 'Pilot' | 'Commander';

export type Ideology = 'Green' | 'Yellow' | 'Blue' | 'Red' | 'Purple';

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
  | 'smelter'
  | 'fuel'
  | 'missile'
  | 'raygun';

// Support requirements for a card
export interface SupportRequirements {
  generatorPush?: boolean;      // ⟛ Generator (push generator)
  generatorElectric?: boolean;  // e Generator (electric generator)
  reactorFission?: boolean;     // X Reactor
  reactorFusion?: boolean;      // ∿ Reactor (wave/fusion)
  reactorAntimatter?: boolean;  // 💣 Reactor (bomb/antimatter)
  reactorAny?: boolean;         // Any Reactor
  solar?: boolean;              // Solar powered
}

// Base stats common to most cards
export interface CardStats {
  mass?: number;
  radHard?: number;
  // Thruster/propulsion stats
  thrust?: number;
  fuelConsumption?: string;     // e.g., "1/2", "1/3", "2"
  fuelType?: FuelType;
  afterburn?: number;           // Afterburn bonus
  bonusPivots?: number;         // Extra pivots
  push?: boolean;               // Can be used for push (solar sail style)
  // Reactor stats
  reactorType?: ReactorType;
  thrustModifier?: number;      // Modifier to thrust when used
  fuelConsumptionModifier?: string; // Modifier to fuel consumption
  // Radiator stats (dual-sided)
  therms?: number;              // Cooling capacity
  lightSideMass?: number;
  lightSideRadHard?: number;
  lightSideTherms?: number;
  heavySideMass?: number;
  heavySideRadHard?: number;
  heavySideTherms?: number;
  // Generator stats
  generatorType?: 'push' | 'electric'; // ⟛ or e
  // Freighter stats
  loadLimit?: number;
  factoryLoadingOnly?: boolean;
  // Colonist/Robonaut stats
  isru?: number;                // ISRU capability
  missile?: boolean;            // Has missile weapon
  raygun?: boolean;             // Has raygun weapon
  buggy?: boolean;              // Has buggy capability
  // Bernal stats
  powersat?: boolean;           // Powersat capability
  hasGenerator?: boolean;       // Has built-in generator
  // General
  airEater?: boolean;           // Can use atmosphere for thrust
  solar?: boolean;              // Solar powered
}

// Extended card data from spreadsheet
export interface SpreadsheetData {
  promotionColony?: string;     // Colony type for promotion
  future?: string;              // Future expansion indicator
  colonistType?: ColonistType;  // Robot or Human
  specialty?: Specialty;        // Engineer, Miner, etc.
  ideology?: Ideology;          // Green, Yellow, etc.
}

export interface CardOCR {
  name: string;
  cardId?: string;
  description?: string;
  stats?: CardStats;
  spectralType?: SpectralType | string | null;
  supportIcons?: string[];
  supportRequirements?: SupportRequirements;
  rawText?: string;
  type?: string;
  ability?: string;             // Card special ability text
  // Contract-specific
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
  spreadsheet?: SpreadsheetData;  // Data from spreadsheet
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
  Any: 'Any',
};

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  Water: 'Water',
  Isotope: 'Isotope',
  Any: 'Any',
};

export const REACTOR_TYPE_LABELS: Record<ReactorType, string> = {
  X: 'Fission (X)',
  wave: 'Fusion (∿)',
  bomb: 'Antimatter (💣)',
};

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  Engineer: 'Engineer',
  Miner: 'Miner',
  Prospector: 'Prospector',
  Scientist: 'Scientist',
  Pilot: 'Pilot',
  Commander: 'Commander',
};

export const IDEOLOGY_LABELS: Record<Ideology, string> = {
  Green: 'Green',
  Yellow: 'Yellow',
  Blue: 'Blue',
  Red: 'Red',
  Purple: 'Purple',
};
