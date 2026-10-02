# FL-DB-005 implementation checkpoint — PENDING

This is an intermediate implementation record, not a gate-2 submission or an RLS acceptance result.

## Inherited authority

BASE-V1.0-20260930 plus the formal gate-5 deltas of FL-GOV-002,
FL-DB-001, FL-DB-002, FL-DEP-001, FL-DB-003 and FL-DB-004.
No baseline snapshot or formal status has been updated.

Backend base: `b5f3cda4e31cef177c952b8c0c3a1b220246e998`.
Evidence base: `2621b7ba4abcf9142423712a3be8f1222cd7ae83`.
Both independent clones use `feature/FL-DB-005-tenant-identity-rls`.
The protected formal-workspace overlays were not read or copied.

## Authority received

The project owner's original-migration exception was verified in the controller
thread `019fa6b7-4f28-7b62-b676-757be88c22f8`: two new blank task databases only;
original DROP CONSTRAINT/INDEX permitted without editing, reordering or skipping.
Controller confirmed the ticket-based identity implementation for isolation only,
and subsequently confirmed two positive object samples. None of these decisions
is production identity integration or deployment approval.

The execution approval system rejected the planned container/authentication/role/
candidate-migration chain because it recognized only the original DROP exception.
The rejected execution was not bypassed. A specific owner authorization question
is pending. No DB5 container, credential, database or SQL execution was created.

## Candidate identity contract

- Migration/initializer is separate from non-owner runtime and trusted issuer.
- Private principal mapping binds database login, subject, tenant, SANDBOX,
  actor kind, purpose and expiry. Runtime cannot edit or enumerate mapping/tickets.
- Direct identity derives from `session_user`, not SET ROLE or request fields.
- Shared Prisma uses an interactive transaction. Target login, PID and transaction
  ID are read on that transaction; an independently authenticated issuer selects
  the pre-approved principal and registers a random capability digest.
- Runtime binding checks digest, target, purpose, expiry and consumption state.
  Private binding is keyed by login, PID and full transaction ID, not a GUC.
- No production issuer, JWT/session integration or existing endpoint is changed.
- Functions have dedicated NOLOGIN owner, qualified object names, fixed safe
  search_path and explicit EXECUTE grants; PUBLIC EXECUTE is revoked.
- Platform/task identities remain denied; no cross-tenant capability is added.

### Unverified design conditions

The SQL candidate has not been executed. Syntax, trigger behavior, catalog grants,
two rebuilds, transaction reuse and actual Prisma pool concurrency remain unverified.
The consumption marker is transactional. Full rollback changes the transaction ID;
however rollback-to-savepoint behavior and repeated binding within the same
transaction require explicit negative tests before claiming replay protection.
An untested assumption must not turn T04/T05 into PASS.

## Object scope and minimum samples

`TABLE-SCOPE-CHECKPOINT.csv` contains exactly the inherited 54 catalog tables.
Its source is the already accepted DB4 catalog, not a fresh DB5 observation.
The candidate explicitly enables RLS/FORCE RLS for those 54 and revokes PUBLIC
table access. This alone does not establish a correct per-operation permission model.

Approved isolated positive samples:

- Customer: ordinary user SELECT of self; tenant admin SELECT of own tenant.
  No Customer writes are granted.
- WithdrawalAddress: ordinary user's own address-book CRUD only. INSERT ownership
  is set from the trusted context; any client-supplied owner/tenant/environment is
  rejected. UPDATE ownership changes are rejected. This is not a funds transfer.
- Other 52 objects: no permissive policy or runtime DML grant; operation contract
  remains BLOCKED. Denying all operations is not successful legitimate-path testing.

Ten Prisma-only models are listed separately as STALE/pending scope determination;
they are not built, omitted from the discrepancy record, or counted among the 54.
Four legacy treasury tables absent from Prisma remain part of the original 54
denominator and are also explicitly marked STALE/ownership unresolved.

## Retained risks and prohibitions

DB-R02 potential P0; DB1 T08/T09 FAIL and T13 BLOCKED; DB4 T07 FAIL and
T08–T11 BLOCKED; 38 Admin routes LIMITED; 88 High and 2,917 semantic candidates;
DEV1-T03/T12, GOV2-T09, original FAIL/corrections/21 backups/tool references and
early historical-text gaps all remain. No historical record is overwritten.

Funds remain disabled. No existing DEV/TEST/UAT/production/Railway access,
provider calls, real data, old credentials, baseline update, deployment or promotion.
No GC, cleanup, index restoration, worktree restoration or history rewriting.

## Rollback

No database change has occurred at this checkpoint. The new rollback SQL is a
review-only, fail-closed plan: revoke the new runtime grants and disable new mapping
admissions; retain tables, RLS/FORCE, evidence and history. It is not executed.
If later committed, corrections use new commits and reviewed PRs, never reset,
force-push, amendment, deletion of evidence or restoration of broad access.

## Next required evidence

Owner resolution of the execution approval block; two independent blank rebuilds;
task-only authentication and isolation proof; role/member/default privilege catalog;
same/cross-tenant results for both positive samples; expiry/replay/conflict/savepoint
and pool interleaving tests; target-data invariance; unapproved object contracts;
complete DB5-T01–T18; both Draft PRs, separate HEADs and CI.

References used for design, not proof of this implementation:
[PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[PostgreSQL 17 function security](https://www.postgresql.org/docs/17/sql-createfunction.html),
[Prisma transactions](https://www.prisma.io/docs/orm/fundamentals/transactions).
