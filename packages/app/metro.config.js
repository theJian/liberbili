const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath =
  require.resolve('@lingui/metro-transformer/expo');
config.resolver.sourceExts.push('po', 'pot');

module.exports = config;
