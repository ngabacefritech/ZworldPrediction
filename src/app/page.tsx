"use client";

import { useState, useEffect, useMemo } from "react";
import { PredictionsResponse, MatchPrediction, LeagueGroup } from "@/lib/types";
import { DailyCombo } from "@/components/daily-combo";

// Helper de calcul de probabilité max du match
function getMatchProbability(match: MatchPrediction): number {
  const { home, draw, away } = match.probs;
  const values = [home, draw, away].filter((v): v is number => v !== null);
  if (values.length === 0) return 50;
  return Math.max(...values);
}

// Helper pour déterminer la catégorie de risque
function getSafetyCategory(probability: number) {
  if (probability >= 80) {
    return { label: "🔥 Ultra Safe", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", filterKey: "ultrasafe" };
  }
  if (probability >= 65) {
    return { label: "🛡️ Safe", color: "bg-blue-500/20 text-blue-400 border-blue-500/40", filterKey: "safe" };
  }
  return { label: "⚡ Moins Safe", color: "bg-amber-500/20 text-amber-400 border-amber-500/40", filterKey: "moins-safe" };
}

export default function Home() {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Récupération des données (avec rafraîchissement automatique toutes les 30s)
  useEffect(() => {
    async function fetchPredictions() {
      try {
        const res = await fetch("/api/predictions");
        const json = await res.json();
        if (json.ok) {
          setData(json);
        } else {
          setError(json.error || "Erreur lors de la récupération des données.");
        }
      } catch (err) {
        console.error(err);
        setError("Impossible de joindre le serveur de prédictions.");
      } finally {
        setLoading(false);
      }
    }

    fetchPredictions();
    const interval = setInterval(fetchPredictions, 30000); // Polling 30s (Live check)
    return () => clearInterval(interval);
  }, []);

  // Filtrage intelligent des matchs selon l'onglet actif
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

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-medium">Chargement des pronostics et analyses en direct...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-2xl max-w-md text-center">
          <h2 className="text-lg font-bold mb-2">Oups, une erreur est survenue</h2>
          <p className="text-sm text-slate-300">{error || "Données indisponibles."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* En-tête de l'application */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Zworld Prediction PWA
            </h1>
            <p className="text-xs text-slate-400">Analyses statistiques, Safe Picks & Scores en Direct</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full text-slate-300">
              ⚡ Synchro : {new Date(data.scrapedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-8">
        {/* Composant de la Combinaison du Jour */}
        <DailyCombo leagues={data.leagues} />

        {/* Barre de Filtres par Risque */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {[
            { id: "all", label: "Tous les Matchs" },
            { id: "ultrasafe", label: "🔥 Ultra Safe (≥80%)" },
            { id: "safe", label: "🛡️ Safe (65-79%)" },
            { id: "moins-safe", label: "⚡ Moins Safe (<65%)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                activeFilter === tab.id
                  ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Liste des Ligues et Matchs */}
        {filteredLeagues.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400">Aucun match ne correspond à ce filtre pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredLeagues.map((league) => (
              <div key={league.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl">
                {/* En-tête de ligue */}
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-800/80">
                  {league.flag ? (
                    <span className="text-xl">{league.flag}</span>
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  )}
                  <div>
                    <h2 className="text-base font-bold text-white">{league.name}</h2>
                    {league.country && <p className="text-xs text-slate-400">{league.country}</p>}
                  </div>
                </div>

                {/* Grille des matchs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {league.matches.map((match, idx) => {
                    const prob = getMatchProbability(match);
                    const category = getSafetyCategory(prob);
                    const isLive = false; // Mettre à true si le match est en cours de diffusion

                    return (
                      <div
                        key={match.id || idx}
                        className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition rounded-xl p-4 flex flex-col justify-between"
                      >
                        {/* Ligne haute : Heure & Catégorie */}
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            🕒 {match.time}
                          </span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${category.color}`}>
                            {category.label} ({prob}%)
                          </span>
                        </div>

                        {/* Équipes et scores en direct éventuels */}
                        <div className="my-2 space-y-1.5">
                          <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                            <span>{match.home}</span>
                            {isLive && <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-white">0</span>}
                          </div>
                          <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                            <span>{match.away}</span>
                            {isLive && <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-white">0</span>}
                          </div>
                        </div>

                        {/* Si le match est en direct, afficher le badge animé */}
                        {isLive && (
                          <div className="my-2">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              EN DIRECT
                            </span>
                          </div>
                        )}

                        {/* Ligne basse : Pronostic & Score exact */}
                        <div className="mt-3 pt-3 border-t border-slate-900 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Prono :</span>
                            <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-900/40 font-mono">
                              {match.tip || "N/A"}
                            </span>
                          </div>
                          {match.exactScore && (
                            <div className="text-slate-400">
                              Score : <span className="font-mono font-bold text-white">{match.exactScore}</span>
                            </div>
                          )}
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
    </main>
  );
}