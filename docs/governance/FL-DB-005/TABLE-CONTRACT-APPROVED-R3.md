# 52表正式默认拒绝契约 R3

批准原文：OWNER-CONTRACT-APPROVAL-R3.md。原R2逐表/分组建议及BLOCKED历史保留；它们不再作为当前待启用权限清单。R3只承接契约明确性，未知业务归属、服务可用性和52表正向路径未被证明。

唯一正向例外：USER读取本人Customer、TENANT_ADMIN读取本租户Customer、USER对本人WithdrawalAddress受控CRUD。其余52表对所有应用运行身份均拒绝CRUD；后续正向权限只能通过FL-DB-006逐项批准。

| ID | 表 | 模块 | SELECT | INSERT | UPDATE | DELETE | 批准状态 |
|---|---|---|---|---|---|---|---|
| DB5-CONTRACT-001 | AdminSession | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-002 | ApiClient | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-003 | ApiKey | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-004 | AuditLog | 审计/事件/供应商调用 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-005 | Card | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-006 | CardBalance | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-007 | CardEvent | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-008 | CardHolder | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-009 | CardLifecycleEvent | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-010 | CardLimit | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-011 | CardRenewal | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-012 | CardReplacement | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-013 | CardRestriction | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-014 | CardSecurityProfile | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-015 | CardTransaction | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-016 | EndUserRefreshToken | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-017 | EndUserSession | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-018 | EvidenceArtifact | 审计/事件/供应商调用 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-019 | FxConversion | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-020 | FxOrder | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-021 | FxRate | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-022 | Journal | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-023 | JournalEntry | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-024 | Merchant | 商户/结算 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-025 | MerchantPayment | 商户/结算 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-026 | MerchantQrCode | 商户/结算 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-027 | Permission | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-028 | ProviderOperation | 审计/事件/供应商调用 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-029 | Role | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-030 | RolePermission | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-031 | SettlementBatch | 商户/结算 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-032 | SettlementItem | 商户/结算 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-033 | SimulationRecord | 模拟场景 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-034 | SimulationScenario | 模拟场景 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-035 | Tenant | 租户根 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-036 | TenantCardProviderConfig | 供应商配置 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-037 | TenantUser | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-038 | TenantUserRole | 身份/权限 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-039 | TreasuryPosition | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-040 | WalletAccount | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-041 | WalletOperation | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-042 | WalletTransaction | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-043 | WebhookEvent | 审计/事件/供应商调用 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-044 | tenant_third_party_config | 供应商配置 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-045 | third_party_asset_orders | 账本/钱包/资金 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-046 | third_party_callback_events | 审计/事件/供应商调用 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-047 | treasury_accounts | 旧资金目录 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-048 | treasury_fx_orders | 旧资金目录 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-049 | treasury_operation_logs | 旧资金目录 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-050 | treasury_settlements | 旧资金目录 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-051 | ucard_card_base | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |
| DB5-CONTRACT-052 | ucard_transactions | 卡 | DENY | DENY | DENY | DENY | APPROVED_DEFAULT_DENY |

逐项归属依据、敏感字段名、间接访问及历史记录映射见evidence/52-table-approved-contract-r3.json。所有运行身份包括普通用户、租户Admin、平台Admin、服务/任务；数据库初始化owner的管理能力不作为业务可用性或RLS安全证明。票据签发方只有既有专用函数权限，不获得52表通用DML。

T08～T15继续LIMITED，实际服务Prisma/JWT/任务集成仍BLOCKED，52表业务能力未启用。10个schema-only及4个catalog-only差异继续STALE，54表分母不变。资金硬前置仍有效。
