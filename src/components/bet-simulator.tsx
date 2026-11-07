"use client";

import { useState } from "react";
import { MatchPrediction } from "@/lib/types";

interface BetItem {
  match: MatchPrediction;
  selectedTip: string;
}

interface BetSimulatorProps {
  selectedBets: BetItem[];
  onRemoveBet: (matchId: string) => void;
  onClear: () => void;
}

export function BetSimulator({ selectedBets, onRemoveBet, onClear }: BetSimulatorProps) {
  const [stake, setStake] = useState<number>(10);

  if (selectedBets.length === 0) return null;

  const calculateEstimatedOdds = (prob: number) => {
    if (prob >= 80) return 1.25;
    if (prob >= 65) return 1.55;
    if (prob >= 50) return 1.95;
    return 2.50;
  };

  const totalOdds = selectedBets.reduce((acc, item) => {
    const prob = Math.max(item.match.probs.home || 50, item.match.probs.away || 50, item.match.probs.draw || 33);
    return acc * calculateEstimatedOdds(prob);
  }, 1).toFixed(2);

  const potentialWin = (stake * parseFloat(totalOdds)).toFixed(2);

  return (
    <div className="fixed bottom-4 right-4 z-40 w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-2xl shadow-2xl p-5 text-white backdrop-blur-lg">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
        <h3 className="font-bold text-base flex items-center gap-2">
          🎟️ Mon Coupon / Simulateur ({selectedBets.length})
        </h3>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-red-400 transition">
          Tout effacer
        </button>
      </div>

      <div className="max-h-40 overflow-y-auto space-y-2 mb-4 scrollbar-thin">
        {selectedBets.map((item, idx) => (
          <div key={item.match.id || idx} className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs">
            <div>
              <p className="font-semibold">{item.match.home} vs {item.match.away}</p>
              <p className="text-emerald-400">Prono : {item.selectedTip}</p>
            </div>
            <button onClick={() => onRemoveBet(item.match.id)} className="text-slate-500 hover:text-red-400 p-1">
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Cote Globale Estimée :</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">{totalOdds}</span>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Votre Mise :</label>
          <input
            type="number"
            min="1"
            value={stake}
            onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
            className="w-24 bg-slate-900 border border-slate-700 text-right px-2 py-1 rounded font-mono text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-sm font-bold">
          <span className="text-slate-300">Gain Potentiel :</span>
          <span className="text-emerald-300 font-mono text-base">{potentialWin}</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-3 text-center">
        💡 Conseil Bankroll : Ne misez jamais plus de 2 à 5% de votre capital total sur un seul combiné.
      </p>
    </div>
  );
}