import { desc, lt } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { predictionSnapshots } from "@/db/schema";
import { scrapePredictions, SOURCE_URL } from "@/lib/scraper";
import type { PredictionsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Cache temporaire en mémoire : 15 min pour ne pas surcharger la source. */
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_TTL_SECONDS = CACHE_TTL_MS / 1000;
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
};

interface CacheEntry {
  payload: PredictionsResponse;
  at: number;
}

function getStore(): { entry: CacheEntry | null } {
  const g = globalThis as unknown as { __predictionsCache?: { entry: CacheEntry | null } };
  if (!g.__predictionsCache) g.__predictionsCache = { entry: null };
  return g.__predictionsCache;
}

async function persistSnapshot(payload: PredictionsResponse): Promise<void> {
  try {
    await db.insert(predictionSnapshots).values({
      source: payload.source,
      payload,
      scrapedAt: new Date(payload.scrapedAt),
      matchCount: payload.stats.matches,
    });
    // Ménage : on conserve 30 jours d'historique
    await db
      .delete(predictionSnapshots)
      .where(lt(predictionSnapshots.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  } catch {
    // La persistance ne doit jamais faire échouer la réponse principale.
  }
}

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("refresh") === "1";
  const store = getStore();
  const now = Date.now();

  // 1) Cache mémoire valide -> réponse immédiate
  if (!force && store.entry && now - store.entry.at < CACHE_TTL_MS) {
    const body: PredictionsResponse = {
      ...store.entry.payload,
      servedAt: new Date().toISOString(),
      fallback: "memory-cache",
      cache: {
        hit: true,
        ttlSeconds: CACHE_TTL_SECONDS,
        ageSeconds: Math.round((now - store.entry.at) / 1000),
      },
    };
    return Response.json(body, { headers: CACHE_HEADERS });
  }

  // 2) Scraping frais de la source
  const result = await scrapePredictions();

  if (result.ok) {
    const payload: PredictionsResponse = {
      ok: true,
      source: SOURCE_URL,
      scrapedAt: result.scrapedAt,
      servedAt: new Date().toISOString(),
      stats: {
        leagues: result.leagues.length,
        matches: result.leagues.reduce((n, l) => n + l.matches.length, 0),
      },
      cache: { hit: false, ttlSeconds: CACHE_TTL_SECONDS, ageSeconds: 0 },
      fallback: "fresh",
      error: null,
      leagues: result.leagues,
    };
    store.entry = { payload, at: now };
    void persistSnapshot(payload);
    return Response.json(payload, { headers: CACHE_HEADERS });
  }

  // 3) Source indisponible -> dernier snapshot connu en base PostgreSQL
  try {
    const rows = await db
      .select()
      .from(predictionSnapshots)
      .orderBy(desc(predictionSnapshots.scrapedAt))
      .limit(1);
    const snap = rows[0];
    if (snap) {
      const body: PredictionsResponse = {
        ...snap.payload,
        servedAt: new Date().toISOString(),
        fallback: "database",
        error: result.error,
        cache: {
          hit: true,
          ttlSeconds: CACHE_TTL_SECONDS,
          ageSeconds: Math.max(0, Math.round((now - snap.scrapedAt.getTime()) / 1000)),
        },
      };
      return Response.json(body, { status: 200, headers: CACHE_HEADERS });
    }
  } catch {
    // Base indisponible également -> on renvoie une erreur propre (502)
  }

  // 4) Rien à servir : erreur explicite, le front bascule sur le cache local
  const body: PredictionsResponse = {
    ok: false,
    source: SOURCE_URL,
    scrapedAt: result.scrapedAt,
    servedAt: new Date().toISOString(),
    stats: { leagues: 0, matches: 0 },
    cache: { hit: false, ttlSeconds: CACHE_TTL_SECONDS, ageSeconds: 0 },
    fallback: "none",
    error: result.error,
    leagues: [],
  };
  return Response.json(body, { status: 502, headers: { "Cache-Control": "no-store" } });
}
