// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Register font extensions in assetExts to prevent loading errors
if (!config.resolver.assetExts.includes('ttf')) config.resolver.assetExts.push('ttf');
if (!config.resolver.assetExts.includes('otf')) config.resolver.assetExts.push('otf');


// // Exclude unnecessary directories from file watching
// config.watchFolders = [__dirname];
// config.resolver.blacklistRE = /(.*)\/(__tests__|android|ios|build|dist|.git|node_modules\/.*\/android|node_modules\/.*\/ios|node_modules\/.*\/windows|node_modules\/.*\/macos)(\/.*)?$/;

// // Alternative: use a more aggressive exclusion pattern
// config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|windows|macos|__tests__|\.git|.*\.android\.js|.*\.ios\.js)$/;

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

// Force CommonJS resolution for zustand to avoid import.meta issues on web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "zustand") {
    return {
      filePath: path.resolve(__dirname, "node_modules/zustand/index.js"),
      type: "sourceFile",
    };
  }
  if (platform === "web" && moduleName === "zustand/middleware") {
    return {
      filePath: path.resolve(__dirname, "node_modules/zustand/middleware.js"),
      type: "sourceFile",
    };
  }
  // Fallback to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
