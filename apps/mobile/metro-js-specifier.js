/**
 * Shared uses NodeNext specifiers (`./x.js`) that point at `.ts` sources.
 * Strip the extension for those relative imports so Metro can resolve the `.ts` file.
 * Callers should fall back to the original specifier if the extensionless path misses a real `.js` file.
 */
function rewriteSharedJsSpecifier(moduleName, originModulePath) {
  if (typeof moduleName !== "string" || !moduleName.endsWith(".js")) {
    return null;
  }
  if (!moduleName.startsWith(".")) {
    return null;
  }
  const origin = String(originModulePath || "").replace(/\\/g, "/");
  if (!origin.includes("/packages/shared/")) {
    return null;
  }
  return moduleName.slice(0, -3);
}

module.exports = { rewriteSharedJsSpecifier };
