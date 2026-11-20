# FastLink 项目基线快照 · 2026-11-12

归档编号 **FASTLINK-PROJECT-BASELINE-20261112**。范围为 2026-11-01 至 2026-11-12（北京时间），以归档时已有的治理记录和封存回执为准。正式治理基线 **BASE-V1.8-20261108**，B17 历史参考基线 **BASE-V1.4-20261102**。

截至快照，B17 为 **38/47**。固定 UAT 的 C 复合验收为 **HTTP 15/15、Context 21/21**。D 原生数据库专项已收口，首批 HTTP **3/3**，reader/replay **10/11**。3.3 的 43 表逐域隔离已验 **2/43**，另有 41 表待验。各分母对应各自的原始清单。

## 12 天成果与证据

| 时间 | 已固定的成果 | 证据入口 |
| --- | --- | --- |
| 11-01 | 开发至上线流程规范和 S1/S2 承接登记完成，原八阶段路线与门禁继续作为开工依据。B17 的 Admin d78 已单次发布至版本 `86f47012-b1ec-46af-9283-62198096bc29`。 | [流程登记回执](</Users/ck/Documents/ChatGPT/SaaS金融平台/FastLink-流程固化接入回执-20261101.json>) · [流程规范](</Users/ck/Developer/FastLink/fastlink-prime-wallet/docs/governance/DEVELOPMENT-TO-LAUNCH-WORKFLOW.md>) |
| 11-02 | B17 参考候选按 **38/47** 限定封存。继承联调基线、限定 Admin 查询与流程、同一 TEST 对象双端只读配对、维护源和修复候选的既有验证。 | [B17 原始封存](evidence/B17_SEAL.zip) · [逐项执行单](</Users/ck/Documents/ChatGPT/SaaS金融平台/FastLink-B17-当前剩余差额执行单-20261101.md>) |
| 11-03 | P1 的新 Admin 预览 Worker 版本 `697b0460-c55b-49f6-94fa-e59d9f213cc9` 发布并读回，真实响应证据限定为 401。b15 预览 Admin TTL 激活失败后恢复原值，Wallet 仅完成限定配置读取。P1 仍 OPEN。 | [P1 发布回执](</Users/ck/Documents/ChatGPT/SaaS金融平台/p1-access-auth-401-preview-20261103/publication/NATIVE-PUBLISH-RECEIPT.json>) · [预览 TTL 处置](</Users/ck/Documents/ChatGPT/SaaS金融平台/backend-scope-metadata-readonly-20261103/A-B-ACTUAL-RESULT.json>) |
| 11-04 | 固定 Railway UAT 的项目、环境、Backend、Postgres 对象绑定；取得当时部署来源与健康响应。元数据和健康分别取证。 | [对象绑定](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-20261104/F0-ACTUAL-RESULT.json>) · [健康与来源](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-20261104/F1-ACTUAL-RESULT.json>) |
| 11-05—06 | 两批 45 表按矩阵授权，RLS 与 FORCE 已启用。初始规则仍含宽策略。固定 UAT 的钱包/Admin、CORS 与会话设置限定继承，终端 API 启用后无认证请求实测 401。UAT 的 TTL 记录与上面 b15 预览处置分别记账。 | [45 表权限矩阵](</Users/ck/Doubao/chats/2026-10-20/new-chat/uat-table-privilege-matrix-20261106.md>) · [治理记录](</Users/ck/Developer/FastLink/fastlink-prime-wallet/docs/governance/project-master-summary.md>) |
| 11-07 | B-1 真实落地及独立后态复核通过。65 表及 48 枚举的属主交接完成，迁移角色收口为 LOCKED，批次 1 为 6/6。SupportCase 数据层交付，后续 V1.7 实际记录确认纳入 66 表。 | [B-1 验收](</Users/ck/Doubao/chats/2026-10-20/new-chat/b1-acceptance-record-20261107.md>) · [SupportCase 数据层候选](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/SUPPORTCASE-DATA-LAYER-20261107-1794057519/CONTROLLER-RESULT.json>) |
| 11-08 | V1.7 的 Admin 受控认证入口部署、身份表限定收权与 Tenant INSERT 合同对齐，取得健康及 Admin 登录和 /me 正向结果。V1.8 的 AuditLog、EvidenceArtifact 两表完成 24 项原生验收及接线部署。3.1、3.2 已勾，3.5 按两表和四行对照限定。 | [V1.7 连贯验收](</Users/ck/Doubao/chats/2026-10-20/new-chat/tenant-align-execution-acceptance-20261108.md>) · [两表原生回执](evidence/V18_PILOT.json) · [V1.8 部署验收](</Users/ck/Doubao/chats/2026-10-20/new-chat/d3-deploy-acceptance-20261108.md>) · [V1.8 独审](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/D3-REMAINING43-20261108/G3/BASELINE-PROMOTION-AND-TRACKER-REVIEW.json>) |
| 11-08—09 | 自动登记结构完成安装并独立读回，目录计数最终 57/57。既有密钥预置与两行样本承接，修复两个 helper 后完成直连 ABI **20/20**。 | [安装回执](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/AUTOENROLL-INSTALLATION-20261108-02/ROOT/NATIVE-INSTALLATION-FINAL-20261109.json>) · [ABI 实际回执](evidence/AUTOENROLL_ABI.json) |
| 11-10 | 固定 UAT R4 成功发布。记录的部署为 `c51ef268-88b2-4596-80c7-0c10638eef29`，D 首批 HTTP 再次绑定该部署。发布源码、清单及镜像摘要均有回执。历史 H05 停止记录保留。 | [R4 来源绑定](evidence/R4_BOUND.json) · [固定源码归档](evidence/R4_SOURCE_ZIP.zip) |
| 11-10—11 | H05 分层真实复测通过。C 汇总采用具名复合证据，HTTP **14 项继承加 H15**，Context **21 项已验覆盖**。H15 的通过范围为已观测到的 CORS 合同。 | [Layer1 实际回执](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/SHARED-API-DIAGNOSTICS-OFFLINE-20261110-01/H05-LAYER1-RETEST-PREP-20261111-01/ROOT/LIVE/FINAL-ACTUAL-RESULT.json>) · [Layer2 实际回执](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/SHARED-API-DIAGNOSTICS-OFFLINE-20261110-01/H05-LAYER2-OFFLINE-PREP-20261111-01/ROOT/LIVE/FINAL-ACTUAL-RESULT.json>) · [C 最终原始封包](evidence/C_SEAL.zip) |
| 11-11—12 | ApiClient、ApiKey 的策略迁移已提交并独立读回。保留 12 条身份策略，以 8 条租户策略替换 6 条应用宽策略。密钥生命周期、双向跨租户零行、写阻断和上下文清理均有原生回执。首批 HTTP 401、403、200 全过。reader/replay 由首批 7 项加 L04、L01、L02 达到 **10/11**。 | [D 原生收口](evidence/D_NATIVE.json) · [D HTTP](evidence/D_HTTP.json) · [首批 7 项](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/SHARED-API-DIAGNOSTICS-OFFLINE-20261110-01/D-READER-REPLAY-PREP-20261111-01/LIVE-20261111-01/RESULT.json>) · [L04](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/SHARED-API-DIAGNOSTICS-OFFLINE-20261110-01/D-READER-REPLAY-L04-RI-NATIVE-20261112-02/ACTUAL/RESULT.json>) · [L01](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/SHARED-API-DIAGNOSTICS-OFFLINE-20261110-01/D-READER-REPLAY-L01-C05-NATIVE-20261112-01/L01.RESULT.json>) · [L02](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/SHARED-API-DIAGNOSTICS-OFFLINE-20261110-01/D-READER-REPLAY-L02-NATIVE-20261112-01/L02.RESULT.json>) |
| 11-12 | 逐表回填将 ApiClient、ApiKey 计入 3.3，当前 **2/43**。CardProductTemplate 的 EndUser 产品列表和开卡报价已接受控事务，通过 TypeScript 零诊断、22 项定向测试、5 项本机合成 HTTP 和独审。 | [43 表矩阵](evidence/D3_MATRIX.json) · [首域离线入口](</Users/ck/.codex/visualizations/2026/11/01/01a1970a-7021-7263-9ec7-3448d1950d80/UAT-PROGRESS-20261106/D3-FIRST-DOMAIN-OFFLINE-20261112-01/ENTRY-MANIFEST.json>) · [候选封包](evidence/CPT_SEAL.zip) |

C 的复合结果按各用例原窗口承接。H08—H14 的证据是已封序列断言和安全事件。Context 证据包含事务返回与调度记录，原始事务协议回执未采集。D 的 HTTP 通过范围为首批 3 条，其他路由继续依各自验收合同。

## 开工接续与保留缺口

| 事项 | 当前状态和接续入口 |
| --- | --- |
| 3.3 / 3.6 | 2/43、41 表待验，逐域独立复核待续。CardProductTemplate 仅固定 UAT AppModule 的两条读路径离线通过。迁移和回滚草案有硬停，真实验收入口待封。接续先核对持卡费用详情、卡列表及真实模板来源、金额，再处理旧 Admin 写入及 RETURNING、发卡和账务依赖。 |
| Reader/replay | 10/11。L03 错误环境用例搁置，等环境证据齐备。 |
| B17 / P1 | B17 38/47，3.7 LIMITED、3.9 UNVERIFIED、6B NOT_READY。P1 发布已取证，Access 恢复时的会话保留、后端真 401 清态及真实 TTL 行为待验。#61/#94/#338 按历史登记保留 Draft 合并前置条件。 |
| DEV 旧状态核查 | 独立承接旧 Supabase 轨道，最后登记 115 UNKNOWN、99f 执行累计 0。固定 Railway UAT 成果按其环境使用。 |
| 批次与门禁 | 原进度表 A 8/8，批次 1 为 6/6，批次 2 为限定 3/5，批次 3 为限定 4/6，批次 5 为 1/3。批次 4、6、7、8–9 已勾数为 0。正式 UAT 签收待完成，Gate1 NOT_PASSED，生产、资金、真实 Provider 按原冻结执行。 |

## 归档核验

[证据索引](EVIDENCE-INDEX.json)逐项登记原路径、字节数、SHA-256 和归档位置。有历史完整摘要的证据已复算匹配，其余来源在本次首次固定摘要。归档含代表性原始封存和回执的字节副本，其他来源由索引追溯。解压后在本目录运行 `shasum -a 256 -c SHA256SUMS` 可校验归档全部载荷。治理入口、权威现状摘要和追加历史仍是后续增量登记位置。快照修订以新日期追加。

治理入口 [project-master-summary.md](</Users/ck/Developer/FastLink/fastlink-prime-wallet/docs/governance/project-master-summary.md>) · [权威现状摘要](</Users/ck/Developer/FastLink/fastlink-prime-wallet/docs/governance/baseline/PROJECT-STATUS-SUMMARY.md>) · [进度表](</Users/ck/Doubao/chats/2026-10-20/new-chat/fastlink-progress-tracker-20261106.md>)
