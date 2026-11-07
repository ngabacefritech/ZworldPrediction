"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker /sw.js (mode hors-ligne de la PWA)
 * et demande une vérification de mise à jour toutes les heures.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Service worker indisponible (contexte non sécurisé, etc.) : l'app continue en mode web classique.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", () => void register(), { once: true });
    }

    const id = window.setInterval(() => {
      void navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    }, 60 * 60 * 1000);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
