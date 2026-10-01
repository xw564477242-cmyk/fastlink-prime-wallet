# 身份与权限边界
本轮实测：初始化身份fl_db004_initializer与三测试身份分离；tenant_a、tenant_b、anonymous分别独立SCRAM登录，current_user=session_user，非superuser、无BYPASSRLS、无CREATEDB/CREATEROLE、成员关系0、拥有关系0。详情见isolation.json。
测试角色仅初始化LOGIN属性，未人为授予业务DML。空白库没有业务表，不能把无表状态或权限不足当作跨租户拒绝通过。

继承DB1：默认库16角色、3内置成员边、385表授权记录；UAT部分库17角色、3成员边、412授权记录。两个目录显式default privileges记录0；NULL ACL与空pg_default_acl不等于没有默认授权。未来函数默认PUBLIC EXECUTE必须单独审核。
实际部署角色、角色闭包、创建对象身份、GRANT、服务端到客户端传播仍BLOCKED。共享服务角色能力不等于终端用户实际可达。
