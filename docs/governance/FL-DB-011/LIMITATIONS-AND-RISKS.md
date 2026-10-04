# 永久保留限制与风险

1. cross_insert/cross_delete在ACL层42501，只证明当前权限拒绝，不能证明获得相应写权限后的RLS。
2. cross_update为SELECT_ONLY_CONTRACT_NO_AUTHORIZED_UPDATE_PROOF；不能记为完整写隔离通过。
3. unbound在IDENTITY层拒绝，RLS为NOT_PROVEN。
4. 64表仅RLS/FORCE目录覆盖，未完成64表全部动态CRUD。
5. 66项静态测试绑定本地化前文件，不是最终动态工具的自洽可复跑验证。
6. DB10历史失败无原始帧/回滚首因证据，不可唯一归因；DB9/DB10及本轮原FAIL/STOP/LIMITED/BLOCKED持续保留。
7. observer仅目录检查；目标数据摘要由bootstrap观察取得，权限行为由非特权runtime/issuer验证，不能混用为owner下RLS证明。

总控门禁3登记的三项非阻断证据质量问题（本次不修复工具）：
- 准入层拒绝也可能命名为BUSINESS_SQL_REJECTED；必须同时阅读stage和businessSqlAttempted，不能据名称推定到达业务SQL。
- 顶层REPORT.reason白名单宽于用例证据；通用边界仍有收紧空间，不称全部错误路径脱敏已被精确覆盖。
- 后置快照、数据或日志失败可能缺firstCause；当前动态没有这些失败，不能据此宣称该诊断缺口解决。

DB-R02及已继承的数据库权限/部署身份、资金与后续安全前置仍未解除。门禁2/3为治理范围限定通过，不是数据库或完整RLS写安全通过。未部署、未晋升，不更新正式基线。
