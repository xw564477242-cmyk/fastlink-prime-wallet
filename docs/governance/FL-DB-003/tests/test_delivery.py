import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class DeliveryTests(unittest.TestCase):
    def test_route_audit_is_complete(self):
        audit = json.loads((ROOT / "evidence/admin-route-audit.json").read_text())
        self.assertEqual(audit["guardRouteCount"], 131)
        self.assertTrue(audit["complete"])
        self.assertEqual(len(audit["routes"]), 131)
        self.assertEqual(sum(audit["counts"].values()), 131)
        self.assertTrue(all(row["repairStatus"] in {"PASS_LOCAL", "PASS_STATIC", "LIMITED"} for row in audit["routes"]))

    def test_same_p0_case_changes_from_fail_to_reject(self):
        before = json.loads((ROOT / "evidence/db2-r01-before.json").read_text())
        after = json.loads((ROOT / "evidence/db3-r01-after.json").read_text())
        before_case = next(case for case in before["cases"] if case["id"] == "D04")
        after_case = next(case for case in after["cases"] if case["id"] == "D04")
        self.assertEqual((before_case["actual"], before_case["foreignTenantReturned"], before_case["status"]), (200, True, "FAIL"))
        self.assertEqual((after_case["actual"], after_case["foreignTenantReturned"], after_case["status"]), (403, False, "PASS"))
        self.assertEqual(after["deniedNetworkAttempts"], 0)
        self.assertTrue(after["binding"]["serverStopped"])

    def test_backend_head_is_fixed(self):
        audit = json.loads((ROOT / "evidence/admin-route-audit.json").read_text())
        self.assertEqual(audit["backendHead"], "4fead5f3e007d6226d63e263991c2de680744424")

    def test_required_documents_exist(self):
        required = {
            "README.md", "SCOPE-AND-REUSE.md", "BUSINESS-CHANGE.md", "ADMIN-ROUTE-AUDIT.md",
            "P0-BEFORE-AFTER.md", "TENANT-REGRESSION.md", "IMPACT-AND-STALE.md",
            "RISKS-AND-FOLLOWUPS.md", "CHANGE-AND-ROLLBACK.md", "BASELINE-DELTA.md",
            "SELF-TEST.md", "HANDOFF.md",
        }
        self.assertTrue(required.issubset({path.name for path in ROOT.glob("*.md")}))

    def test_no_secret_material_in_delivery(self):
        patterns = [
            re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
            re.compile(r"AKIA[0-9A-Z]{16}"),
            re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"),
            re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"),
        ]
        for path in ROOT.rglob("*"):
            if not path.is_file() or path.name == "SHA256SUMS":
                continue
            text = path.read_text(errors="ignore")
            self.assertFalse(any(pattern.search(text) for pattern in patterns), path)


if __name__ == "__main__":
    unittest.main()
