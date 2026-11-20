本文件为 2026-08-28《FastLink 月度项目归档 & 交班白皮书》原文归档。
- 文档编号：FASTLINK-HANDOFF-2026-08-28
- 归档时间（事件）：2026-08-28（Asia/Shanghai）
- 落盘归档（补录）：2026-10-05，由新总控只读补登；只追加，不改写。
- 保密等级：项目内部；不含任何密码、Token、Cookie、私钥、连接串或生产凭据。
- 说明：以下为交班白皮书正文原样保留；与后续只读核验冲突处，以新证据为准并在 CHANGE-HISTORY 追加纠正，不在本文件涂改。

================================================================
FastLink 月度项目归档 & 交班白皮书
文档编号：FASTLINK-HANDOFF-2026-08-28
归档时间：2026-08-28（Asia/Shanghai）
旧总控状态：FROZEN · READ-ONLY ARCHIVE
新集群状态：PENDING INTAKE
保密等级：项目内部；不得记录或传播任何密码、Token、Cookie、私钥、数据库连接串或生产凭据

本白皮书是新总控的唯一交班入口。它依据本会话、本地归档、当前仓库只读状态、GitHub/Railway脱敏回执和人工UAT回执整理。用户提供的章节清单全部保留；与最新证据冲突的旧状态已明确纠正，禁止以旧口头状态覆盖后续已验证事实。

0. 归档范围、证据等级与事实纠正
0.1 归档范围
本交班包覆盖当前会话可验证的全部高价值工作：产品定位、架构边界、代码与配置版本、PR/CI流转、UAT判定、环境门禁、Cregis接入、安全约束、已解决问题、未关闭缺陷、失败路径、责任流转及下一阶段强制顺序。
用户称旧集群已连续运行30天；当前本地可直接核验的细粒度执行证据主要集中在2026-08-25至2026-08-28。更早的产品与架构成果按已归档项目事实纳入，但不存在的日期、日志或运行结果不得补造。
本文件不包含模型私密思维链。为满足审计要求，所有有业务价值的判断均以“决策、理由、证据、结果、后续影响”形式保存。
0.2 证据优先级
1. 当前仓库Git对象、文件字节和不可变SHA。
2. 可核验的GitHub PR、Merge Commit和CI Run。
3. Railway/Cloudflare等平台的脱敏运行身份回执。
4. 人工浏览器UAT记录与截图。
5. 本地归档文档。
6. 口头或模板化状态；与1至5冲突时必须降级为NOT_VERIFIED或SUPERSEDED。
0.3 必须纠正的旧状态
- PR #69仍为Draft/Open → fastlik-app PR #69已合并到dev，Merge Commit为91ce890fcb27ed042d9547d3083c63bd2e2e31d6；配套后端PR #260也已合并；旧状态SUPERSEDED。
- PR #69未完成UAT所以不能合并 → PR #69已经完成合并；当前人工UAT属于合并后SANDBOX验收/后续发布门禁，不再把PR #69合并作为待执行动作。
- Cregis分支尚未合并 → fastlik-backend PR #261已合并，Merge Commit和dev基线为38d9fdefe4ec524b391c5d908a7c43b4193ecdd；旧状态SUPERSEDED。
- 731c768…为PR #261合并后dev → 该SHA不包含PR #261，已被GitHub只读取证否决；RELEASE-EVIDENCE-REJECTED。
- 前端Build 89a5…必须等于后端38d9… → 两者来自独立组件，不要求数值相同；必须证明前端API Origin与目标TEST后端Deployment可追溯配对；旧“跨仓SHA相等”规则废止。
- SANL-X夹具尚未实现 → SANLX-FIXTURE-001已在PR #263实现CREATE/DISABLE/CLEANUP，但缺少受控只读PRECHECK且尚未合并/部署/运行；改为PARTIALLY_IMPLEMENTED。
- 当前需要合并的是PR #69 → 当前开放、Ready且禁止合并的是SANL-X独立PR #263；纠正对象。

1. 项目整体定位与架构归档
1.1 产品定位
FastLink是以U-卡实体卡、虚拟卡发行及租户卡片全生命周期管理为核心的多租户SaaS金融平台。FastLink-Prime钱包是配套C端增值客户端，承担租户用户的资产查看、USDT链上充值/提现安全态、流水查询、卡片充值报价及向U-卡充值的入口。Admin后台提供多租户运营与权限管理。
Phase1已完成平台底座；当前处于Phase2收尾及第三方数字资产沙盒准备阶段。Cregis用于提供数字资产充提通道；独立法币兑换下单能力采用B方案延期。
业务权重永久锁定：
- U-卡实体卡与虚拟卡发卡业务是主业务。
- 钱包、链上充提、Cregis和FX是配套资产通路。
- 后续迭代不得以第三方钱包能力反向污染或主导U-卡核心业务域。
1.2 架构模式
- 多租户SaaS，所有查询和写入必须以服务端派生的tenant/customer/environment范围执行。
- U-卡核心domain与外部Provider严格解耦。
- 外部服务商统一收敛在third-party模块，通过Adapter/Provider接口插拔。
- PR #69本地API不依赖Cregis，不允许静默回退到第三方。
- Cregis确认入金后只产生协调事件；若PR #69发布门控未满足，行为必须为DEFERRED。
- 金额与费率均使用确定性十进制/字符串契约，禁止浮点金额进入金融边界。
1.3 环境划分
- LOCAL_DEV：本地代码实现与无外部副作用验证；可改代码，不得连接生产资源。
- DEV：合并后的开发底座；只读验证优先，不得使用生产凭据。
- 联调：环境服务间契约联调；必须与DEV、TEST、PROD密钥和数据隔离。
- TEST/SANDBOX：第三方测试网与人工UAT；仅Sandbox，写入需逐项授权。
- PROD：生产；智能体不得部署、修改、调试或执行金融业务。
1.4 安全底层原则
- 只读优先。
- 账本写入必须强契约、租户隔离、幂等、原子双分录及失败复核。
- AI不得自主触发充值、提现、转账、兑换、开卡、卡片充值或任何资金副作用。
- U-卡开卡与卡片充值属于高危金融操作，必须人工触发并实施双重审批。
- Provider异常、签名配置缺失、环境身份不明或契约失效时统一fail-closed。

2. 过去30天已落地完成工作明细
2.1 架构与流程层
- 建立总控、开发、测试、联调环境四职能协同模式。
- 固化PR Draft、Ready、CI、人工授权、UAT、合并、部署的分层门禁。
- 建立SHA不可变基线制度；拒绝以短SHA、分支名、latest或平台绿色状态替代运行身份。
- 建立PASS / FAIL / BLOCKED / NOT_VERIFIED / B_DEFERRED状态体系。
- 建立资金类路径fail-closed策略。
- 建立Draft PR CI节流：Draft只运行轻量lint；Ready后执行完整构建、类型、测试和安全Gate。
- 为CI job设置超时、npm lockfile缓存，并取消feature分支push的无差别重型运行。
- 建立人工UAT模式及UAT_RESUME_AUTHORIZATION显式授权门控。
- 终止不可执行的跨会话Git Bundle交付链，改用远端CI与可追溯SANDBOX运行证据。
2.2 后端业务层
- Admin多租户SaaS底座：租户、用户、Workspace、角色与权限隔离。
- U-卡模型：实体卡、虚拟卡、Card Product、租户启用关系和currencyId绑定。
- 资产与钱包模型：租户范围、金额精度、分页和环境隔离。
- 链上充值地址安全体系：地址分配/轮换不得由AI或普通UAT触发。
- 提现安全态：真实提交默认禁止，前后端双重拦截。
- 链上流水列表：服务端范围派生、游标分页、错误安全降级。
- currencyId统一合同：开卡必须使用租户内启用的currencyId，拒绝裸ISO、跨租户或禁用产品。
- PR #69配套后端PR #260包含四个FastLink本地能力：链上充值预览（短期previewId、签名/到期绑定、零账本与零Provider写入）；链上流水列表（租户/用户/环境范围、游标校验、读取失败安全降级）；卡片充值报价（一次性quoteId、字符串金额、签名配置缺失时fail-closed；后续结算必须原子双分录）；开卡currencyId契约（虚拟卡与实体卡均使用规范ID）。
- CardTopupService在本地quote签名配置缺失时恢复CARD_TOPUP_QUOTE_UNAVAILABLE fail-closed，同时保持currencyId合同。
- 卡产品读取增加租户范围与有界超时策略。
- FX quote-only在不可用时返回503 FX_QUOTE_ONLY_UNAVAILABLE，并明确未发生兑换或资金移动。
2.3 Cregis第三方模块
- 原feature/ucard-core-saas-platform重放到dev基线。
- 冲突处理：prisma/schema.prisma保留Phase2链上/卡片模型，新增Cregis/UCard模型，并清理9个重复反向关系；src/app.module.ts同时保留Phase2OnchainModule与ThirdPartyModule；未删除、替换或改写PR #69本地业务逻辑。
- PR #261已实现并合并：Cregis充值与提现接口骨架；请求签名和回调验签；幂等回执；本地账本协调；secret://引用校验；外部执行fail-closed门控；PR #69协调事件DEFERRED/REQUESTED逻辑。
- 外部执行门控仅在SANDBOX + TEST + PR69_LOCAL_API_RELEASE_STATUS=MERGED_AND_UAT_ACCEPTED + CREGIS_EXTERNAL_SANDBOX_EXECUTION_STATUS=APPROVED_AFTER_PR69_UAT时允许继续。
- Cregis真实Sandbox调用、回调联通和资金状态验证均未执行。
- 独立Fiat Exchange Order API未实现，状态固定为B_DEFERRED / OUT_OF_SCOPE，后续分支feature/cregis-fiat-exchange。
2.4 前端钱包客户端层
- Lovable钱包UI导出并迁移到独立feature/phase2-onchain-client，排除Admin冗余代码。
- 已具备资产首页、链上充值、提现、交易流水、U-卡卡片、FX只读安全态及i18n基础。
- 高危按钮维持禁用/只读隔离；SANDBOX、DEV和PROD视觉身份区分。
- 鉴权使用Cookie Session、CSRF和Idempotency；禁止把Bearer Token粘贴到浏览器存储。
- 已对接v2钱包onchain与卡片契约。
- Cloudflare Worker构建可展示环境与Build SHA。
2.5 部署与CI/CD层
- Cloudflare Worker前端部署链路已打通，前端Build可追溯。
- Railway DEV/TEST基础服务存在；TEST自动部署已关闭。
- TEST公开钱包入口：https://fastlink-wallet-test.adhesive-snowshoe.workers.dev/
- 已核验当前TEST后端服务名称fastlink-backend-test和稳定Deployment回滚入口。
- 根railway.json仍含npx prisma migrate deploy，实际候选部署必须禁止使用该路径。
- PR #263新增/railway.sanlx-test.json，明确无preDeployCommand、Migration、Seed、Reset或DDL；根railway.json未修改。
- 凭据、密钥、Token、Cookie不得进入聊天、CI、部署日志或归档；一次性测试凭据仅可在受控本地TTY单次显示。
2.6 测试与UAT体系
- 形成47项人工只读UAT矩阵：RT-001至RT-005、PR69-UAT-001至PR69-UAT-042。
- 覆盖资产、充值地址/安全预览、提现安全态、链上流水、卡片currencyId/安全报价、FX quote-only安全态。
- 明确资金写路径永久排除：充值intent、提现提交、开卡、卡片充值结算、转账、兑换下单。
- 第一次人工浏览器回执确认TEST登录页可达、环境为TEST、前端Build为89a5…，但登录态业务用例缺少专用账号。
- UAT原始报告为16 PASS / 0 FAIL / 31 BLOCKED；随后因错误地将前后端SHA作数值比较曾改为15 PASS / 1 FAIL / 31 BLOCKED；该FAIL后经开发复核撤销为“后端运行身份/配对NOT_VERIFIED”。当前规范化状态为：15项已证明PASS；0项已证明业务FAIL；RT-003及31项登录/固定安全项合计32项BLOCKED；总体BLOCKED，且不构成PR #69业务回归失败。
- 未注册新账户、未使用生产身份、未进行任何资金或Provider操作。
2.7 SANL-X夹具安全工程
SANLX-FIXTURE-001独立PR #263已实现：
- TEST/SANDBOX环境硬门禁；tenant allowlist；sandbox:fixtures:write RBAC；HMAC签名、5分钟时效、nonce重放保护；幂等创建；固定24小时TTL；UAT_READONLY写路径拒绝；Signed DISABLE；按fixtureId + tenantId + environment精确CLEANUP；会话撤销；一次性凭据仅本地/dev/tty输出。
- 该实现不会创建Tenant；只会在既有ACTIVE TEST Tenant内创建UAT_READONLY Customer。
- Schema已验证为COMPATIBLE_NO_MIGRATION。
- 当前缺口SANLX-FIXTURE-002：没有受控、签名、强制事务只读的Tenant/Workspace/管理员/RBAC PRECHECK命令。

3. 当前项目固化快照
3.1 业务与阶段
- 主体业务：U-卡实体卡、虚拟卡发行与生命周期管理。
- 配套能力：Prime钱包、链上资产、Cregis、FX。
- 阶段：Phase2收尾；SANL-X夹具与TEST人工UAT前置。
- Fiat Exchange：B_DEFERRED · OUT_OF_SCOPE。
- PROD：NOT_APPROVED · PROHIBITED。
3.2 Git、PR与SHA
- fastlik-backend PR #260：MERGED；reviewed head 4fb069c180f736f312a282218dc1610b509aaf79；merge commit 4c6273e459843af2e00bca68fc127e4689fc2279。
- fastlik-app PR #69：MERGED，不再是Draft/Open；reviewed head 1f2d794d367dea471e7db128d87be3179de1365e；merge commit 91ce890fcb27ed042d9547d3083c63bd2e2e31d6。
- fastlik-backend PR #261：MERGED；head 69b5c5c48b2f16b5386d333424249f246ccd9430；merge/dev baseline 38d9fdefe4ec524b391c5d908a7c43b4193ecdd4。
- fastlik-backend PR #263：READY FOR REVIEW · OPEN · NOT MERGED；branch feature/sanlx-readonly-fixture；head abbfc411dfb7941e58579fd2e7cf7a0d82204af6；base dev@38d9fdefe4ec524b391c5d908a7c43b4193ecdd4。
链接：
- Backend PR #260: https://github.com/xw564477242-cmyk/fastlik-backend/pull/260
- Frontend PR #69: https://github.com/xw564477242-cmyk/fastlik-app/pull/69
- Cregis PR #261: https://github.com/xw564477242-cmyk/fastlik-backend/pull/261
- SANL-X PR #263: https://github.com/xw564477242-cmyk/fastlik-backend/pull/263
- Archive Issue #262: https://github.com/xw564477242-cmyk/fastlik-backend/issues/262
3.3 PR #263测试证据
- Build / Lint：PASS。
- SANL-X定向测试：6 suites / 30 tests PASS。
- 全量单元：167 suites / 1,444 tests PASS。
- HTTP/E2E：46 suites / 450 tests PASS。
- Secret Scan：PASS；git diff --check：PASS；Workflow YAML：PASS；Railway Schema/禁用命令检查：PASS。
远端CI：
- Backend Pull Request Gate: https://github.com/xw564477242-cmyk/fastlik-backend/actions/runs/33173648682
- FastLink Backend Non-Production CI: https://github.com/xw564477242-cmyk/fastlik-backend/actions/runs/33173648665
- Dev Reset Round Trip: https://github.com/xw564477242-cmyk/fastlik-backend/actions/runs/33173648738
三项均绑定abbfc411dfb7941e58579fd2e7cf7a0d82204af6并为completed/success。该证据不覆盖尚未实现的SANLX-FIXTURE-002。
3.4 TEST/SANDBOX运行状态
- Wallet URL：https://fastlink-wallet-test.adhesive-snowshoe.workers.dev/
- Frontend Worker Build：89a5eed87395670f99a94e4075f25a5846d7892a；API显示/api。
- Backend service：fastlink-backend-test；Service ID cc85aff6…9c8a（脱敏）；Stable deployment 0484dc24…36c4（脱敏）；Current deployed backend SHA 1efc76ea79d61dd0affda87b014ea4a36101cf26；Source branch test。
- 当前config/railway.json：Effective preDeploy npx prisma migrate deploy；Custom config support YES，但/railway.sanlx-test.json尚未选择；Environment changes NONE。
结论：当前TEST Backend没有运行PR #263，也没有运行dev@38d9…；不得把平台Online或前端页面可达误报为目标候选已部署。
3.5 文件与配置指纹
dev@38d9…已归档：
- railway.json SHA-256 007fc41408a988f03c6a4d4071b30677a5ecfaf56e4812ab5f893615eccd430a。
- package-lock.json SHA-256 59af64e681afea89754aa8450e9206d14467755a033364027266d4343daab1eb。
- prisma/schema.prisma SHA-256 71d9d944afc1b73c5244eee7691e55a555cee90d20c57eeaa11044004e4dde9a。
- prisma/migrations Git Tree 5502a290a22f6b660d015619fcb54f15b61fc739。
- Prisma CLI/client 6.19.3 / 6.19.3。
PR #263专用配置 /railway.sanlx-test.json：preDeployCommand ABSENT；Migration / Seed / Reset / DDL ABSENT；Dockerfile、node dist/src/main.js、/api/health、ON_FAILURE、MAX_RETRIES=3已通过静态验证。
3.6 本地工作区提醒
- fastlik-backend本地工作区：feature/sanlx-readonly-fixture，HEAD abbfc411…，检查时干净。
- fastlik-app本地工作区：feature/phase2-onchain-client，存在用户历史文档修改和未跟踪文档；不得清理、覆盖或把该本地工作区误称为远端dev。
- sources目录是只读项目镜像，禁止编辑、移动、重命名或删除。

4. 阻塞问题与未完成任务完整台账
4.1 P0：SANLX-FIXTURE-002受控只读预检缺失（OPEN · DEVELOPMENT REQUIRED）
现有PR #263只有CREATE / DISABLE / CLEANUP。CREATE要求预先知道exact tenantId和actorTenantUserId；环境侧当前不知道既有TEST Tenant、Workspace、活跃管理员和sandbox:fixtures:write权限。禁止手工SQL或一次性Prisma查询，因此必须先补齐可审计PRECHECK。
验收要求：
- 签名、TEST-only、5分钟时效、nonce与环境绑定。
- 数据库事务/session强制只读，并验证transaction_read_only=on。
- 只读Tenant、TenantUser、TenantUserRole、Role、RolePermission、Permission。
- 仅发现ACTIVE TEST/SANDBOX Tenant、Workspace及具fixture权限的ACTIVE管理员。
- exact IDs只写本地/dev/tty；stdout只输出脱敏计数和不可逆摘要。
- 不输出Email、密码、Secret、连接串或完整ID。
- 禁止任何create/update/delete/upsert/DDL/migration/seed/reset。
- 不读取钱包、卡片、余额、账本、流水、Provider、会话或真实客户金融数据。
- 不在CI或开发阶段连接环境数据库。
- 新Head必须重跑完整本地与三项远端CI。
4.2 P0：PR #263环境最终门禁未满足（BLOCKED · WAITING FOR NEW PRECHECK IMPLEMENTATION）
缺失：SANLX_FIXTURE_SIGNING_KEY密封引用；SANLX_FIXTURE_TENANT_ALLOWLIST密封引用；TEST数据库Host/Project/Schema/Role的独立脱敏身份匹配；既有TEST Tenant、Workspace、活跃fixture管理员和权限；本地安全TTY、Shell History关闭、录屏/日志不采集的操作证据；选中/railway.sanlx-test.json后的有效配置预览。
禁止事项：在PRECHECK开发和新CI完成前，不申请数据库读取、Railway Apply或部署；不使用根railway.json部署候选；不通过清空Dashboard pre-deploy抵消代码配置。
4.3 P0：PR #69人工UAT暂停
PR #69已经合并，因此本项是合并后验收阻塞，不是PR #69合并阻塞。当前规范化UAT：15 PASS / 0已证明FAIL / 32 BLOCKED。
主要原因：未有可登录的UAT_READONLY SANL-X专用账号；PR #263未部署和执行；当前TEST Backend SHA为1efc76…，不是PR #263候选；登录后资产、充值、提现、流水、卡片和FX只读链路均未完成。
UAT_RESUME_AUTHORIZATION曾设为YES，但因SANL-X夹具不存在而暂停。夹具完成、隔离反证通过并经新总控再次明确授权前，不得恢复。
4.4 P1：卡片充值报价端到端验收未闭环
代码/测试层已有quote-only、签名fail-closed、currencyId和原子结算合同。浏览器只读UAT尚未验证真实TEST数据下的Card Product、currencyId、quote响应和无副作用证明。仍禁止实际卡片充值结算。
4.5 P1：Cregis TEST/SANDBOX真实联调未开始
PR #261已合并，但TEST当前没有部署目标dev基线。Cregis Sandbox AK/SK密封引用、专用Callback、数据库隔离和Migration审查未完成。未调用Cregis Sandbox，更未使用Mainnet。应在PR #69后验收与SANL-X闭环后再进入。
4.6 P2：Fiat Exchange独立能力延期
FIAT_EXCHANGE_STATUS：B_DEFERRED。独立下单API不存在。未来分支：feature/cregis-fiat-exchange。不得在PR #263、PR #69 UAT或Cregis充提验收中把它标记为PASS。
4.7 归档同步状态
本地CREGIS-PHASE-ARCHIVE-2026-08-26.md包含截至SANLX-FIXTURE-002缺口的记录。GitHub Issue #262存在，但最近自动外发未获授权，不能宣称已同步最新状态。本交班包附可人工粘贴的Issue摘要；新总控取得明确授权后才能外部更新。

5. 项目全套不可突破安全红线
- AI不得自动发起账本写入、余额变更、充值、提现、转账、兑换、U-卡开卡或卡片充值。
- 所有金融写操作必须由人触发，并经过双重审批、幂等与原子账本校验。
- 聊天、PR、Issue、CI、部署日志和文档禁止出现密码、Token、Cookie、私钥、AK/SK、Webhook Secret、数据库连接串。
- Preview/Quote必须校验合法契约ID、签名、范围、到期和幂等；无合法契约直接拒绝。
- UAT只读优先，不得通过真实调用“试探”接口是否有副作用。
- PROD永久禁止智能体部署、修改、调试或金融业务操作。
- DEV、联调、TEST、PROD不得复用配置、密钥、账号、Callback或数据。
- Draft PR不得自动合并；Ready PR也必须在人工评审、CI和总控审计完成后由人决定。
- PR #263当前虽Ready，仍禁止合并、部署或运行夹具。
- third-party适配器必须与U-卡核心domain解耦。
- Provider异常或身份/配置不明时fail-closed，不允许静默降级为真实调用。
- 禁止Migration、Seed、Reset、DDL、手工SQL或宽泛清理，除非存在独立明确授权和恢复方案。
- SANL-X只允许TEST/SANDBOX、tenant allowlist、UAT_READONLY、固定TTL、精确disable/cleanup。
- 一次性凭据仅受控本地TTY单次显示；禁止Shell History、录屏和日志采集。
- 不得把Frontend Worker SHA与Backend SHA数值相等作为配对规则；必须使用仓库、Deployment、API Origin和时间证据。
- U-卡实体/虚拟卡稳定性优先于钱包和第三方集成。

6. 四智能体岗位职责固化模板
6.1 新总控统筹
维护唯一全局快照、SHA、PR、CI、环境、UAT和缺陷状态；做证据分级、冲突纠正、风险识别、授权边界和任务流转；优先确认U-卡主体业务不受第三方或夹具变更影响；不开发、不测试、不部署、不合并、不迁移、不调用API。除必须由开发/测试/环境执行的工作外，其他归档、复核和指令编制均由总控完成。
6.2 新开发智能体
当前第一任务仅为SANLX-FIXTURE-002；在PR #263范围内实现PRECHECK，不扩大到Cregis、Fiat Exchange或PR #69业务代码；维护分支、PR和完整CI，保留No-Migration路径；不部署、不连接TEST数据库、不运行fixture、不接触凭据；回传完整Head SHA、文件清单、测试数、CI URL和安全影响。
6.3 新测试智能体
在总控明确恢复授权后执行47项人工只读UAT汇总；不自动访问外部SANDBOX，不持有或转发凭据；维护PASS/FAIL/BLOCKED/B_DEFERRED与缺陷台账；登录态验收优先覆盖资产、充值地址、提现安全态、链上流水、卡片currencyId/报价和FX安全态；不执行开卡、卡片充值结算、充提、转账、兑换或任何资金写入。
6.4 新联调与环境智能体
负责Railway/Cloudflare/TEST配置与证据，只在逐步授权后执行变更；首先只读核验Runtime、DB身份、Secret引用、Tenant/Admin、TTY、回滚和配置路径；仅使用/railway.sanlx-test.json，绝不运行根配置中的prisma migrate deploy；受控执行PRECHECK、Provision、隔离反证、Disable/Cleanup；凭据只在本地TTY；Cregis联调必须等待钱包UAT闭环及独立Sandbox授权。

7. 新总控接手强制执行顺序
Gate 0：交班接收——阅读本白皮书、CREGIS阶段归档和PR #69 UAT范围；核对PR #263仍为Open/Ready/Not merged，Head是否仍为abbfc411…；若任何SHA或PR状态变化，先更新快照，不沿用旧CI。
Gate 1：开发SANLX-FIXTURE-002——向开发智能体下达受控只读PRECHECK任务；保持PR #263范围，不创建Migration，不修改Cregis/Fiat/PR #69；取得新Head、完整本地结果和三项新远端CI；新总控静态审计PRECHECK确实强制事务只读、TTY脱敏和零金融表读取。
Gate 2：环境最终只读复审——核验TEST Runtime、DB脱敏身份、既有Tenant/Workspace、管理员权限；核验两个SANLX密封引用名称已准备，但不读取值；核验安全TTY、History/录屏/日志控制和稳定Deployment回滚；预览选用/railway.sanlx-test.json后的有效配置，确认无preDeploy；返回READY_FOR_AUTHORIZATION前不Apply。
Gate 3：逐步人工授权的TEST落地——人工授权候选部署后，部署固定PR #263 Head，禁止Migration；核验Runtime SHA、Artifact、配置路径和TEST环境；人工授权只读PRECHECK后，由环境智能体在受控TTY执行；操作人员本地选择获批Tenant/Workspace/Admin，并创建密封allowlist引用；人工授权Provision后创建UAT_READONLY、24小时TTL夹具；一次性Workspace/Email/Password只在本地TTY显示，不进入聊天；执行白名单用户可见、同租户非白名单不可见、其他租户不可见的隔离反证。
Gate 4：恢复PR #69合并后人工UAT——新总控重新签发UAT_RESUME_AUTHORIZATION=YES；人工浏览器从RT-001开始执行47项；重点：U-卡实体/虚拟卡基础状态、资产、充值地址、提现安全态、链上流水、currencyId、Card top-up quote-only、FX quote-only；严禁提交开卡、卡片充值、充值intent、提现、转账、兑换；测试智能体汇总正式报告；总控登记缺陷及责任域。
Gate 5：缺陷闭环与PR #263处置——仅对明确可复现缺陷回派开发；每次修复必须新Head、新CI、新环境证据、新复测；UAT与隔离/cleanup通过后，再由人工决定是否合并PR #263；总控不得自动合并。
Gate 6：Cregis TEST/SANDBOX——以已合并dev@38d9…及后续合法合并提交为源，重新锁定最终SHA；审查Migration与隔离数据库，不得沿用未经批准的preDeploy；配置Cregis Sandbox专用AK/SK密封引用、独立Callback和TEST数据库；分层验证签名、充值地址、充值回调、提现请求、回调幂等和fail-closed；全程Sandbox，不使用真实资产；Fiat Exchange继续B_DEFERRED，除非独立PR完成并通过门禁。
Gate 7：Phase2冻结——形成最终版本、环境、测试和风险记录；关闭或转移所有未解决缺陷；只有人工产品/工程/安全批准后才规划下一迭代。

8. 本会话收尾约束
本白皮书输出后：旧总控进入READ-ONLY ARCHIVE SLEEP；停止15分钟轮询，避免旧上下文继续影响新决策；不再执行开发、调试、部署、UAT、CI、Git、Railway、数据库、Cregis或资金操作；后续用户消息如误发到旧会话，只回复“请转至新总控任务”，不得继续项目执行；旧会话保留为历史证据，不删除；新总控以本交班包作为启动输入，但仍需重新核验任何可变外部状态。

附录A：关键决策与事件时间线
- 2026-08-25：PR #69后端候选修复、CardTopup fail-closed、currencyId和全量测试；后端reviewed head 4fb069…
- 2026-08-26：先合并后端PR #260，再合并前端PR #69；backend dev 4c6273…；frontend dev 91ce89…
- 2026-08-26：Cregis分支rebase，解决Schema/AppModule冲突；Cregis范围独立。
- 2026-08-27：CI节流、PR #261三项CI恢复；PR head 69b5c…三项重CI PASS。
- 2026-08-27：PR #261合并；dev/merge 38d9fd…
- 2026-08-27：否决错误基线731c…；RELEASE-EVIDENCE-REJECTED。
- 2026-08-27：静态审计railway/lockfile/schema/migrations；记录四项指纹；Migration HOLD。
- 2026-08-27：停用Git Bundle链路；改为远端CI+SANDBOX直接验证。
- 2026-08-27：正式下发PR #69 SANDBOX UAT；因Runtime/范围证据阻塞。
- 2026-08-28：切换人工UAT模式；47项清单生成。
- 2026-08-28：人工登录页UAT；15 PASS / 0已证明FAIL / 32 BLOCKED。
- 2026-08-28：缺少TEST专用账号；UAT暂停。
- 2026-08-28：SANLX-FIXTURE-001实现PR #263，aeafdc…
- 2026-08-28：PR #263发布门禁补强；Head abbfc…，三项CI PASS。
- 2026-08-28：Railway TEST只读复审；当前SHA 1efc…；根配置有migration；未变更。
- 2026-08-28：发现无受控PRECHECK新缺口；SANLX-FIXTURE-002。
- 2026-08-28：月度交班冻结；旧集群退役，新集群接手。

附录B：47项UAT当前状态
- RT-001、RT-002、RT-004、RT-005：4 PASS（TEST页面、环境标签、API显示和Cookie安全说明）。
- RT-003：1 BLOCKED / NOT_VERIFIED（当前只证明前端Build；后端Runtime/配对不由该字段证明）。
- PR69-UAT-001至011：11 PASS（未登录页面、布局、焦点、刷新和安全显示）。
- PR69-UAT-012至015：4 BLOCKED（固定安全/页面前置项未进入）。
- PR69-UAT-016至031：16 BLOCKED（缺少获批TEST UAT_READONLY账号）。
- PR69-UAT-032至036：5 BLOCKED（固定高危/副作用门禁，不得通过实际写请求验证）。
- PR69-UAT-037至042：6 BLOCKED / B_DEFERRED（FX quote-only安全态待登录；Fiat Exchange下单OUT_OF_SCOPE）。
合计47：15 PASS / 0 FAIL / 32 BLOCKED；未发生业务写入。

附录C：当前缺陷台账
- SANLX-FIXTURE-002｜P0｜OPEN｜开发｜缺少签名、TEST-only、强制事务只读PRECHECK。
- ENV-SANLX-001｜P0｜BLOCKED｜环境｜Signing Key与Allowlist密封引用未准备。
- ENV-DB-IDENTITY-001｜P0｜BLOCKED｜环境｜TEST DB身份和Role/Schema未脱敏验证。
- ENV-TENANT-RBAC-001｜P0｜BLOCKED｜环境｜既有Tenant/Workspace/Admin/权限未知。
- ENV-TTY-001｜P0｜BLOCKED｜环境/人工｜TTY、History、录屏和日志控制未验证。
- UAT-AUTH-001｜P0｜BLOCKED｜总控/环境/人工｜无可用UAT_READONLY登录夹具。
- UAT-PR69-001｜P1｜BLOCKED｜测试｜登录后完整只读UAT未执行。
- UAT-CARD-QUOTE-001｜P1｜BLOCKED｜测试｜卡片充值quote-only E2E未闭环。
- CREGIS-SBX-001｜P1｜NOT_STARTED｜环境/测试｜Cregis Sandbox未部署/联调。
- FIAT-ORDER-001｜P2｜B_DEFERRED｜后续开发｜独立法币兑换下单API未实现。

附录D：新总控首次启动检查
1. 读取本白皮书。
2. 读取../CREGIS-PHASE-ARCHIVE-2026-08-26.md。
3. 读取../PR69-READONLY-SANDBOX-UAT-SCOPE-2026-08-27.md。
4. 核验PR #263当前Head/状态，禁止沿用过期CI。
5. 把SANLX-FIXTURE-002作为唯一开发首任务。
6. 维持PR #261、PR #69和Cregis业务范围冻结。
7. 维持Fiat Exchange B_DEFERRED。
8. 不自动更新Issue #262，除非用户明确授权外部写入。
9. 不恢复UAT，直至Fixture部署、隔离反证和总控重新授权。
10. 不触碰生产、真实Provider或资金操作。

附录E：归档材料索引
- ../CREGIS-PHASE-ARCHIVE-2026-08-26.md
- ../PR69-READONLY-SANDBOX-UAT-SCOPE-2026-08-27.md
- ../deliverables/fastlik-app/docs/PR69-MERGE-EXECUTION-RECORD.md
- ../deliverables/fastlik-app/docs/PR69-FINAL-MERGE-VALIDATION.md
- ../deliverables/fastlik-backend/docs/SANLX-FIXTURE-001.md
- ../deliverables/fastlik-backend/railway.sanlx-test.json
- ../deliverables/fastlik-backend/scripts/sanlx-readonly-fixture.ts

================================================================
【白皮书正文结束】
