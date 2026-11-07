import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import ar from "../locales/ar.json";
import en from "../locales/en.json";

/**
 * The installable app (PWA): registering the service worker (public/sw.js), offering to
 * install, and saying when a new version has been deployed.
 *
 * Browsers that support it (Chrome, Edge, Samsung Internet) announce that the app can be
 * installed with `beforeinstallprompt`; it is kept here so an install button can use it at any
 * time. iPhone and iPad have no such event: they only install through Safari's share menu, so
 * the button there explains the steps instead.
 */
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const word = (key) => (document.documentElement.lang === "en" ? en : ar)[key];

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

// iPadOS reports itself as a Mac; a touch screen tells them apart.
export const isIos = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function initPwa() {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; notify(); });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; notify(); });

  // Production only: in development the worker would serve an old shell over today's edits.
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        next?.addEventListener("statechange", async () => {
          if (next.state !== "activated" || !hadController) return;
          // A page loaded after the deploy is already the new build: its shell is the new
          // worker's cache. Only a page still running the old build is told to reload, and it
          // is asked rather than reloaded, so a teacher halfway through a form loses nothing.
          const keys = await caches.keys();
          if (keys.includes(`halaqtna-shell-${import.meta.env.VITE_BUILD_ID}`)) return;
          toast(word("update_ready"), { duration: Infinity, action: { label: word("update_reload"), onClick: () => window.location.reload() } });
        });
      });
      // An installed app can stay open for days: look for a new deploy whenever it comes back.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}

/** What an install button can offer on this device, and the action that does it. */
export function useInstall() {
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt);
  return {
    standalone: isStandalone(),
    canPrompt: Boolean(prompt),
    ios: isIos(),
    install: async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
      deferredPrompt = null;   // the browser allows one prompt per event
      notify();
    },
  };
}
