# FL-GOV-001 代码资产盘点报告

盘点时间：2026-09-29T13:21:55+0800。范围为用户指定项目根目录及子目录；本工单新建的独立审阅克隆不计入原资产数量。

## 数量与身份

发现 **5 个本地 Git 工作区，均属于新钱包及其派生副本**；通过远端 API 核实 **6 个原始仓库 + 1 个私有归档库** 均存在且可访问。不能将“5 个工作区”与“7 个独立远端仓库”等同。其余六库在本次根目录范围内没有独立 Git 工作区，不能标为干净、已推送或丢失。根目录外的正式工作区未扩展搜索。

| 仓库 | 用途 | 技术栈/证据范围 | 本地对应 | 远端状态 |
| --- | --- | --- | --- | --- |
| fastlink-prime-wallet | 新钱包前端 | TypeScript / React / TanStack Start / Vite / Bun | 5 个 Git 工作区，详见下表 | 已核实；公开 |
| fastlik-backend | 共享后台 API | TypeScript / NestJS / Prisma（023源码副本验证） | 根目录内无独立 Git；有 outputs/CREGIS-FUNDS-023/candidate/backend 等源码快照 | 已核实；私有 |
| fastlik-app | 旧钱包 | TypeScript（远端主语言） | 根目录内未定位独立 Git；不推断本地状态 | 已核实；公开 |
| fastlik-Admin | 运营后台 | TypeScript（远端主语言） | 根目录内未定位独立 Git；不推断本地状态 | 已核实；公开 |
| fastlik-Website | 独立网站 | JavaScript（远端主语言） | 根目录内未定位独立 Git；不推断本地状态 | 已核实；私有 |
| fastlink-control-plane | 任务、决策及控制记录 | JavaScript（远端主语言） | 根目录内未定位独立 Git；历史控制包不等同工作区 | 已核实；私有 |
| fastlink-recovery-archive | 私有恢复归档；不计入原六库 | 混合源码及恢复证据；非部署应用 | 根目录内未定位独立 Git；历史总表存在归档关联 | 已核实；私有 |

## 全目录覆盖

记录 538,477 个文件（含依赖），共 5,659,297,046 字节；89,688 个非 node_modules 普通文件计算 SHA-256。无遍历错误。完整逐文件相对路径、大小及哈希在本地 asset-files.json；PR 中提供分类汇总和本地证据文件哈希。符号链接不跟随；依赖文件纳入数量但不计算内容哈希；Git 对象由独立 fsck 检查。

- src/public：前端业务源码与静态资产，仅盘点。
- tests/scripts：测试及运维脚本，仅盘点。
- .github/deployments/wrangler.* / Dockerfile / railway.json：流水线及环境配置，仅盘点。
- docs、根目录 Markdown：设计、历史、基线和交接资料，包含用户未提交材料。
- outputs：历次候选源码、证据、缓存、打包及快照；不将无 .git 的源码副本计为独立仓库。
- .output、.wrangler、node_modules、outputs 内 bun-cache/dist：构建产物、工具状态与依赖缓存；不删除、不归档上传。

顶层及 outputs 各工单目录文件数量见 [asset-summary.json](evidence/asset-summary.json)。发现 20 个压缩包/bundle/备份文件，路径、大小和哈希见 [archives.json](evidence/archives.json)。SQL 文件属源码/数据库脚本候选，不混计压缩归档数量。归档只登记外层文件；未解包执行、未证明每个归档可恢复。

发现 26,067 组相同 SHA-256 的重复内容，包含候选副本、依赖缓存和相同版本材料；完整分组仅本地 duplicate-content.json。重复内容不等于可删除资产，未做清理。

## Git 工作区、子模块和工作树

| 相对路径 | 分支 | 完整 HEAD | 状态计数 | 保护状态 | 浅克隆 |
| --- | --- | --- | --- | --- | --- |
| . | codex/dev-version-006-snapshot | 7581a751d5964d481d335131c856270ccc98238b | {'staged': 0, 'unstaged': 2, 'untracked': 58152} | 受保护现场 | false |
| outputs/B03-CREGIS-CLOSEOUT-004/workspace | codex/b03-cregis-closeout-004-frontend-closure | ec29d29ab39e6afff95650a8603b3a6529c86179 | {'staged': 0, 'unstaged': 0, 'untracked': 0} | 干净；本轮只读 | false |
| outputs/DEV-SANDBOX-FAST-001/workspace | [unavailable] | e8ccb6a508f478d7a948f4ccebaa3d73dcbbfe18 | {'staged': 0, 'unstaged': 0, 'untracked': 1} | 受保护现场 | true |
| outputs/DEV-VERSION-032/entry-workspace | codex/dev-version-032-test-manual-entry | d972eea0c708840f016c32444018a420f9bf62c7 | {'staged': 0, 'unstaged': 0, 'untracked': 0} | 干净；本轮只读 | true |
| outputs/DEV-VERSION-040/workspace | codex/dev-version-040-single-person-guard | 8c1d3be110e98f39328a98cba122411b4689337f | {'staged': 0, 'unstaged': 0, 'untracked': 0} | 干净；本轮只读 | true |

五个目录均为独立 .git 目录，没有发现已配置子模块或有效嵌套 linked worktree。主仓库登记了三个根目录外、目标已不存在的 worktree：fastlink-bun-pr、fastlink-dev-version-014、fastlink-dev-version-018，Git 标记 prunable；仅登记，未 prune。4 个 outputs 工作区属于嵌套仓库，其中 004 的 origin 指向本地主工作区而非 GitHub。

## 敏感与未知资产

文件名规则发现 79 个环境/密钥后缀候选（含 example）；内容启发式扫描结果见 [异常与风险清单](FL-GOV-001-异常与风险清单.md)。报告只保留位置、类型和行号，不保留秘密值。历史总表提到的两份完整 bundle 位于根目录外，仍按历史受阻项登记，未读取或复制秘密、未上传 bundle。

旧钱包、Admin、Website、控制仓库的本地源码身份、各历史归档的恢复完整性、未知 outputs 材料的业务归属均待逐项核定；不根据相似目录名自动建立权威映射。
