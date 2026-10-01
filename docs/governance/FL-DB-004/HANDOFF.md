【HANDOFF交接摘要】
✅已完成：
- FL-DB-004阶段A当前范围：51SQL差量一致；32份正式SQL默认条件原样执行；54业务表、19角色、3成员边、162角色表权限、函数与默认权限目录。
- 17.11任务隔离容器network none/无宿主端口；三独立非特权身份；2合成租户/2用户/2Customer；42项原生ACL拒绝，数据摘要前后一致。
- DB4-T01～T16：5 PASS、6 LIMITED、4 BLOCKED、1 FAIL；结果见SELF-TEST-R1.md。治理范围见文件清单，完整提交SHA/PR/CI由提交后外置回执绑定。
⚠️未改动/保留原样：
- 未添加测试DML授权，未改原SQL、业务代码、实际环境、JWT/RLS/GRANT、正式基线；整改草案未执行。
- 所有原风险、失败、检查点、永久偏差、密钥/证据/工具引用保留。任务容器已停止，未删除容器、卷或任务认证材料。
- 未连接现有DEV/TEST/UAT/生产/Railway，未部署或晋升；本地未重跑全量业务测试或秘密扫描。
🚧遗留阻塞/待决策：
- 54表RLS未启用；同租户也无访问权，因此42拒绝不能证明租户隔离。DB-R02潜在P0及DB1 T08/T09 FAIL、T13 BLOCKED保留。
- 实际角色/GRANT/客户端可达性、可信tenant身份、合法业务路径、UAT第32步前置来源、阶段B仍需独立输入和授权。
- 未扩大测试DML权限；没有新的本轮跨租户成功，不声称生产安全或风险关闭。资金模块硬前置未解除。
- Draft PR仅申请门禁2；未经门禁3不得合并，门禁4不适用。
📌下一任务仅需读取文件：
- REVISION-R1.md、SELF-TEST-R1.md、COVERAGE-AND-LIMITS-R1.md、RISK-AND-RETEST-R1.md、BASELINE-DELTA-R1.md、evidence/test-results-r1.json。
