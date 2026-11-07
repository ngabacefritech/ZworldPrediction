"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LeagueGroup, MatchPrediction, PredictionsResponse } from "@/lib/types";

const STORAGE_KEY = "pronos-foot:predictions:v1";
const API_URL = "/api/predictions";

/* ------------------------------ Helpers ------------------------------ */

function relTime(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 45) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
}

/** Code couleur de confiance : vert >= 70 %, ambre >= 50 %, neutre sinon. */
function confClass(p: number | null): string {
  if (p == null) return "border-slate-600/40 bg-slate-700/30 text-slate-300";
  if (p >= 70) return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (p >= 50) return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  return "border-slate-500/40 bg-slate-600/20 text-slate-300";
}

function barClass(p: number | null): string {
  if (p == null) return "bg-slate-600";
  if (p >= 70) return "bg-emerald-400";
  if (p >= 50) return "bg-amber-400";
  return "bg-sky-400";
}

function tipInfo(m: MatchPrediction): { label: string; conf: number | null } {
  const t = (m.tip ?? "").trim().toUpperCase();
  if (!t) return { label: "Pronostic indisponible", conf: null };
  const { home, draw, away } = m.probs;
  const best = (...vals: Array<number | null>) => {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length > 0 ? Math.max(...nums) : null;
  };
  switch (t) {
    case "1":
      return { label: "1 · Victoire domicile", conf: home };
    case "X":
      return { label: "N · Match nul", conf: draw };
    case "2":
      return { label: "2 · Victoire extérieur", conf: away };
    case "1X":
      return { label: "1X · Double chance", conf: best(home, draw) };
    case "X2":
      return { label: "X2 · Double chance", conf: best(draw, away) };
    case "12":
      return { label: "12 · Domicile ou extérieur", conf: best(home, away) };
    default:
      if (t.includes("+") || /^[HXA]/.test(t)) {
        return { label: `${t} · Handicap / Over-Under`, conf: null };
      }
      return { label: t, conf: null };
  }
}

/* --------------------------- Petits composants --------------------------- */

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
          : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

function ProbBars({ m }: { m: MatchPrediction }) {
  const rows: Array<[string, number | null]> = [
    ["Domicile", m.probs.home],
    ["Nul", m.probs.draw],
    ["Extérieur", m.probs.away],
  ];
  return (
    <div className="mt-3 space-y-1.5">
      {rows.map(([label, p]) => (
        <div key={label} className="flex items-center gap-2 text-[11px]">
          <span className="w-16 shrink-0 text-slate-400">{label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barClass(p)}`}
              style={{ width: `${p ?? 0}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-slate-300">
            {p != null ? `${p}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function MatchCard({ m }: { m: MatchPrediction }) {
  const tip = tipInfo(m);
  return (
    <article className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20 transition hover:border-emerald-500/40 hover:bg-slate-900">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 font-mono font-semibold text-slate-200">
          <ClockIcon /> {m.time}
        </span>
        {m.date && <span className="capitalize text-slate-500">{formatDate(m.date)}</span>}
      </div>

      <div className="mt-3">
        <p className="truncate text-[15px] font-semibold text-slate-100" title={m.home}>
          {m.home}
        </p>
        <div className="my-1.5 flex items-center gap-2">
          <span className="h-px flex-1 bg-slate-800" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500">VS</span>
          <span className="h-px flex-1 bg-slate-800" />
        </div>
        <p className="truncate text-[15px] font-semibold text-slate-100" title={m.away}>
          {m.away}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-bold ${confClass(tip.conf)}`}
        >
          {tip.label}
          {tip.conf != null && <span className="font-mono text-[10px] opacity-80">{tip.conf}%</span>}
        </span>
        {m.secondary && (
          <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-[11px] font-semibold text-slate-300">
            Combi {m.secondary}
          </span>
        )}
        {m.exactScore && (
          <span className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold text-indigo-300">
            Score exact {m.exactScore}
          </span>
        )}
      </div>

      <ProbBars m={m} />

      {m.url && (
        <a
          href={m.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 text-[11px] font-medium text-emerald-400/80 transition hover:text-emerald-300"
        >
          Voir le détail sur la source ↗
        </a>
      )}
    </article>
  );
}

/* ------------------------------ Dashboard ------------------------------ */

export default function PredictionsDashboard() {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState("all");
  const [now, setNow] = useState(() => Date.now());

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      const json = (await res.json()) as PredictionsResponse;
      if (json.ok && json.leagues.length > 0) {
        setData(json);
        setError(null);
        setLastSync(new Date(json.scrapedAt).getTime());
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), data: json }));
        } catch {
          // stockage plein ou indisponible : on ignore
        }
      } else {
        setError(json.error ?? `Erreur serveur (HTTP ${res.status})`);
      }
    } catch {
      setError("Serveur injoignable — vérifiez votre connexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Hydratation instantanée depuis localStorage (peinture rapide + mode hors-ligne)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { data?: PredictionsResponse };
        if (parsed.data && parsed.data.leagues.length > 0) {
          setData(parsed.data);
          setLastSync(new Date(parsed.data.scrapedAt).getTime());
        }
      }
    } catch {
      // données locales illisibles : on ignore
    }

    const updateOnline = () => setOffline(!navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    const tick = window.setInterval(() => setNow(Date.now()), 30_000);

    if (navigator.onLine) {
      void loadData(false);
    } else {
      setLoading(false);
    }

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.clearInterval(tick);
    };
  }, [loadData]);

  const filtered = useMemo<LeagueGroup[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.leagues
      .filter((l) => league === "all" || l.id === league)
      .map((l) => ({
        ...l,
        matches: l.matches.filter((m) => {
          if (!q) return true;
          return (
            m.home.toLowerCase().includes(q) ||
            m.away.toLowerCase().includes(q) ||
            l.name.toLowerCase().includes(q) ||
            (m.tip ?? "").toLowerCase().includes(q)
          );
        }),
      }))
      .filter((l) => l.matches.length > 0);
  }, [data, query, league]);

  const totalMatches = useMemo(() => filtered.reduce((n, l) => n + l.matches.length, 0), [filtered]);

  const status = offline
    ? {
        label: "Mode hors-ligne",
        cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
        dot: "bg-amber-400",
      }
    : error
      ? {
          label: "Synchro échouée",
          cls: "border-red-500/40 bg-red-500/10 text-red-300",
          dot: "bg-red-400",
        }
      : {
          label: "En ligne",
          cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
          dot: "bg-emerald-400 animate-pulse",
        };

  const fallbackLabel =
    data?.fallback === "memory-cache"
      ? "cache serveur"
      : data?.fallback === "database"
        ? "snapshot BDD"
        : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* ------------------------------ Header ------------------------------ */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-lg ring-1 ring-emerald-500/40">
              ⚽
            </span>
            <div>
              <h1 className="text-base leading-tight font-bold">Pronos Foot</h1>
              <p className="text-[11px] text-slate-500">betwizad.com/predictions</p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.cls}`}
            >
              <span className={`size-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            <span className="text-[11px] text-slate-400">
              {lastSync ? `Dernière synchro ${relTime(lastSync, now)}` : "Jamais synchronisé"}
            </span>
            {fallbackLabel && (
              <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400">
                {fallbackLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-60"
            >
              {loading ? <Spinner /> : <span aria-hidden>↻</span>}
              Rafraîchir
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------ Bannières ------------------------------ */}
      <div className="mx-auto w-full max-w-6xl space-y-2 px-4 pt-4">
        {offline && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            <span aria-hidden>⚠️</span>
            <span>
              Mode hors-ligne — affichage des dernières données enregistrées
              {lastSync ? ` (synchro ${relTime(lastSync, now)})` : ""}.
            </span>
          </div>
        )}
        {!offline && error && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
            <span aria-hidden>⚠️</span>
            <span>
              {error}
              {data ? " — données historisées affichées." : ""}
            </span>
            <button
              type="button"
              onClick={() => void loadData(true)}
              className="ml-auto rounded-md border border-red-400/40 px-2 py-1 text-[11px] font-semibold hover:bg-red-500/20"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------ Filtres ------------------------------ */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une équipe, une ligue, un pronostic…"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pr-3 pl-9 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <p className="shrink-0 text-xs text-slate-500">
            <span className="font-semibold text-slate-300">{totalMatches}</span> match(s) ·{" "}
            <span className="font-semibold text-slate-300">{filtered.length}</span> championnat(s)
          </p>
        </div>

        {data && data.leagues.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            <Chip active={league === "all"} onClick={() => setLeague("all")}>
              Tous
            </Chip>
            {data.leagues.map((l) => (
              <Chip key={l.id} active={league === l.id} onClick={() => setLeague(l.id)}>
                {l.name}{" "}
                <span className="opacity-60">({l.matches.length})</span>
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------ Contenu ------------------------------ */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {loading && !data ? (
          <div className="space-y-8">
            <div className="skeleton h-6 w-48 rounded-lg" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-44 rounded-2xl border border-slate-800" />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
            <p className="text-4xl" aria-hidden>
              🔍
            </p>
            <p className="mt-3 font-semibold text-slate-200">Aucun match ne correspond</p>
            <p className="mt-1 text-sm text-slate-500">
              {data
                ? "Essayez un autre terme ou réinitialisez les filtres."
                : "Aucune donnée disponible pour le moment."}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setLeague("all");
                void loadData(true);
              }}
              className="mt-4 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
            >
              Réinitialiser / resynchroniser
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filtered.map((l) => (
              <section key={l.id}>
                <div className="mb-3 flex items-center gap-2.5">
                  {l.flag ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.flag} alt="" className="size-5 rounded-full object-cover ring-1 ring-slate-700" />
                  ) : (
                    <span className="size-2.5 rounded-full bg-emerald-500/70" />
                  )}
                  <h2 className="text-sm font-bold tracking-wide text-slate-200 uppercase">
                    {l.name}
                  </h2>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    {l.matches.length}
                  </span>
                  <span className="h-px flex-1 bg-slate-800/80" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {l.matches.map((m) => (
                    <MatchCard key={m.id} m={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* ------------------------------ Footer ------------------------------ */}
      <footer className="border-t border-slate-800/80 px-4 py-6 text-center text-[11px] leading-relaxed text-slate-500">
        Données agrégées depuis <span className="text-slate-400">betwizad.com/predictions</span> ·
        cache serveur 15 min · PWA avec mode hors-ligne
        <br />
        Jouez de manière responsable —{" "}
        <a
          href="https://www.begambleaware.org"
          target="_blank"
          rel="noreferrer noopener"
          className="text-emerald-400/80 underline hover:text-emerald-300"
        >
          BeGambleAware.org
        </a>
      </footer>
    </div>
  );
}
