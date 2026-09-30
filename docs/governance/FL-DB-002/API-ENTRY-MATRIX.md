# API入口与租户校验矩阵

## 静态覆盖

固定源HEAD下291个后端第一方非测试TypeScript文件解析成功，0个解析失败。识别35个控制器、216个展开路由；216/216均可由AppModule静态注册关系追溯。211个路由声明了控制器级或方法级业务守卫，5个无此类守卫：Admin登录、两个健康入口、一个Cregis回调和一个通用Webhook入口。Webhook是否安全不能仅凭本矩阵判断，其签名/处理链需按专门契约解释。

守卫分布（路由可能展开别名，本列按最终路由计）：

| 静态守卫组合 | 路由数 | 说明 |
|---|---:|---|
| `AdminBearerGuard` | 131 | 管理端opaque会话、RBAC、tenant/environment检查 |
| `EndUserAuthGuard` | 66 | 委托EndUserSession/Origin/CSRF链 |
| `OriginGuard` | 8 | 原点控制，不能单独证明对象归属 |
| `EndUserSessionGuard` | 3 | 服务端会话、Origin、CSRF |
| Phase2 webhook/poller守卫 | 2 | 内部回调/任务边界 |
| `ApiKeyGuard + ApiScopeGuard` | 1 | 服务端API key及scope |
| 未声明上述业务守卫 | 5 | 含公开/回调入口，需入口专门校验 |

完整逐路由路径、HTTP方法、参数名、身份字段、服务/数据库调用符号和动态状态位于 `evidence/api-static-matrix.json`。它是静态注册与符号索引，不替代运行时依赖注入、实际数据库授权、代理配置或部署路由证明。

## 动态覆盖与停止

仅对 `GET /api/admin/tenants/:id` 做4个定向用例。使用原始Nest控制器、`AdminBearerGuard`、`TenantsService`与实际路由元数据；Prisma边界是严格内存Mock，不连接数据库。第4例首次确认跨租户读取后立即停止，因此其余215个路由没有本机动态结论，全部保持“尚未验证”；所有已部署入口保持“阶段B未授权”。

## 影响模块

Admin租户详情入口已受影响。由于同一守卫覆盖131个路由，凡同时存在路径对象ID与可控query/body `tenantId` 的入口均标记 `STALE`，需要后续专项逐入口复验，但本工单未在确认P0后扩展测试。账户、钱包、卡、交易、入账、结算、退款、对账、Thredd和Cregis的部署安全结论继续为 `STALE` 或未验证；不据此推断它们均可利用。
