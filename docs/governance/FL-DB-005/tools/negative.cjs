const fs = require("node:fs"),
  crypto = require("node:crypto");
const { PrismaClient } = require("/work/node_modules/@prisma/client");
const output = { rounds: [], scope: "isolated identity and least-privilege controls" };
const clients = [];
const save = () => fs.writeFileSync("/results/negative-r1.json", JSON.stringify(output, null, 2));
function make(c, r) {
  const u = new URL(`postgresql://${c.container}:5432/${c.database}`);
  u.username = r;
  u.password = r === "db5_initializer" ? c.initializer : c.roles[r];
  u.searchParams.set("connection_limit", "2");
  const p = new PrismaClient({
    datasources: { db: { url: u.toString() } },
    log: [],
    errorFormat: "minimal",
  });
  clients.push(p);
  return p;
}
const code = (e) => e.meta?.code || e.code || "UNKNOWN";
(async () => {
  for (const round of [1, 2]) {
    const c = JSON.parse(fs.readFileSync(`/auth/r${round}/credentials.json`));
    const pool = make(c, "db5_pool"),
      issuer = make(c, "db5_issuer"),
      owner = make(c, "db5_initializer"),
      ordinary = make(c, "db5_user_a");
    const r = { round, cases: [] };
    output.rounds.push(r);
    const add = (name, ok, details = {}) => {
      r.cases.push({ name, status: ok ? "PASS" : "FAIL", ...details });
      save();
    };
    async function denied(name, fn) {
      try {
        await fn();
        add(name, false);
      } catch (e) {
        add(name, code(e) === "42501", { sqlstate: code(e) });
      }
    }
    async function issue(tx, seconds = 30) {
      const [t] =
        await tx.$queryRaw`SELECT session_user::text AS login,pg_backend_pid() AS pid,pg_current_xact_id()::text AS xid`;
      const value = crypto.randomBytes(32).toString("hex"),
        digest = crypto.createHash("sha256").update(value).digest("hex");
      await issuer.$queryRaw`SELECT fl_identity.issue_ticket(decode(${digest},'hex'),'pool_a',${t.login}::name,${t.pid}::int,${t.xid}::xid8,'address-book',clock_timestamp()+${seconds}::int*interval '1 second')::text`;
      return value;
    }
    await denied(
      "runtime_cannot_read_mapping",
      () => pool.$queryRaw`SELECT principal_id FROM fl_identity.principal`,
    );
    await denied(
      "runtime_cannot_read_ticket_digests",
      () => pool.$queryRaw`SELECT digest FROM fl_identity.ticket`,
    );
    await denied("runtime_cannot_set_identity_owner", () =>
      pool.$executeRawUnsafe("SET ROLE fl_db005_identity_owner"),
    );
    await denied(
      "runtime_cannot_issue",
      () =>
        pool.$queryRaw`SELECT fl_identity.issue_ticket(decode(repeat('0',64),'hex'),'pool_a','db5_pool'::name,1,'1'::xid8,'address-book',clock_timestamp()+interval '20 seconds')::text`,
    );
    await denied(
      "customer_insert_denied",
      () =>
        ordinary.$executeRaw`INSERT INTO public."Customer" (id) VALUES ('synthetic-disallowed')`,
    );
    await denied(
      "customer_update_denied",
      () =>
        ordinary.$executeRaw`UPDATE public."Customer" SET "firstName"='synthetic' WHERE id='db5_customer_a'`,
    );
    await denied(
      "customer_delete_denied",
      () => ordinary.$executeRaw`DELETE FROM public."Customer" WHERE id='db5_customer_a'`,
    );
    await denied("purpose_conflict_denied", () =>
      pool.$transaction(async (tx) => {
        const v = await issue(tx);
        await tx.$queryRaw`SELECT fl_identity.bind_ticket(${v},'wrong-purpose')::text`;
      }),
    );
    await denied(
      "random_ticket_denied",
      () =>
        pool.$queryRaw`SELECT fl_identity.bind_ticket(${crypto.randomBytes(32).toString("hex")},'address-book')::text`,
    );
    await denied("wrong_login_pid_denied", () =>
      pool.$transaction(async (tx) => {
        const v = await issue(tx);
        await ordinary.$queryRaw`SELECT fl_identity.bind_ticket(${v},'address-book')::text`;
      }),
    );
    await denied("expiry_denied", () =>
      pool.$transaction(async (tx) => {
        const v = await issue(tx, 1);
        await tx.$executeRaw`SELECT pg_sleep(1.1)`;
        await tx.$queryRaw`SELECT fl_identity.bind_ticket(${v},'address-book')::text`;
      }),
    );
    await denied("same_transaction_duplicate_denied", () =>
      pool.$transaction(async (tx) => {
        const v = await issue(tx);
        await tx.$queryRaw`SELECT fl_identity.bind_ticket(${v},'address-book')::text`;
        await tx.$queryRaw`SELECT fl_identity.bind_ticket(${v},'address-book')::text`;
      }),
    );
    let old;
    await pool.$transaction(async (tx) => {
      old = await issue(tx);
      await tx.$queryRaw`SELECT fl_identity.bind_ticket(${old},'address-book')::text`;
    });
    await denied(
      "new_transaction_after_commit_replay_denied",
      () => pool.$queryRaw`SELECT fl_identity.bind_ticket(${old},'address-book')::text`,
    );
    try {
      await pool.$transaction(async (tx) => {
        old = await issue(tx);
        await tx.$queryRaw`SELECT fl_identity.bind_ticket(${old},'address-book')::text`;
        throw new Error("SYNTHETIC_ROLLBACK");
      });
    } catch (e) {
      if (e.message !== "SYNTHETIC_ROLLBACK") throw e;
    }
    await denied(
      "new_transaction_after_rollback_replay_denied",
      () => pool.$queryRaw`SELECT fl_identity.bind_ticket(${old},'address-book')::text`,
    );
    const unbound = await pool.$queryRaw`SELECT count(*)::int AS n FROM public."Customer"`;
    add("rollback_pool_context_absent", unbound[0].n === 0);
    const seq = await owner.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fl_identity' AND c.relkind='S' AND (has_sequence_privilege('fl_db005_runtime',c.oid,'USAGE') OR has_sequence_privilege('fl_db005_runtime',c.oid,'SELECT') OR has_sequence_privilege('fl_db005_runtime',c.oid,'UPDATE') OR has_sequence_privilege('fl_db005_issuer',c.oid,'USAGE') OR EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) a WHERE a.grantee=0))",
    );
    add("private_sequence_no_runtime_issuer_public_rights", seq[0].n === 0);
    r.default_privileges = await owner.$queryRawUnsafe(
      "SELECT pg_get_userbyid(defaclrole) AS creator,defaclnamespace::regnamespace::text AS namespace,defaclobjtype,defaclacl::text AS acl FROM pg_default_acl ORDER BY 1,2,3",
    );
    r.table_grants = await owner.$queryRawUnsafe(
      "SELECT table_name,privilege_type FROM information_schema.table_privileges WHERE grantee='fl_db005_runtime' ORDER BY table_name,privilege_type",
    );
    add(
      "runtime_positive_grants_only_two_objects",
      r.table_grants.length === 5 &&
        r.table_grants.every((x) => ["Customer", "WithdrawalAddress"].includes(x.table_name)),
    );
    r.sequence_count = (
      await owner.$queryRawUnsafe(
        "SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fl_identity' AND c.relkind='S'",
      )
    )[0].n;
    r.lifecycle = "LIMITED: retained; no automatic cleanup; isolation prototype only";
    save();
  }
})()
  .catch((e) => {
    output.error = { code: code(e), category: e.constructor.name };
    save();
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(clients.map((c) => c.$disconnect().catch(() => {})));
    console.log(
      JSON.stringify(
        output.rounds.map((r) => ({
          round: r.round,
          pass: r.cases.filter((x) => x.status === "PASS").length,
          fail: r.cases.filter((x) => x.status === "FAIL").length,
        })),
      ),
    );
  });
