const { getDefaultConfig } = require("expo/metro-config");
const { rewriteSharedJsSpecifier } = require("./metro-js-specifier");

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const rewritten = rewriteSharedJsSpecifier(moduleName, context.originModulePath);
  const resolve = (name) => {
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, name, platform);
    }
    return context.resolveRequest(context, name, platform);
  };

  if (!rewritten) {
    return resolve(moduleName);
  }

  try {
    return resolve(rewritten);
  } catch {
    return resolve(moduleName);
  }
};

module.exports = config;
