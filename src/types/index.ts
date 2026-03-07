export interface Asset {
  name: string;
  issuer: string;
  type: string;
  category: "stablecoin" | "lst" | "lrt" | "btc";
  backing: string;
  backingShort: string;
  riskTier: string;
  yield: string;
  yieldSource: string | null;
  curatorUsage: string;
  status: string;
  keyFact: string;
  marketCap: string;
  peg: string;
  collapsed: boolean;
  hasYield: boolean;
  isWrapper: boolean;
  regulation: string;
  tags: string[];
  // Optional fields for LSTs/LRTs/BTC
  riskLayers?: number;
  withdrawalTime?: string;
  restakingProtocol?: string | null;
  depegHistory?: string;
  depegDate?: string;
  depegSeverity?: string;
  exposedCurators?: string[];
  collapseDate?: string;
  collapseDetails?: string;
}

export interface Curator {
  name: string;
  type: string;
  tvl: string;
  venues: string[];
  keyVaults: string[];
  feeModel: string;
  collateralPreference: string;
  streamExposure: string;
  keyFact: string;
  tags: string[];
}

export interface ExtraQuestion {
  type: string;
  text: string;
  correct: string;
  wrongs: string[];
  explanation: string;
  coin: string;
}

export interface QuizQuestion {
  type: string;
  text: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  coin: string;
}

export interface QuizSettings {
  count: number;
  focus: "balanced" | "weakest";
  categories: string;
  collapsed: boolean;
  curators: boolean;
}

export interface RoundResult {
  score: number;
  total: number;
  category: string;
  answers: AnswerResult[];
  timestamp: number;
}

export interface AnswerResult {
  questionText: string;
  coin: string;
  correct: boolean;
  skipped: boolean;
}

export interface UserProfile {
  id: string;
  wallet_address: string;
  ens_name: string | null;
  created_at: string;
}
