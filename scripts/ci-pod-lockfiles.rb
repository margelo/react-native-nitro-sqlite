require 'open3'
require 'yaml'

# Compares installed lockfiles with the committed dependency graph and sources.
# Local podspec checksums can include absolute checkout paths, so they are excluded.
def check_pod_lockfiles(paths)
  paths.all? do |path|
    committed, status = Open3.capture2('git', 'show', "HEAD:#{path}")
    raise "Cannot read committed #{path}" unless status.success?

    if normalize_pod_lockfile(committed) == normalize_pod_lockfile(File.read(path))
      puts "#{path}: dependency resolutions match"
      next true
    end

    warn "#{path}: dependency resolutions changed. Commit the updated native-lockfiles artifact."
    false
  end
end

def normalize_pod_lockfile(content)
  lockfile = YAML.safe_load(content, permitted_classes: [Symbol])
  checksums = lockfile.fetch('SPEC CHECKSUMS')
  lockfile.fetch('EXTERNAL SOURCES', {}).each do |name, source|
    checksums.delete(name) if source.key?(:path)
  end
  lockfile
end

if __FILE__ == $PROGRAM_NAME
  raise 'At least one Podfile.lock path is required' if ARGV.empty?
  exit(check_pod_lockfiles(ARGV) ? 0 : 1)
end
