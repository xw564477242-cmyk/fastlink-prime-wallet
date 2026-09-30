# 环境、连接与角色来源矩阵

| 资产 | 静态连接方式 | 身份来源 | 数据库直连/高权限客户端证据 | 运行验证 | 结论 |
|---|---|---|---|---|---|
| 新钱包 | 同源后端HTTP；Cookie会话、CSRF | 后端会话返回actor/tenant/customer | 浏览器代码未见数据库驱动或service-role变量 | 未连接部署环境 | `LIMITED` |
| 旧App | 同源后端HTTP；Cookie/CSRF | 后端会话 | 跟踪源码及现有bundle未见数据库直连 | 未连接部署环境 | `LIMITED` |
| Admin | 同源后端HTTP；Bearer Admin会话 | 后端AdminSession及RBAC | 跟踪源码及现有bundle未见数据库直连；Bearer令牌存在于客户端运行态 | 本机原始Admin入口确认P0 | `FAIL` |
| Website | Worker代理后端HTTP；Cookie或Bearer按路由转发 | 后端会话/入口策略 | 未见数据库驱动 | 未连接部署环境 | `LIMITED` |
| Backend | Prisma通过运行时 `DATABASE_URL` | Prisma连接角色；AdminSession、EndUserSession、ApiKey服务端查询 | 实际部署连接值、数据库角色、role membership和GRANT未读取 | 持久层未连接 | `BLOCKED`（真实角色） |
| Control-plane | 治理CLI及外部模型调用脚本 | 环境注入，不属于业务终端身份 | 未见业务数据库直连证据；配置值未读取 | 未执行 | `LIMITED` |
| 后台任务/供应商 | 后端进程内任务及Thredd/Cregis边界 | 后端共享服务身份及供应商认证配置 | 实际部署角色及权限未确认 | 按停止规则未动态执行；外部服务未调用 | `BLOCKED` |

静态检查只读取跟踪的第一方代码、package声明及既有前端bundle；跳过依赖、缓存、迁移、测试、文档和所有 `.env`。发现的仅是变量名、符号和调用位置，不包含值。源码中存在Supabase验证脚本符号不证明运行时采用Supabase；未创建或连接Supabase项目，Data API/Storage保持“不适用/待确认”。

后端Admin会话为服务端查询的opaque令牌哈希，RBAC由数据库关系装配；End User会话由服务端记录绑定user、tenant、environment及authVersion；API key由服务端哈希记录绑定client、tenant、environment和scope。实际部署数据库连接角色、GRANT与RLS适用关系没有授权证据，因此不能将这些静态设计判为运行时安全。
