# 正式消息原文留存

来源：总控对话 `019fa6b7-4f28-7b62-b676-757be88c22f8`，turn `01a0fd08-e6ea-7152-ac84-a1c03f6a0ac4`；接收端：整理代码执行对话。项目所有者授权由总控转达/作出决策，不伪称代码执行端自行批准。

以下正文按协调消息逐字留存。历史用语若与后续纠正冲突，由02/03文件追加承接，禁止据旧表述扩大B端权限。

<!-- ORIGINAL-BEGIN -->
## FL-DB-007 门禁1评审结论：通过

批准按首次回执启动“54表业务权限正式决策固化”，仅限治理交付，不实施数据库、RLS、应用授权或密钥操作。

### 一、批准范围
1. 从只读核验后的治理仓库最新 origin/dev 建立独立工作区和分支 `feature/FL-DB-007-owner-policy-record`；不得带入正式工作区覆盖层或已取消工单残留。
2. 仅新增 `docs/governance/FL-DB-007/` 下的决策文件、结构化矩阵、治理校验、测试、证据、SHA、自测、回滚、HANDOFF和基线拟差量。
3. 允许执行治理材料的静态一致性检查、敏感格式扫描和SHA校验；允许创建Draft PR至dev并取得现有PR门禁CI。
4. 允许按既有正式证据引用DB6的54表、324角色行、1296操作格和25项未来场景；禁止重新运行数据库实验、全量迁移、业务测试或环境验收。

### 二、必须固化的产品边界
1. C端钱包属于FastLink自营租户，不是全局租户或RLS旁路。
2. B端OEM/ODM白标客户只消费FastLink统一标准自有API和授权式管理后台，可直接使用、集成或二次开发。
3. 第三方IPA/卡组织/支付服务只通过FastLink内部可插拔适配器接入；不得向B端透传第三方接口、身份、秘密或原始配置。
4. FastLink API Client必须绑定tenant、environment和限定Scope，强制幂等、审计和不可自提权。
5. “此前向B端提供第三方IPA接口”的相反表述必须以追加纠正记录明确作废，但历史原文不得删除或改写。

### 三、54表决策验收要求
1. 54/54唯一主记录，缺失0、重复0、额外0；P1～P12与已批准映射一致。
2. 每表至少明确：主profile、数据归属、可见主体、有效CRUD/命令、允许字段、禁止/隐藏字段、不可变字段、状态边、终态、平台JIT例外、后台任务例外、审计义务、实施状态、验证状态和证据来源。
3. 交叉约束可叠加但不得重复计数；冲突必须进入显式冲突队列，禁止用更宽权限自动合并。
4. `OWNER_APPROVED_POLICY`只代表项目所有者业务决策已确定；不得标成VERIFIED、RLS已通过或资金安全前置解除。
5. DB6的47 BLOCKED、7 UNKNOWN以及后续实施缺口须逐项承接，不得因本工单改写为PASS。

### 四、强制权限边界
- USER：本人对象安全投影；资金及状态变更只走命令，不直接写金额、账本或状态。
- TENANT_ADMIN：本租户品牌、人员、预定义可分配角色、API Client Scope子集及获准业务功能；禁止自提权、跨租户、直接账本写入和读取秘密。
- PLATFORM_ADMIN：无常驻全租户旁路；仅JIT，普通最长60分钟默认只读，敏感写双人审批，break-glass最长30分钟且24小时内复核。
- BACKGROUND_TASK：按scheduler/provider/webhook/ledger/settlement/retention/audit拆分，单tenant/environment/purpose、幂等和租约；不得用通用高权worker。
- BACKEND_RUNTIME：只承载已验证主体/任务上下文，不得自由选租户或SET ROLE进入owner/issuer。
- MIGRATION_OWNER：NOLOGIN、DDL专用，应用不可继承。
- P12四张旧treasury表：维持QUARANTINED_DENY，不得恢复为正式业务路径。

### 五、字段与状态要求
1. tenant/environment/owner、资源ID、createdAt、provider外部ID、幂等键、账本金钱/币种/方向/journalId等保持不可变。
2. Secrets、hash、原始provider payload、PAN/CVV/PIN及内部错误不得进入外部投影。
3. 财务、审计、provider事件为追加式；纠错使用状态机、冲正或补偿记录。
4. 环境不得通过UPDATE晋升。
5. 状态转换必须采用已批准边集；未列边默认拒绝，终态不得重开。名称与现有schema不一致时记录映射或实施缺口，不得伪造字段。

### 六、已知缺口的处理
- WithdrawalAddress无停用字段、CardHolder.profile无批准schema、Role无assignable标记、两套provider配置状态结构不同：均保留为实施BLOCKED，不补造字段。
- JIT审批、用途级任务身份、issuer/连接池绑定和正式RLS仍需后续工单。
- 10个模型独有/4个目录独有差异只记录依赖，不扩展本工单表集合。
- 永久偏差、历史缺口、DB-R02、88 High、2917候选、38条Admin LIMITED及DB5 T17 LIMITED继续携带。

### 七、禁止事项
不得修改业务源码、schema、迁移、数据库、GRANT/RLS、JWT、API实现、CI工作流、Secret、平台配置或正式基线；不得连接DEV/TEST/UAT/生产、Railway或供应商；不得部署、晋升、合并或处置风险资产。PR必须保持Draft，自动合并关闭。

完成后提交门禁2材料：Draft PR、完整HEAD、CI、54表覆盖与冲突结果、全部治理测试、自测、逐文件SHA、敏感扫描、范围证明和HANDOFF。
<!-- ORIGINAL-END -->
