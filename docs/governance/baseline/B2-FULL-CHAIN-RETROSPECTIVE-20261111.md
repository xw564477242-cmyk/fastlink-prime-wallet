# B-2 全链路复盘摘要（H05 分层接线 → C 收口）

- 记录标识：`B2-FULL-CHAIN-RETROSPECTIVE-20261111-01`
- 基线：`BASE-V1.8-20261108`（本复盘为回顾性质，**不升级基线**）
- 撰写口径：用户侧总顾问离线复核（只汇总已封机器证据，不连库、不执行、不推断未观测事实）
- 当前结论：`C_COMPOSITE_PASS`（HTTP 15/15、Context 21/21）；D 未启动；3.3 仍 ◐、其余 43 表真实隔离 0/43

---

## 一、范围与口径

本次复盘覆盖 B-2 中 H05 分层验收的完整链路，共 **7 个真实窗口 + 3 个离线批次**：

1. 层1 首轮（失败）
2. 权限/签名审计（离线）
3. 目录最小补证（真实只读）
4. 统计可见性补丁（离线 → 真实落库）
5. 层1 复测（真实通过）
6. 层2 边界验收（真实通过）
7. C 收口六卡主批（14/15）→ H15 离线修订 → H15 补测（真实通过）

**继承不重跑**（全部保留原证据，不重复计分）：H01—H04、57 函数安装、密钥预置、两行 Customer 样本、`issuer_shared_context` 42702 替换修复、独立元数据核验 PASS、已应用迁移、20 表分类。

**C 是"具名复合覆盖"**：HTTP 15/15 = 既有 14 项 + 本批 H15；Context 21/21 = 本批 12 项 + 具名历史真实证据。不等于原 137/287 整套在单窗口/同池重跑，也不扩为 43 表行隔离验收。

---

## 二、执行时间线（真实窗口）

| # | 阶段 | 结果 | 关键消耗 | 证据 SHA256（节选） |
|---|---|---|---|---|
| 1 | 层1 首轮 `H05-LAYER1-NATIVE-FAILED-20261110-01` | ✗ 失败关窗 | 7 事务尝试 / 14 显式 SQL（app1/issuer6）；2 私源各读 1 次 | 封包 `6f56efd8…b1a5`；总控回执 `78349b84…61c6` |
| 2 | 权限/签名审计 `H05-PERMISSION-SIGNATURE-AUDIT-20261110-01` | 离线结论：根因未证实 | 数据库/私源/签名 0 | 报告 `f4db4f36…b986`；审计结果 `6eb7303e…eb0b` |
| 3 | 目录最小补证 `H05-ACL-METADATA-ACTUAL-20261110-01` | ✓ 只读成功，根因收敛 | 1 RO 事务 / 2 SQL / 1 次 `B2_ISSUER_URL` | 封包 `45d706ef…f2954`；报告 `267a9d42…d51e` |
| 4 | 统计可见性补丁离线 `H05-STATS-VISIBILITY-OFFLINE-20261110-01` | ✓ 离线独审 PASS_OFFLINE_ONLY | 数据库/私源/签名/HTTP/部署 0 | 封包 `19317241…ee99` |
| 5 | 补丁落库＋只读验收 `H05-STATS-VISIBILITY-APPLY-20261111-01` | ✓ 两阶段 exit0、COMMIT 确认 | 2 事务 / 11 顶层 SQL / 2 次 `DIRECT_URL` | 证据包 `0740d635…21c6` |
| 6 | 层1 复测 `H05-LAYER1-RETEST-ACTUAL-20261111-01` | ✓ `LAYER1_API_CONTEXT_PRODUCTION_CHAIN_PASS` | 10 事务 / 21 调度 SQL；2 私源各读 1 次；重试 0 | 封包 `25a9b65a…67e2` |
| 7 | 层2 边界 `H05-LAYER2-ACTUAL-20261111-01` | ✓ `LAYER2_API_CONTEXT_BOUNDARIES_PASS`，8 项反例全中 | 59 事务（48 issuer / 11 app）/ 122 dispatcher | 封包 `43f8cb0d…aa70` |
| 8 | C 收口主批 `C-CLOSEOUT-OFFLINE-20261111-01` | ◐ Context 12/12（累计 21/21），HTTP 14/15 | 78 事务 / 165 调度 SQL；3 私源读取 | 实际 `40cf8772…5813`；封包 `9e80d802…8468` |
| 9 | H15 离线修订 `H15-ONLY-OFFLINE-READY-20261111-01` | ✓ 18/18 | 无真实 HTTP/私源/日志 | 封包 `3c2f1b23…6e36` |
| 10 | H15 补测 `C-COMPOSITE-PASS-H15-ACTUAL-20261111-01` | ✓ 单次 POST 通过、独审通过 | 1 请求；私源/显式 SQL/日志/重试 0 | 最终封包 `f591cb11…c28a` |

---

## 三、卡点一：层1 首轮 `28000 / P2010`

**现象**：`API_CLIENT_PRODUCTION_CHAIN → ISSUE → RUNTIME_ISSUE`，`queryResolved=false`，阶段 `NATIVE_STATEMENT_FAILED`；SQLSTATE `28000`、Prisma `P2010`；外/内退出码均 1。
- 窗口 22:47:36.213—23:47:36.213（CST），**22:51:21.259 提前关窗**；余量作废、不复用。
- `consume / reader / close` 均未发出；**保护状态前缀可能已持久化，实际增改行数未独立读取**（未把 5 增 4 改预算当已发生）。

**排除路径**：
- 不是本地 A 身份断言失败；非 42702 语法/歧义列问题。
- 不是缺 EXECUTE —— 补证实测 `issuer EXECUTE=true`、`app/PUBLIC=false`、schema USAGE 正常，owner/SECDEF/definition 摘要全部匹配基线。
- 签名链 18 项字段、13 组拒绝条件静态对齐（UTF8 / SHA256 HMAC / lowerhex / owned-key 复制清除顺序），**未发现确定可修的 HMAC 或字段缺陷**；实际 payload/signature/signer/clock 未留存，不重构旧私源。

**根因收敛**：目录补证实测 `fastlink_identity superuser=false`，`pg_read_all_stats` 与 app 角色 effective USAGE 均为 false；与已审源码中"活动事务 `xact_start` 守卫"合看 → **跨角色 `pg_stat_activity` 统计可见性前提缺口确认**。
> 诚实边界：未读 stats 行，**旧 28000 最先命中的是哪一条内部守卫仍未逐条还原**；补证的目录 PASS 不等于 context 正例 PASS。

**修复设计（关键取舍）**：
- ❌ 不给 issuer 授 `pg_read_all_stats` / 不开放全局统计视图（高危，直接放弃）
- ✅ 新建 postgres 属主的 `fl_context_guard` schema + `target_app_transaction_active(integer) → boolean` SECURITY DEFINER helper，**`issuer_shared_context` 仅改一行**（activity 判断改为调用 helper）
- ✅ 签名 / 租户 / nonce / 有效期 / PID / XID / 写入规则逐字继承，不动
- ✅ helper 只返回固定 PID 的会话事务活跃性，不暴露其他会话或全局统计；空值直接拒绝
- ✅ 防绕过守卫：若目标账号可经角色成员关系提权到高属主，迁移即中止
- ✅ 精确 rollback 只删本次新增对象，不批量删除历史对象

**验证**：离线首轮 31 项中 29 PASS、2 项扫描误判，修正扫描方法后定向 2/2 通过（原件保留、SQL/model 未改、旧测试不重跑）；真实落库 2 事务 / 11 顶层 SQL，两阶段 exit0 + COMMIT 确认。

---

## 四、卡点二：H15 `ORIGIN_EXACT_JSON`

**现象**：HTTP 403、request/response Trace 均为 `C-CLOSEOUT-20261111-01-H15_ORIGIN_DENIED`，但**精确 JSON 断言失败**；响应正文未留存，具体不符字段与实际拒绝路径 UNKNOWN。

**处置原则**：**不由 403 单独反推根因，也不据此判通过**；不回读旧私源/日志补正文。

**修订**：新增独立 H15 验收器，严格区分源码已定义的两种 403 合同：
- CORS 中间件 403（三字段）
- OriginGuard 403（四字段）
并要求固定 Trace、**无 Set-Cookie**；未知 403 仍判失败。18/18 合成测试通过、9/9 输入 SHA 前后匹配。

**补测**：`2026-11-11T03:28:33.348Z—03:28:33.851Z` 单次 `POST /api/v1/auth/login`，固定拒绝 Origin + 公开合成无效凭据 → 403 精确命中 `CORS_MIDDLEWARE_FORBIDDEN` 三字段合同，Trace 精确 MATCH，无 Set-Cookie、无重定向，内外退出码 0；批准窗 `03:25:11.864Z—04:25:11.864Z`，实际关窗 `03:29:50.729314Z`。

---

## 五、资源账（B-2 真实消耗汇总）

| 维度 | 累计 | 说明 |
|---|---|---|
| 真实窗口 | 5 个（含 1 个失败窗） | 失败窗额度作废，不重放 |
| 事务 | 约 157（7+1+2+10+59+78） | 含失败窗 7 次尝试、层2 59、C 主批 78 |
| 显式/调度 SQL | 约 323（14+2+11+21+122+165） | 口径为调度 SQL，不含 Prisma 事务控制与函数内部 SQL |
| 私源读取 | 各批 1—3 次 | 均内存读取，原文不落盘、不输出、不 hash |
| 重试 / 重放 | **0** | 全部失败即关窗 |
| 生产/资金/Provider/Gate1/部署 | **0** | 全程冻结 |

**未观测项（不填假精确值）**：layer1 首轮前缀实际增改行数；H08—H14 独立响应正文/cookie 副本；wire ACK；HTTP 内部 SQL；触发器/全局实际行数；旧 28000 命中的具体内部守卫。

---

## 六、结论与后续

1. **C（H05）正式收口**：`C_COMPOSITE_PASS`，HTTP 15/15、Context 21/21，独立复核通过，证据封包 `f591cb11…c28a`（27 项文件 SHA 全 MATCH）。
2. **基线不升级**：仍为 `BASE-V1.8-20261108`；3.3 保持 ◐、其余 43 表真实隔离 0/43；3.6 未完成。
3. **D 未启动**，需另提离线方案 + 测试封包 + 双卡草案，重新走预审裁定；`/api/sandbox/ping` 旧分支保持冻结、不再复活。
4. **遗留挂账**：历史 open Issue（6 条评论、无 assignee、无新增维护者回复），单独跟踪，不并入验收闸门。
5. **冻结不变**：B API、资金、真实 Provider、生产、Gate1、部署。

---

## 七、可复用经验

1. **权限类 28000 先分域审计，再决定是否补权**：先分清"缺 EXECUTE""签名/入参校验""跨角色可见性"三类分支，避免直接 `GRANT` 掩盖真因（本次 GRANT 假设被实物证据否定）。
2. **统计视图跨角色可见性，用 SECDEF 受限 helper 代理**，不要给业务角色开放 `pg_read_all_stats` 或全局统计视图。
3. **失败即关窗、额度作废、不重放**：失败窗即使只跑了几秒也不续跑，避免 nonce/usage 脏数据累积与状态不可判定。
4. **单卡单动作 + 严格顺序断言**：正例必须先于撤销执行；Admin 前置不通过不得进入主批。
5. **验收器断言失败但 Trace 匹配时，先修验收合同，不猜根因**：本次 H15 即由"合同未区分两类 403"导致，修正器后一次补测即通过。
6. **补丁设计必须自带精准 rollback**：只删本次新增对象，不做批量删除，不破坏既有基线。
7. **离线通过 ≠ 真实通过**：合成测试只证明能力就绪，真实 UAT 回执才计入验收勾选。
