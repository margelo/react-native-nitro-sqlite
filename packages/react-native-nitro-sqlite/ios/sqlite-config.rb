require "json"

# Library-scoped settings emitted by Expo's withPodfileProperties mod.
# Both SQLite pods read the same file without changing the app's Podfile or ENV.
module NitroSQLitePodConfig
  def self.read(installation_root)
    path = File.join(installation_root, "Podfile.properties.json")
    properties = File.exist?(path) ? JSON.parse(File.read(path)) : {}
    raise "Podfile.properties.json must contain an object" unless properties.is_a?(Hash)
    properties
  end

  def self.enabled(properties, key, environment)
    value = properties[key]
    unless value.nil? || %w[true false].include?(value)
      raise "#{key} in Podfile.properties.json must be true or false"
    end
    if ENV.key?(environment) && !value.nil? && (ENV[environment] == "1") != (value == "true")
      raise "#{environment} conflicts with #{key} in Podfile.properties.json"
    end
    value.nil? ? ENV[environment] == "1" : value == "true"
  end

  def self.flags(properties, defaults, system_sqlite)
    value = properties.fetch("nitroSqlite.flags", "")
    raise "nitroSqlite.flags must be a string" unless value.is_a?(String)
    definitions = {}
    value.split.each do |flag|
      unless flag.match?(/\A(?:SQLITE_|HAVE_)[A-Z0-9_]+=(-?\d+|[A-Z_][A-Z0-9_]*)\z/)
        raise "Invalid nitroSqlite.flags definition: #{flag}"
      end
      name = flag.split("=").first
      if definitions.key?(name) && definitions[name] != flag
        raise "Conflicting nitroSqlite.flags definitions for #{name}"
      end
      if defaults.match?(/(?:\A|\s)-D#{Regexp.escape(name)}(?:=|\s|\z)/)
        raise "#{name} is reserved by Nitro SQLite's native configuration"
      end
      definitions[name] = flag
    end
    if system_sqlite && !definitions.empty?
      raise "nitroSqlite.flags cannot configure Apple's system SQLite"
    end
    definitions.values.map { |flag| "-D#{flag}" }.join(" ")
  end
end
