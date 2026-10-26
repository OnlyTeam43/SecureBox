// plugins/withArm64Only.js
// Targets arm64-v8a (64-bit ARM) only.
// Strips 32-bit (armeabi-v7a) and x86 emulator binaries, cutting APK size down to ~45-55MB
// while keeping ProGuard/R8 completely disabled so all classes and JNI methods remain intact.
const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

module.exports = function withArm64Only(config) {
  // 1. Inject ndk.abiFilters 'arm64-v8a' into android/app/build.gradle defaultConfig
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

  // 2. Set gradle.properties reactNativeArchitectures=arm64-v8a
  config = withGradleProperties(config, (configProps) => {
    const existing = configProps.modResults.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    );
    if (existing) {
      existing.value = 'arm64-v8a';
    } else {
      configProps.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: 'arm64-v8a',
      });
    }
    return configProps;
  });

  return config;
};
