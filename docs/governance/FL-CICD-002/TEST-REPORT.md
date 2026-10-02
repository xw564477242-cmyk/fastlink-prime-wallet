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
