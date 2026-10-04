# 单次R1动态结果

北京时间2026-10-05 00:28:13至00:28:48。仅全新任务cluster、PostgreSQL17.11缓存固定镜像、内部网络、新卷及5容器；0宿主端口、无外网或旧资源访问。34/34既有迁移按序执行；仅migration-03原有约束/索引删除，未执行其他DROP/TRUNCATE。

64/64物理表RLS/FORCE目录通过，unsafeActors=0；动态仅覆盖冻结Tenant核心用例，不能外推64表全部CRUD。

| 用例 | 结果 | SQLSTATE | 行数 | 层级 | 业务SQL到达 | RLS证明 |
|---|---|---|---:|---|---|---|
| same_select | PASS | 00000 | 1 | NONE | 是 | PASS |
| cross_select | PASS | 00000 | 0 | RLS | 是 | PASS |
| cross_insert | LIMITED | 42501 | 0 | ACL | 是 | LIMITED |
| cross_update | LIMITED | 00000 | 0 | RLS | 是 | LIMITED |
| cross_delete | LIMITED | 42501 | 0 | ACL | 是 | LIMITED |
| ownership_tamper | PASS | 42501 | 0 | CONTRACT | 否 | NOT_REACHED |
| unbound | LIMITED | 42501 | 0 | IDENTITY | 是 | NOT_PROVEN |
| expired_grant | PASS | 42501 | 0 | GRANT | 否 | NOT_REACHED |
| expired_request | PASS | 42501 | 0 | REQUEST | 否 | NOT_REACHED |
| revoked_key | PASS | 42501 | 0 | KEY | 否 | NOT_REACHED |

10项各执行一次，6 PASS、4 LIMITED，无FAIL或未执行；重试0，无R2。20/20 finally回滚PASS，均00000/ALIVE。cross_delete在业务SQL返回42501后双会话回滚正常，后续5项完成；不掩盖旧失败。

每项前后合成Tenant目标摘要：`00754904608261542b0b6dcecba30ae2f0a6d97a8b8c10ace959ca626f354a76`。仅该目标表本轮不变，不代表全库快照，也不代表和旧轮数据相同。

[逐项JSON](evidence/batch-result.json)、[汇总](evidence/final-summary.json)、[迁移](evidence/r1-migrations.json)。原batch-result SHA：`6312ed8d80dc216bf235de64008d02959825e80e1fcc010349b1dc57047c755e`；归档版本为去标识投影，SHA不同，见溯源表。
