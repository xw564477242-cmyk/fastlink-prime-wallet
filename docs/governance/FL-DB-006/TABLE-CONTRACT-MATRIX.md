# 54表正式权限契约矩阵（设计稿）

正式业务契约 VERIFIED 0 / UNKNOWN 7 / BLOCKED 47。54/54均有结论；覆盖率100%只指登记完整，不代表权限验收通过。52表默认拒绝及2表正向例外均为历史隔离口径。每表6角色×4操作共1296个正式操作单元全部待批准。

逐字段、6角色CRUD、代码调用位置、状态字段、责任角色及决策见TABLE-CONTRACTS.json、OPERATION-MATRIX.csv、DECISION-QUEUE.json。

| ID | 表 | 归属类别 | 正式契约 | 源调用候选数 | 决策 |
|---|---|---|---|---:|---|
| DB6-TABLE-001 | AdminSession | indirect-tenant | BLOCKED | 5 | DB6-DEC-001 |
| DB6-TABLE-002 | ApiClient | direct-tenant | BLOCKED | 5 | DB6-DEC-002 |
| DB6-TABLE-003 | ApiKey | indirect-tenant | BLOCKED | 6 | DB6-DEC-003 |
| DB6-TABLE-004 | AuditLog | direct-tenant | BLOCKED | 32 | DB6-DEC-004 |
| DB6-TABLE-005 | Card | direct-tenant | BLOCKED | 54 | DB6-DEC-005 |
| DB6-TABLE-006 | CardBalance | indirect-tenant | BLOCKED | 11 | DB6-DEC-006 |
| DB6-TABLE-007 | CardEvent | direct-tenant | BLOCKED | 16 | DB6-DEC-007 |
| DB6-TABLE-008 | CardHolder | direct-tenant | BLOCKED | 2 | DB6-DEC-008 |
| DB6-TABLE-009 | CardLifecycleEvent | direct-tenant | BLOCKED | 23 | DB6-DEC-009 |
| DB6-TABLE-010 | CardLimit | indirect-tenant | BLOCKED | 6 | DB6-DEC-010 |
| DB6-TABLE-011 | CardRenewal | direct-tenant | BLOCKED | 3 | DB6-DEC-011 |
| DB6-TABLE-012 | CardReplacement | direct-tenant | BLOCKED | 3 | DB6-DEC-012 |
| DB6-TABLE-013 | CardRestriction | direct-tenant | BLOCKED | 6 | DB6-DEC-013 |
| DB6-TABLE-014 | CardSecurityProfile | indirect-tenant | BLOCKED | 1 | DB6-DEC-014 |
| DB6-TABLE-015 | CardTransaction | direct-tenant | BLOCKED | 25 | DB6-DEC-015 |
| DB6-TABLE-016 | Customer | direct-tenant | BLOCKED | 26 | DB6-DEC-016 |
| DB6-TABLE-017 | EndUserRefreshToken | indirect-tenant | BLOCKED | 6 | DB6-DEC-017 |
| DB6-TABLE-018 | EndUserSession | direct-tenant | BLOCKED | 9 | DB6-DEC-018 |
| DB6-TABLE-019 | EvidenceArtifact | direct-tenant | BLOCKED | 5 | DB6-DEC-019 |
| DB6-TABLE-020 | FxConversion | direct-tenant | BLOCKED | 4 | DB6-DEC-020 |
| DB6-TABLE-021 | FxOrder | direct-tenant | BLOCKED | 0 | DB6-DEC-021 |
| DB6-TABLE-022 | FxRate | direct-tenant | BLOCKED | 1 | DB6-DEC-022 |
| DB6-TABLE-023 | Journal | direct-tenant | BLOCKED | 15 | DB6-DEC-023 |
| DB6-TABLE-024 | JournalEntry | direct-tenant | BLOCKED | 1 | DB6-DEC-024 |
| DB6-TABLE-025 | Merchant | direct-tenant | BLOCKED | 8 | DB6-DEC-025 |
| DB6-TABLE-026 | MerchantPayment | direct-tenant | BLOCKED | 23 | DB6-DEC-026 |
| DB6-TABLE-027 | MerchantQrCode | direct-tenant | BLOCKED | 4 | DB6-DEC-027 |
| DB6-TABLE-028 | Permission | platform-or-unresolved | UNKNOWN | 1 | DB6-DEC-028 |
| DB6-TABLE-029 | ProviderOperation | direct-tenant | BLOCKED | 47 | DB6-DEC-029 |
| DB6-TABLE-030 | Role | platform-or-unresolved | UNKNOWN | 1 | DB6-DEC-030 |
| DB6-TABLE-031 | RolePermission | platform-or-unresolved | UNKNOWN | 1 | DB6-DEC-031 |
| DB6-TABLE-032 | SettlementBatch | direct-tenant | BLOCKED | 2 | DB6-DEC-032 |
| DB6-TABLE-033 | SettlementItem | indirect-tenant | BLOCKED | 0 | DB6-DEC-033 |
| DB6-TABLE-034 | SimulationRecord | direct-tenant | BLOCKED | 8 | DB6-DEC-034 |
| DB6-TABLE-035 | SimulationScenario | direct-tenant | BLOCKED | 6 | DB6-DEC-035 |
| DB6-TABLE-036 | Tenant | tenant-root | BLOCKED | 16 | DB6-DEC-036 |
| DB6-TABLE-037 | TenantCardProviderConfig | direct-tenant | BLOCKED | 5 | DB6-DEC-037 |
| DB6-TABLE-038 | TenantUser | direct-tenant | BLOCKED | 3 | DB6-DEC-038 |
| DB6-TABLE-039 | TenantUserRole | indirect-tenant | BLOCKED | 1 | DB6-DEC-039 |
| DB6-TABLE-040 | TreasuryPosition | direct-tenant | BLOCKED | 32 | DB6-DEC-040 |
| DB6-TABLE-041 | WalletAccount | direct-tenant | BLOCKED | 62 | DB6-DEC-041 |
| DB6-TABLE-042 | WalletOperation | direct-tenant | BLOCKED | 52 | DB6-DEC-042 |
| DB6-TABLE-043 | WalletTransaction | direct-tenant | BLOCKED | 24 | DB6-DEC-043 |
| DB6-TABLE-044 | WebhookEvent | direct-tenant | BLOCKED | 15 | DB6-DEC-044 |
| DB6-TABLE-045 | WithdrawalAddress | direct-tenant | BLOCKED | 10 | DB6-DEC-045 |
| DB6-TABLE-046 | tenant_third_party_config | direct-tenant | BLOCKED | 4 | DB6-DEC-046 |
| DB6-TABLE-047 | third_party_asset_orders | direct-tenant | BLOCKED | 18 | DB6-DEC-047 |
| DB6-TABLE-048 | third_party_callback_events | direct-tenant | BLOCKED | 11 | DB6-DEC-048 |
| DB6-TABLE-049 | treasury_accounts | platform-or-unresolved | UNKNOWN | 0 | DB6-DEC-049 |
| DB6-TABLE-050 | treasury_fx_orders | platform-or-unresolved | UNKNOWN | 0 | DB6-DEC-050 |
| DB6-TABLE-051 | treasury_operation_logs | platform-or-unresolved | UNKNOWN | 0 | DB6-DEC-051 |
| DB6-TABLE-052 | treasury_settlements | platform-or-unresolved | UNKNOWN | 0 | DB6-DEC-052 |
| DB6-TABLE-053 | ucard_card_base | direct-tenant | BLOCKED | 6 | DB6-DEC-053 |
| DB6-TABLE-054 | ucard_transactions | direct-tenant | BLOCKED | 2 | DB6-DEC-054 |

归属链只是结构证据，不证明用户身份可信或权限应当授予。enum取值不是状态转换许可；data字段不是写入白名单；未找到调用也不证明对象无人使用。四张catalog-only旧表必须由资产所有者确认来源，不自行增加模型或迁移。
