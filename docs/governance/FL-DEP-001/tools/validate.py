"""Read-only evidence checks. No tests, network, credentials or source writes."""
import argparse
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", type=Path, required=True)
    parser.add_argument("--check-manifest", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    evidence = root / "evidence"
    load = lambda name: json.loads((evidence / name).read_text())
    checks = []

    def check(name, condition):
        checks.append({"check": name, "status": "PASS" if condition else "FAIL"})

    def git(*cmd):
        return subprocess.check_output(
            ["git", "--no-optional-locks", "-C", str(args.backend), *cmd], text=True
        )

    diff = load("dependency-diff.json")
    base, head = diff["base"], diff["head"]
    check("business-head", git("rev-parse", "HEAD").strip() == head)
    check("two-file-scope", set(git("diff", "--name-only", base, head).splitlines())
          == {"package.json", "package-lock.json"})
    before = json.loads(git("show", base + ":package.json"))
    after = json.loads(git("show", head + ":package.json"))
    check("exact-version-upgrade", before["dependencies"]["undici"] == "8.9.0"
          and after["dependencies"]["undici"] == "8.10.2")
    before["dependencies"]["undici"] = "8.10.2"
    check("no-other-package-json-change", before == after)
    old = json.loads(git("show", base + ":package-lock.json"))
    new = json.loads(git("show", head + ":package-lock.json"))
    old["packages"][""]["dependencies"]["undici"] = "8.10.2"
    for field in ("version", "resolved", "integrity"):
        old["packages"]["node_modules/undici"][field] = new["packages"]["node_modules/undici"][field]
    check("no-other-lock-change", old == new)
    check("lock-determinism-evidence", diff["lockSha256BeforeSecondResolve"]
          == diff["lockSha256AfterSecondResolve"]
          == hashlib.sha256((args.backend / "package-lock.json").read_bytes()).hexdigest())
    before_audit, after_audit = load("audit-before.json"), load("audit-after.json")
    counts = after_audit["metadata"]["vulnerabilities"]
    check("high-critical-zero", counts["high"] == counts["critical"] == 0)
    mods = lambda audit: {k: v for k, v in audit["vulnerabilities"].items()
                          if v["severity"] == "moderate"}
    check("five-moderates-unchanged", len(mods(after_audit)) == 5
          and mods(before_audit) == mods(after_audit))
    tests = load("test-results.json")
    check("existing-results-preserved", tests["targeted"]["numPassedTests"] == 76
          and tests["fullJest"]["numPassedTests"] == 1755
          and tests["fullJest"]["numPendingTests"] == 2
          and tests["fullJest"]["numFailedTests"] == 0)
    check("mock-loopback-evidence", tests["adapter"]["httpStatus"] == 200
          and all(x["externalAttemptsDenied"] == 0 for x in tests["network"].values()))
    ci = load("business-ci.json")
    check("draft-ci-bound-to-head", ci["pr"]["headRefOid"] == head
          and ci["pr"]["isDraft"] and ci["pr"]["baseRefName"] == "dev"
          and all(x["headSha"] == head and x["conclusion"] == "success" for x in ci["runs"]))
    files = sorted(p for p in root.rglob("*") if p.is_file() and p.name != "SHA256SUMS")
    check("no-symlinks-or-bytecode", not any(p.is_symlink() or "__pycache__" in p.parts for p in root.rglob("*")))
    rules = {
        "private-key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        "github-token": r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b",
        "aws-access": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
        "jwt": r"\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b",
        "credential-url": r"[a-z][a-z0-9+.-]*://[^\s/:@]+:[^\s/@]+@",
        "secret-assignment": r"(?i)(?:password|client_secret|api_key|access_token)\s*[=:]\s*[\"'][^\"'\s]{8,}[\"']",
    }
    findings = []
    entropy_reviewed = 0
    for file in files:
        text = file.read_text()
        for name, pattern in rules.items():
            if re.search(pattern, text):
                findings.append({"file": file.relative_to(root).as_posix(), "rule": name})
        # Only literal token forms; metadata exemptions are structural, never directory-wide.
        public_links = r"https://(?:github\.com/(?:nodejs/undici/security/advisories/GHSA-[a-z0-9-]+|advisories/GHSA-[a-z0-9-]+|xw564477242-cmyk/(?:fastlik-backend|fastlink-prime-wallet)/(?:pull/[0-9]+|actions/runs/[0-9]+(?:/job/[0-9]+)?))|raw\.githubusercontent\.com/nodejs/undici/v8\.10\.2/package\.json|registry\.npmjs\.org/undici/-/undici-[0-9.]+\.tgz)(?=[\s\"。)]|$)"
        entropy_text = re.sub(public_links, "PUBLIC_REFERENCE", text)
        for filename in ("CHANGE-HISTORY.md", "PROJECT-STATUS-SUMMARY.md", "FULL-ARCHIVE-INDEX.md"):
            entropy_text = entropy_text.replace("docs/governance/baseline/" + filename, "PROTECTED_PATH")
        for value in re.findall(r'[A-Za-z0-9_+/=-]{32,}', entropy_text):
            entropy = -sum((value.count(c) / len(value)) * math.log2(value.count(c) / len(value)) for c in set(value))
            if entropy < 4.5:
                continue
            entropy_reviewed += 1
            if re.fullmatch(r"[a-fA-F0-9]{40}|[a-fA-F0-9]{64}", value):
                continue
            if re.fullmatch(r"sha512-[A-Za-z0-9+/]{86}==", value):
                continue
            findings.append({"file": file.relative_to(root).as_posix(), "rule": "unclassified-high-entropy"})
    check("governance-secret-scan", not findings)
    if args.check_manifest:
        lines = (root / "SHA256SUMS").read_text().splitlines()
        expected = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
        actual = {}
        for line in lines:
            digest, name = line.split("  ", 1)
            actual[name] = digest
        check("sha256-complete-and-correct", expected == actual and len(lines) == len(actual))
    result = {"checks": checks, "secretFindings": findings,
              "highEntropyMetadataReviewed": entropy_reviewed,
              "scanLimits": "New governance UTF-8 files only; exact public reference URL forms, three protected path names, hex OIDs/SHA256 and npm SHA512 integrity are metadata. No actual key file read. Not a full-project rescan.",
              "failed": sum(x["status"] == "FAIL" for x in checks)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return bool(result["failed"])


if __name__ == "__main__":
    raise SystemExit(main())
