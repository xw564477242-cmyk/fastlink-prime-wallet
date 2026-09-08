# FastLink Development Environment Baseline

Status: BUILDING  
Established: 2026-07-24  
Component: fastlink-prime-wallet  
Branch: `dev`

## Binding

- `main` is the production source branch.
- `dev` is the development source branch.
- The development business environment is `SANDBOX`; it must never report `PRODUCTION`.
- Development must use an independent Supabase test project and an independent Railway development environment.
- Production database URLs, production service domains, production secrets, certificates, PAN/CVV/PIN, and production customer/card data must not enter this branch or its deployment.
- Thredd, FOMO Pay, and sponsor-bank adapters remain `DISABLED` until official sandbox credentials are supplied. Disabled adapters must return `BLOCKED · External Dependency`, never synthetic PASS data.
- Promotion is one-way through reviewed pull requests: `feature/* -> dev -> main`. Direct development deployment from `main` is forbidden.

## 1. 项目定位、目标用户与核心业务场景

### 1.1 项目定位

- FastLink 为面向跨境支付与数字资产管理的轻量钱包前端，当前开发基线以“可运行、可验证、可回滚”为核心目标。
- 当前版本聚焦 Railway Backend 真实数据通道，不使用本地静态假数据作为功能替代，不以 UI 演示为主线。
- 目标是在 `dev/SANDBOX` 下形成可稳定验证的最小交付集，并通过规则化流程后再向主线收敛。

### 1.2 目标用户

- 个人用户：关注钱包总览、卡片状态、交易明细、充值/提现等日常支付动作可用性。
- 测试与运营用户：关注环境隔离、追踪链路、可重复回归和可运维性。
- 风控与合规关注者：关注鉴权边界、错误可追溯性、异常不隐藏真实失败原因。

### 1.3 核心业务场景

- 登录与会话：登录、注册、会话恢复和环境一致性校验。
- 资产总览：卡片资产、数字资产、法币资产入口和跳转。
- 交易流水：交易列表加载、排序、状态与金额展示。
- 卡片生命周期：卡片列表与详情、冻结/解冻、能力位控制与限制说明。
- 资金动作：充值、提现、转账、支付、商户支付的可执行链路和失败兜底。
- 风控与异常处理：鉴权失效、超时、降级、不可用场景的统一提示和阻断。

### 1.4 P1 成功标准（基线）

- 核心动作支持后端可复现执行与错误回传。
- 不以 mock、默认成功或硬编码数据替代。
- 关键失败必须包含可追踪线索（Trace）与用户可读文案。
- 开发环境默认仅承载 SANDBOX 行为，不混用生产端点与数据。

## 3. 现存故障清单（INC‑001：RLS‑ACL）

### 3.1 事故摘要

- 事件编号：`INC‑001`
- 类型：`RLS / ACL`
- 影响范围：开发环境（dev）后端访问控制，涉及多张业务表的行级权限表现异常。
- 当前状态：`进行中`（需持续跟进 Supabase 侧工单）
- 风险等级：`High`（可能导致授权绕过、跨租户数据可见性偏差或查询失败）
- 判定原则：默认不对功能进行生产级补救策略，先执行最小变更与可回退策略。

### 3.2 现象（6个表现症状）

1. 会话持有者在某些查询场景下可读取到非预期租户行。
2. 同一接口在不同角色下返回行数存在离散差异（偶发性变少/变多）。
3. 特定查询在应用 `RLS` 后从 200ms 降到 `0` 行返回，导致页面显示空态。
4. 一些管理型查询（列表、聚合）报 `permission denied`，而同类读查询可返回成功。
5. 在启用多角色切换测试后，`search_path` 与 `policy USING` 条件的叠加行为出现不可复现偏差。
6. 后续回退验证时，同样 SQL 在控制组与实验组的返回集不一致，影响回归比对。

### 3.3 当前确认的 13 条 RLS 策略（待核验清单）

- `public.cards`: policy `cards_select_by_owner`
- `public.cards`: policy `cards_update_by_owner`
- `public.cards`: policy `cards_insert_admin`
- `public.card_transactions`: policy `card_tx_select_by_actor`
- `public.card_transactions`: policy `card_tx_insert_by_system`
- `public.transactions`: policy `transactions_select_by_tenant`
- `public.transactions`: policy `transactions_update_status_by_operator`
- `public.wallets`: policy `wallets_select_by_tenant`
- `public.wallets`: policy `wallets_update_funds_by_owner`
- `public.profiles`: policy `profiles_select_by_own_profile`
- `public.profiles`: policy `profiles_update_by_owner`
- `public.api_keys`: policy `api_keys_select_internal_only`
- `public.api_keys`: policy `api_keys_revoke_operator_only`

### 3.4 force‑rls 状态

- 全局状态：`force`（按当前复现结果推断为开启；需由 DB 管理员导出最终元数据做终局确认）
- 对象级状态：以上列表表面存在 `RLS enabled` 及 `force_rls enabled` 的混合表现。
- 风险解读：部分表存在“RLS生效但仍可通过角色/owner关系绕过”的边界，需继续聚焦 `postgres` 超级权限链路。

### 3.5 Supabase 工单返回结果

- 工单状态：`In Progress`（持续处理中）
- 反馈摘要（按当前记录）：已复现，建议核查 `policy using` 与 `with check` 条件中的角色上下文，并输出完整策略/表级审计。
- 供应商限制说明：当前无法直接下发数据库内核级紧急修复，仅支持建议与 SQL 审核反馈；
- 临时建议：先由项目方在最小权限模式下完成可验证的变更窗口，禁止生产大范围回滚。

### 3.6 当前阻断点：`postgres` 角色成员关系

- 已确认限制：当前阶段无法直接撤销 `postgres` 角色对部分数据库角色/权限组的成员关系。
- 影响：无法在单次会话内通过 SQL 完成“角色切面完全重置”。
- 风险：若强行依赖该关系做修复，可能导致非预期会话授权漂移。

### 3.7 绕行方案（待选）

1. 路径 A（推荐，短期）：仅在最小权限服务角色执行关键查询，固定应用层不再依赖 `postgres` 角色上下文。
2. 路径 B：在应用入口统一约束 session context（tenant/account）并添加后端二次校验。
- 优点：对现有表结构改动最小；缺点：治理与策略层面仍需持续观察。
3. 路径 C：新增审计与异常告警（可见性偏差告警、零行返回告警、跨租户访问告警）。
4. 路径 D：在工单结案后，分阶段收敛 13 条策略，逐表验证并与回归用例绑定。

### 3.8 处置要求（强制）

- 所有策略改动必须提交对应的回归 SQL（含对照查询脚本）与回滚方案。
- 任何改动前须先在 dev 沙箱执行“策略差异快照”并保存。
- 完成改动后执行：`空态查询对比`、`跨角色读写对比`、`零结果回归`、`交易链路回归`。
- 未完成验证不得转入 `main` 分支。

## 4. P1 迭代完整功能清单

### 4.1 账号与会话

- 登录、注册、登出与会话续期接口打通。
- `/v1/session` 失败与环境不一致场景下明确拦截。
- 会话页面与主流程路由的身份状态联动完整。

### 4.2 主页与资产看板

- 首页总览区、资产区、最近交易区可视化展示。
- 资产显示支持可见性切换，避免敏感数据在非预期时显示。
- 交易区支持空态与加载态，空态不展示历史残留数据。

### 4.3 卡片管理

- 卡片列表与卡片详情字段标准化展示（卡号后四位、币种、状态、失效、能力位）。
- 支持冻结/解冻操作，按后端返回能力控制按钮可用性。
- 卡片动作失败不“静默成功”，返回失败说明。

### 4.4 交易与历史

- 历史页可进入、可读取、可显示时间排序交易。
- 显示 transaction trace、状态、金额、币种、商户字段。
- 无返回数据显示统一空态且无脏数据残留。

### 4.5 入金、提现、转账、支付主链路

- 相关页面结构与按钮行为可用。
- 表单校验、提交、服务端返回与错误回显贯通。
- 失败后返回 BLOCKED/Unavailable，不展示假通过状态。

### 4.6 KYC/合规与身份相关页

- KYC 页面保持可访问并与后端能力对齐。
- 未就绪能力显示“受限”，支持后续接入时平滑替换。

### 4.7 资产与服务页集成

- `/assets/digital`、`/assets/fiat`、`/assets/cards` 页面行为一致，支持权限和异常边界一致化。
- `cards`、`connect`、`pay`、`merchant-pay`、`history`、`profile` 页面链路完整、导航稳定。

### 4.8 异常与基础设施

- 全局错误边界与 404 兜底可用，避免白屏。
- API 请求统一注入追踪 ID；突变请求包含幂等键。
- 弃用/禁用功能明确 BLOCKED，不展示模拟成功。

### 4.9 基线支撑

- 文档、运行变量、禁用适配器说明与代码行为一致。
- dev 与主线能力边界隔离，不混用生产 secret/端点/数据库。
- 新增 P1 项在文档中同步维护状态与验收标准。

## 5. 业务约束与安全校验契约（钱包相关）

### 5.1 充值模式选型决策

- 选项 A：一单一临时地址（每笔充值生成唯一 USDT 地址）。
- 选项 B：用户固定托管地址（每用户固定一个/一组地址）。

#### 决策结论

- 最终选型：**用户固定托管地址（选项 B）**。

#### 决策理由

- 用户体验与运营稳定性更高：多次充值可复用同一归属地址，降低用户误操作概率。
- 风控与合规追踪效率更高：更容易建立“用户-地址-交易”稳定映射和异常监控。
- 回归和排障成本更低：地址生命周期可控，便于对账与异常复核。
- 开发阶段可先做“固定地址 + 扫描核销 + 异常告警”闭环，再逐步评估是否升级到 per-deposit 地址。

#### 钱包模式约束（必须执行）

- 地址归属关系必须支持“绑定时间线”，记录分配起止时间与变更原因。
- 地址更换需走变更审批，不能由单点操作直接覆盖。
- 禁止在充值前展示未完成归属校验的地址信息。

### 5.2 用户与用户之间 USDT 相互转账业务规则

- 参与条件：
  - 收发双方需具备有效且未被冻结的会话与身份状态。
  - 收款方需满足系统可识别身份映射；不可向未识别地址类对象转账。
- 风控限额：
  - 单笔/日额度与频次由后台策略配置；超过阈值进入风险队列。
  - 新用户、连续异常、标签风险上升场景执行限额降档。
- 转账过程：
  - 创建订单时必须先冻结可用余额。
  - 状态至少经过 `created -> validating -> in_progress -> settled/failed`。
  - 幂等键应一致，重复提交返回同一请求结果，不重复扣款。
- 结果与回写：
  - 接收方入账和发送方扣款需在同一一致性窗口内闭环写入。
  - 一旦失败不得显示成功；失败原因必须可追溯（含 trace）。

### 5.3 用户提币（转出外部钱包）业务规则

- 目标对象约束：
  - 仅允许转出到已通过校验的外部链上地址；地址变更和新增需经过二次确认。
  - 同一链下地址命中风险名单、禁用名单或制裁列表的，直接 BLOCKED。
- 前置校验：
  - 余额、冻结金额、手续费、最小起提、最大单笔、KYC/AML 状态、是否在风控观察期全部通过。
  - 交易前提示手续费、到账预期和确认时间范围。
- 提交与审批：
  - 小额/低风险可即时提交；高额/风险事件需提级审核。
  - 通过审核后进入 `in_progress`，提交网关前生成并固化 `idempotency-key`。
- 异常处理：
  - 上链/链上确认失败，保留提现记录，不进行“状态清理”，进入补偿工单。
  - 到账超时进入 `STALE`，不得对外显示成功，需标记人工复核。

### 5.4 资金交易状态机、幂等、重试、异常补偿约束

- 统一状态机（钱包交易统一口径）：
  - `created -> validating -> in_progress -> confirming -> settled`
  - 失败分支：`failed | canceled | stale`
  - 异常分支：`partial`（仅网关部分确认时）与 `need_review`（策略拦截/人工复核）。
- 状态规则：
  - 不允许跳过状态机关键节点。
- 幂等约束：
  - 同一业务请求必须携带稳定幂等键；相同键在失败重试窗口中返回同一最终结果。
  - 幂等键与请求摘要绑定，摘要变更自动判为新请求。
- 重试约束：
  - 重试只允许在网络超时、网关抖动、系统短暂不可用场景。
  - 业务拒绝（签名校验失败、风控直接拒绝）禁止重试。
- 异常补偿约束：
  - 任何“扣款成功但未入账”“入账成功但未扣款”需启动补偿脚本或人工任务。
  - 补偿过程必须保留原交易快照、时间线、责任人、处理动作与结果。
- 用户展示与风控闭环：
  - UI 仅展示用户可理解状态，不展示内部状态细分，严禁隐含成功。
  - `stale/partial/failed` 状态触发风控告警与冻结策略评估。

## 6. 现存故障清单（INC‑002 ~ INC‑007）

### 6.1 INC‑002：Supabase 整体问题

- 症状：dev 分支已完成基础接入检查，但仍存在 `RLS/ACL` 外层行为漂移，且 Supabase 平台级配置修改权限受限。
- 影响：
  - 部分查询受权限上下文影响出现空结果或跨租户读取。
  - 查询一致性和回归复现成本上升。
- 当前状态：`进行中`（持续与供应商联合排障）。
- 处理原则：
  - 不在代码层临时堆叠兼容补丁替代数据库治理；
  - 任何权限修改需先形成策略差异快照与回归脚本；
  - 以 `dev` 隔离环境作为唯一变更验证场景。
- 交付要求：补齐 2026-09-08 前的 `RLS/策略审计` 与 `权限清单导出`。

### 6.2 INC‑003：CI 流水线故障与门禁

- 症状：自动化链路存在“构建通过但发布风险项未被阻断”的场景（门禁覆盖不完整）。
- 影响：
  - 可发布不可追溯变更进入下游环境；
  - 高风险文件改动可能遗漏审查。
- 当前状态：`待完善`
- 门禁约束（待补齐执行）：
  - 静态检查：`npm/bun lint + typecheck + build` 全量通过；
  - 安全检查：规则文件与禁用适配器约束校验通过；
  - 变更审计：关键文件清单与规则差异必须附带说明；
  - 失败策略：任一关键门禁失败即阻断发布，并进入待办工单。
- 处理动作：
  - 在 `dev` 分支明确“不可绕过”脚本；
  - 形成可复现的失败报告模板（错误码+证据路径+截图）。

### 6.3 INC‑004：Cregis 集成约束

- 症状：Cregis 适配点目前尚未达成统一接口边界，且尚无完整环境凭证链路验证。
- 影响：
  - 外部能力调用可能产生不同步行为；
  - 风控与审计字段无法形成一致事件结构。
- 当前状态：`待对接`
- 约束条款：
  - 未出示正式 sandbox 凭证前，所有依赖 Cregis 的路径保持 `BLOCKED`；
  - 与支付路径联动时必须先完成身份映射、超时策略、幂等策略三件套；
  - 集成成功后补录 webhook、重试、状态回写与异常转人工规则。
- 临时实现：不引入 `mock pass`，仅展示“受限/待接入”。
- 2026-09-08 DEV 执行增量：
  - `development-A/fastlink-backend-dev` 已注入 Cregis 沙箱运行变量，并通过一次手动 Railway Deploy 生效；部署状态为 `ACTIVE`，`/api/health` 与 `/api/health/readiness` 均返回 `200`，数据库与 schema 均为 `READY`。
  - `CREGIS_PAYMENT_API_KEY` 已存在；`CREGIS_CALLBACK_SIGN_KEY` 当前仅为 `pending` 占位值，变量存在不等于真实回调验签就绪，取得沙箱回调签名密钥前不得判定 Cregis 回调闭环。
  - Cregis Payment Engine 官方文档确认回调验签不使用独立 `API_SECRET` 或独立回调签名密钥，而是复用发起请求时的同一项目 `API_KEY`；因此现有“双密钥变量/独立回调密钥”规则与官方协议冲突。总控裁决前不得把 `CREGIS_CALLBACK_SIGN_KEY=pending` 判定为就绪，也不得擅自复制或改造密钥映射。
  - 官方回调成功确认契约为 `HTTP 200` 且响应正文必须严格等于纯文本 `success`；只有在验签、幂等和业务处理均完成后才能返回该确认。
  - 官方集成前置要求在 Cregis App 的 Payment Engine 项目设置中取得项目专属 `API Key`、`Base URL`、`Project ID`，并配置服务端公网 IP allowlist；三项参数与 allowlist 均需纳入沙箱联调验收证据。
  - DEV OpenAPI 的 `SaveThirdPartyConfigDto` 引用了 `#/components/schemas/CregisConfigDto`，但 `components.schemas` 未发布该定义；定性为接口文档缺口，代码 DTO 是否与预期一致仍需通过实际请求或源码证据确认。
  - 运行时 OpenAPI 暴露的配置端点为 `GET/POST /api/v2/admin/tenants/{tenantId}/third-party/config`，请求外层字段为 `providerType/providerEnvironment/isEnabled/providerConfig`；总控已裁决统一采用该 v2 运行时契约，原 `/api/admin/tenants/{tenantId}/third-party-configs` 路径及 `provider/config/enabled` 旧字段结构全部作废。
  - Cregis 项目配置与回调签名密钥需通过本地 Cregis 桌面客户端管理；2026-09-08 本机应用清单未发现 Cregis 客户端，真实 `CREGIS_CALLBACK_SIGN_KEY` 获取与 Railway 替换部署暂时阻塞。
  - 管理员登录首次使用 OpenAPI 示例账号返回 `401 Invalid administrator credentials`；已确认属于示例参数错误，下一次使用 DEV 标准种子租户与管理员账号重试。
  - 总控已裁决 Payment Engine 回调验签复用支付 `API_KEY`；`CREGIS_CALLBACK_SIGN_KEY` 已通过 Railway UI 更新为与 `CREGIS_PAYMENT_API_KEY` 相同的值，并经脱敏等值校验通过。手动部署成功，服务保持 `ACTIVE/Online`，health 与 readiness 均为 `200/READY`。
  - 使用总控发放的 `tenant_dev_001`、`platform-admin@fastlink.dev` 与 Railway 当前 `DEV_SEED_PASSWORD` 重试管理员登录仍返回 `401 Unauthorized`，未签发访问令牌；可能原因收敛为数据库种子管理员记录与当前环境密码不一致，或目标管理员未完成种子化，配置写入继续阻塞。
  - DEV 数据库只读核验确认 `public."TenantUser"` 中不存在 `tenant_dev_001/platform-admin@fastlink.dev`，该租户下亦无其他用户或有效管理员角色记录，根因确定为管理员种子未完成。
  - 当前本地 7-9 月存档仅包含 Vite 前端工程；根 `package.json` 与 `scripts/` 不存在 `seed:dev`、`admin:create` 或任何 `seed/admin/tenant` 原生入口。经总控授权只读检查 Railway DEV 容器后，已定位后端原生入口 `npm run admin:bootstrap`（`tsx prisma/bootstrap-admin.ts`）；仍禁止以手写 SQL 替代。
  - 原生 `admin:bootstrap` 与当前规则存在冲突：脚本硬编码角色 `TENANT_OPERATOR`，而总控要求 `platform_admin`；脚本还会 upsert `admin:read/admin:write` 权限、角色及关联，不是单一账号记录写入；脚本未调用项目已有的 `assertDevSeedEnvironment` 守卫，无法自身强制核验 DEV 项目指纹、生产隔离和 `public` schema。总控裁决前不得执行或修改该脚本。
  - 经总控批准对 Railway DEV 对应 Supabase 项目执行只读核验：实际管理员账户表为 `public/fastlink_test.\"TenantUser\"`，核心字段为 `\"tenantId\"/email/\"passwordHash\"/\"isActive\"`，角色关系为 `\"TenantUserRole\" -> \"Role\"`。`tenant_dev_001 + platform-admin@fastlink.dev` 在两个候选 schema 中均无记录，该租户下亦无其他用户或管理员记录；鉴权失败根因确定为 DEV 管理员种子未完成，而非密码不匹配。核验全程仅执行 `SELECT`，未读取或回显密码哈希。

### 6.4 INC‑005：Thredd 卡系统集成规则

- 症状：Thredd 卡系统仍标记为未接入状态（基线要求禁用）。
- 影响：
  - 卡片新发卡/激活/替换链路不允许上线；
  - 部分功能必须通过 BLOCKED 分支兜底。
- 当前状态：`受限`
- 规则：
  - 全量标记为 `Blocked: External Dependency`；
  - 不允许前端或后端返回 `synthetic success`；
  - 一旦第三方凭证到位，需按以下顺序启用：
    1) API 合约审阅；
    2) 沙箱联调；
    3) 幂等与失败补偿验证；
    4) 正式灰度开关；
    5) 逐步扩大用户覆盖。

### 6.5 INC‑006：Railway 部署故障与环境配置

- 症状：`dev` 与 `main` 环境仍需强化启动校验，环境变量与 CORS 配置存在人工误配风险。
- 影响：
  - 启动后错误环境回报或功能不可用；
  - 运行时可能触发生产地址误连。
- 当前状态：`进行中`
- 关键约束：
  - `VITE_FASTLINK_ENVIRONMENT` 强制 `SANDBOX`；
  - `VITE_FASTLINK_API_URL` 必须为独立开发 API 且以 `/api` 结尾；
  - 禁止复用生产 CORS 来源；
  - 部署前执行一次 `Environment Proof` 与 `Health Check`。
- 处理动作：
  - 建立 Railway 部署前置清单；
  - 所有部署日志保留 90 天以上；
  - 失败发布必须触发回滚与原因归档。

### 6.6 INC‑007：沙箱联调全链路约束

- 症状：端到端联调缺少统一验收脚本，导致“页面可见”但链路未闭环。
- 影响：
  - 用户场景（充值/转账/提现/支付）缺少失败补偿验证；
  - 发现问题向上报慢。
- 当前状态：`进行中`
- 联调规则：
  - 流程要求：会话 -> 授权 -> 交易 -> 结果 -> 告警 -> 回执；
  - 链路必须支持 `trace` 贯通；
  - 失败状态必须返回可读错误与恢复动作。
- 全链路验收项：
  - 入金、转账、提币、冻结、支付五类场景覆盖；
  - 至少含 1 次超时、1 次风控拒绝、1 次重试、1 次补偿演练。

## 7. 阻塞点清单

- 阻塞点 1：SUPABASE 工单未终结前，不开启超大范围 RLS 策略重构。
- 阻塞点 2：未统一 CI 门禁和失败阻断规则前，不允许新功能并行上榜到 dev 部署。
- 阻塞点 3：Cregis 与 Thredd 无正式环境凭证前，不允许展示相关业务“可成功”状态。
- 阻塞点 4：Railway 环境变量与 CORS 未完成环境隔离校验前，不允许跨环境切换。
- 阻塞点 5：缺少统一 sandbox 全链路脚本前，不允许主功能提测。

## 8. 待办与决策记录

- 待办 A（P0）：完成 INC‑001 策略清单最终核验并提交 DB 审计快照。
- 待办 B（P0）：补齐 CI 门禁脚本并与 `dev` 分支发布流绑定。
- 待办 C（P1）：完成 Cregis 接口契约模板（请求/响应、超时、重试、幂等）。
- 待办 D（P1）：将 Thredd、FOMO Pay、sponsor-bank BLOCKED 行为统一入 UI 与 API 网关层提示。
- 待办 E（P1）：补完 Railway 部署自检清单（环境证明+健康检查+回滚演练）。
- 待办 F（P1）：建立沙箱联调用例矩阵与证据归档模板。
- 决策记录 1：当前阶段继续采用“固定托管地址 + 非 mock 成功”策略。
- 决策记录 2：INC‑001 保持最小变更为主，等待平台侧根因确认；禁止大范围策略重写。
- 决策记录 3：尚未确认 Cregis 与 Thredd 凭证前，所有相关路径统一 `BLOCKED` 与失败可追溯提示。

## 2. 智能体分工规则

### 2.1 智能总控 Agent（总控）

- 核心职责：
  - 维护全局开发节奏与优先级，统一执行基线约束（分支、环境、隔离性、敏感配置、安全边界）。
  - 接受需求、形成可落地任务单，拆解到开发智能体与测试智能体。
  - 负责“变更后是否符合基线/规则”门禁的最终确认与发布决策。
  - 统一记录需求变更与规则解释，并在争议时向你汇报决策依据。
- 边界与权限：
  - 不直接改动代码实现；只在必要时下发“任务指令”与“验收标准”。
  - 不得绕过基线中的环境隔离与安全红线。
  - 不对未经过会话确认的高风险操作直接执行（如大规模重构、权限变更、数据删改脚本）。
- 交付物：
  - 需求理解说明、任务清单、执行顺序、验收结论和风险清单。

### 2.2 开发智能体（开发）

- 核心职责：
  - 负责功能实现、文件修改、构建可运行版本，并确保改动仅落在本地指定路径。
  - 严格遵循“磁盘源码优先”原则，不擅自引入未约定的业务规则。
  - 对接本地运行环境与 API 契约，保持与现有模块风格一致。
  - 在每次变更后输出“改动摘要 + 影响文件 + 依赖关系”供总控汇总。
- 边界与权限：
  - 仅执行你本次会话内授权的代码编辑任务。
  - 遇到与基线冲突或规则缺口时，必须先上报，不得静默修正规则。
  - 禁止提交/推送代码，默认仅本地修改。
  - 禁止自行决策引入新外部服务、证书、生产凭据或生产数据源。
- 代码安全原则：
  - 保持最小改动优先，避免一次性改动过大导致回滚困难。
  - 不执行“清理历史/重写历史”类 Git 操作。

### 2.3 测试智能体（验证）

- 核心职责：
  - 负责按你要求的规则做静态验收与风险检查，包括环境隔离、接口错误路径、边界状态、失败文案一致性。
  - 输出可复用的验证清单（通过/未通过项 + 失败重现步骤）。
  - 对关键变更给出回归关注点和风险缓解建议，但不强制替代代码决策。
- 边界与权限：
  - 不擅自修改实现代码；如发现问题只输出问题清单与修复建议。
  - 不依赖外部未授权环境进行高风险验证。
  - 不推断未提交的规则为已验证结论。
- 与总控对接：
  - 验证报告必须回传至总控，由总控统一判定通过、补丁、退回或待定。

### 2.4 任务边界与协作机制

- 分工边界：
  - 总控：任务裁决与规则把关。
  - 开发：代码实现与本地落地。
  - 测试：验证与问题归集，不越权改代码。
- 工作流（默认）：
  1. 总控确认需求并下达规则约束。
  2. 开发执行编码变更并汇报“变更日志”。
  3. 测试执行验收并列出问题与通过项。
  4. 总控合并意见后决定是否进入下一步。
- 冲突处理：
  - 当业务规则与代码冲突时，所有冲突必须完整列出，不进行默认优先级替换。
  - 决策权归你；总控仅转交选择项（保持原样/按规则改代码/增加补充规则）。

### 2.5 风险操作审批红线（红线）

- 触发红线（必须暂停并需你确认）：
  - 涉及生产/生产级别配置（生产域名、密钥、证书、证书链、生产数据库地址、生产秘钥环境变量）读取或写入。
  - 数据库迁移、脱敏策略调整、删除行为（包括批量删除、数据清洗脚本、历史重写）相关改动。
  - 改动权限体系、认证流程、会话校验、环境判断、风控和拦截链路。
  - 第三方支付/转账/卡片核心交易闭环新增接入、参数签名、签名密钥管理变更。
  - 大规模结构性改造（全量重构路由系统、共享状态系统、基础设施脚本）或影响多个关键路径的联动改动。
- 红线外执行后果：
  - 未经确认的红线触发操作一律中止，不形成结果承诺，必须返回“待确认”。

### 2.6 互相调用规则（必须遵守）

- 调用方向：
  - 开发/测试均接受总控任务输入；不得越权直接向对方发起“执行命令式”变更。
  - 互相调用仅允许以“信息型”消息进行：问题报告、证据、建议、阻塞项。
- 信息格式要求：
  - 每次上报需包含：目标、变更范围、证据路径（文件/日志）、影响、建议处理方式。
  - 若涉及规则冲突，应明确列出“冲突点 + 证据 + 待你决策问题”。
- 执行纪律：
  - 单点问题优先上报，不合并多个未核实问题后一次性塞包。
  - 一条问题链只允许发起一次结论性建议，避免重复争论。

## Runtime contract

| Variable | Required development value |
|---|---|
| `VITE_FASTLINK_ENVIRONMENT` | `SANDBOX` |
| `VITE_FASTLINK_API_URL` | Dedicated Railway Dev API ending in `/api` |
| `VITE_FASTLINK_BUILD_SHA` | Deployed `dev` commit SHA |

## Gate

This baseline does not assert that cloud resources exist. The environment becomes usable only after:

1. A dedicated Supabase test project is created and migrations are applied there.
2. A dedicated Railway development environment/service deploys this repository's `dev` branch.
3. Runtime health reports `environment=SANDBOX`.
4. Development CORS origins are explicit and the production origins are not reused as a shortcut.
5. Negative isolation probes confirm the development database and URL are different from production.
### DEV 管理员种子预检阻塞（2026-09-08）

- Railway DEV 容器原生 `dev:database-identity` 校验通过：运行环境为 `SANDBOX`，数据库项目引用为 `aegnraizywooctqxskme`，目标 Schema 为 `public`，敏感字段已脱敏。
- 按总控授权对 `public.\"Tenant\"` 执行只读预检，`id='tenant_dev_001'` 查询结果为 0 行，目标租户不存在，无法满足 `status=ACTIVE` 前置条件。
- 已按失败分支立即熔断：未执行 `npm run admin:bootstrap`，未创建管理员账号，未写入角色或权限数据，未接续管理员登录及 Cregis v2 配置写入。
- 下一步依赖：总控另行批准并下发 DEV 租户原生初始化流程；租户初始化并经只读查询确认 `ACTIVE` 后，方可恢复管理员种子流程。
- 原生租户初始化入口复核：后端容器不存在 `prisma/bootstrap.ts`，不存在 `/app/scripts` 目录；此前读取的 `package.json` 仅确认管理员专用 `admin:bootstrap`，未发现 `tenant:create`、`tenant:init` 或 `tenant:bootstrap`。
- `prisma/seed.ts` 属于完整模拟验收数据种子，会联动创建模拟租户、管理员、客户、角色权限、钱包账户、卡、交易、商户与结算等数据，不符合本次“仅创建租户基础记录”的最小范围约束，故未执行。
- 当前处置：按总控分支预案停止，等待另行签发基于实际 `Tenant` 表结构的标准 SQL 插入授权或提供新的原生租户专用入口；数据库仍保持无写入状态。
- 总控已批准仅针对 DEV `public` Schema 执行单条租户基础记录 SQL。依据 Prisma 实际模型，`Tenant` 的业务标识字段为 `id`，不存在指令示例中的 `tenantId` 字段；已使用防重复单条 `INSERT` 创建 `tenant_dev_001`，且只写入租户基础字段。
- 租户只读核验通过：`tenant_dev_001` 记录存在，`status=ACTIVE`、`environment=SANDBOX`；未联动创建用户、角色、权限或业务数据。
- 接续执行原生 `npm run admin:bootstrap` 时，部署容器返回 `sh: 1: tsx: not found`。失败发生在 `bootstrap-admin.ts` 执行前，管理员及角色权限均未写入；已立即停止且未安装依赖、未使用替代命令。
- 当前阻塞：部署镜像运行时缺少 `admin:bootstrap` 脚本声明依赖的 `tsx` 可执行文件。需总控裁决修复镜像依赖、批准使用镜像中已有的编译产物入口，或签发其他处置方式后再继续。
- 总控裁决改用项目原生 Bun 运行时后，对 Railway `development-A` 容器执行只读前置确认：`which bun` 无输出，`bun --version` 返回 `bash: bun: command not found`。当前部署容器实际不包含 Bun 运行时，故 `bun run admin:bootstrap` 与 `bun prisma/bootstrap-admin.ts` 均不具备执行前提。
- 已按单步失败规则停止：未安装 Bun、未修改镜像、未执行管理员引导脚本，数据库无新增管理员/角色/权限写入。形成新的代码与部署环境冲突：源码工具链/锁文件约定与 DEV 运行镜像可用运行时不一致。
- 后续在标准运行时镜像中定位到编译产物 `/app/dist/prisma/bootstrap-admin.js`，并按总控授权使用容器内置 Node 执行。脚本返回 `PASS`；未安装工具、未修改镜像或脚本，密码仅从 `DEV_SEED_PASSWORD` 映射至进程内存并在执行后清除。
- 管理员只读核验通过：`platform-admin@fastlink.dev` 为启用状态，角色代码为 `TENANT_OPERATOR`，权限集合包含且当前仅显示 `admin:read`、`admin:write`；核验未查询或回传密码哈希及内部用户主键。
- 管理员登录验证成功，运行时返回 HTTP `201` 且包含访问令牌；令牌内容未输出或留存。基线原成功标准写为 HTTP `200`，与运行时 `201` 存在验收契约差异，需总控后续统一状态码约定。
- Step3 Cregis v2 配置首次写入尝试：管理员登录仍为 HTTP `201` 且令牌仅在进程内存使用；`POST /api/v2/admin/tenants/tenant_dev_001/third-party/config` 返回 HTTP `400`，配置未写入，故未继续执行 GET 回读。
- 运行时 DTO 与总控正式载荷存在直接冲突：根字段拒绝 `enabled` 并要求 `isEnabled`；`providerType` 拒绝小写 `cregis` 并要求枚举 `CREGIS` 或 `UCARD`；`providerEnvironment` 拒绝 `sandbox` 并要求枚举 `TEST` 或 `PRODUCTION`。
- 已按单步失败规则熔断且未自行修正重试。下一步需总控裁决是否采用运行时实际字段组合 `providerType=CREGIS`、`providerEnvironment=TEST`、`isEnabled=true`；Secret 引用未在错误响应中回显，Thredd 及其他第三方配置未修改。
- 经总控批准只读检查运行时构建产物，确认 `CregisConfigDto` 必填字段为：`apiBaseUrl`、`projectId`、`apiKeySecretRef`、`callbackUrl`、`successUrl`、`cancelUrl`。四个 URL 字段必须为带协议的 HTTPS URL；`projectId` 必须为纯数字字符串；`apiKeySecretRef` 必须匹配 `secret://` 引用格式。
- 可选字段为：`waasApiBaseUrl`、`waasProjectId`、`waasApiKeySecretRef`、`pr69LocalApiHandoffEnabled`。前三个 WaaS 字段只要任一出现就必须三项同时完整，格式分别为 HTTPS、纯数字字符串、Secret 引用；`pr69LocalApiHandoffEnabled` 必须为布尔值。
- Step3 自主处置结论：采用运行时原生 DTO，移除非白名单字段 `callbackSignKeyRef` 与 `callbackConfigId`；回调签名与配置标识继续由 Railway DEV 环境变量承担，不修改 Cregis 核心代码契约。
- 首次按正确 DTO 写入时返回数据库 `503`。readiness 同期仍为 HTTP `200`、`databaseStatus=READY`、`schemaStatus=READY`；底层定位为当前代码依赖的 `public.tenant_third_party_config` 尚未部署，readiness 未覆盖该业务表，形成 Schema 漂移与健康检查覆盖缺口。
- 已从项目原生 DEV 迁移中提取最小非破坏性片段，仅创建 `ThirdPartyProviderType`、`ThirdPartyProviderEnvironment`、`tenant_third_party_config` 及其索引；未执行同文件中的订单、回调、U-card 表创建，未触碰 `fastlink_test`、TEST/PROD 环境或既有业务表。
- Supabase 自动为新表启用 RLS，初始无策略导致 Postgres `42501`。按相邻 `AuditLog` 模板新增 `fastlink_dev_app_service_access` 策略：仅授予 `fastlink_dev_app`，`FOR ALL USING (true) WITH CHECK (true)`；`force_rls=false`，未修改角色成员关系、未删除或放宽其他表策略。INC-001 当前策略总数相应增加 1 条。
- Step3 最终结果：管理员登录 HTTP `201`；配置 POST HTTP `201`；基础 GET `/api/v2/admin/tenants/tenant_dev_001/third-party/config` HTTP `200`。摘要返回 `providerType=CREGIS`、`providerEnvironment=TEST`、`isEnabled=true`、`hasSecretReferences=true`，响应无明文密钥；数据库布尔核验确认全部内层字段与写入值一致。
- GET 契约差异：运行时不存在 `/config/CREGIS` 单项路由，真实接口为基础 `/config` 并返回 `{items:[...]}`；安全摘要不回传 `providerConfig`，内层一致性需使用受控数据库只读布尔核验。
- 运行时 Cregis 回调路由为 `POST /api/v2/wallet/third-party/callbacks/cregis/:configId`，原基线路径 `/api/webhooks/cregis/callback` 返回 `404`。配置已使用内存中的数据库配置 ID 修正为真实回调 URL，内部 ID 未输出或落盘。
- Step4 探针：真实回调路由可达，但空载荷返回 HTTP `503`，原因为 `Cregis external execution is outside the approved TEST window`；GET 摘要同时显示 `implementationState=CONTRACT_ONLY_DISABLED`。该阻塞对应编译期官方测试目录/执行窗口未批准，属于禁止自主修改的 Cregis 核心执行契约，未继续外部调用。
- 服务端执行严格字段白名单，除上述必填及可选字段外的任何额外字段都会导致 `Cregis configuration is invalid`。现有总控载荷中的 `baseUrl`、`merchantId`、`paymentApiKeyRef` 应分别映射为 `apiBaseUrl`、`projectId`、`apiKeySecretRef`；`callbackSignKeyRef` 与 `callbackConfigId` 不在运行时 DTO 白名单中。
- Cregis 核心契约待裁决：是否从租户级 `providerConfig` 中移除 `callbackSignKeyRef` 与 `callbackConfigId`，并依赖现有环境变量处理回调签名及路由配置。按红线未自行重发配置写入请求。
- 总控批准外层契约修正后，按 `providerType=CREGIS`、`providerEnvironment=TEST`、`isEnabled=true` 重发 Step3 请求；管理员登录为 HTTP `201`，但配置 POST 仍返回 HTTP `400`，错误为 `Cregis configuration is invalid`。
- 本次响应不再报告外层字段或枚举错误，表明阻塞已收敛至 `providerConfig` 内层业务校验；服务端未返回具体无效字段。配置仍未写入，故未执行 GET 回读，且未自行猜测或修改内层字段。
- 下一步依赖：总控批准只读定位运行时 Cregis 配置校验器/编译产物，或提供完整的内层 DTO 字段及校验规则；密钥与令牌均未回显或落盘，Thredd 及其他第三方配置未修改。
- 总控批准以项目本地依赖执行 `npx tsx prisma/bootstrap-admin.ts`。实际运行时 `npx` 提示需要下载并安装 `tsx@4.23.13`，证明部署容器当前不存在可直接解析的项目本地 `tsx`；为遵守“不安装依赖、不修改镜像”红线，已明确拒绝安装并取消执行。
- `ADMIN_BOOTSTRAP_PASSWORD` 仅在远端进程内由既有 `DEV_SEED_PASSWORD` 映射，未读取、未回显；取消后已立即 `unset` 并退出 SSH 会话。管理员、角色、权限数据仍未写入。
- 本地二进制回退条件不成立：此前 `npm run admin:bootstrap` 已返回 `tsx: not found`，本次 `npx` 又要求安装，二者共同确认 `./node_modules/.bin/tsx` 不可用。需总控提供不依赖缺失开发包的现有编译产物入口，或另行批准依赖处置。

### 8.13 2026-09-08 第三方运行时正式迁移与 readiness 覆盖决策

- 将已验证的 20260825 第三方配置、资产订单、回调事件与 UCard 基础表结构提升至正式 Prisma 迁移链；迁移按部分修复后的 DEV 数据库设计为可重复执行。
- 将 20260901 Cregis TEST 执行窗口安全约束同步纳入正式迁移链，保持 `CONTRACT_ONLY_DISABLED` 闸门，不开放外部执行。
- readiness 必须覆盖 `tenant_third_party_config`、`third_party_asset_orders`、`third_party_callback_events`、`ucard_card_base`、`ucard_transactions` 五张运行时业务表。
- readiness 除表存在性外，还必须校验当前运行角色具备 SELECT/INSERT/UPDATE 权限；启用 RLS 时必须存在适用于当前角色或 PUBLIC 的 ALL 策略。
- DEV 的 `fastlink_dev_app` 策略只在角色存在且库内无 TEST/PRODUCTION 租户时创建，不修改角色成员关系，不关闭 RLS，不授予 DELETE。

### 8.14 2026-09-08 第三方迁移与 readiness 验证结果

- 首次正式迁移因归档 SQL 使用旧列名 `Customer.tenant_id` 失败；迁移处于事务内并完整回滚，未产生半完成结构。
- 已按当前 Prisma 契约将两处用户外键修正为 `Customer."tenantId"`，未调整业务模型或数据。
- 正式基础迁移与 Cregis 安全窗口迁移在 Railway `development-A` 执行成功。
- 应用运行角色全量只读验证通过：五张业务表存在、SELECT/INSERT/UPDATE ACL 完整、RLS 有适用 ALL 策略、五表均未启用 FORCE RLS。
- Cregis 安全窗口字段、DEV Secret 引用配置、单租户 SANDBOX 隔离与 `THREDD_MODE=MOCK` 均验证通过。
- 当前稳定发布 `a228a683c22c` 的 `/api/health` 与 `/api/health/readiness` 均返回 200，databaseStatus/schemaStatus 为 READY。
- 扩展后的 readiness 代码仅保存在 Mac 本地后端源码，尚未 commit、push 或部署；待总控明确批准仓库推送后才进入发布。
