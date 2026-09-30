import hashlib
import json
import pathlib
import re
import subprocess
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]


def git(repo, *args):
    return subprocess.check_output(["git", "--no-optional-locks", *args], cwd=repo, text=True).strip()


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    if len(sys.argv) != 5:
        raise SystemExit("usage: finalize.py BACKEND FORMAL_BACKEND FORMAL_EVIDENCE BASE_SHA")
    backend = pathlib.Path(sys.argv[1]).resolve()
    formal_backend = pathlib.Path(sys.argv[2]).resolve()
    formal_evidence = pathlib.Path(sys.argv[3]).resolve()
    base = sys.argv[4]

    head = git(backend, "rev-parse", "HEAD")
    changed = git(backend, "diff", "--name-only", f"{base}..{head}").splitlines()
    expected = {
        "src/admin-auth/admin-bearer.guard.spec.ts",
        "src/admin-auth/admin-bearer.guard.ts",
        "src/common/auth/request-auth.ts",
        "src/tenants/tenants.controller.spec.ts",
        "src/tenants/tenants.controller.ts",
        "test/admin-tenant-scope.integration.e2e-spec.ts",
    }
    if set(changed) != expected:
        raise SystemExit("unexpected business diff")
    business = {
        "schema": "FL-DB-003-business-files-v1",
        "base": base,
        "head": head,
        "files": [{"path": name, "sha256": sha(backend / name)} for name in sorted(changed)],
    }
    (ROOT / "evidence/business-files.json").write_text(json.dumps(business, indent=2) + "\n")

    protected = {
        "schema": "FL-DB-003-source-protection-v1",
        "formalBackend": {
            "head": git(formal_backend, "rev-parse", "HEAD"),
            "status": git(formal_backend, "status", "--porcelain=v2", "--untracked-files=all").splitlines(),
        },
        "formalEvidence": {
            "head": git(formal_evidence, "rev-parse", "HEAD"),
            "status": git(formal_evidence, "status", "--porcelain=v2", "--untracked-files=all").splitlines(),
        },
        "contentRead": False,
        "modifiedByTicket": False,
        "note": "Only Git porcelain-v2 metadata, paths and HEADs are recorded; protected file contents were not read.",
    }
    (ROOT / "evidence/source-protection.json").write_text(json.dumps(protected, indent=2) + "\n")

    patterns = {
        "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "aws-access-key": re.compile(r"AKIA[0-9A-Z]{16}"),
        "github-token": re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"),
        "jwt": re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"),
        "connection-secret": re.compile(r"(?i)(?:password|secret|token)\s*=\s*['\"][^'\"]{8,}['\"]"),
    }
    hits = []
    scanned = 0
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts or path.suffix == ".pyc" or path.name in {"SHA256SUMS", "delivery-checks.json"}:
            continue
        text = path.read_text(errors="ignore")
        scanned += 1
        for name, pattern in patterns.items():
            if pattern.search(text):
                hits.append({"path": str(path.relative_to(ROOT)), "rule": name})
    synthetic = {
        "private-key": "-----BEGIN " + "PRIVATE KEY-----",
        "aws-access-key": "AKIA" + "ABCDEFGHIJKLMNOP",
        "github-token": "ghp_" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        "jwt": "eyJ" + "A" * 21 + "." + "eyJ" + "B" * 21 + "." + "C" * 20,
        "connection-secret": "password" + '=\"synthetic-value-only\"',
    }
    positive = {name: bool(pattern.search(synthetic[name])) for name, pattern in patterns.items()}
    checks = {
        "schema": "FL-DB-003-delivery-checks-v1",
        "scannedFiles": scanned,
        "secretRules": list(patterns),
        "syntheticPositive": positive,
        "hits": hits,
        "range": "docs/governance/FL-DB-003 only",
    }
    (ROOT / "evidence/delivery-checks.json").write_text(json.dumps(checks, indent=2) + "\n")
    if hits or not all(positive.values()):
        raise SystemExit("sensitive scan failed")

    files = [
        path for path in sorted(ROOT.rglob("*"))
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc" and path.name != "SHA256SUMS"
    ]
    lines = [f"{sha(path)}  {path.relative_to(ROOT)}" for path in files]
    (ROOT / "SHA256SUMS").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
