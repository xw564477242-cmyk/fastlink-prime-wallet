# 函数、视图与默认权限 R1
数据库目录实测public函数/过程、view/materialized view/sequence均0；内置pg_catalog不作为应用对象。当前函数search_path、SECURITY DEFINER与EXECUTE逐对象矩阵为空，不给已部署安全PASS。
原迁移没有应用函数差量；默认创建者为初始化身份，pg_default_acl显式记录0，不表示未来函数PUBLIC不可执行。Schema public的CREATE/USAGE、函数owner与角色成员必须联合评审。
未来新增函数需精确签名、owner非特权边界、固定可信search_path并考虑pg_temp、PUBLIC EXECUTE及授权角色、间接表访问、SQL注入和错误侧信道逐项验证。视图需检查执行身份/底层RLS；物化视图需独立授权保护。

官方依据（仅文档查阅，无远端数据库调用）：
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- https://www.postgresql.org/docs/17/sql-createfunction.html
RLS与GRANT为不同层；owner一般绕过RLS，FORCE不约束superuser/BYPASSRLS；SECURITY DEFINER按owner权限执行。缺显式WITH CHECK需考虑USING继承，不能机械判定漏洞。外键完整性检查不受RLS限制，应另验错误信息边界。

补充只读核验：public触发器312项，其中内部312项、用户自建0项；函数归属均见indirect-catalog-r1。迁移后3个测试角色再次确认无特权/成员/对象所有权。未执行触发器动态攻击。
