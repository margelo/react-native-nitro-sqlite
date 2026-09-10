#!/usr/bin/env ruby

require "shellwords"
require "tmpdir"

ROOT = File.expand_path("..", __dir__)
PACKAGE_DIRECTORY = File.join(ROOT, "packages", "react-native-nitro-sqlite")
PODSPEC = File.join(PACKAGE_DIRECTORY, "RNNitroSQLite.podspec")
SQLITE_SOURCE = File.join(PACKAGE_DIRECTORY, "cpp", "sqlite", "sqlite3.c")

module Pod
  module UI
    def self.puts(*) end
  end

  class Spec
    class << self
      attr_accessor :last

      def new
        spec = allocate
        spec.send(:initialize)
        yield spec
        self.last = spec
      end
    end

    attr_reader :attributes_hash

    def initialize
      @attributes_hash = {}
    end

    def dependency(*) end

    def method_missing(name, *arguments)
      attribute = name.to_s
      return @attributes_hash[attribute] if arguments.empty?

      if attribute.end_with?("=") && arguments.length == 1
        @attributes_hash[attribute.delete_suffix("=")] = arguments.first
        return arguments.first
      end

      super
    end

    def respond_to_missing?(*_arguments)
      true
    end
  end
end

def min_ios_version_supported
  "13.4"
end

def install_modules_dependencies(_spec) end

def main
  default_flags = flags_for(nil)
  assert_threadsafe(default_flags, "1")
  assert_optimization_flags(default_flags)

  unsafe_flags = flags_for("0")
  assert_threadsafe(unsafe_flags, "0")
  assert_optimization_flags(unsafe_flags)

  safe_flags = flags_for("1")
  assert_threadsafe(safe_flags, "1")
  assert_optimization_flags(safe_flags)

  assert_invalid_value_rejected
  assert_system_sqlite_configuration
  compile_and_probe(unsafe_flags, "0")
  compile_and_probe(safe_flags, "1")

  puts "SQLite pod configuration tests passed"
end

def flags_for(threadsafe)
  spec = evaluate_podspec(
    "NITRO_SQLITE_THREADSAFE" => threadsafe,
    "NITRO_SQLITE_USE_PHONE_VERSION" => nil,
  )
  spec.attributes_hash.fetch("pod_target_xcconfig").fetch("OTHER_CFLAGS")
end

def evaluate_podspec(environment)
  previous_environment = environment.to_h do |name, _value|
    [name, ENV.key?(name) ? ENV.fetch(name) : nil]
  end

  environment.each do |name, value|
    value.nil? ? ENV.delete(name) : ENV[name] = value
  end

  Dir.chdir(PACKAGE_DIRECTORY) { load PODSPEC }
  Pod::Spec.last
ensure
  previous_environment&.each do |name, value|
    value.nil? ? ENV.delete(name) : ENV[name] = value
  end
end

def assert_threadsafe(flags, expected)
  assert_includes(flags, "-DSQLITE_THREADSAFE=#{expected}")
  other = expected == "1" ? "0" : "1"
  refute_includes(flags, "-DSQLITE_THREADSAFE=#{other}")
end

def assert_optimization_flags(flags)
  %w[
    -DSQLITE_DQS=0
    -DSQLITE_DEFAULT_MEMSTATUS=0
    -DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1
    -DSQLITE_LIKE_DOESNT_MATCH_BLOBS=1
    -DSQLITE_MAX_EXPR_DEPTH=0
    -DSQLITE_OMIT_DEPRECATED=1
    -DSQLITE_OMIT_PROGRESS_CALLBACK=1
    -DSQLITE_OMIT_SHARED_CACHE=1
    -DSQLITE_USE_ALLOCA=1
  ].each { |flag| assert_includes(flags, flag) }
end

def assert_invalid_value_rejected
  evaluate_podspec("NITRO_SQLITE_THREADSAFE" => "2")
  fail "Expected an invalid NITRO_SQLITE_THREADSAFE value to fail"
rescue RuntimeError => error
  expected = "NITRO_SQLITE_THREADSAFE must be either 0 or 1"
  fail "Unexpected validation error: #{error.message}" unless error.message == expected
end

def assert_system_sqlite_configuration
  spec = evaluate_podspec(
    "NITRO_SQLITE_THREADSAFE" => "1",
    "NITRO_SQLITE_USE_PHONE_VERSION" => "1",
  )
  attributes = spec.attributes_hash

  assert_equal(attributes.fetch("library"), "sqlite3")
  assert_equal(
    attributes.fetch("exclude_files"),
    ["cpp/sqlite/sqlite3.c", "cpp/sqlite/sqlite3.h"],
  )
end

def compile_and_probe(flags, expected)
  Dir.mktmpdir("nitro-sqlite-threadsafe") do |directory|
    probe = File.join(directory, "probe.c")
    binary = File.join(directory, "probe")
    File.write(
      probe,
      "#include <stdio.h>\n#include \"sqlite3.h\"\nint main(void) { printf(\"%d\", sqlite3_threadsafe()); return 0; }\n",
    )

    compile_flags = Shellwords.split(flags).reject { |flag| flag == "$(inherited)" }
    command = [
      ENV.fetch("CC", "cc"),
      *compile_flags,
      "-I#{File.dirname(SQLITE_SOURCE)}",
      SQLITE_SOURCE,
      probe,
      "-o",
      binary,
    ]
    fail "Failed to compile bundled SQLite with SQLITE_THREADSAFE=#{expected}" unless system(*command)

    actual = IO.popen([binary], &:read)
    assert_equal(actual, expected)
  end
end

def assert_includes(value, expected)
  fail "Expected #{value.inspect} to include #{expected.inspect}" unless value.include?(expected)
end

def refute_includes(value, unexpected)
  fail "Expected #{value.inspect} not to include #{unexpected.inspect}" if value.include?(unexpected)
end

def assert_equal(actual, expected)
  fail "Expected #{expected.inspect}, got #{actual.inspect}" unless actual == expected
end

main
