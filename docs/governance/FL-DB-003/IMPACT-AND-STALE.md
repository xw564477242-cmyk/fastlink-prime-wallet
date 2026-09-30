# 影响与STALE传播

本次可更新为本机源码已验证：

- `GET /api/admin/tenants/:id`不再允许冲突query改变守卫校验对象；
- 守卫、租户详情控制器和服务调用使用同一 `authorizedTenantId`；
- 共享守卫对path/query/body冲突执行统一拒绝。

继续保持 `STALE` 或未验证：

- 38个仅获静态结论的Admin守卫路由；
- 已部署DEV/TEST/UAT/生产的Admin入口；
- 实际角色、GRANT、RLS、JWT提供方、代理与客户端可达性；
- 账户、钱包、卡、交易、入账、结算、退款、对账、Thredd、Cregis和平台后台任务的部署安全结论。

DB2-R01只能在两个PR合并且门禁5通过后标记为“本机当前源码已修复”；不得标记为“部署风险关闭”。DB-R02维持潜在P0。
