require 'minitest/autorun'
require_relative 'ci-pod-lockfiles'

class PodLockfilesTest < Minitest::Test
  LOCKFILE = <<~YAML
    PODS:
      - LocalPod (1.0.0)
      - RemotePod (2.0.0)
    DEPENDENCIES:
      - LocalPod (from `../packages/local`)
      - RemotePod
    EXTERNAL SOURCES:
      LocalPod:
        :path: ../packages/local
    SPEC CHECKSUMS:
      LocalPod: local-checkout-dependent
      RemotePod: remote-checksum
    PODFILE CHECKSUM: podfile-checksum
    COCOAPODS: 1.15.2
  YAML

  def test_local_pod_checksums_may_differ_between_checkouts
    assert_equal normalize_pod_lockfile(LOCKFILE),
                 normalize_pod_lockfile(LOCKFILE.sub('local-checkout-dependent', 'other-checkout'))
  end

  def test_remote_pod_checksums_must_match
    refute_equal normalize_pod_lockfile(LOCKFILE),
                 normalize_pod_lockfile(LOCKFILE.sub('remote-checksum', 'changed-checksum'))
  end

  def test_dependency_versions_must_match
    refute_equal normalize_pod_lockfile(LOCKFILE),
                 normalize_pod_lockfile(LOCKFILE.sub('RemotePod (2.0.0)', 'RemotePod (2.1.0)'))
  end

  def test_local_sources_and_podfile_checksum_must_match
    ['../packages/local', 'podfile-checksum'].each do |input|
      refute_equal normalize_pod_lockfile(LOCKFILE),
                   normalize_pod_lockfile(LOCKFILE.gsub(input, 'changed'))
    end
  end
end
