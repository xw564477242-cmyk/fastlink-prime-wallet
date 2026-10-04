# 一次完整安全退役

退役PASS，失败列表为空：身份NOLOGIN、口令NULL；activeLogins/passwords/memberships/actorSessions=0，pendingHBA=false。

unrevokedKeys、enabledGrants、unexpiredRequests、enabledConfig、enabledCarriers、enabledObserverCases、connectPrivileges、tempPrivileges全部0。bootstrap禁用且无口令；管理会话关闭，PostgreSQL停止，5任务容器停止，sessionsAfterStop=0，HBA/TLS tmpfs卸载。

网络/卷/停止容器和宿主受限材料保留，未删除、恢复或GC；本PR不携带其标识或私有内容。不执行额外退役、现场复查或资源操作。

[退役原字节证据](evidence/r1-retirement-step-202610041628487753850000.json)，SHA-256：`41c19ba0ba6833b091bb9405a3948f11bdd333e334bcf8cca15b60d2bfea9fec`。

原DB10首轮退役不完整的历史不因本轮PASS被覆盖。
