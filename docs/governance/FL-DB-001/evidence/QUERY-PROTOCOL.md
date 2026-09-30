# 隔离验证查询协议

源SQL不复制进PR；按51文件SHA定位。初始化/夹具由本地owner建立，访问通过独立非owner TCP登录；没有SET ROLE借用owner连接。

每次访问：BEGIN → 单条操作 → ROLLBACK。出错则连接退出自动回滚。

```sql
-- 以下仅为已执行的合成目标查询模板，禁止在非本工单隔离库执行。
SELECT count(*) FROM "Customer" WHERE id = '<synthetic_customer_a_or_b>';
WITH affected AS (
  INSERT INTO "Customer" (id,"tenantId",environment,"externalUserId","providerCustomerRef","updatedAt")
  VALUES ('db001_probe_insert','<synthetic_tenant_a_or_b>','SANDBOX','synthetic-insert','synthetic-insert','2026-01-01') RETURNING id
) SELECT count(*) FROM affected;
WITH affected AS (
  UPDATE "Customer" SET "firstName"='SYNTHETIC PROBE' WHERE id='<synthetic_customer_a_or_b>' RETURNING id
) SELECT count(*) FROM affected;
WITH affected AS (
  DELETE FROM "Customer" WHERE id='<synthetic_customer_a_or_b>' RETURNING id
) SELECT count(*) FROM affected;
```

补充归属改写：在事务中将合成客户A的tenantId改为合成租户B、externalUserId改为合成其他身份，读取影响行数再回滚。

目标集合摘要在owner只读审计会话取Tenant和Customer按id排序的json_agg结果，Python SHA-256只保存摘要。身份验证查询current_user、session_user、rolsuper、rolbypassrls、rolcreaterole、Customer owner匹配布尔值。具体值仅角色名、布尔值、行数和SQLSTATE进入证据。

fixture角色仅获public USAGE及Tenant/Customer SELECT/INSERT/UPDATE/DELETE；匿名只获USAGE。没有为匹配期望结果创建或改写RLS policy。原UAT服务角色只设置本地随机登录认证，其原授权/策略未改。
