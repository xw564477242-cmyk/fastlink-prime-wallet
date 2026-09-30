# 对象、权限、RLS覆盖矩阵

以下是隔离重建目录，不是生产目录。bootstrap owner仅初始化和审计；所有访问用例通过独立TCP会话的非owner、非superuser、无BYPASSRLS角色执行，session_user=current_user。原始目录快照在添加测试角色/夹具授权之前获取。

| 对象 | 默认32步完整 | UAT前31步 |
|---|---:|---:|
| public表（包含迁移台账） |55|54|
| 业务表 |54|53|
| 含tenantId/tenant_id的表 |38|37|
| 开启RLS/FORCE |0/0|6/6|
| 策略 |0|13|
| 应用view/materialized view |0/0|0/0|
| 应用function/procedure |0/0|0/0|
| 用户trigger |0|0|
| 内部FK trigger |312|308|
| 显式default privilege条目 |0|0|
| 扩展 |plpgsql|plpgsql|

本地对象枚举覆盖55/55及54/54；策略枚举13/13，实测Customer 3种已授权操作与未授权DELETE。不能把单表动态测试扩展成全部54业务表/全部API验证。应用视图和函数为零仅在本地目录成立。开发分支、实际部署扩展/动态DDL及暴露配置未覆盖。

| 角色类别 | 已有依据/本轮测试 | 边界及结论 |
|---|---|---|
| anonymous | 无授予表权限的合成LOGIN角色，55表无有效DML | 8次拒绝；不是生产角色确认 |
| authenticated/tenant user | 两个合成直连角色显式授予Customer/Tenant DML | 模拟错误直连授权，默认库跨租户可达；非已发现生产GRANT |
| tenant admin | 无正式角色映射 | BLOCKED，不能推定数据库权限 |
| platform admin | 业务跨租户权限未确认 | BLOCKED，不判PASS |
| backend/service | 原UAT角色fastlink_uat_app（只设置隔离登录口令） | 16/54表有部分DML；逐表见effective证据；后端是租户控制点 |
| owner/superuser | fl_db001_owner用于建库、迁移、夹具初始化和目录读取 | 不用于RLS通过证明 |

GRANT与RLS分别检查：有表授权不等于行授权；public schema不等于公开Data API。默认ACL无显式条目不等于PUBLIC函数EXECUTE已被收紧。UAT策略命令计数SELECT6、INSERT4、UPDATE3，表达式全部true，角色限后端。UPDATE同时检查SELECT可见性、USING和WITH CHECK；缺省WITH CHECK可能继承USING，不能仅凭省略就报漏洞。

| 表 | 默认RLS | UAT RLS/FORCE | UAT策略操作 |
|---|---|---|---|
| `AdminSession` | 否 | 否/否 | 无 |
| `ApiClient` | 否 | 否/否 | 无 |
| `ApiKey` | 否 | 否/否 | 无 |
| `AuditLog` | 否 | 否/否 | 无 |
| `Card` | 否 | 否/否 | 无 |
| `CardBalance` | 否 | 否/否 | 无 |
| `CardEvent` | 否 | 否/否 | 无 |
| `CardHolder` | 否 | 否/否 | 无 |
| `CardLifecycleEvent` | 否 | 否/否 | 无 |
| `CardLimit` | 否 | 否/否 | 无 |
| `CardRenewal` | 否 | 否/否 | 无 |
| `CardReplacement` | 否 | 否/否 | 无 |
| `CardRestriction` | 否 | 否/否 | 无 |
| `CardSecurityProfile` | 否 | 否/否 | 无 |
| `CardTransaction` | 否 | 否/否 | 无 |
| `Customer` | 否 | 是/是 | INSERT,SELECT,UPDATE |
| `EndUserRefreshToken` | 否 | 是/是 | INSERT,SELECT,UPDATE |
| `EndUserSession` | 否 | 是/是 | INSERT,SELECT,UPDATE |
| `EvidenceArtifact` | 否 | 否/否 | 无 |
| `FxConversion` | 否 | 否/否 | 无 |
| `FxOrder` | 否 | 否/否 | 无 |
| `FxRate` | 否 | 否/否 | 无 |
| `Journal` | 否 | 否/否 | 无 |
| `JournalEntry` | 否 | 否/否 | 无 |
| `Merchant` | 否 | 否/否 | 无 |
| `MerchantPayment` | 否 | 否/否 | 无 |
| `MerchantQrCode` | 否 | 否/否 | 无 |
| `Permission` | 否 | 否/否 | 无 |
| `ProviderOperation` | 否 | 否/否 | 无 |
| `Role` | 否 | 否/否 | 无 |
| `RolePermission` | 否 | 否/否 | 无 |
| `SettlementBatch` | 否 | 否/否 | 无 |
| `SettlementItem` | 否 | 否/否 | 无 |
| `SimulationRecord` | 否 | 是/是 | SELECT |
| `SimulationScenario` | 否 | 是/是 | SELECT |
| `Tenant` | 否 | 是/是 | INSERT,SELECT |
| `TenantCardProviderConfig` | 否 | 未建立 | 无 |
| `TenantUser` | 否 | 否/否 | 无 |
| `TenantUserRole` | 否 | 否/否 | 无 |
| `TreasuryPosition` | 否 | 否/否 | 无 |
| `WalletAccount` | 否 | 否/否 | 无 |
| `WalletOperation` | 否 | 否/否 | 无 |
| `WalletTransaction` | 否 | 否/否 | 无 |
| `WebhookEvent` | 否 | 否/否 | 无 |
| `WithdrawalAddress` | 否 | 否/否 | 无 |
| `_prisma_migrations` | 否 | 否/否 | 无 |
| `tenant_third_party_config` | 否 | 否/否 | 无 |
| `third_party_asset_orders` | 否 | 否/否 | 无 |
| `third_party_callback_events` | 否 | 否/否 | 无 |
| `treasury_accounts` | 否 | 否/否 | 无 |
| `treasury_fx_orders` | 否 | 否/否 | 无 |
| `treasury_operation_logs` | 否 | 否/否 | 无 |
| `treasury_settlements` | 否 | 否/否 | 无 |
| `ucard_card_base` | 否 | 否/否 | 无 |
| `ucard_transactions` | 否 | 否/否 | 无 |
