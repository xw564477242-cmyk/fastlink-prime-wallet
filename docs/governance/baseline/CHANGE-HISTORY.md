# 变更历史归档日志

> 本版本是首个正式项目级基线固化点，不代表此前全部历史原文已经完成归档。缺失的早期原始记录保持“待归档”状态，当前摘要及证据引用不得替代原始审计记录。

版本：`BASE-V1.0-20260930`。这是首次落盘的项目级日志，既有完整历史前缀未取得；没有宣称已导入或验证此前日志。以下FL-DEV-001记录是本轮取得的第一条完整原文，之前历史保持“原始历史正文待归档”。新日志不替换、删除或改写任何其他已有历史记录。

<!-- BEGIN SOURCE: FL-DEV-001-历史追加原文 -->
## 2026-09-30｜FL-DEV-001｜六仓正式开发环境基线

- 工单编号：`FL-DEV-001`
- 状态：门禁5通过、已闭环
- PR：`#80`
- 获批提交：`798dc304bd148963cb561563d295eecccf551ae4`
- 合并提交：`6c1473b93cb3d2ad122cf974a6c843950a0f4da6`
- 合并时间：2026-09-30 13:04:06（北京时间）
- 合并后CI：运行`36671709135`，`verify success`
- 变更范围：119个新增治理文件、14,751行新增、0行删除
- 基线证据引用：`docs/governance/FL-DEV-001/`
- 开发工作区：六个业务仓库已在长期受控目录建立独立工作区，权限`700`。
- 工具链：Node.js `22.22.1`、npm `10.9.4`；新钱包另使用Bun `1.3.14`。
- 测试结果：
  - 新钱包579项通过；
  - 旧应用409项通过；
  - Admin 162项通过；
  - Website 95项通过；
  - 后端1,755项单元/HTTP测试及2项数据库测试通过；
  - Control-plane只读CLI校验通过。
- 启动结果：四个前端服务完成回环健康检查；后端完成隔离健康检查；Control-plane无Web服务。
- 分支结论：缺失和分叉已记录，本工单没有创建、修复或晋升远端长期分支。
- 独有资产：4个本地独有提交、后端023差异和38个未匹配候选保持原样。
- 工作树：三条失效登记已移除；21个备份文件及校验记录保留。
- 永久偏差：
  - 工作树登记未经事前门禁批准被清理；
  - index变更前原始字节不可恢复；
  - 工具引用写入进程未最终归因。
- 发布状态：未部署、未晋升环境。
- 作废方案：治理文档使用独立revert PR撤销；不得恢复index或登记、删除备份和工具引用、执行GC或改写审计记录。
<!-- END SOURCE: FL-DEV-001-历史追加原文 -->

## 2026-09-30｜FL-BASE-001｜首个项目级基线固化送审

- 版本：`BASE-V1.0-20260930`。
- 状态：门禁1通过；文件固化并提交门禁2材料，门禁2/3/5待评审；未合并、未部署、未晋升环境。
- 内容依据：本轮用户提供的完整活跃基线、FL-DEV-001闭环意见和历史追加原文。
- 来源边界：缺失的早期原始历史正文与完整前缀待归档，当前摘要及证据不能替代旧日志。
- 永久偏差：DEV1-T03、DEV1-T12继续LIMITED，原FAIL、错误证据、V1更正包、21项备份、工具引用和校验记录持续保留。
- 写入范围：仅docs/governance/baseline/内新增治理文件；无业务、生产配置、数据库或环境变更。
- 后续：取得缺失原文后仅追加；合并和最终验收另行追加，不覆盖本记录。

## 2026-09-30｜FL-BASE-001正式基线固化

- 工单：`FL-BASE-001`
- 基线版本：`BASE-V1.0-20260930`
- 状态：门禁5通过，工单正式闭环
- PR：`#81`
- 获批提交：`2e25033595b5f1ea1aaea0ed65d3c6ae73db5914`
- 合并提交：`1686d504ec2c44f06718d70e6e4b0c6f92452de8`
- 合并时间：2026-09-30 14:54:30（北京时间）
- 合并后CI：`36680731106`，`verify success`
- 交付范围：17个新增文件、1,776行新增、0删除
- 部署及晋升：未发生
- 变更：新增项目级正式快照、状态摘要、归档版、追加式历史日志及校验证据。
- 验收结论：门禁5通过，FL-BASE-001闭环，`BASE-V1.0-20260930`正式生效。
- 保留事项：早期原始历史正文待归档；DEV1-T03、DEV1-T12永久偏差继续保留；安全风险及P0阻塞项未关闭。
- 作废方案：无。若未来替换基线版本，只能追加新版本和作废说明，不删除或覆盖本记录。

## 2026-09-30｜全量归档证据登记：0928项目现状总表PDF

- 动作：将《FastLink项目现状总表（全部盘点结果·资料库补核更新版）》PDF 登记为全量归档证据源，建立页/章节索引导航；不复制全文、不改写历史。
- 证据：PDF 1321页，SHA-256 `79ec6d3451d61f10eb41445ea14a3d3e791181f23e8ed50b8f01ea7793299538`，导出 2026-09-28 22:00+08:00；源 markdown SHA-256 `871cf544200dd31812ca957ce3ed2b3fbd414ac7aafb0b9d2c0868471d1f0747`。
- 索引文件：[`FULL-ARCHIVE-INDEX.md`](FULL-ARCHIVE-INDEX.md)。
- 记录的偏差：PDF 扉页所印源 md SHA（`270dd0…`）与现盘 md（`871cf5…`）不一致，系 PDF 导出后 md 继续编辑所致；以 PDF 为只读归档快照、md 为工作底本，二者不互证字节一致。
- 边界：仅登记与导航，无业务/环境/数据库变更；早期原始历史正文仍待归档。

## 2026-10-01｜阶段路线图固化（门禁1目标对齐依据）

- 动作：将用户提供的八阶段路线图固化为正式路线图文件，作为后续工单「目标对齐校验」依据；不执行其中任何阶段任务。
- 文件：[`ROADMAP.md`](ROADMAP.md)。
- 内容：阶段1正式开发环境收口 → 阶段2安全资产治理 → 阶段3 DEV业务功能与集成 → 阶段4 TEST系统验证 → 阶段5合作方UAT与合规 → 阶段6生产就绪评审 → 阶段7灰度+Hypercare → 阶段8正式运营与持续治理。
- 当前位置锚定：阶段1主体已闭环（FL-DEV-001）；当前处于阶段2；阶段3资金模块以 RLS 与函数级权限验收通过为硬前置。
- 边界：仅路线登记与对齐锚点，无业务/环境/数据库/凭据变更；Thredd/Cregis 真实链路与线上复验仍须各自独立授权。

## 2026-10-05｜补录：2026-08-28「FastLink 新总控交班」缺口回填

- 记录性质：**事后补录（backfill）**。事件发生于 2026-08-28，因该段新总控对话未进入 0928 全量总表源语料，于 2026-10-05 经只读核对 1321 页 PDF 后补登；不伪称当时已记录。
- 核对结论：0928 总表已收录底层 SANL-X 工作线（主题 H33/H32，写作 `SANL-X`/`PR263`：PR263 创建 24 小时只读 fixture、002 补签名、PR263 当时未部署；47 项 UAT 15 PASS/32 BLOCKED），但**未收录**本次交班的实时编排状态。
- 本次补登的交班要点（`HANDOFF_ACCEPTANCE_STATUS: ACCEPTED`，运行模式 `READ_ONLY ORCHESTRATION`，阶段 GATE 1·SANLX-FIXTURE-002，生产 `NOT_APPROVED·PROHIBITED`）：
  - PR #263 OPEN·READY·NOT MERGED，head `abbfc411dfb7941e58579fd2e7cf7a0d82204af6`，base dev@`38d9fdefe4ec524b391c5d908a7c43b4193ecdd4`；
  - 三项 CI `33173648682`/`33173648665`/`33173648738` 均 SUCCESS，仅证明旧 head 的 SANLX-FIXTURE-001 通过，**不得**用于证明 002；
  - 唯一开发任务 SANLX-FIXTURE-002：受控 PRECHECK，强制 TEST/SANDBOX、HMAC、五分钟时效、nonce、环境绑定、事务只读，须验证 `transaction_read_only=on`；禁止 Migration/Seed/Reset/DDL；
  - UAT 维持 PAUSED（15 PASS/0 PROVEN FAIL/32 BLOCKED），须重新签发 `UAT_RESUME_AUTHORIZATION=YES` 方可恢复；
  - Cregis Sandbox NOT_STARTED、Fiat Exchange B_DEFERRED、Production NOT_APPROVED·PROHIBITED、Issue #262 未更新。
- 边界：本次仅为证据补登与缺口回填，未执行 PRECHECK/Fixture、未合并/部署、未访问 Railway/Cloudflare/数据库；不改变任何 P0 阻塞与资金硬前置状态。
- 作废方案：无。后续若该 PR 合并或 SANLX-FIXTURE-002 推进，只能追加新记录，不覆盖本补录。

## 2026-10-05｜交班白皮书全文原样归档（源文件固化）

- 动作：将《FastLink 月度项目归档 & 交班白皮书》（FASTLINK-HANDOFF-2026-08-28）**全文原样**固化为只读源文件，补齐此前仅有「要点摘要」、缺全文的归档缺口；只追加，不改写。
- 源文件：[`sources/FASTLINK-HANDOFF-WHITEPAPER-2026-08-28.md`](sources/FASTLINK-HANDOFF-WHITEPAPER-2026-08-28.md)。
- SHA-256：`837cba7bae4f01c2373b8a612fff7b8c7dd2147db99fa43f46a2c787e125925b`。
- 内容范围：白皮书 0–8 节及附录 A–E（事实纠正、架构、已落地工作、固化快照、阻塞台账、安全红线、四职能职责、Gate 0–7、UAT 47 项、缺陷台账、材料索引）。
- 保密核对：全文不含密码、Token、Cookie、私钥、连接串等凭据；仅含 SHA、URL 与脱敏标识。
- 边界：仅归档固化，未执行其中任何开发/测试/部署/合并/Migration/API/资金动作；与后续只读核验冲突处，另在本日志追加纠正，不涂改源文件。

## 2026-10-11｜FL-DB-015 V13 回滚只读审查一次性特例豁免（已到期）｜BASE-V1.1-20261011

- 动作：应执行需要，向基线追加一条一次性特例豁免条款，并在审定后记录结论；只追加，上一版本 BASE-V1.0-20260930 原样保留。
- 豁免范围：仅限 FL-DB-015 V13 事务 rollback 生命周期只读审查内的 23505 约束行为确认与回滚后数据指纹取证（认定为原始 Gate1 清单项的原生验收条件，非新增独立任务）；不可复用至其他 Gate1 前置补证项。
- 执行边界：全程只读，不写 SQL、不改容器/角色/权限、不重试、不启动容器、不部署/清理/删除、不覆盖旧失败日志与 SHA 证据。
- 审定结论：23505 仅证明唯一性冲突、不能确认预期 Customer_pkey（NOT_VERIFIED）；回滚后数据指纹未采集、不得用其他场景指纹替代（NOT_VERIFIED）。两项均 NOT_VERIFIED，本项审查结束，特例到期失效；Gate1 仍未通过。
- HANDOFF：`/private/tmp/FL-DB-015-v13-final-readonly-review-20261011/HANDOFF.md`。
- 后续约束：其余 Gate1 前置补证条目继续执行「清单锁定后执行期间不新增任何核验/取证」。
- 作废方案：无；本豁免为一次性，已随任务结束自动失效，不删除本记录。

## 2026-10-11｜FL-DB-015 V13 回滚只读审查一次性特例豁免（已到期）｜BASE-V1.1-20261011

- 动作：应执行需要，向基线追加一条一次性特例豁免条款，并在审定后记录结论；只追加，上一版本 BASE-V1.0-20260930 原样保留。
- 豁免范围：仅限 FL-DB-015 V13 事务 rollback 生命周期只读审查内的 23505 约束行为确认与回滚后数据指纹取证（认定为原始 Gate1 清单项的原生验收条件，非新增独立任务）；不可复用至其他 Gate1 前置补证项。
- 执行边界：全程只读，不写 SQL、不改容器/角色/权限、不重试、不启动容器、不部署/清理/删除、不覆盖旧失败日志与 SHA 证据。
- 审定结论：23505 仅证明唯一性冲突、不能确认预期 Customer_pkey（NOT_VERIFIED）；回滚后数据指纹未采集、不得用其他场景指纹替代（NOT_VERIFIED）。两项均 NOT_VERIFIED，本项审查结束，特例到期失效；Gate1 仍未通过。
- HANDOFF：`/private/tmp/FL-DB-015-v13-final-readonly-review-20261011/HANDOFF.md`。
- 后续约束：其余 Gate1 前置补证条目继续执行「清单锁定后执行期间不新增任何核验/取证」。
- 作废方案：无；本豁免为一次性，已随任务结束自动失效，不删除本记录。

## 2026-10-11｜重复记录关系澄清｜BASE-V1.2-20261011

- 本增量仅为文档关系澄清；既有 BASE-V1.0、BASE-V1.1 正文和历史时点状态完整保留。
- 权威摘要与历史日志中的两段 BASE-V1.1 特例记录指向同一次授权及审查，不构成第二次授权、重新生效、新增指标或第二次版本升级。
- 原特例已到期，不可复用；两项取证仍为 NOT_VERIFIED，Gate1 仍未通过，资金硬前置保持冻结。
- 原 FAIL、错误证据、更正包、备份、工具引用和历史缺口继续保留，不恢复、删除或覆盖。
- 剩余补证仅按实际可读的冻结原始清单规划，不以摘要重构，不增加指标；执行权限、资源、次数与窗口另待审批。本次不执行动态验证。


## 2026-10-12｜FL-LAUNCH-B1附带Admin编译维护修复｜本次集中补登

- 本批业务目标为首发只读卡链。以下改动为附带维护修复，分类③其他：为使基于原仓的独立Admin候选通过TypeScript编译，修改既有业务文件及类型配置；不是新增只读展示功能，也不是收紧写路径。本次才集中登记，不倒填为此前已记账。
- 实施位置：`/Users/ck/.codex/worktrees/bcae/SaaS金融平台/deliveries/FL-LAUNCH-B1-20261012-8DlMud/fastlik-Admin`。原`/Users/ck/Developer/FastLink/fastlik-Admin`未合并或回填，不能写成原仓从此编译通过。
- 所有者点名五处（候选行号）：`src/cardTransactionContract.ts:98`、`src/walletOperationListContract.ts:83`、`src/walletOperationParser.ts:55`、`src/treasuryReconciliationContract.ts:113`、`src/adminWalletTransactionContract.ts:75`。均为`never`抛错箭头函数改为`function`声明；throw、校验条件、合同逻辑不变。确实触及钱包、交易、资金对账域既有文件，不以展示措辞遮掩。
- 数量边界：上述五处只是点名子集。补丁另含`src/cardTimelineContract.ts:114`、`src/cardWorkspaceContract.ts:100`两处同类声明修复；`src/TreasuryReconciliationWorkspace.tsx:65`空状态返回类型修复；`tsconfig.app.json`增加`allowImportingTsExtensions: true`以支持已有`.ts`导入，保留`noEmit`及原strict设置。不声称仅五处改动导致整个编译通过。
- 这些维护改动未放宽strict、资金或卡写权限，未引入Provider调用；类型检查成功不证明资金验证或运行态安全。

### 既有证据引用（未重跑测试）

- 封存根目录：`/Users/ck/.codex/worktrees/bcae/SaaS金融平台/deliveries/FL-LAUNCH-B1-20261012-8DlMud`；`VERSION-MANIFEST.json` SHA-256：`7fbfc87273ee1d66f43634afb2e200f4b85acb66af3a72d6a72e7e26a0bfe1e0`。
- `checks/admin-types-baseline.json`：原仓tsc退出码2；capturedAt `2026-10-11T17:26:46.888Z`，北京时间`2026-10-12 01:26:46.888 +08:00`；原失败日志`checks/admin-types-baseline.log` SHA-256：`52fdb8e33db18b3996dc127d83f05b9f8339b2a59d74d1b3861ca5bdaf091696`。原失败保留。
- `checks/admin-sealed-types.json`：独立候选tsc退出码0；capturedAt `2026-10-11T17:33:55.179Z`，北京时间`2026-10-12 01:33:55.179 +08:00`；空日志`checks/admin-sealed-types.log` SHA-256：`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。记录中的执行cwd为当时临时候选目录，现证据位于上述持久封存目录，不改写旧执行路径。
- 候选通过不证明原仓通过、真实资金验证、运行态安全或Gate1通过。本条仅文档补登，未修改业务代码或封存包，未重跑测试；不宣布新正式基线版本或上线批准，不改变既有状态、重复记录关系、冻结门禁及永久偏差。

## 2026-10-12｜FL-LAUNCH-B1 本地候选验收（LOCAL_CANDIDATE，非发布）

- 权威登记正文：同目录PROJECT-STATUS-SUMMARY.md的同名条目；唯一权威候选代码目录为`/Users/ck/.codex/worktrees/bcae/SaaS金融平台/deliveries/FL-LAUNCH-B1-20261012-8DlMud/`。
- 总控接受本地候选交付，不表示完整运营闭环验收或整体结案。三候选29文件；95项为引用既有Mock/内存测试结果，本次未重跑，旧失败保留。
- Manifest SHA-256：`7fbfc87273ee1d66f43634afb2e200f4b85acb66af3a72d6a72e7e26a0bfe1e0`。
- 审核报告：`/Users/ck/.codex/worktrees/35cc/fastlink-prime-wallet-dev-release/deliveries/FL-LAUNCH-B1-REVIEW-20261012/HANDOFF.md`；SHA-256：`21d997c48caca390d9ff7fe96e3b3e81fea8ae0dfc8930e05928449a2124644b`。
- 未部署、未连真实数据库、未调用第三方、未合并原仓；客户端限读不代表后端写路由关闭，身份生命周期及审计既有写行为保留。
- 客服持久化、真实身份/RLS、数据新鲜度、环境版本绑定与运营就绪仍未完成；FL-DB-015 Gate1 NOT_PASSED，PRODUCTION未授权，第三方与资金批次外。
- 仅追加文档，保留旧记录、失败、正式版本号及门禁；附带编译维护引用前一登记，不重复执行。

## 2026-10-16｜真 DEV 客服迁移与 I01—I07 验证收口｜BASE-V1.3-20261016

- 授权：所有者要求将本轮交付物提交 GitHub，并更新 `docs/governance/project-master-summary.md`，登记真 DEV 迁移完成、I01—I07 全部 PASS、Gate1 NOT_PASSED、资金冻结。入口继续指向唯一权威 `PROJECT-STATUS-SUMMARY.md`；入口、正本与本日志同步追加，既有内容和重复记录不删除、不改写。
- 登记范围：真 DEV `vjauheoyeysgezbxhbcc` 的 `postgres/public` 九表客服最小迁移及合成 fixture；I07 本批四个身份/SANLX 模型投影与受保护任务 key/窄函数。不是全平台迁移、主干集成、生产/UAT 或应用部署。
- I01—I05：引用 2026-10-15 实际 PASS 与后续独立受限收尾审定，SHA256 `04457302d3cd929c9bafb69414482befc7d3fa2f6e910f1185879171c68bd738`。旧迁移轮次与原运行回执中的 STOP 保留，不回填结果；本次不重跑。
- I06/I07：2026-10-16 北京时间 11:21:54.748748—11:27:12.628083，一次运行、exit 0、无重试；两组 PASS_TRUE_DEV_RUNTIME，受限认证收尾确认。三连接 PID 集合一致、上下文清除、cookie/HMAC 负例与同租户/环境卡 Trace 边界通过。总控审定 SHA256 `a946c0e603303163fc81687f73e1f3c2ba91bf22f7792b352a6d2e5ff7d769b1`。
- 合并状态：I01—I07 全部 PASS，仅限两次已接受真 DEV 客服/补充审计运行的合并证据；不是一次原始轮次七组通过，不等于旧 FL-DB-015 Gate1 或完整 END_USER 登录链通过。
- GitHub：backend 新归档分支 `codex/b6-dev-i01-i07-20261016`，提交 [`bcb04983db3f7a2f0bf739cbd2d3c3b680a6bdf4`](https://github.com/xw564477242-cmyk/fastlik-backend/commit/bcb04983db3f7a2f0bf739cbd2d3c3b680a6bdf4)，父提交为已认下备份 `9589262a1a99e34b447a834c0b9fda07c46e2ec7`，不是当前 dev；87 份原件加 1 份公开清单。凭据/私有材料/依赖缓存排除，原字节及 SHA 保留，未为格式检查改写历史空行。
- 本次原始 RUN SHA256 `d032cc40ab121c8dfdb002d1623fdf0be1e808710d9d51c6797d0a1c9d370471`；runtime SHA256 `6a9ba1eb88eb7eaaafd1ca92a9b65423178a23683fd691cc86a67ce7a4938d6b`；HANDOFF SHA256 `698b96176a89b80c6dce1800ed76ffc8caa8ced502a0928dc52ffab44f571ad4`。完整原件路径及能力限定见权威总表本日追加。
- 收尾：runtime NOLOGIN、会话 0、TEMP=false、expiry1970，密码清空为命令 ACK；原 grantor 关系一致，任务 key 已过期退役。数据/私有材料/退出资源等保留，两条合成 Admin 租约未另行撤销、上限 12:21:54.748748+08:00 到期；不是完整退役或材料销毁。
- 不变：Gate1 NOT_PASSED，资金 FROZEN，完整 END_USER 认证未验证、API_CLIENT BLOCKED，历史失败/缺口/永久偏差保留；未合并主干、未部署、未晋升环境，未重新执行数据库操作或测试。
- 版本性质：`BASE-V1.3-20261016` 为本次状态登记增量，不替换既有正式快照或宣称新的安全/上线门禁批准。前述历史时点状态由本条承接，不涂改。
