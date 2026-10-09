// Server-safe: imported by the root layout to paint the right theme before hydration.
export const THEME_STORAGE_KEY = "capella-erp-theme";
export const THEME_DARK_QUERY = "(prefers-color-scheme: dark)";

/** Runs in <head> before first paint so the page never flashes the wrong theme. */
export const themeBootScript = `(function(){var m=window.matchMedia("${THEME_DARK_QUERY}").matches;var p="system";try{p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system"}catch(e){}document.documentElement.dataset.theme=(p==="dark"||(p==="system"&&m))?"dark":"light"})()`;
