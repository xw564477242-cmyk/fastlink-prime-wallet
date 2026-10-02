# 身份链与运行时绑定设计（未实施）

所有行号对应后端固定dev `2b120bc18a1e2ef3bb5ae42197c625764441db0c`。见 [结构证据](evidence/identity-structure.json) 和 [源文件SHA](evidence/source-files.json)。读取的仅源码标识、字段名及结构；没有读取运行环境连接串、token或秘密值。

## 当前事实与缺口

| 入口 | 固定源码证据 | 可确认的静态结构 | 未确认/不能推定 |
|---|---|---|---|
| 普通用户 | end-user-session.service.ts:134、385；end-user-session.guard.ts:15 | opaque会话查库、撤销/过期/用户状态/authVersion/租户环境一致性；guard调用认证与CSRF检查 | 部署会话提供方、真正运行角色、全入口覆盖、正式RLS身份绑定 |
| Admin | admin-auth.service.ts:14；admin-bearer.guard.ts:11 | 服务端TenantUser、角色关联、AdminSession；DB3规范化授权租户与冲突拒绝 | 已有平台scope分支不等于获批平台跨租户权限，38条LIMITED保留 |
| API client | common/guards/api-key.guard.ts:10 | 活跃ApiKey与ApiClient/Tenant关联后生成tenant/environment/scopes | 实际客户端可达权限及服务账号权限；不试用任何Key |
| 后端连接 | prisma/prisma.service.ts:4、25、30 | 共享PrismaClient通过DATABASE_URL变量名构造，URL处理不产生租户身份 | session_user、owner/BYPASSRLS/membership/GRANT的运行值未知 |
| 隔离原型 | prisma/isolated-tenant-transaction.ts:19、26、32、34、36 | 在事务中获取目标、调用issuer、绑定后传递tx | issuer正式实现/可信边界未接入；不把原型当运行安全通过 |
| 注册与登录 | end-user-session.service.ts:47、84、343；admin-auth.service.ts:14 | 认证前需要Customer/Tenant/User、会话创建、失败计数等操作 | 不能因缺少已登录上下文而授予普通运行角色全表读写 |
| 异步任务 | webhooks.service.ts:21、74、129 | 定时启动和队列扫描、claim及处理，不能从无Cron装饰器推断无后台任务 | 现有全局队列选择不是跨租户任务授权；用途/字段/租户分片待批准 |
| 供应商回调 | modules/thredd/webhook/thredd-webhook-auth.plugin.ts:25、66、103；phase2 guards | 签名/时间与服务端映射变量的结构 | 未读取配置值、未访问供应商；签名成功不自动授予任意租户 |

上述路径在src/下。源码包含jose依赖声明并不证明部署使用JWT；固定生产源码中未找到对应jwtVerify/SignJWT等调用。部署JWT仍UNKNOWN/BLOCKED，未来若引入JWT需另审签发方、audience、issuer、时效、撤销和不可编辑归属字段。

65个事务语法调用中59 interactive、3 batch、3 unresolved；6个raw调用分别涉及隔离原型、健康/目录查询和SANLX fixture。它们是迁移到可信事务边界的待审点，不是新增已确认漏洞。事务外lastUsedAt更新、登录计数及会话撤销也必须有独立批准用途。

## 方案比较与推荐

| 方案 | 信任来源与优势 | 约束/失败模式 | 本轮结论 |
|---|---|---|---|
| 每租户/每用户独立数据库login | session_user可确定连接主体，不依赖可写上下文 | 凭据/连接池数量、轮换、路由与对象本人归属；共享login若可SET ROLE到全部租户即失去隔离 | 可选，需容量和生命周期评审，不直接实施 |
| 共享Prisma＋单事务一次性opaque票据＋受保护身份映射 | 保持既有池，票据绑定已验证主体、数据库连接及事务 | 必须建立独立可信issuer与不可伪造消费边界；防重放、回滚、事务外逃逸、并发串租均未正式验证 | 推荐进入后续最小实现评审，当前LIMITED |
| 客户端/运行SQL可任意设置的tenant GUC | 成本低 | 调用方可伪造；与session_user相同问题不能靠命名或SET LOCAL解决 | REJECT，不能作为RLS权威输入 |
| 受控业务操作broker | 极窄操作接口可减少广泛表权限 | 容易形成泛用definer逃逸、认证循环或大规模重构 | 仅用于必要认证bootstrap/票据消费，不批准重构全后端 |

签名JWT/声明也只能是经过可信验证的输入；不得让RLS直接信任未验证claim、query/body/path或客户端GUC。本轮不选签名算法、不生成密钥、不建立Secret。

## 推荐契约：事务绑定及信任分离

1. 认证层先依据服务端会话/角色映射取得principal、tenant、environment、用途、会话版本及已批准资源范围。来自客户端的租户标识仅作一致性检查；冲突拒绝，不能覆盖服务端归属。DB3授权上下文保持唯一，但它仍须经过issuer鉴权，不接受调用者自造对象。
2. 业务runtime login只负责承载事务，不可修改身份映射、签发票据、授予角色、切换到issuer/owner或读取票据存储。迁移owner不可借业务池使用；membership及SET ROLE边界须单独验证。
3. 开始单个interactive transaction后取得实际数据库login、后端PID、transaction ID。独立issuer验证认证证明、用途、资源范围和吊销状态，签发短时、限定audience及协议版本的随机opaque票据，绑定该事务目标。票据不暴露给终端客户端，不入日志/PR。
4. 受保护消费入口核对全部绑定与有效期，一次性消费，写入只有该事务可用的受保护映射；后续策略读取受保护映射。普通SQLcaller既不能直接创建映射，也不能通过自定义GUC伪装。初始化失败即中止，不允许退回无上下文查询。
5. issuer不能信任runtime提供的任意principal，也不能仅凭业务进程持有issuer口令就授予无限代签。候选实现需证明权限/凭据隔离和认证证明不可转用；若同一受陷进程能任意签发，数据库无法补救该信任破坏，应标BLOCKED而非包装为RLS保证。
6. **票据消费不能因业务事务回滚而重新可用。** 后续设计须确定独立提交的消费登记或等价不可重放机制，处理消费已成功而业务失败时只能重新认证签发，不得复用旧票据。跨事务/跨连接/PID复用、并发消费及失效时间必须测试。DB5候选结果只能作为设计参考，不能继承为正式验证。
7. callback只接收受限tx client，禁止在其中调用全局Prisma、另建连接或另起未绑定事务。nested transaction、batch数组、后台异步工作、重试策略须明确：无可证明相同绑定则拒绝；重试重新取得上下文及票据。返回之后不允许延迟异步任务复用该tx。
8. commit、rollback、超时、取消、异常、池归还后均不可留下可复用主体。业务CRUD与归属检查必须同一事务/快照；仅在请求开始验证一次而后续用其他连接不足以保证隔离。
9. 审计只记录授权决策、用途、策略版本、关联ID及批准脱敏主体标识，不记录认证材料/完整请求或客户数据。日志不承担授权；鉴权失败和不存在资源的外部响应不得暴露存在性。
10. 票据最大寿命、会话撤销传播、审计保留、issuer权限与凭据保管/轮换需安全负责人和所有者批准，数值尚未指定。过期/无法验证一律拒绝。生命周期建议不授权本轮处置任何现有密钥。

## 认证bootstrap和服务权限

当前登录前会读Customer/TenantUser/会话并写登录失败状态；直接对共享runtime开放这些表，会绕过拟建RLS。建议定义用途受限认证broker：只允许验证指定认证证明、返回最小主体引用及创建/撤销本次会话，禁止任意查询、批量导出或随意指定tenant。注册、密码修改、锁定计数、refresh、lastUsedAt分别审批列和状态转换。不能把USER业务CRUD与认证内部操作混为一组。

broker若必须使用SECURITY DEFINER，其owner应无登录、无通用业务调用权限，固定安全search_path、显式限定对象、拒绝动态对象名、精确EXECUTE；所有者及函数权限需独立审查。当前只是建议，没有新增函数。

普通用户只能本人对象，租户管理员仅本租户；平台管理员未审批的跨租户能力为NONE_APPROVED。任务采用用途受限身份：调度器若确需枚举租户，只能在专项审批后读取最小调度投影，再由每租户worker持短时用途票据处理；不能把当前全局队列扫描直接写成全表授权。迁移owner与runtime、issuer、任务角色不能通过继承或SET ROLE互相突破。

## 设计依据

RLS与对象权限分别验收；owner、特权角色与引用完整性路径需单列，不能只依赖普通查询样例。[PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)

角色切换能力必须与成员关系分别盘点，不把角色名称当权限边界。[SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html)

Prisma交互事务内的操作应使用同一tx client；该API不会自动提供租户鉴权。[Prisma transactions](https://www.prisma.io/docs/orm/fundamentals/transactions)
