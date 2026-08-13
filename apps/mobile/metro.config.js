const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, "../../packages/shared");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const relativeOrigin = path.relative(sharedRoot, context.originModulePath);
  const comesFromShared =
    relativeOrigin !== "" &&
    !relativeOrigin.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeOrigin);
  const shouldTrySource =
    comesFromShared && moduleName.startsWith(".") && moduleName.endsWith(".js");

  if (shouldTrySource) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      // Keep real JavaScript imports working if no TypeScript source file exists.
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
