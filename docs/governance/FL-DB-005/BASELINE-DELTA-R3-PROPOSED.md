# 基线拟追加差量R3（PENDING，未写入正式基线）

新增决定：项目所有者正式批准52表保守默认拒绝契约。正向例外仍仅为USER本人Customer SELECT、TENANT_ADMIN本租户Customer SELECT、USER本人WithdrawalAddress受控CRUD。其余应用角色/表/字段/操作不获正向授权。

新增证据：52表逐项与保留的r3/r4对象、RLS/FORCE、GRANT及策略目录核对一致；当前业务HEAD和实现未变化，数据库执行0。T06由R2 BLOCKED以新记录承接PASS，原BLOCKED保留。批准不是业务可用性、资金安全、实际Prisma/JWT/任务身份集成或生产架构验收。

当前DB5编号状态：8 PASS、10 LIMITED；T08～T15/T17/T18继续LIMITED，实际身份集成仍BLOCKED。10个schema-only和4个catalog-only继续STALE，54表分母不变。历史DB1/DB4 FAIL/BLOCKED、DB-R02潜在P0、38Admin LIMITED、永久偏差和历史缺口继续继承。

后续权限工作必须由独立FL-DB-006按服务入口、角色、字段和操作逐项授权；本次不启动FL-DB-006。完整CI方案仍未获执行批准，双PR保持Draft。4条moderate依赖公告仅为版本命中，未确认应用可利用，未自动修复。

未Ready、未合并、未部署、未晋升、未重启或更改数据库、未清理风险资产或更新正式基线。资金硬前置不解除。
