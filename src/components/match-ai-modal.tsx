"use client";

import { MatchPrediction } from "@/lib/types";

interface MatchAiModalProps {
  match: MatchPrediction | null;
  onClose: () => void;
}

export function MatchAiModal({ match, onClose }: MatchAiModalProps) {
  if (!match) return null;

  const prob = Math.max(match.probs.home || 50, match.probs.away || 50);
  const isSafe = prob >= 75;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold">
          ✕
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs px-2.5 py-1 rounded-full font-bold">
            🤖 Analyse IA Zworld
          </span>
          <span className="text-xs text-slate-400">🕒 {match.time}</span>
        </div>

        <h3 className="text-lg font-black text-white mb-2">
          {match.home} vs {match.away}
        </h3>

        <div className="space-y-4 my-4 text-sm text-slate-300">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <p className="font-semibold text-emerald-400 mb-1">🎯 Pronostic Recommandé : {match.tip || "1X2"}</p>
            <p className="text-xs text-slate-400">Indice de confiance estimé à {prob}%. {isSafe ? "Les indicateurs statistiques majeurs soutiennent fortement cette option." : "Option à risque modéré nécessitant prudence."}</p>
          </div>

          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">Facteurs Clés de l&apos;Analyse :</h4>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
              <li>Analyse de la dynamique offensive à domicile sur les 5 derniers matchs.</li>
              <li>Confrontations directes (H2H) favorables aux tendances statistiques actuelles.</li>
              <li>Gestion des absents et forme physique globale des titulaires.</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button onClick={onClose} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs transition">
            Fermer l&apos;analyse
          </button>
        </div>
      </div>
    </div>
  );
}