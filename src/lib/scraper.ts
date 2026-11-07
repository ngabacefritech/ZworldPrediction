import * as cheerio from "cheerio";
import type { LeagueGroup, MatchPrediction, MatchProbabilities } from "./types";

export const SOURCE_URL = "https://betwizad.com/predictions";

const FETCH_TIMEOUT_MS = 20_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type Api = cheerio.CheerioAPI;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = cheerio.Cheerio<any>;

export type ScrapeResult =
  | { ok: true; leagues: LeagueGroup[]; scrapedAt: string }
  | { ok: false; error: string; scrapedAt: string };

/**
 * Récupère la page des prédictions et l'analyse.
 * Ne lève jamais d'exception : renvoie { ok: false, error } en cas de problème.
 */
export async function scrapePredictions(): Promise<ScrapeResult> {
  const scrapedAt = new Date().toISOString();

  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(SOURCE_URL, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
        },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return { ok: false, error: `La source a répondu HTTP ${res.status}`, scrapedAt };
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erreur réseau";
    return { ok: false, error: `Source inaccessible (${msg})`, scrapedAt };
  }

  try {
    const leagues = parsePredictionsHtml(html);
    const count = leagues.reduce((n, l) => n + l.matches.length, 0);
    if (count === 0) {
      return {
        ok: false,
        error: "Aucun match reconnu — la structure du site source a peut-être changé",
        scrapedAt,
      };
    }
    return { ok: true, leagues, scrapedAt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erreur inconnue";
    return { ok: false, error: `Erreur d'analyse HTML : ${msg}`, scrapedAt };
  }
}

/** "paris-saint-germain" -> "Paris Saint Germain", "as-roma" -> "AS Roma" */
function slugToName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

interface MatchUrlInfo {
  leagueSlug: string;
  countrySlug: string;
  date: string;
  teamsSlug: string;
  id: string;
  url: string;
}

function parseMatchUrl(onclick: string | undefined): MatchUrlInfo | null {
  if (!onclick) return null;
  const m = onclick.match(
    /match-details\/([^/'"]+)\/([^/'"]+)\/(\d{4}-\d{2}-\d{2})\/([^/'"]+)\/(\d+)/
  );
  if (!m) return null;
  const [, leagueSlug, countrySlug, date, teamsSlug, id] = m;
  return {
    leagueSlug,
    countrySlug,
    date,
    teamsSlug,
    id,
    url: `https://betwizad.com/match-details/${leagueSlug}/${countrySlug}/${date}/${teamsSlug}/${id}`,
  };
}

/** Texte d'un élément en ignorant le contenu des <style>/<script>/<svg> embarqués. */
function cleanText($: Api, $el: El): string {
  const $c = $el.clone();
  $c.find("style,script,svg").remove();
  return $c.text().replace(/\s+/g, " ").trim();
}

function extractProbs($: Api, $scope: El): MatchProbabilities {
  const probs: number[] = [];
  $scope.find("svg text").each((_, el) => {
    const pm = $(el).text().replace(",", ".").match(/(\d+(?:\.\d+)?)\s*%/);
    if (pm) probs.push(parseFloat(pm[1]));
  });
  return {
    home: probs[0] ?? null,
    draw: probs[1] ?? null,
    away: probs[2] ?? null,
  };
}

function parseMatchRow($: Api, $tr: El, $cells: El): MatchPrediction | null {
  const time = $cells.eq(0).text().trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(time)) return null;

  const $teamsCell = $cells.eq(1);
  const info =
    parseMatchUrl($teamsCell.find("div[onclick]").first().attr("onclick")) ??
    parseMatchUrl($tr.find('div[onclick*="match-details"]').first().attr("onclick"));

  let home = "";
  let away = "";
  if (info) {
    const vs = info.teamsSlug.match(/^(.+)-vs-(.+)$/);
    if (vs) {
      home = slugToName(vs[1]);
      away = slugToName(vs[2]);
    }
  }
  if (!home || !away) {
    const names = $teamsCell
      .find(".col-lg-5")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((_, el: any) => $(el).text().trim().replace(/\.{3}$/, "").trim())
      .get();
    if (names.length >= 2) {
      home = names[0];
      away = names[names.length - 1];
    } else {
      const parts = $teamsCell.text().split(/\s+-:-+\s+|\s+vs\.?\s+/i);
      if (parts.length >= 2) {
        home = parts[0].replace(/\.{3}$/, "").trim();
        away = parts[parts.length - 1].replace(/\.{3}$/, "").trim();
      }
    }
  }
  if (!home || !away) return null;

  const $tipEl = $tr.find('td[class*="highlight"]').first();
  let tip = $tipEl.length > 0 ? cleanText($, $tipEl) : "";
  if (!tip && $cells.length > 5) tip = cleanText($, $cells.eq(5));
  const secondary = ($cells.length > 6 ? cleanText($, $cells.eq(6)) : "") || null;
  const rawScore = ($cells.length > 7 ? cleanText($, $cells.eq(7)) : "") || null;
  const exactScore = rawScore && /^\d+\s*-\s*\d+$/.test(rawScore) ? rawScore.replace(/\s+/g, "") : null;

  return {
    id: info?.id ?? `${home}-${away}-${time}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    time,
    date: info?.date ?? null,
    home,
    away,
    url: info?.url ?? null,
    tip,
    secondary,
    exactScore,
    probs: extractProbs($, $tr),
  };
}

/** Filet de sécurité si la structure en <tr> disparaît : on part des liens match-details. */
function parseFromLink($: Api, $el: El): MatchPrediction | null {
  const info = parseMatchUrl($el.attr("onclick"));
  if (!info) return null;
  const $scope = ($el.closest("tr").length ? $el.closest("tr") : $el.parent()) as El;
  const tm = $scope.text().match(/\b(\d{1,2}:\d{2})\b/);
  const vs = info.teamsSlug.match(/^(.+)-vs-(.+)$/);
  if (!vs) return null;
  return {
    id: info.id,
    time: tm ? tm[1] : "--:--",
    date: info.date,
    home: slugToName(vs[1]),
    away: slugToName(vs[2]),
    url: info.url,
    tip: null,
    secondary: null,
    exactScore: null,
    probs: extractProbs($, $scope),
  };
}

export function parsePredictionsHtml(html: string): LeagueGroup[] {
  const $ = cheerio.load(html);
  const leagues: LeagueGroup[] = [];
  let current: LeagueGroup | null = null;

  const newLeague = (name: string, flag: string | null): LeagueGroup => {
    const id =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `ligue-${leagues.length + 1}`;
    current = { id, name, country: name.split(/\s+/)[0] ?? null, flag, matches: [] };
    leagues.push(current);
    return current;
  };

  $("tr").each((_, tr) => {
    const $tr = $(tr) as El;
    const $cells = $tr.children("td") as El;
    if ($cells.length === 0) return;

    // Ligne d'en-tête de championnat : td.league_head avec du texte visible
    const $head = $cells
      .filter(".league_head")
      .filter((_, el) => cleanText($, $(el)).length > 2)
      .first();
    if ($head.length > 0) {
      const flag = $tr.find("td.league_head img").first().attr("src") ?? null;
      newLeague(cleanText($, $head), flag);
      return;
    }

    const match = parseMatchRow($, $tr, $cells);
    if (match) {
      if (!current) newLeague("Autres matchs", null);
      current?.matches.push(match);
    }
  });

  const total = leagues.reduce((n, l) => n + l.matches.length, 0);
  if (total === 0) {
    const fallback = newLeague("Matchs du jour", null);
    const seen = new Set<string>();
    $('div[onclick*="match-details"]').each((_, el) => {
      const m = parseFromLink($, $(el) as El);
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        fallback.matches.push(m);
      }
    });
  }

  return leagues.filter((l) => l.matches.length > 0);
}
