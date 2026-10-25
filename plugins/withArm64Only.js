// plugins/withArm64Only.js
// 1. Injects ndk.abiFilters "arm64-v8a" into android/app/build.gradle defaultConfig
// 2. Enforces expo.useLegacyPackaging=true in gradle.properties to compress native .so libraries
// 3. Sets reactNativeArchitectures=arm64-v8a
const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

module.exports = function withArm64Only(config) {
  // 1. Inject ndk.abiFilters 'arm64-v8a' into android/app/build.gradle
  config = withAppBuildGradle(config, (configProps) => {
    let contents = configProps.modResults.contents;
    if (contents.includes('defaultConfig {') && !contents.includes('abiFilters "arm64-v8a"')) {
      contents = contents.replace(
        'defaultConfig {',
        `defaultConfig {
        ndk {
            abiFilters "arm64-v8a"
        }`
      );
      configProps.modResults.contents = contents;
    }
    return configProps;
  });

  // 2. Set gradle.properties for legacy packaging (compression) & architectures
  config = withGradleProperties(config, (configProps) => {
    const setOrAdd = (key, value) => {
      const existing = configProps.modResults.find(
        (item) => item.type === 'property' && item.key === key
      );
      if (existing) {
        existing.value = value;
      } else {
        configProps.modResults.push({ type: 'property', key, value });
      }
    };

    setOrAdd('reactNativeArchitectures', 'arm64-v8a');
    setOrAdd('expo.useLegacyPackaging', 'true');
    return configProps;
  });

  return config;
};
