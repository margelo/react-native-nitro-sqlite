# QuickSQLite is deprecated

`react-native-quick-sqlite` is no longer maintained. Switch to [NitroSQLite](https://github.com/margelo/react-native-nitro-sqlite), its maintained successor.

```sh
npm uninstall react-native-quick-sqlite
npm install react-native-nitro-sqlite react-native-nitro-modules
npx pod-install
```

Follow the [migration guide](https://sqlite.margelo.com/docs/guides/migrate-from-quick-sqlite) to update your imports and database calls, preserve existing database files, and rebuild your app. Check the [supported React Native versions](https://sqlite.margelo.com/docs) before upgrading.
