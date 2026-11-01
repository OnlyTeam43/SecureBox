// babel.config.js
module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isProd ? [['transform-remove-console', { exclude: ['error'] }]] : []),
      'react-native-reanimated/plugin',
    ],
  };
};
