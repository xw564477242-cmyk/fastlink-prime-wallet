const fs = require("node:fs");
const crypto = require("node:crypto");
const { PrismaClient } = require("/work/node_modules/@prisma/client");
const {
  withIsolatedTenantTransaction,
} = require("/work/dist/src/prisma/isolated-tenant-transaction");
const output = {
  scope: "new local isolation only; no production claim",
  rounds: [],
  stopped: false,
};
const allClients = [];
const save = () =>
  fs.writeFileSync("/results/dynamic-final-r5-r6.json", JSON.stringify(output, null, 2));
const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
function client(c, role) {
  const password = role === "db5_initializer" ? c.initializer : c.roles[role];
  const url = new URL(`postgresql://${c.container}:5432/${c.database}`);
  url.username = role;
  url.password = password;
  url.searchParams.set("connection_limit", "2");
  const p = new PrismaClient({
    datasources: { db: { url: url.toString() } },
    log: [],
    errorFormat: "minimal",
  });
  allClients.push(p);
  return p;
}
function sqlstate(error) {
  return typeof error?.meta?.code === "string" ? error.meta.code : error?.code || "UNKNOWN";
}
async function main() {
  for (const round of [5, 6]) {
    const c = JSON.parse(fs.readFileSync(`/auth/r${round}/credentials.json`, "utf8"));
    if (c.container !== `fl-db005-p8ryoi9-r${round}` || c.database !== `fl_db005_r${round}`)
      throw new Error("invalid target");
    const owner = client(c, "db5_initializer"),
      issuer = client(c, "db5_issuer"),
      pool = client(c, "db5_pool");
    const roles = Object.fromEntries(
      ["db5_user_a", "db5_user_b", "db5_admin_a", "db5_platform", "db5_task"].map((r) => [
        r,
        client(c, r),
      ]),
    );
    const result = { round, cases: [], catalog: {}, verdict: "IN_PROGRESS" };
    output.rounds.push(result);
    save();
    const add = (name, pass, details = {}) => {
      result.cases.push({ name, status: pass ? "PASS" : "FAIL", ...details });
      save();
    };
    result.catalog.roles = await owner.$queryRawUnsafe(
      "SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname LIKE 'db5_%' ORDER BY rolname",
    );
    result.catalog.tables = await owner.$queryRawUnsafe(
      "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname",
    );
    result.catalog.functions = await owner.$queryRawUnsafe(
      "SELECT p.proname,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS owner,EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='fl_identity' ORDER BY p.proname",
    );
    result.catalog.memberships = await owner.$queryRawUnsafe(
      "SELECT pg_get_userbyid(roleid) AS role,pg_get_userbyid(member) AS member,admin_option,inherit_option,set_option FROM pg_auth_members WHERE pg_get_userbyid(member) LIKE 'db5_%' ORDER BY 1,2",
    );
    result.catalog.policies = await owner.$queryRawUnsafe(
      "SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
    );
    add(
      "54_tables_rls_force",
      result.catalog.tables.length === 54 &&
        result.catalog.tables.every((x) => x.relrowsecurity && x.relforcerowsecurity),
    );
    add(
      "runtime_nonprivileged",
      result.catalog.roles
        .filter((x) => x.rolname !== "db5_initializer")
        .every((x) => !x.rolsuper && !x.rolbypassrls && !x.rolcreaterole && !x.rolcreatedb),
    );
    add(
      "safe_function_owners_paths_execute",
      result.catalog.functions.every(
        (x) =>
          x.owner === "fl_db005_identity_owner" &&
          x.proconfig.includes("search_path=pg_catalog, pg_temp") &&
          !x.public_execute,
      ),
    );
    const snapshot = async () =>
      hash(
        await owner.$queryRawUnsafe(
          `SELECT json_build_object('customer',(SELECT json_agg(x) FROM (SELECT * FROM public."Customer" ORDER BY id)x),'address',(SELECT json_agg(x) FROM (SELECT * FROM public."WithdrawalAddress" ORDER BY id)x)) AS data`,
        ),
      );
    async function cross(name, action) {
      const before = await snapshot();
      let rows = null,
        code = null;
      try {
        const v = await action();
        rows = Number(v?.[0]?.n ?? 0);
      } catch (e) {
        code = sqlstate(e);
      }
      const after = await snapshot();
      if (rows > 0 || before !== after) {
        add(name, false, { rows, sqlstate: code, before_sha256: before, after_sha256: after });
        output.stopped = true;
        output.emergency = "P0: cross-tenant success or target change; no further expanded tests";
        save();
        throw new Error("P0_STOP");
      }
      add(name, rows === 0 || code === "42501", {
        rows,
        sqlstate: code,
        data_unchanged: before === after,
        before_sha256: before,
        after_sha256: after,
      });
    }
    for (const t of ["a", "b"]) {
      const role = roles[`db5_user_${t}`],
        other = t === "a" ? "b" : "a";
      const own =
        await role.$queryRaw`SELECT count(*)::int AS n FROM public."Customer" WHERE id=${`db5_customer_${t}`}`;
      add(`customer_same_${t}`, own[0].n === 1);
      await cross(
        `customer_cross_${t}`,
        () =>
          role.$queryRaw`SELECT count(*)::int AS n FROM public."Customer" WHERE id=${`db5_customer_${other}`}`,
      );
      const created =
        await role.$queryRaw`INSERT INTO public."WithdrawalAddress"(id,"assetCode","networkId",address,label,"updatedAt") VALUES (${`db5_address_r3_${t}`},'SYNTHETIC','synthetic','not-a-real-address-r3','synthetic',now()) RETURNING "tenantId","customerId",environment::text`;
      add(
        `address_insert_context_${t}`,
        created[0].tenantId === `db5_tenant_${t}` &&
          created[0].customerId === `db5_customer_${t}` &&
          created[0].environment === "SANDBOX",
      );
    }
    const stableData = await snapshot();
    for (const t of ["a", "b"]) {
      const role = roles[`db5_user_${t}`],
        other = t === "a" ? "b" : "a";
      await cross(
        `address_select_cross_${t}`,
        () =>
          role.$queryRaw`SELECT count(*)::int AS n FROM public."WithdrawalAddress" WHERE id=${`db5_address_r3_${other}`}`,
      );
      await cross(
        `address_update_cross_${t}`,
        () =>
          role.$queryRaw`WITH x AS(UPDATE public."WithdrawalAddress" SET label='synthetic-change' WHERE id=${`db5_address_r3_${other}`} RETURNING id) SELECT count(*)::int AS n FROM x`,
      );
      await cross(
        `address_delete_cross_${t}`,
        () =>
          role.$queryRaw`WITH x AS(DELETE FROM public."WithdrawalAddress" WHERE id=${`db5_address_r3_${other}`} RETURNING id) SELECT count(*)::int AS n FROM x`,
      );
      await cross(
        `address_insert_forged_owner_${t}`,
        () =>
          role.$queryRaw`WITH x AS(INSERT INTO public."WithdrawalAddress"(id,"tenantId","customerId",environment,"assetCode","networkId",address,label,"updatedAt") VALUES (${`db5_forged_${t}`},${`db5_tenant_${other}`},${`db5_customer_${other}`},'SANDBOX','SYNTHETIC','synthetic','not-a-real-address-r3','synthetic',now()) RETURNING id) SELECT count(*)::int AS n FROM x`,
      );
      await cross(
        `address_update_owner_${t}`,
        () =>
          role.$queryRaw`WITH x AS(UPDATE public."WithdrawalAddress" SET "tenantId"=${`db5_tenant_${other}`},"customerId"=${`db5_customer_${other}`} WHERE id=${`db5_address_r3_${t}`} RETURNING id) SELECT count(*)::int AS n FROM x`,
      );
      let updated = 0,
        deleted = 0;
      try {
        await role.$transaction(async (tx) => {
          const u =
            await tx.$queryRaw`WITH x AS(UPDATE public."WithdrawalAddress" SET label='synthetic-own-change' WHERE id=${`db5_address_r3_${t}`} RETURNING id) SELECT count(*)::int AS n FROM x`;
          updated = u[0].n;
          const d =
            await tx.$queryRaw`WITH x AS(DELETE FROM public."WithdrawalAddress" WHERE id=${`db5_address_r3_${t}`} RETURNING id) SELECT count(*)::int AS n FROM x`;
          deleted = d[0].n;
          throw new Error("SYNTHETIC_ROLLBACK");
        });
      } catch (e) {
        if (e.message !== "SYNTHETIC_ROLLBACK") throw e;
      }
      add(
        `address_same_update_delete_${t}`,
        updated === 1 && deleted === 1 && (await snapshot()) === stableData,
      );
    }
    for (const name of ["db5_platform", "db5_task"]) {
      const v = await roles[name].$queryRaw`SELECT count(*)::int AS n FROM public."Customer"`;
      add(`${name}_denied`, v[0].n === 0);
    }
    const adminOwn = await roles.db5_admin_a
      .$queryRaw`SELECT count(*)::int AS n FROM public."Customer" WHERE "tenantId"='db5_tenant_a'`;
    add("tenant_admin_same_select", adminOwn[0].n === 1);
    await cross(
      "tenant_admin_cross_select",
      () =>
        roles.db5_admin_a
          .$queryRaw`SELECT count(*)::int AS n FROM public."Customer" WHERE "tenantId"='db5_tenant_b'`,
    );
    const issueFor = (principal) => ({
      issue: async (target, purpose) => {
        const value = crypto.randomBytes(32).toString("hex"),
          digest = crypto.createHash("sha256").update(value).digest("hex");
        await issuer.$queryRaw`SELECT fl_identity.issue_ticket(decode(${digest},'hex'),${principal},${target.databaseLogin}::name,${target.backendPid}::int,${target.transactionId}::xid8,${purpose},clock_timestamp()+interval '50 seconds')::text`;
        return value;
      },
    });
    const poolUnbound = await pool.$queryRaw`SELECT count(*)::int AS n FROM public."Customer"`;
    add("pool_unbound_denied", poolUnbound[0].n === 0);
    const expected = [];
    for (let batch = 0; batch < 4; batch++) {
      const cases = await Promise.all(
        ["a", "b"].map((t) =>
          withIsolatedTenantTransaction(pool, issueFor(`pool_${t}`), "address-book", async (tx) => {
            await tx.$executeRaw`SELECT pg_sleep(0.02)`;
            const v = await tx.$queryRaw`SELECT id FROM public."Customer" ORDER BY id`;
            return { t, ok: v.length === 1 && v[0].id === `db5_customer_${t}` };
          }),
        ),
      );
      for (const c of cases) {
        if (!c.ok) {
          output.stopped = true;
          output.emergency = "P0: shared pool tenant mismatch";
          save();
          throw new Error("P0_STOP");
        }
        expected.push(c.ok);
      }
    }
    add("pool_concurrent_interleaving", expected.length === 8 && expected.every(Boolean), {
      transactions: expected.length,
      connection_limit: 2,
    });
    const afterPool = await pool.$queryRaw`SELECT count(*)::int AS n FROM public."Customer"`;
    add("pool_after_commit_denied", afterPool[0].n === 0);
    // Savepoint replay is explicitly tested rather than inferred from a full rollback.
    let replayAccepted = false;
    await pool.$transaction(async (tx) => {
      const [target] =
        await tx.$queryRaw`SELECT session_user::text AS "databaseLogin",pg_backend_pid() AS "backendPid",pg_current_xact_id()::text AS "transactionId"`;
      const ticket = await issueFor("pool_a").issue(target, "address-book");
      await tx.$executeRawUnsafe("SAVEPOINT before_binding");
      await tx.$queryRaw`SELECT fl_identity.bind_ticket(${ticket},'address-book')::text`;
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT before_binding");
      try {
        await tx.$queryRaw`SELECT fl_identity.bind_ticket(${ticket},'address-book')::text`;
        replayAccepted = true;
      } catch {}
    });
    add("same_transaction_savepoint_replay_rejected", !replayAccepted, {
      scope: "same approved subject and transaction; not a cross-tenant observation",
    });
    result.data_after_probes_unchanged = (await snapshot()) === stableData;
    result.verdict = result.cases.every((x) => x.status === "PASS")
      ? "PASS_WITH_SCOPE_LIMITS"
      : "FAIL_WITH_SCOPE_LIMITS";
    save();
  }
}
main()
  .catch((e) => {
    output.stopped = true;
    output.failure =
      e.message === "P0_STOP" ? "P0_STOP" : { category: e.constructor.name, code: sqlstate(e) };
    save();
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(allClients.map((p) => p.$disconnect().catch(() => {})));
    console.log(
      JSON.stringify({
        rounds: output.rounds.length,
        stopped: output.stopped,
        cases: output.rounds.map((r) => ({
          round: r.round,
          pass: r.cases.filter((x) => x.status === "PASS").length,
          fail: r.cases.filter((x) => x.status === "FAIL").length,
        })),
      }),
    );
  });
