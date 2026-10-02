# CICD2-T01～T14 自测

固定定义由总控2026-10-02恢复确认，未按结果重排。生成时10 PASS、4 LIMITED（T02/T04/T12/T14）；最终状态通过追加记录承接。

| 编号 | 固定定义 | 状态 | 依据及限制 |
|---|---|---|---|
| CICD2-T01 | 权威基线链、工单范围及禁止重复事项可追溯 | PASS | README、授权；只实施CI输入增量 |
| CICD2-T02 | Railway官方Schema来源、版本及许可证/内部使用权边界可追溯 | LIMITED | 项目所有者内部/私有CI授权；缺官方原始摘要、明确公开再分发许可 |
| CICD2-T03 | 固定Schema候选字节、SHA-256、完整性与保存边界验证 | PASS | 13044字节固定SHA、受限副本、无正文入Git、编码往返及私有输入链 |
| CICD2-T04 | Schema版本适用性、弃用/过期及STALE判定机制 | LIMITED | REFRESH-AND-STALE明确触发；无官方版本/期限/弃用清单，不能认定当前或未来平台适用 |
| CICD2-T05 | 普通CI离线校验，Schema验证阶段外部网络请求为0且无在线回退 | PASS | 本地deny-network三模式；远端Draft执行同一同步加载器，无fetch/loadSchema。仅Schema阶段，不含npm安装/checkout网络 |
| CICD2-T06 | Schema输入缺失时明确失败，不跳过、不降级 | PASS | 新增控制缺失/空输入拒绝；fork无输入即失败 |
| CICD2-T07 | Schema字节或固定SHA被篡改时明确失败 | PASS | 固定pin、错误摘要和保留合法JSON的字节篡改拒绝 |
| CICD2-T08 | 无效Schema及无效Railway配置均被拒绝，合法固定配置可接受 | PASS | 无效编码/JSON/Schema/远程ref负例；原固定配置三模式成功 |
| CICD2-T09 | 既有117项配置控制兼容性与覆盖保持 | PASS | 既有117＋新增16，共133；本地及三Draft全部通过，不改写117历史口径 |
| CICD2-T10 | 原在线校验与新离线校验在获批输入集合上的语义等价性及两轮确定性 | PASS | 13组比较，两独立进程相同；原函数以同一字节的内存网络替身执行，未向Railway请求 |
| CICD2-T11 | 手动刷新流程具备独立审批、来源/SHA/差异/回滚记录，且不自动覆盖正式快照 | PASS | REFRESH-AND-STALE为流程设计，刷新未执行；实际Secret更新/删除须另批 |
| CICD2-T12 | 三条固定工作流调用链覆盖，绑定获批基点并无部署语义变化 | LIMITED | 三Draft输入链通过，原Ready调用点静态覆盖；完整Ready作业未获授权、未运行 |
| CICD2-T13 | 新增材料敏感扫描、SHA清单、Secret/Schema零泄露、部署和环境晋升为0 | PASS | 明确扫描范围及元数据见证据；仅Draft，无数据库/部署作业运行 |
| CICD2-T14 | 双Draft PR范围、失败历史、回滚、永久限制及HANDOFF完整 | LIMITED | 业务Draft已创建；治理Draft提交及CI完成后由最终HANDOFF追加状态，保留本生成时点 |

本地lint exit0；node语法检查通过；两轮候选27项子控制及13组语义比较不冒充远端完整CI。控制TAP结果仅保留测试统计与摘要，未提交候选样本。

## 追加：双Draft PR建立后的最终自测口径

业务#337和治理#89已创建且均指向dev、Draft、无自动合并。CICD2-T14转PASS；原生成时LIMITED记录保留。最终11 PASS、3 LIMITED：T02、T04、T12继续LIMITED。逐项定义不变，机器结果见evidence/test-status-final.json。最终治理CI以对应最终HEAD的外置HANDOFF为准，不沿用先前提交CI。


## 追加：完整CI、下载失败与所有者验收后状态

历史表格不覆盖。最新11 PASS、3 LIMITED（T02/T04/T12）。T13先因下载失败保持LIMITED/待证，现按所有者验收PASS，证据限制不消失。以下按原编号及定义承接：

| 编号 | 状态 | 依据及限制 |
|---|---|---|
| CICD2-T01 | PASS | README、授权；只实施CI输入增量 |
| CICD2-T02 | LIMITED | 项目所有者内部/私有CI授权；缺官方原始摘要、明确公开再分发许可 |
| CICD2-T03 | PASS | 13044字节固定SHA、受限副本、无正文入Git、编码往返及私有输入链 |
| CICD2-T04 | LIMITED | REFRESH-AND-STALE明确触发；无官方版本/期限/弃用清单，不能认定当前或未来平台适用 |
| CICD2-T05 | PASS | 本地deny-network三模式；远端Draft执行同一同步加载器，无fetch/loadSchema。仅Schema阶段，不含npm安装/checkout网络；追加三条完整CI成功，仅证明本固定HEAD及固定私有输入。 |
| CICD2-T06 | PASS | 新增控制缺失/空输入拒绝；fork无输入即失败 |
| CICD2-T07 | PASS | 固定pin、错误摘要和保留合法JSON的字节篡改拒绝 |
| CICD2-T08 | PASS | 无效编码/JSON/Schema/远程ref负例；原固定配置三模式成功 |
| CICD2-T09 | PASS | 既有117＋新增16，共133；本地及三Draft全部通过，不改写117历史口径 |
| CICD2-T10 | PASS | 13组比较，两独立进程相同；原函数以同一字节的内存网络替身执行，未向Railway请求 |
| CICD2-T11 | PASS | REFRESH-AND-STALE为流程设计，刷新未执行；实际Secret更新/删除须另批 |
| CICD2-T12 | LIMITED | 三条完整CI已按专项授权成功且无重跑；仍按总控要求LIMITED。候选版本/许可及旧证据连续性限制不消除；不得将其他工作流、未来版本或部署语义认定全面通过。此前未运行描述保留为当时状态。 |
| CICD2-T13 | PASS | PASS基于项目所有者制品验收与限制接受；三run日志专项扫描零命中。本机下载失败、制品扫描0字节；外部扫描1757文件约504MB为责任人声明，缺机器SHA及Schema专项报告，均保留。新增治理扫描和SHA本轮单独校验。 |
| CICD2-T14 | PASS | 两PR均恢复/保持Draft、dev、无自动合并；完整CI授权、失败、恢复Draft及所有者接受依序保留。治理新HEAD/CI由提交后外置HANDOFF提供。 |

机器表见evidence/test-status-owner-accepted.json；治理HEAD对应CI须以提交后外置HANDOFF为准。


## 追加：本机部分制品证据连续性限制及总控处置

失败时及05:52 UTC的本机记录为25,231,360字节；本次提交前stat为92,979,200字节，仍不等于预期523,697,848字节。当前mode=0644；原流程目标0600。mtime=2026-10-02T06:49:16.129714Z仅为文件修改时间，不是创建时间或写入归因证明。变化原因、实际过程时间和写入进程未知；lsof无返回不能证明不存在历史写入者。不得解释为下载继续、下载成功、完整制品或扫描完成。

本次未重启下载、扫描或CI，未读取部分ZIP内容，未修改其内容或权限。提交前预期部分文件大小保持不变的断言失败，该失败如实保留于本节；随后总控允许作为新的证据连续性限制追加后继续治理提交。原失败、恢复Draft及当前stat记录均保留。

总控明确要求停止进程归因调查，不重新下载/扫描、不访问云主机、不清理或修改部分文件。该本机变化与所有者接受的外部云主机扫描是不同证据链，不能互相替代。T13继续按所有者接受为PASS并附本限制；T02/T04/T12保持LIMITED。
