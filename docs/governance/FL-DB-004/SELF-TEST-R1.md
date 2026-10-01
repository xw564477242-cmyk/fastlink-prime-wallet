# DB4-T01～T16 R1

这是安全审计结果，不是全部安全测试通过。5 PASS、6 LIMITED、4 BLOCKED、1 FAIL。

|编号|状态|项目|依据和限制|
|---|---|---|---|
|DB4-T01|PASS|基线与复用范围|正式链、固定后端/报告基点及旧风险继承；不重做既有全量任务。|
|DB4-T02|PASS|51SQL及对象索引增量|51/51 SHA/OID一致，Prisma零差量；54业务对象与DB1共同属性匹配。|
|DB4-T03|PASS|隔离实例与最小权限|17.11镜像摘要一致、network none、无端口、初始public0；全新角色/合成数据。|
|DB4-T04|PASS|测试角色非特权|三个角色独立登录，非owner/superuser/BYPASSRLS，成员0；未借用owner证明隔离。|
|DB4-T05|LIMITED|角色成员关系和GRANT|本轮19角色/3内置成员边，162角色表组合完整；实际部署角色和合法tenant权限映射仍未知。|
|DB4-T06|LIMITED|default privileges|当前显式默认权限0、schema ACL完整；尚不证明实际创建者和未来函数默认权限安全。|
|DB4-T07|FAIL|核心表RLS/FORCE安全状态|54/54业务表完整盘点；RLS/FORCE均false、policy0，未建立数据库行级隔离。不是已证实生产可利用。|
|DB4-T08|BLOCKED|SELECT跨租户拒绝且同租户通过|原生ACL探测均拒绝，同租户也拒绝；缺获批合法身份/可达权限，不能形成有效RLS正反例。|
|DB4-T09|BLOCKED|INSERT跨租户拒绝且目标不变|Customer原生ACL拒绝/目标不变；无合法同租户写路径，其他对象动态未覆盖。|
|DB4-T10|BLOCKED|UPDATE跨租户拒绝且目标不变|Tenant/Customer原生ACL拒绝/目标不变；无合法同租户更新路径。|
|DB4-T11|BLOCKED|DELETE跨租户拒绝且目标不变|Tenant/Customer原生ACL拒绝/目标不变；无合法同租户删除路径。|
|DB4-T12|LIMITED|函数/过程安全|当前应用函数/过程0；search_path、SECURITY属性、EXECUTE空集合不是实际部署或未来对象安全证据。|
|DB4-T13|LIMITED|视图/序列及间接访问|当前view/materialized view/sequence0；实际部署对象、完整业务间接路径未验。|
|DB4-T14|LIMITED|UAT第32步可重复方案|原失败继承；已列业务前置来源审批、合成seed、独立二轮重建计划，未执行或获全部输入。|
|DB4-T15|PASS|草案回滚STALE拆单|全注释草案、最小权限前置、独立拆单及定向复验齐备；未执行整改。|
|DB4-T16|LIMITED|保护扫描SHA Draft PR HANDOFF|本轮隔离克隆保护/交付检查可复核；原正式现场未重新采集，永久证据缺口保留。Draft PR/CI绑定在最终外置HANDOFF；不将限制包装为完全取证证明。|
