
## 2026-09-08 - Cregis v2 内层 DTO 只读定位

- 当前子任务：定位 `Cregis configuration is invalid` 的具体字段约束。
- 修改文件：`docs/environment/DEV-BASELINE.md`、`docs/history-journal.md`。
- 遇到问题：总控载荷使用 `baseUrl/merchantId/paymentApiKeyRef/callbackSignKeyRef/callbackConfigId`，运行时 DTO 使用严格字段白名单。
- 处理结果：只读确认必填字段为 `apiBaseUrl/projectId/apiKeySecretRef/callbackUrl/successUrl/cancelUrl`；可选字段为 WaaS 三字段和 `pr69LocalApiHandoffEnabled`。URL 必须为 HTTPS，项目 ID 必须为纯数字，Secret 引用必须符合 `secret://` 格式。
- 决策理由：`callbackSignKeyRef` 与 `callbackConfigId` 不在运行时白名单，移除它们涉及 Cregis 核心契约边界；依据总控红线停止自动重发，等待正式裁决。
- 数据与环境影响：仅只读检查 Railway DEV 编译产物；未修改代码、数据库、环境变量或第三方配置。
- 下一步计划：总控确认最终内层载荷后，重新登录并在单进程内完成 POST、GET 和明文密钥泄漏检查。

## 2026-09-08 - Cregis Step3 配置闭环与 Step4 执行闸门定位

- 当前子任务：按运行时 DTO 完成 Cregis 租户配置写入、RLS 排障及回调路由探针。
- 修改文件：`docs/environment/DEV-BASELINE.md`、`docs/history-journal.md`。
- 数据库变更：在 DEV `public` Schema 新增两个第三方枚举、`tenant_third_party_config` 表、范围索引及仅面向 `fastlink_dev_app` 的服务访问 RLS 策略；写入一条 `tenant_dev_001/CREGIS/TEST` 配置。
- 遇到问题：运行时缺少业务表导致 API 503；新表自动启用 RLS 且无策略导致 Postgres 42501；文档 GET 与回调路径均与运行时不一致。
- 解决方案：从项目已有 DEV 迁移提取最小非破坏性片段，不执行 U-card 与交易表；复用 `AuditLog` 的服务策略模板；采用运行时基础 GET 列表契约，并将回调 URL 修正为带数据库配置 ID 的 v2 路由。
- 决策理由：优先安全与最小变更，只补齐 Cregis 配置闭环所需 Schema 与策略，不扩大到未进入当前任务的 U-card/交易结构，不关闭 RLS、不变更角色成员关系。
- 验证结果：配置 POST 201、GET 200；摘要与数据库布尔核验通过，Secret 明文零回显。回调路由可达，但执行闸门返回 503，`implementationState=CONTRACT_ONLY_DISABLED`。
- 下一步：保持 Cregis 外部执行关闭，等待官方 TEST 目录/执行窗口被批准；并将缺失业务表纳入正式迁移和 readiness 覆盖修复。
- 是否需要人工介入：是，仅限批准 Cregis 官方 TEST 执行窗口或核心目录变更；常规代码、迁移与 readiness 修复继续自主推进。

## 2026-09-08 - 正式迁移链与第三方 readiness 覆盖修复

- 当前子任务：补齐第三方运行时正式迁移，并消除 readiness 对新业务表缺失的误绿。
- 修改文件：新增两段正式 Prisma 迁移；扩展 HealthController schema/ACL/RLS 核验；补充健康检查与迁移契约测试；同步 DEV 基线。
- 遇到的问题：当前工作区仅有前端源码，后端存在两个本地交付副本；基础副本不含当前 Cregis 安全增量。
- 处理结果：选用与 Railway 运行契约一致的 `fastlik-backend-cregis-security`；正式迁移保持重复安全，DEV RLS 策略受角色和租户环境双重守卫。
- 决策理由：优先保证安全和运行时一致性；不突破 Cregis TEST 窗口，不修改资金状态机，不触碰生产环境或数据库角色成员关系。
- 待验证：在 development-A 执行正式迁移后，对五张业务表、ACL/RLS 与 `/api/health/readiness` 进行全量验证。

## 2026-09-08 - 第三方正式迁移与 readiness 全量验证完成

- 当前子任务：第三方运行时迁移落库与 readiness 全量核验。
- 修改文件：正式迁移两份、HealthController、健康检查测试、迁移契约测试、DEV-BASELINE.md、history-journal.md。
- 遇到的问题：首次执行时两条 Customer 外键沿用归档列名 `tenant_id`，与当前真实列 `tenantId` 不一致。
- 处理结果：首次事务完整回滚；修正两处外键后重试成功，第二段安全窗口迁移同步成功。
- 验证结果：本地 2 个测试套件、23 个测试全部通过，Nest 构建成功；DEV 五表、ACL、RLS、force-RLS、安全字段、Cregis 配置、租户隔离和 Thredd MOCK 全部通过；health/readiness 均为 200。
- 决策理由：保留正式迁移可重复执行能力，不直接写 Prisma 迁移元数据；后续由获批的正常部署执行 `prisma migrate deploy` 并登记迁移。
- 仓库状态：无 commit、无 push、无远程源码部署。
