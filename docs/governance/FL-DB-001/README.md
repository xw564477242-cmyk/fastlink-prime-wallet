# FL-DB-001 数据库安全验收增量交付

状态：PENDING，Draft PR；门禁2未通过，门禁3未进入。仅完成本轮可安全执行的发现、验证与整改设计，不宣称数据库安全通过。

继承 `BASE-V1.0-20260930 + FL-GOV-002门禁5正式追加差量`。不复制现状总表、不重做恢复/全项目秘密扫描/六仓搭建/全量业务测试。资金功能保持关闭。

- [范围与迁移](SCOPE-AND-MIGRATIONS.md)
- [对象、权限与覆盖](DATABASE-MATRIX.md)
- [双租户验证](TENANT-TESTS.md)
- [函数、身份及暴露审计](FUNCTION-AUTH-EXPOSURE.md)
- [风险与拆单](RISKS-AND-REMEDIATION.md)
- [整改SQL草案（禁止执行）](REMEDIATION-DRAFT.sql)
- [依赖扩散与基线差量](BASELINE-DELTA.md)
- [隔离与现场保护](ISOLATION-AND-PROTECTION.md)
- [自测](SELF-TEST.md)、[改动与回滚](CHANGE-AND-ROLLBACK.md)、[HANDOFF](HANDOFF.md)

关键结论：默认条件32步原迁移成功；UAT条件第32步因必要租户不存在阻塞，未绕过。42个合成数据用例均回滚且目标数据不变。默认数据库在授予直连DML的夹具条件下不隔离租户；这是条件性风险，不是生产授权或API穿透证明。UAT共享后端角色策略刻意允许多租户数据，隔离依赖服务端入口，尚未完成端到端证明。
