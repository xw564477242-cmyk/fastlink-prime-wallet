# 字段与状态决策固化边界

完整物理字段映射见POLICY-CONTRACTS.json；完整批准边集见STATE-CONTRACTS.json。来源是固定DB6结构和所有者决策，不重新读取生产schema或源码。

- tenant/environment/subject/owner、ID、createdAt、供应商外部ID、幂等、经济事实金额/币种/方向及journal关联不可由外部角色改写。
- 直接字段修改白名单：Customer.email/firstName/lastName；Card.alias；WithdrawalAddress.label/isDefault；ApiClient.name/scopes子集/isActive；TenantUser.email/isActive；TenantUserRole.startsAt/expiresAt/grantReason/revokedAt（撤销单向）；Merchant.name/mcc/settlementAssetCode；Tenant.brandName。全部仍经服务端认证/归属/业务检查。
- 密码/PIN/token/CSRF/API key哈希、Secret引用、provider原始配置/payload/callback、PAN/CVV/PIN、内部错误和原始审计metadata不对外返回。原始IP/user-agent也不进入安全投影。
- updatedAt/version/计数/租约等系统字段不等于任意任务可写，只能在明确用途、批准状态边与原子性边界内维护。资金/审计/供应商事实不覆写，修正新增事件、冲正或补偿。DB7-C01/C02禁止从状态机要求推导宽泛UPDATE权限。
- WithdrawalAddress创建时由可信上下文注入tenant/customer/environment；客户端只能提交已列业务字段。asset/network/address创建后不变，label/isDefault可改；物理DELETE因缺停用字段保持BLOCKED，不能仅凭检查未完成订单就启用删除。
- CardHolder.profile没有获批字段schema，禁止任意JSON直写；Role没有既有assignable列，不能伪造字段。自营Tenant与其他租户一样受环境隔离，不通过UPDATE晋升。

## 状态规则

只列所有者明确批准的有向边。未列边拒绝，终态不得重开。KYC的REJECTED→PENDING需新材料，APPROVED→PENDING需双人合规复审；不得APPROVED↔REJECTED直跳。ProviderOperation.UNKNOWN只能经对账进入SUCCEEDED/FAILED，新尝试创建新记录。Journal冲正必须新增journal/entries，不能覆写金额。Webhook人工重放新建attempt。撤销/消费/解除时间单向NULL→timestamp，不能清空恢复。

Provider生产启用需双人审批；SHADOW→CANARY→LIMITED→FULL仅逐级放量，风险回退也须逐级审计。状态批准不是环境应用授权。

物理映射：ucard_card_base逻辑status映射card_status；tenant_third_party_config没有status/rolloutStage，其is_enabled不能表达完整状态图，逻辑决策保留、physical_field=null、实施BLOCKED。会话设备脱敏标签不是已核验物理列，未伪造。无枚举字段时不虚构枚举，状态图只登记适用的时间戳或逻辑要求。

## 显式冲突与缺口

CONFLICT-QUEUE.json共6项：C01事件追加/生命周期、C02不可变资金事实/派生字段、C06能力枚举/PIN命令与禁止秘密展示保持UNRESOLVED_IMPLEMENTATION；C03一次性FastLink密钥创建渠道、C04owner目录读取边界已有明确限定；C05 B端上游接口解释由正式纠正替代。三项未解决的是实施语义，不撤销所有者顶层决策，也不自动扩大允许范围。

9类实施缺口见IMPLEMENTATION-GAPS.json。决策固化不完成issuer、连接池、JIT、角色Scope、归属链、正式RLS或部署验证；所有物理实施仍BLOCKED、动态NOT_RUN。
