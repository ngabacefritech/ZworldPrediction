export interface MatchProbabilities {
  home: number | null;
  draw: number | null;
  away: number | null;
}

export interface MatchPrediction {
  id: string;
  /** Heure affichée, ex: "21:05" */
  time: string;
  /** Date ISO "YYYY-MM-DD" extraite de l'URL de détail, si disponible */
  date: string | null;
  home: string;
  away: string;
  /** Lien vers la page de détail sur la source */
  url: string | null;
  /** Pronostic principal affiché (1X2, handicap, over/under…), ex: "1", "X2", "+1.5" */
  tip: string | null;
  /** Pronostic secondaire (combiné), ex: "1/1" */
  secondary: string | null;
  /** Score exact proposé, ex: "3-0" */
  exactScore: string | null;
  /** Probabilités 1X2 affichées en % (ordre: domicile, nul, extérieur) */
  probs: MatchProbabilities;
}

export interface LeagueGroup {
  id: string;
  name: string;
  country: string | null;
  flag: string | null;
  matches: MatchPrediction[];
}

export type FallbackMode = "fresh" | "memory-cache" | "database" | "none";

export interface PredictionsResponse {
  ok: boolean;
  source: string;
  /** Date du dernier scraping réussi */
  scrapedAt: string;
  /** Date à laquelle la réponse est servie */
  servedAt: string;
  stats: { leagues: number; matches: number };
  cache: { hit: boolean; ttlSeconds: number; ageSeconds: number };
  fallback: FallbackMode;
  error: string | null;
  leagues: LeagueGroup[];
}
