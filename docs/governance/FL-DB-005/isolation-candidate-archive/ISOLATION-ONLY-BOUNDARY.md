# 隔离候选归档边界

sql/内文件属于被移出业务正式迁移链的原始候选，不是可部署迁移。三份SHA、字节数、blob OID、源HEAD和源路径均在SOURCE-MANIFEST.json；按原顺序保存，不重新格式化或补改SQL。

禁止CI、容器启动脚本、Prisma迁移链引用或执行此归档；没有新增自动执行入口。未来隔离回放须另行明确授权与独立工具，不运行留存历史工具伪装新一轮结果。

旧两轮32+3 SQL、29+17控制、目录SHA和52表默认拒绝报告仅对应旧HEAD中的隔离候选字节。本次仅迁移放置整改，没有数据库实验。52表默认拒绝只证明保守阻断，不证明52表业务正向权限可用。

业务保留withIsolatedTenantTransaction原型和其5个单测原字节；运行时源码/脚本静态检查未发现调用入口，不表述为实际Prisma/JWT/任务身份集成完成。保留prisma/rollback/fl-db005-fail-closed.sql原字节、仅作未执行隔离草案，不准用于现有数据库，不默认关闭RLS或恢复宽权限。

正式RLS整改、真实身份集成、52表正向契约、正常迁移链动态验收和完整业务CI仍BLOCKED或未完成；资金硬前置未解除。T17永久LIMITED、DB-R02潜在P0、DB1/DB4历史FAIL/BLOCKED、38Admin LIMITED、DEV1-T03/T12、GOV2-T09和历史正文缺口保留。
