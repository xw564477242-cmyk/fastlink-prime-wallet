# DB4-T01～T16 检查点

非最终自测。数据库迁移专项审批尚未解除。

|编号|状态|检查|依据/限制|
|---|---|---|---|
|DB4-T01|PASS|基线与复用范围|权威链及两仓固定HEAD已记录，未重做既有全量盘点。|
|DB4-T02|PASS|51SQL与最新dev差量|51/51 SHA和OID相同，Prisma全目录无差量；调用链8文件变化已归类。|
|DB4-T03|PASS|隔离实例与最小权限|实际17.11、network none、无宿主端口、初始public对象0。|
|DB4-T04|PASS|非owner/non-superuser/no-BYPASSRLS|三独立SCRAM身份均验证，成员关系0、拥有关系0。|
|DB4-T05|LIMITED|成员关系和直接/继承GRANT|三新测试角色关系已查；业务授权仅继承DB1，未在本轮重建。|
|DB4-T06|LIMITED|default privileges|继承两目录显式记录0；本轮业务创建者权限未验。|
|DB4-T07|LIMITED|核心表RLS与FORCE|继承默认55对象和UAT部分54对象矩阵；不是本轮运行结果。|
|DB4-T08|BLOCKED|SELECT跨租户拒绝且同租户通过|迁移第3步授权阻塞，未创建业务数据，执行0。|
|DB4-T09|BLOCKED|INSERT跨租户拒绝|迁移授权阻塞，执行0，无本轮目标哈希。|
|DB4-T10|BLOCKED|UPDATE跨租户拒绝|迁移授权阻塞，执行0，无本轮目标哈希。|
|DB4-T11|BLOCKED|DELETE跨租户拒绝|迁移授权阻塞，执行0，无本轮目标哈希。|
|DB4-T12|LIMITED|函数/过程安全|继承应用函数0，无新增源差量；不能证明实际部署。|
|DB4-T13|LIMITED|视图/序列/间接访问|继承目录并列复验方案，当前业务库未建立。|
|DB4-T14|LIMITED|UAT第32步重复重建方案|前置来源/seed审批/二次独立重建计划已列，尚未实际验证。|
|DB4-T15|PASS|草案回滚STALE拆单|全注释SQL、独立处置工单、定向复验及不可逆风险保留。|
|DB4-T16|LIMITED|保护扫描SHA Draft PR HANDOFF|检查点可验证；完整阶段A尚未完成，未创建PR或触发CI。|
