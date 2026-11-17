# Nitro SQLite Expo config plugin

Configure optional native SQLite features during Expo prebuild and EAS Build. Install this package alongside matching versions of `react-native-nitro-sqlite` and, for vector search, `react-native-nitro-sqlite-vec`. Supports Expo SDK 55, 56, and 57.

```sh
npx expo install react-native-nitro-sqlite-expo-plugin
```

```json
{
  "expo": {
    "plugins": [
      ["react-native-nitro-sqlite-expo-plugin", { "fts5": true }],
      "react-native-nitro-sqlite-expo-plugin/vec"
    ]
  }
}
```

The `/vec` entry requires the companion package. Omit it when you do not need vector search. The core entry supports `fts5`, `sqliteFlags.ios`, `sqliteFlags.android`, `ios.appGroup`, and `ios.useSystemSqlite`. It preserves existing settings and reports conflicting values.

Regenerate native directories and rebuild after changing options. Expo Go and JavaScript updates cannot add native SQLite features. EAS Build applies the plugin when it generates native directories; committed native projects need prebuild before building.

See the [Expo configuration guide](https://sqlite.margelo.com/docs/configuration/expo) for all options, App Group setup, system SQLite limitations, and manual configuration.
