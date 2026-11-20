# FastLink 状态指针（单页入口）

2026-11-20 · 本页用于替代"承接/续记/纠正"类长文。新会话只读本页即可定位，细节回原文按需查。

---

## 一、现在在哪

- 阶段：**阶段 2 安全资产治理**（八阶段中的第 2 个），阶段 3 未启动，资金关闭。
- 正式基线：`BASE-V1.8-20261108`，未被 11 月任何动作升级。
- 门禁：**Gate1（FL-DB-015）NOT_PASSED**。规则：清单固化后禁止追加核验项。

## 二、进度计数（唯一尺子，禁止虚报）

| 项 | 当前 | 分母 |
| --- | --- | --- |
| 表验收 | 6 | 43 |
| 固定 UAT 调用点 | 31 | 47（余 16，含 4 UNKNOWN） |
| 固定 UAT 槽 | 10 | 16（S01–S10） |
| 旧 Admin 行为 | 0 | 9（独立分母） |
| P0 离线闭环 | 56 | 90（余 34） |

**坐标提醒**：以上五组全部跑满，Gate1 仍不会通过。Gate1 的卡点是另一套清单，见《效率改造包》第 2 节。

## 三、唯一堵点

Admin B 恢复封包已具体可审，技术准备 9/9 闭合，**缺所有者一次终态裁定**（执行 or 否决关闭）。

- 封包：`docs/work-logs/TEST-ADMIN-B-RESET-FINAL-CANDIDATE-20261120/REVIEW.md` SHA `a1318cb8271dd1f0de3d8987859c9011f3b93b5df9e029b7c663c3985cf9b3b2`
- 清单：同目录 `SHA256.json` SHA `c79204e1569415aad2f416cdbcae9618c7e0f86321b27b419df6b4d6939d6858`
- 当前状态：`APPROVAL-TEMPLATE.json` 三标志位全 false，`manifestSha256=UNBOUND_PENDING_OWNER_EXECUTION_APPROVAL`，无有效 permit。

## 四、冻结清单（不得自行解除）

资金/冻结、生产、真实 Provider、连库写入、策略切换、TEST 晋升、发布、PR 创建/合并、S11–S16、FX 整批、WalletAccount 策略切换、Treasury GET 部署、本机 P2.4/P2.5 路线（已由所有者停止）。

## 五、仓库事实（务必知道）

| 仓 | 位置 | HEAD | 状态 |
| --- | --- | --- | --- |
| 后端 | `Downloads/fastlik-backend` | `9777084`（09-09） | 与 11 月联合候选差 270 一致 / 93 不同 / 119 缺失；**不作为运行基线** |
| 治理 | `~/Developer/FastLink/fastlink-prime-wallet` | `2e25033`（09-30） | 本地 == 远端分支；但 11 月治理内容**未提交未推送** |
| 前端 release | `Downloads/fastlink-prime-wallet-dev-release` | `7581a75`（09-16） | 与快照登记前端 `ec29d29` 不一致 |

**治理已入库（2026-11-20，纯文档、未动 main）**：

| 仓 | 云端分支 | 提交 | 内容 |
| --- | --- | --- | --- |
| 治理仓 | `docs/governance-20261120` | `2210417` | 总表、状态正本、基线增量、证据索引（43 文件） |
| 后端仓 | `docs/work-logs-20261120` | `d122527` | 48 项工单日志 + AGENTS.md 三条刹车规则（1542 文件） |

排除项：`*.bak`、大体积 CSV/ZIP（含高熵候选表）、`private-runtime`（postgres 二进制与运行数据）、passfile 类凭据文件。main 两仓均未改动（治理 `e8ccb6a`、后端 `74e5be0`），可随时删分支回退。

## 六、证据入口

- 治理总表：`~/Developer/FastLink/fastlink-prime-wallet/docs/governance/project-master-summary.md`（主体止于 11-13）
- 状态正本：`.../baseline/PROJECT-STATUS-SUMMARY.md`（11-20 三节在尾部）
- 速览：`Downloads/fastlink-prime-wallet-dev-release/docs/assets/governance-snapshot.md`
- 工单：`Downloads/fastlik-backend/docs/work-logs/`（48 项）
