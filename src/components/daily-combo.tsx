import { LeagueGroup, MatchPrediction } from "@/lib/types";

function getMatchProbability(match: MatchPrediction): number {
  const { home, draw, away } = match.probs;
  const values = [home, draw, away].filter((v): v is number => v !== null);
  if (values.length === 0) return 50;
  return Math.max(...values);
}

function getSafetyCategory(probability: number) {
  if (probability >= 80) {
    return { label: "🔥 Ultra Safe", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" };
  }
  if (probability >= 65) {
    return { label: "🛡️ Safe", color: "bg-blue-500/20 text-blue-400 border-blue-500/40" };
  }
  return { label: "⚡ Moins Safe", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" };
}

interface DailyComboProps {
  leagues: LeagueGroup[];
}

export function DailyCombo({ leagues }: DailyComboProps) {
  // Extraction de tous les matchs
  const allMatches: { match: MatchPrediction; prob: number; leagueName: string }[] = [];

  leagues.forEach((league) => {
    league.matches.forEach((match) => {
      const prob = getMatchProbability(match);
      allMatches.push({ match, prob, leagueName: league.name });
    });
  });

  // Sélection des 5 meilleurs matchs avec probabilité >= 65%
  const bestSelections = allMatches
    .filter((item) => item.prob >= 65)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5);

  if (bestSelections.length === 0) return null;

  const totalComboProbability = Math.round(
    bestSelections.reduce((acc, curr) => acc * (curr.prob / 100), 1) * 100
  );

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-6 mb-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            🎯 Le Combiné du Jour
          </h2>
          <p className="text-sm text-slate-400">
            Sélection automatique des meilleures opportunités du jour
          </p>
        </div>
        <div className="bg-emerald-950/60 border border-emerald-500/40 px-4 py-2 rounded-xl text-right">
          <span className="text-xs text-emerald-400 block font-medium">Confiance Globale Estimée</span>
          <span className="text-xl font-black text-emerald-300">{totalComboProbability}%</span>
        </div>
      </div>

      <div className="space-y-3">
        {bestSelections.map(({ match, prob, leagueName }, idx) => {
          const category = getSafetyCategory(prob);
          return (
            <div
              key={match.id || idx}
              className="flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/70 transition p-3.5 rounded-xl border border-slate-700/50"
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${category.color}`}>
                  {category.label}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">
                    {match.home} <span className="text-slate-500 font-normal">vs</span> {match.away}
                  </p>
                  <p className="text-xs text-slate-400">{leagueName} • {match.time}</p>
                </div>
              </div>

              <div className="text-right flex items-center gap-3">
                {match.tip && (
                  <span className="text-xs bg-slate-700/80 text-emerald-400 px-2.5 py-1 rounded-md font-mono font-bold border border-slate-600">
                    {match.tip}
                  </span>
                )}
                <span className="text-sm font-black text-white">{prob}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}