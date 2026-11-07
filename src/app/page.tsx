"use client";

import { useState, useEffect, useMemo } from "react";
import { PredictionsResponse, MatchPrediction } from "@/lib/types";
import { DailyCombo } from "@/components/daily-combo";
import { BetSimulator } from "@/components/bet-simulator";
import { MatchAiModal } from "@/components/match-ai-modal";

interface BetItem {
  match: MatchPrediction;
  selectedTip: string;
}

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

export default function Home() {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const [selectedBets, setSelectedBets] = useState<BetItem[]>([]);
  const [selectedMatchForAi, setSelectedMatchForAi] = useState<MatchPrediction | null>(null);

  useEffect(() => {
    async function fetchPredictions() {
      try {
        const res = await fetch("/api/predictions");
        const json = await res.json();
        if (json.ok) {
          setData(json);
        } else {
          setError(json.error || "Erreur de chargement.");
        }
      } catch (err) {
        console.error(err);
        setError("Impossible de joindre le serveur.");
      } finally {
        setLoading(false);
      }
    }

    fetchPredictions();
    const interval = setInterval(fetchPredictions, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredLeagues = useMemo(() => {
    if (!data) return [];
    if (activeFilter === "all") return data.leagues;

    return data.leagues
      .map((league) => ({
        ...league,
        matches: league.matches.filter((match) => {
          const prob = getMatchProbability(match);
          if (activeFilter === "ultrasafe") return prob >= 80;
          if (activeFilter === "safe") return prob >= 65 && prob < 80;
          if (activeFilter === "moins-safe") return prob < 65;
          return true;
        }),
      }))
      .filter((league) => league.matches.length > 0);
  }, [data, activeFilter]);

  const handleToggleBet = (match: MatchPrediction) => {
    const tip = match.tip || "1X2";
    setSelectedBets((prev) => {
      const exists = prev.some((item) => item.match.id === match.id);
      if (exists) {
        return prev.filter((item) => item.match.id !== match.id);
      } else {
        return [...prev, { match, selectedTip: tip }];
      }
    });
  };

  const handleRemoveBet = (matchId: string) => {
    setSelectedBets((prev) => prev.filter((item) => item.match.id !== matchId));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-slate-400 font-medium">Chargement des pronostics...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-5 rounded-2xl max-w-xs text-center text-xs">
          <h2 className="font-bold mb-1">Erreur</h2>
          <p className="text-slate-300">{error || "Données indisponibles."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-32">
      {/* En-tête mobile compact */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-3 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Zworld PWA
            </h1>
            <p className="text-[10px] text-slate-400">Safe Picks & Live Scores</p>
          </div>
          <span className="text-[10px] bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full text-slate-300 font-mono">
            ⚡ {new Date(data.scrapedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-3 mt-4">
        {/* Combiné du jour */}
        <DailyCombo leagues={data.leagues} />

        {/* Filtres par risque (Scroll horizontal tactile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none -mx-3 px-3">
          {[
            { id: "all", label: "Tous" },
            { id: "ultrasafe", label: "🔥 Ultra Safe" },
            { id: "safe", label: "🛡️ Safe" },
            { id: "moins-safe", label: "⚡ Moins Safe" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap border ${
                activeFilter === tab.id
                  ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Liste des ligues et matchs */}
        {filteredLeagues.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
            Aucun match ne correspond à ce filtre.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLeagues.map((league) => (
              <div key={league.id} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 shadow-lg">
                {/* Entête de ligue */}
                <div className="flex items-center gap-2.5 pb-2.5 mb-3 border-b border-slate-800/80">
                  {league.flag ? (
                    <img src={league.flag} alt="" className="w-5 h-5 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  )}
                  <div>
                    <h2 className="text-xs font-bold text-white leading-tight">{league.name}</h2>
                    {league.country && <p className="text-[10px] text-slate-400">{league.country}</p>}
                  </div>
                </div>

                {/* Grille verticale mobile d'une seule colonne */}
                <div className="space-y-3">
                  {league.matches.map((match, idx) => {
                    const prob = getMatchProbability(match);
                    const category = getSafetyCategory(prob);
                    const isSelected = selectedBets.some((b) => b.match.id === match.id);

                    return (
                      <div
                        key={match.id || idx}
                        className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-between"
                      >
                        <div>
                          {/* Ligne haute */}
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              🕒 {match.time}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${category.color}`}>
                              {category.label} ({prob}%)
                            </span>
                          </div>

                          {/* Équipes */}
                          <div className="my-2 space-y-1">
                            <div className="text-xs font-bold text-slate-100">{match.home}</div>
                            <div className="text-xs font-bold text-slate-100">{match.away}</div>
                          </div>
                        </div>

                        {/* Prono & Score */}
                        <div className="mt-2.5 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Prono:</span>
                            <span className="font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/40 font-mono">
                              {match.tip || "N/A"}
                            </span>
                          </div>
                          {match.exactScore && (
                            <div className="text-slate-400">
                              Score: <span className="font-mono font-bold text-white">{match.exactScore}</span>
                            </div>
                          )}
                        </div>

                        {/* Boutons d'action tactiles */}
                        <div className="mt-3 pt-2 border-t border-slate-900/60 flex items-center gap-2">
                          <button
                            onClick={() => setSelectedMatchForAi(match)}
                            className="flex-1 bg-indigo-950/50 border border-indigo-500/30 text-indigo-300 text-[11px] py-1.5 px-2 rounded-lg font-medium active:scale-95 transition flex items-center justify-center gap-1"
                          >
                            🤖 IA
                          </button>
                          <button
                            onClick={() => handleToggleBet(match)}
                            className={`flex-1 text-[11px] py-1.5 px-2 rounded-lg font-bold transition border active:scale-95 ${
                              isSelected
                                ? "bg-red-500/20 text-red-400 border-red-500/40"
                                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            }`}
                          >
                            {isSelected ? "Retirer" : "+ Combiné"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composants Flottants */}
      <BetSimulator
        selectedBets={selectedBets}
        onRemoveBet={handleRemoveBet}
        onClear={() => setSelectedBets([])}
      />

      <MatchAiModal
        match={selectedMatchForAi}
        onClose={() => setSelectedMatchForAi(null)}
      />
    </main>
  );
}