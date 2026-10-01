# 证据版本索引

## 当前R1
REVISION-R1、SELF-TEST-R1、HANDOFF、COVERAGE-AND-LIMITS-R1、RISK-AND-RETEST-R1、BASELINE-DELTA-R1及带r1后缀JSON/CSV为专项授权后当前结论。
source-delta、isolation、source-protection记录可复用事实，未据其空白时点推断迁移后业务隔离。

## 保留的历史检查点
README原文、DELTA-AND-SCOPE、ROLE-AND-GRANT、RLS-MATRIX、MODULE-COVERAGE、FUNCTION-VIEW-AUDIT、DYNAMIC-VALIDATION、RISKS-AND-FOLLOWUPS、BASELINE-DELTA-PROPOSED、SELF-TEST、HANDOFF-CHECKPOINT，以及preflight/lifecycle/test-results-checkpoint/scan-checkpoint，记录未取得第3步专项授权的状态。
这些历史“BLOCKED/尚未执行”由migration-exception与R1执行证据承接，不覆盖、不冒充当前事实。
SHA256SUMS-checkpoint.txt对应历史检查点当时字节；README后来追加版本导引，当前文件不应使用旧清单验证。当前全量校验只使用根SHA256SUMS。其自身摘要在PR/HANDOFF外置记录，避免自引用。

## 执行方式和资料边界
execution-driver-r1.py.txt是本机实际执行脚本的原字节审核副本，摘要见driver-provenance；不是新授权，也不应直接再次执行。catalog-queries.sql为只读目录查询；synthetic-fixture.sql仅任务合成测试夹具，禁止现有环境使用。REMEDIATION-DRAFT.sql全部注释，禁止执行。
不纳入本机认证材料、原始连接日志、业务源码副本或数据库数据导出。当前目录目录数据仅对象名/角色名/授权/布尔属性/计数/不可逆摘要，没有真实业务行。

提交前格式检查发现生成CSV使用CRLF，已统一LF，字段及行序不变。前后SHA和失败原因见format-correction-r1.json；历史检查点清单继续保留原摘要，当前清单绑定规范化文件。
