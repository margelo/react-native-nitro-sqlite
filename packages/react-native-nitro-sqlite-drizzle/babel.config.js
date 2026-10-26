module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [['inline-import', { extensions: ['.sql'] }]],
}
