# 函数、视图与间接访问
本轮源差量未增加函数/视图/过程/触发器迁移。复用DB1目录：两种重建状态应用函数/过程、视图、物化视图均为0；默认库312、UAT部分308内部FK触发器。未将内置函数视为应用RPC。
当前DB4业务库未重建，函数owner、SECURITY DEFINER/INVOKER、proconfig search_path、PUBLIC/显式EXECUTE、角色继承及依赖对象的本轮运行验收BLOCKED。历史空集合不能证明现有部署或未来函数安全。
复验需枚举pg_proc/pg_namespace/pg_depend、pg_class及acl/default ACL；每个函数按精确签名核对owner属性和search_path，包含pg_temp顺序；逐个view检查执行身份和底层RLS；materialized view单独验访问ACL与数据范围；sequence检查USAGE/SELECT/UPDATE及拥有关系。
外键唯一性检查可能形成存在性侧信道，须在获批合成数据中检验错误脱敏；不得在已发生跨租户成功的对象继续扩展攻击。

技术依据：
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- https://www.postgresql.org/docs/17/sql-createfunction.html
SECURITY DEFINER按所有者权限执行，不能一概声称必然绕过FORCE RLS。缺显式WITH CHECK也不能直接判漏洞，需考虑USING继承、组合策略与有效角色。
