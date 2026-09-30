"""Read-only R1 scope, inherited evidence, result and manifest verification."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "evidence/resume-R1"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", required=True)
    parser.add_argument("--manifest", action="store_true")
    args = parser.parse_args()
    binding = json.loads((DATA / "source-binding.json").read_text())
    results = json.loads((DATA / "test-results.json").read_text())
    checks = []

    def check(name, ok):
        checks.append({"name": name, "status": "PASS" if ok else "FAIL"})

    def git(repo, *cmd):
        return subprocess.check_output(["git", "--no-optional-locks", "-C", str(repo), *cmd])

    head, base, old = (binding[k] for k in ("backendHead", "backendDev", "backendOldHead"))
    check("exact-new-head", git(args.backend, "rev-parse", "HEAD").decode().strip() == head)
    parents = git(args.backend, "show", "-s", "--format=%P", head).decode().split()
    check("ordinary-merge-parents", parents == [old, base])
    files = {r["path"] for r in binding["businessFiles"]}
    expected = {
        "src/admin-auth/admin-bearer.guard.spec.ts", "src/admin-auth/admin-bearer.guard.ts",
        "src/common/auth/request-auth.ts", "src/tenants/tenants.controller.spec.ts",
        "src/tenants/tenants.controller.ts", "test/admin-tenant-scope.integration.e2e-spec.ts",
    }
    check("six-original-business-files", files == expected
          == set(git(args.backend, "diff", "--name-only", base, head).decode().splitlines()))
    check("six-business-blobs-unchanged", all(git(args.backend, "rev-parse", old + ":" + f)
          == git(args.backend, "rev-parse", head + ":" + f) for f in files))
    check("merge-only-dependency-update", set(git(args.backend, "diff", "--name-only", old, head).decode().splitlines())
          == {"package.json", "package-lock.json"})
    check("test-head-and-exits", results["backendHead"] == head
          and all(r["exitCode"] == 0 for r in results["commands"]))
    expected_counts = {"targeted": (12, 0), "http-regression": (10, 0), "full-jest": (1761, 2)}
    check("exact-machine-counts", all(results["tests"][k]["numPassedTests"] == v[0]
          and results["tests"][k]["numPendingTests"] == v[1]
          and results["tests"][k]["numFailedTests"] == 0 for k, v in expected_counts.items()))
    check("no-external-connection-attempt", all(v["externalAttemptsDenied"] == 0 for v in results["network"].values()))
    check("audit-high-critical-zero", results["auditCounts"]["high"] == results["auditCounts"]["critical"] == 0
          and results["auditCounts"]["moderate"] == 5)
    audit = json.loads((ROOT / "evidence/admin-route-audit.json").read_text())
    check("original-route-matrix-preserved", audit["backendHead"] == old and audit["guardRouteCount"] == 131
          and len(audit["routes"]) == 131 and sum(v["repairStatus"] == "LIMITED" for v in audit["routes"]) == 38)
    old_manifest = (DATA / "SHA256SUMS-pre-resume.txt").read_text().splitlines()
    original_sha_ok = True
    for line in old_manifest:
        digest, name = line.split("  ", 1)
        source = git(ROOT.parents[2], "show", binding["governanceOldHead"] + ":docs/governance/FL-DB-003/" + name)
        original_sha_ok &= hashlib.sha256(source).hexdigest() == digest
    check("old-evidence-manifest-retained", len(old_manifest) == 26 and original_sha_ok)
    ci_path = DATA / "business-ci.json"
    if ci_path.exists():
        ci = json.loads(ci_path.read_text())
        check("business-full-ci-new-head", len(ci["runs"]) == 3 and all(r["headSha"] == head
              and r["conclusion"] == "success" for r in ci["runs"]))
    patterns = {
        "private-key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        "aws": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
        "github": r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b",
        "jwt": r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b",
        "credential-url": r"[a-z][a-z0-9+.-]*://[^\s/:@]+:[^\s/@]+@",
        "secret-assignment": r"(?i)(?:password|client_secret|api_key|access_token)\s*[=:]\s*[\"'][^\"'\s]{8,}[\"']",
    }
    findings = []
    all_files = sorted(p for p in ROOT.rglob("*") if p.is_file() and p.name != "SHA256SUMS")
    check("no-symlinks-bytecode", not any(p.is_symlink() or "__pycache__" in p.parts for p in ROOT.rglob("*")))
    for p in all_files:
        text = p.read_text()
        for name, pattern in patterns.items():
            if re.search(pattern, text):
                findings.append({"path": p.relative_to(ROOT).as_posix(), "rule": name})
    check("governance-sensitive-scan", not findings)
    if args.manifest:
        actual = {}
        for line in (ROOT / "SHA256SUMS").read_text().splitlines():
            digest, name = line.split("  ", 1)
            actual[name] = digest
        expected = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in all_files}
        check("current-sha-complete", actual == expected)
    report = {"checks": checks, "findings": findings, "failed": sum(c["status"] == "FAIL" for c in checks),
              "scanScope": "FL-DB-003 governance only; no original credentials or protected source overlays read; format scan is not proof that no unknown secret exists."}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return bool(report["failed"])


if __name__ == "__main__":
    raise SystemExit(main())
