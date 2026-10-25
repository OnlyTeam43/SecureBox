// plugins/withArm64Only.js
// Forces reactNativeArchitectures=arm64-v8a in android/gradle.properties.
// Strips 32-bit (armeabi-v7a) and x86 emulator binaries, reducing WebRTC + React Native APK size by ~70MB.
const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withArm64Only(config) {
  return withGradleProperties(config, (configProps) => {
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
};
