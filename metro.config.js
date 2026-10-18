// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Block Android and CMake temporary build directories from crashing Metro file watcher on Windows
const customBlockList = [
  /.*[/\\]android[/\\]\.cxx[/\\].*/,
  /.*[/\\]android[/\\]build[/\\].*/,
  /.*[/\\]build[/\\]generated[/\\].*/,
];

if (Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList.push(...customBlockList);
} else if (config.resolver.blockList instanceof RegExp) {
  config.resolver.blockList = [config.resolver.blockList, ...customBlockList];
} else {
  config.resolver.blockList = customBlockList;
}

module.exports = config;
