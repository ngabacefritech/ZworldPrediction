import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { PredictionsResponse } from "@/lib/types";

/**
 * Snapshots des dernières prédictions scrapées avec succès.
 * Sert de filet de sécurité (mode dégradé) quand la source est indisponible,
 * y compris entre les instances serverless (Netlify).
 */
export const predictionSnapshots = pgTable("prediction_snapshots", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  payload: jsonb("payload").$type<PredictionsResponse>().notNull(),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull(),
  matchCount: integer("match_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
