# 正式消息原文留存

来源：总控对话 `019fa6b7-4f28-7b62-b676-757be88c22f8`，turn `01a0fcfd-3775-7e21-b1ce-9112cc591799`；接收端：整理代码执行对话。项目所有者授权由总控转达/作出决策，不伪称代码执行端自行批准。

以下正文按协调消息逐字留存。历史用语若与后续纠正冲突，由02/03文件追加承接，禁止据旧表述扩大B端权限。

<!-- ORIGINAL-BEGIN -->
【标准化工单｜FL-DB-007｜P0｜项目所有者正式权限决策固化】
前置：FL-DB-006门禁5闭环。项目所有者现正式授权总控依据FastLink产品定位作出54表业务权限、字段/状态、平台管理员例外、后台任务边界决策。
产品定位：①平台自营C端钱包及管理后台；②多租户平台，对第三方提供的IPA/API采用可插拔适配器；③面向B端OEM/ODM白标客户提供标准IPA/API及授权式租户后台。

本工单仅把下述正式决策映射到54表治理契约并形成审计记录，不实施业务代码、SQL、迁移、JWT、GRANT/RLS或环境变更。门禁1前仅首次回执，不创建分支/文件/PR。

一、顶层正式决策
1. C端自营业务必须建模为“平台自营租户”，不得使用tenantId=NULL、全局可见或平台管理员旁路。B端每个OEM/ODM为独立租户；所有客户、钱包、卡、交易、商户、供应商配置均同时绑定tenant＋environment。
2. 外部USER/TENANT_ADMIN/API Client不直接连接数据库；其CRUD是经服务端认证与可信事务身份后得到的“有效业务权限”。BACKEND_RUNTIME不得拥有无主体的全租户通权；MIGRATION_OWNER只做DDL，禁止应用登录。
3. tenant/environment、主体/owner FK、id、createdAt、外部供应商ID、幂等键、账本金额/币种、journalIds等均创建后不可由外部角色修改。updatedAt/version/租约/计数由系统维护。
4. 密码、token/CSRF/API key/PIN哈希、Secret引用、完整provider payload/callback raw、PAN/CVV/PIN、内部错误和审计原始metadata禁止返回USER/TENANT_ADMIN；秘密只在专用broker/adapter中使用。
5. 资金、审计、供应商事件默认追加式：普通角色不得UPDATE/DELETE；修正使用状态机、冲正/退款/补偿记录，不覆写或物理删除历史。
6. 所有环境字段不可跨环境更新；SANDBOX/TEST/PRODUCTION不得通过UPDATE晋升。生产启用、真实资金和供应商操作仍需独立门禁4。

二、54表策略分组（必须逐表展开为54项正式记录，不得只保留分组）
P1 身份秘密/会话：AdminSession、ApiKey、CardSecurityProfile、EndUserRefreshToken、EndUserSession。
P2 API与RBAC：ApiClient、Permission、Role、RolePermission、TenantUser、TenantUserRole。
P3 追加审计/事件：AuditLog、EvidenceArtifact、CardEvent、CardLifecycleEvent、WebhookEvent、third_party_callback_events。
P4 客户主体：Customer。
P5 卡域：Card、CardBalance、CardHolder、CardLimit、CardRenewal、CardReplacement、CardRestriction、CardTransaction、ucard_card_base、ucard_transactions。
P6 钱包/账本/资金：FxConversion、FxOrder、FxRate、Journal、JournalEntry、TreasuryPosition、WalletAccount、WalletOperation、WalletTransaction、third_party_asset_orders。
P7 商户/结算：Merchant、MerchantPayment、MerchantQrCode、SettlementBatch、SettlementItem。
P8 模拟：SimulationRecord、SimulationScenario。
P9 租户根：Tenant。
P10 供应商适配器：ProviderOperation、TenantCardProviderConfig、tenant_third_party_config。
P11 提款地址：WithdrawalAddress。
P12 旧资金隔离区：treasury_accounts、treasury_fx_orders、treasury_operation_logs、treasury_settlements。

三、角色正式边界
USER：仅本人且本租户/环境对象；可读安全投影，可发起业务命令；不得直接写状态、余额、账本、供应商或身份秘密。
TENANT_ADMIN：仅本租户；管理白标品牌、员工、预定义角色分配、API client/scopes子集、商户和非秘密供应商配置请求；可查本租户脱敏运营/财务视图；不得跨租户、查看秘密、直接改余额/账本/卡交易或提升自身至平台角色。
PLATFORM_ADMIN：默认无数据库跨租户通权。跨租户仅经JIT broker：必须caseId、目标tenant、purpose、操作者、批准者、有效期；普通JIT最长60分钟且默认只读。生产资金/账本、KYC否决覆盖、租户关闭、供应商生产启用等写操作需双人审批；break-glass最长30分钟、只允许明确定义命令并在24小时内复核。任何平台管理员都不得直接修改金额、余额、journal或秘密。
BACKGROUND_TASK：按任务拆分服务身份（scheduler、provider-adapter、webhook、ledger、settlement、retention、audit），不得共用全能角色。scheduler只读最小到期队列投影；worker一次只绑定一个tenant/environment/purpose，使用短时事务身份，幂等＋租约；只能执行批准状态边。retention不得删除资金/账本/审计历史，仅可按另行批准保留期清理已过期会话/令牌/临时证据。
BACKEND_RUNTIME：共享连接仅承载已验证主体/任务的事务，不自行选择tenant，不得SET ROLE至issuer/owner，不得绕过RLS；认证bootstrap、issuer、业务runtime分权。
MIGRATION_OWNER：NOLOGIN/非应用凭据；仅门禁批准的迁移窗口执行DDL/策略，禁止业务DML及运行时继承。

四、字段白名单正式决策
P1：外部仅可看会话元数据(id、createdAt、expires/lastSeen、revoked状态、设备脱敏标签)并发起本人撤销；hash、失败计数、锁定/PIN数据仅broker可用。INSERT/轮换/lastUsed/撤销由认证服务；物理DELETE仅retention且需保留期工单。
P2：TenantAdmin可管理ApiClient.name、批准scopes子集、isActive；clientId/tenant/environment固定。ApiKey只显示prefix/创建/到期/撤销元数据，keyHash永不返回，密钥只在创建时一次性返回。TenantUser可改email、isActive；passwordHash只经认证broker。TenantUserRole仅可授予平台标记assignable的预定义租户角色，startsAt/expiresAt/grantReason可写，roleId/tenantUserId创建后固定，撤销只写revokedAt；Role/Permission/RolePermission为平台安全目录，只能通过变更审批维护，租户只读可分配子集。
P3：只允许BACKEND_RUNTIME/BACKGROUND_TASK追加；USER仅可通过领域API读取本人卡/订单事件安全投影，TenantAdmin读取本租户脱敏投影，PlatformAdmin按JIT读取。request/response/payload/raw metadata/IP/user-agent/内部错误默认不返回；不得UPDATE/DELETE，纠错追加新事件。
P4 Customer：USER读本人安全字段并仅改email、firstName、lastName；密码经broker，tenant/id/environment/externalUserId/providerCustomerRef/kyc/auth计数不可直接改。KYC仅合规命令可改；TenantAdmin本租户只读脱敏并可发起审核，PlatformAdmin仅JIT合规命令；不物理删除，注销用isActive=false＋会话撤销＋保留流程。
P5：USER读本人卡安全投影(maskedPan/last4/expiry/currency/alias/status/限额/余额)，仅alias可直接改，其余通过activate/freeze/unfreeze/close/limit/PIN/replace/renew命令。CardHolder.profile在形成字段schema前禁止任意JSON直写；CardSecurityProfile永不直接暴露。TenantAdmin本租户读脱敏卡并执行获批运营命令；余额、交易金额、provider字段、状态事件仅adapter/ledger任务写。事件/交易不删不覆写，CardLimit数值须受平台上限和版本并发控制。
P6：USER读本人钱包、余额及交易安全投影并可发起deposit/transfer/withdraw/FX等命令；不得直接INSERT/UPDATE/DELETE资金表。TenantAdmin只读本租户聚合/对账及发起批准运营流程。金额、币种、账户归属、幂等键、journal、posted/pending余额创建后只由ledger状态机/原子记账修改；Journal/Entry追加，冲正新建记录。Treasury仅平台资金任务和双人审批命令；任何角色不得直接改余额。
P7：TenantAdmin可管理本租户Merchant的name/mcc/settlementAssetCode及ACTIVE↔SUSPENDED，CLOSED终态；支付/结算金额及journal不可改。USER可创建/读取本人支付并读取有效二维码安全投影；支付、批次、明细由ledger/settlement任务推进，禁止删除和覆写历史。
P8：仅SANDBOX/TEST且按租户；PRODUCTION明确拒绝。TenantAdmin可在本租户创建/重置获批场景，USER仅在获准沙箱读取自身模拟结果；任务写记录。模拟数据不得作为正式资金证据。
P9 Tenant：TenantAdmin读取本租户并仅直接改brandName；legalName/slug需平台审核命令，status/environment不可由租户改。平台onboarding可创建；状态由平台双人命令管理；CLOSED不删除且不得复活。平台自营C端也是普通Tenant记录。
P10：TenantAdmin读取非秘密provider/status/capabilities/rollout摘要并提交配置请求；不能读credentialSecretRef/mtlsCertificateRef/webhookSecretRef、原始providerSettings或秘密。PlatformAdmin＋安全审批启用生产provider/rollout；adapter任务按单tenant/environment/provider读取解析后的最小配置并写ProviderOperation状态。ProviderOperation请求/响应原文仅adapter/审计，租户只看脱敏结果；无删除。
P11：USER对本人地址可SELECT/INSERT；创建时tenant/customer/environment由可信上下文注入，可提交assetCode/networkId/address/label/isDefault。创建后asset/network/address/归属不可变，仅label/isDefault可改；DELETE仅未被未完成订单引用且经服务检查，优先停用模型，若当前schema无停用字段则物理删除保持BLOCKED直至补字段/契约。TenantAdmin仅本租户脱敏只读，不能代改地址。
P12：四张旧treasury表正式决定为QUARANTINED_DENY：所有运行角色无访问；仅迁移owner可在专项目录处置工单中读取目录/迁移。不得纳入正式RLS实施或资金功能，直到资产归属、模型映射和保留/迁移决定另行批准。

五、状态转换正式决策
- environment、type、provider、direction、accountClass、purpose、side、reason/source/category等分类字段创建后不可变（provider配置的provider也不可变；更换建新配置）。
- Tenant：ACTIVE↔SUSPENDED；ACTIVE/SUSPENDED→CLOSED；CLOSED终态。
- KYC：PENDING→APPROVED/REJECTED；REJECTED→PENDING仅新材料重审；APPROVED→PENDING仅双人合规复审；不得直接APPROVED↔REJECTED。
- Card/ucard：PENDING→ACTIVE/FAILED/CLOSED；ACTIVE→FROZEN/CLOSED；FROZEN→ACTIVE/CLOSED；FAILED/CLOSED终态。transitionTargetStatus只作带租约命令内部字段。
- CardTransaction/MerchantPayment：AUTHORIZED→CLEARED/DECLINED/REVERSED；CLEARED→SETTLED/REVERSED；SETTLED→REFUNDED/REVERSED；DECLINED/REVERSED/REFUNDED终态；每次变更须事件和幂等证据。
- FxConversion/WalletOperation：PROCESSING→PENDING_SETTLEMENT/COMPLETED/FAILED；PENDING_SETTLEMENT→COMPLETED/FAILED；终态不回退。
- FxOrder：QUOTED→COMPLETED/FAILED/EXPIRED，终态不回退。
- Journal：POSTED→REVERSED；REVERSED终态，冲正必须新journal/entries。
- Merchant：ACTIVE↔SUSPENDED；任一→CLOSED；CLOSED终态。
- MerchantQrCode：ACTIVE→PAID/EXPIRED/CANCELLED，终态不回退。
- ProviderOperation：PENDING→UNKNOWN/SUCCEEDED/FAILED；UNKNOWN仅经对账证据→SUCCEEDED/FAILED，不回PENDING；重试建新attempt/记录。
- SettlementBatch：OPEN→PROCESSING→COMPLETED/FAILED；SettlementItem：PENDING→COMPLETED/FAILED；终态不回退。
- Provider config：CONTRACT_ONLY→DISABLED/ENABLED；ENABLED↔DISABLED；生产ENABLED需双人审批。rollout SHADOW→CANARY→LIMITED→FULL，允许因风险逐级回退并审计，禁止跨级放量。
- WalletAccount：ACTIVE↔FROZEN；ACTIVE/FROZEN→CLOSED；CLOSED终态。
- WalletTransaction/ucard_transactions：PENDING→COMPLETED/FAILED；COMPLETED→REVERSED；FAILED/REVERSED终态。
- WebhookEvent：RECEIVED→PROCESSING→PROCESSED/RETRYING/DEAD_LETTER；RETRYING→PROCESSING/DEAD_LETTER；PROCESSED/DEAD_LETTER终态，人工重放创建新attempt。
- third_party_asset_orders：CREATED→PENDING/MANUAL_REVIEW/FAILED；PENDING→CONFIRMED/FAILED/MANUAL_REVIEW；MANUAL_REVIEW→PENDING/CONFIRMED/FAILED；CONFIRMED→REVERSED；FAILED/REVERSED终态。
- 会话/token/api key/restriction撤销或消费字段均单向NULL→timestamp，不能清空恢复；重新授权创建新记录。

六、治理要求
新工单只固化决策，不实施。必须把54项从BLOCKED/UNKNOWN更新为OWNER_APPROVED_POLICY（不是RLS VERIFIED），逐表列有效角色、CRUD、字段、状态和profile；保留所有旧状态和生成时0 VERIFIED原文，由追加决策承接。若现有schema无法满足决策（如WithdrawalAddress无停用字段、CardHolder.profile无schema、旧treasury表），记录实施BLOCKED，不降低决策完整性。

首次回执必须说明：如何把以上分组展开到54表、如何验证无遗漏/冲突、哪些schema差距导致实施BLOCKED、拟交付文件、基线与禁止重复、工具/权限。门禁1前不得创建分支/文件/PR。建议工单名FL-DB-007｜54表业务权限正式决策固化｜P0；仅治理目录docs/governance/FL-DB-007/。
<!-- ORIGINAL-END -->
