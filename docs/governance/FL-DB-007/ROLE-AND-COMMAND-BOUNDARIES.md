# 角色、有效业务权限与命令边界

矩阵中的SELECT/INSERT/UPDATE/DELETE描述经过FastLink服务端认证、归属校验及可信事务身份之后的有效业务行为，不是数据库直连权限或已经执行的SQL授权。`ONLY_EXPLICIT_FIELD_WHITELIST`也必须经API校验，不允许客户端直接修改数据库。

| 主体 | 正式边界 |
|---|---|
| USER | 本人＋本租户＋环境的安全投影；金额/余额/账本/状态不直接写，业务命令须服务端验证 |
| TENANT_ADMIN | 本租户品牌、员工、可分配预定义角色、API Client限定Scope及获准业务功能；不自提权、不跨租户、不读取秘密 |
| API Client | 外部调用身份，使用FastLink自有API；不新增通用高权数据库角色，不代表继承所有用户/管理员权限 |
| PLATFORM_ADMIN | 无常驻跨租户旁路；目标租户与用途限定JIT；未明确的写命令拒绝 |
| BACKGROUND_TASK | scheduler/provider-adapter/webhook/ledger/settlement/retention/audit用途分离；没有通用超级worker |
| BACKEND_RUNTIME | 仅承载已验证主体/任务；不能自由选tenant、代签任意主体或SET ROLE进入owner/issuer |
| MIGRATION_OWNER | NOLOGIN、DDL专用、仅独立批准窗口；应用不得继承；不授予业务DML |

认证bootstrap与issuer必须和business runtime分权；本轮只记录要求，不实现或读取任何认证材料。ApiKey一次性创建回应仅指未来FastLink自有租户凭据broker，不是正常列表/读取投影，不包括上游秘密，本工单不会生成或展示密钥（DB7-C03）。

## 每表解释规则

所有权限取交集：主profile＋逐表规则＋角色范围＋字段约束＋状态边＋明确审批＋环境。跨约束冲突不得取并集扩大权限；受冲突影响操作保持实施BLOCKED。

`visible_fields_upper_bound`是治理上的最大字段集合，仍受“本人/本租户/聚合/脱敏/有效二维码”等视图约束。不得直接返回完整ORM记录，不得把字段名称存在当成序列化安全。未列字段默认不返回；脱敏方式、聚合粒度和归属关系不完整时不能上线。Admin的资金读取通过获准聚合/对账视图，不是全表导出；用户不能因某journal关联本人就读到他人账户分录。

`CARRIER_OF_AUTHORIZED_PRINCIPAL_ONLY`不授予任何独立读写权。runtime必须受主体/任务的更窄规则、实施缺口和冲突限制。`PURPOSE_COMMAND_ONLY`仅表明所有者允许该业务用途，不能用于任意DML。

P12旧treasury四表全部QUARANTINED_DENY：包括平台JIT和任务在内的运行身份均拒绝。迁移owner专项目录核验仅指另批metadata/迁移窗口，不能解释为业务数据SELECT（DB7-C04）。Tenant/平台RBAC目录的合法结构不会授予其他业务全局可见性；缺assignable映射时不得向租户展示或分配未证明可分配的角色。

## JIT与任务

普通JIT最长60分钟、默认脱敏只读，必须caseId、目标tenant、purpose、操作者、批准者和有效期。生产资金/账本、KYC否决覆盖、租户关闭、生产provider启用等敏感写命令需双人审批；仍不得直接改金额、余额、journal或秘密。break-glass最长30分钟、只执行明确命令、24小时内复核，不是绕过审批的通用开关。

scheduler只读最小到期队列投影。worker单tenant/environment/purpose，短时身份、幂等与租约。原文允许模拟任务写入，但未指定专用worker身份，因此DB7-G09保留，不把scheduler扩成写入角色。retention仅在另批保留期工单下清理过期会话/令牌/临时证据；资金、账本、审计历史不允许删除。不可因本轮有retention决策就清理任何已有资产。
