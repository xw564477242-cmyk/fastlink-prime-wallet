# 基线拟差量（PENDING）

拟新增可复用成果：undici 8.10.2精确锁定、指定两项High审计解除证据、Cregis Agent/Dispatcher1Wrapper Mock及回环兼容、锁文件最小差异与确定性证明。

依赖变化令旧undici版本下的兼容/审计结论STALE，本工单定向复验覆盖该范围；其他模块不触发全量重验。未来版本或Node变化须重新评估。

保留：5个Moderate；DB2-R01待FL-DB-003修复验收；DB-R02潜在P0；实际GRANT/RLS、部署JWT、客户端可达性和阶段B未验证；38项路由级LIMITED；DEV1-T03/T12、GOV2-T09、历史缺口。

禁止重复六仓搭建、迁移盘点、全项目初始秘密扫描，禁止自动同步FL-DB-003或更新正式基线。仅门禁5后由总控追加闭环差量。依赖审计通过不等于已部署安全。
