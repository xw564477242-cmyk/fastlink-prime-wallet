# 函数、身份、Data API及Storage

51份迁移静态扫描没有应用CREATE FUNCTION/PROCEDURE/VIEW/MATERIALIZED VIEW/TRIGGER事件；两个本地目录确认应用函数/过程/用户触发器为0。内部FK触发器已枚举。SECURITY DEFINER、应用EXECUTE ACL和函数search_path矩阵当前为空集合，范围仅限上述重建；不能推定远端RPC安全或不存在。

| 场景 | 数量/依据 | 结论 |
|---|---|---|
| 应用SECURITY DEFINER | 本地0 | 无可执行对象；远端待确认 |
| 应用函数search_path及PUBLIC EXECUTE | 本地应用函数0；显式default ACL0 | 不作未来默认权限已安全的断言 |
| view/物化视图绕RLS | 本地0 | 实际部署待确认 |
| Supabase/Data API/Storage | 原迁移无对应部署配置；源码存在Supabase受管角色兼容分支 | 使用可能性有代码证据，实际启用/暴露schema/Storage桶待确认；未创建项目、未连接远端 |
| JWT用户元数据授权 | 已查backend/src符号索引；当前guard走服务端会话 | JWT契约/实际提供方未证实，DB1-T13 BLOCKED |
| platform admin | 无正式授权范围 | 单列BLOCKED，不以Admin界面存在推定跨租户权限 |

重要源码证据：`src/health/end-user-auth-rls.contract.ts`（源HEAD b337bc96）明确后端是租户执行点，共享runtime角色策略有意采用无条件谓词，并核验角色闭包、FORCE RLS、权限。包含Supabase-managed membership兼容分支，不是已连接Supabase的证据。`src/end-user-session/guards/end-user-session.guard.ts`先Origin、再sessions.authenticate、再CSRF。词法索引不替代完整身份/端点验证。

本轮没有读取任何.env、生产连接串、实际密钥或数据库导出；没有对发现的88项High候选做认证。前端是否被注入后端秘密不能仅凭依赖包未出现Supabase就判安全，保留非秘密部署清单核验项。

官方资料在执行前核验（2026-09-30）：
- [PostgreSQL 17 CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html)：默认拒绝、组合策略、USING/WITH CHECK。
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)：GRANT和RLS独立层、owner/service绕过边界。
- [函数安全](https://supabase.com/docs/guides/database/functions)：SECURITY DEFINER、search_path和EXECUTE。
- [Data API访问控制](https://supabase.com/docs/guides/api/securing-your-api)：暴露schema和实际授权。
- [Data API默认暴露变更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)：不能推断既有对象授权自动撤销。
- [17.11变更](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)：扩展及运算符兼容性需按实际使用判断。
- [官方变更索引](https://supabase.com/changelog.md)。没有因此安装工具或执行平台操作。
