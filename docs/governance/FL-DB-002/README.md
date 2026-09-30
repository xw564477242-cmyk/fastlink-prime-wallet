# FL-DB-002 实际权限可达性与跨租户暴露确认

状态：阶段A执行完成；阶段B `BLOCKED`；门禁2待评审；PR保持Draft。

本工单继承 `BASE-V1.0-20260930 + FL-GOV-002门禁5正式差量 + FL-DB-001门禁5正式差量`。复用FL-DB-001的51份SQL盘点、T08/T09失败、T13阻塞及DB-R02潜在P0结论，没有重做迁移盘点、默认数据库跨租户实验、完整隔离库、全量业务测试或全项目秘密扫描。

阶段A完成216个后端路由的静态登记、六仓连接方式检查、认证与身份字段来源分析，以及一个定向本机双租户动态探针。探针确认Admin租户详情入口存在查询参数覆盖路径租户边界的缺陷，并在首次跨租户响应后立即停止扩展测试。

结论边界：`DB2-R01`是确认P0应用层缺陷，证据来自本机隔离环境中的原始控制器、守卫和服务，持久层为严格合成Mock；它不等于已部署DEV/TEST/UAT或生产已确认可达。`DB-R02`真实部署暴露继续保持潜在P0。外部非生产阶段B和生产均未获授权。

交付索引：

- `SCOPE-AND-REUSE.md`：基线、范围、复用与禁止重复事项；
- `CONNECTION-ROLE-MATRIX.md`：六仓连接与身份传播；
- `API-ENTRY-MATRIX.md`：216入口覆盖及认证链；
- `JWT-SESSION-TRUST.md`：会话、JWT与可控字段；
- `LOCAL-TENANT-TEST.md`：本机动态验证；
- `EMERGENCY-P0.md`：脱敏紧急报告；
- `RISKS-AND-FOLLOWUPS.md`：风险分级与整改拆单；
- `SELF-TEST.md`：DB2-T01～T14；
- `ISOLATION-AND-PROTECTION.md`、`CHANGE-AND-ROLLBACK.md`、`BASELINE-DELTA.md`、`HANDOFF.md`。

本目录只含治理材料、只读工具和脱敏证据。没有修改数据库、业务代码、现有配置、正式基线或风险等级源数据；没有部署、环境晋升或真实资金操作。
