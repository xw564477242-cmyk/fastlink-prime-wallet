# JWT、会话与身份字段可信性

## 静态存在

- Admin：客户端Bearer值经服务端SHA-256定位AdminSession；tenant、environment、role和permission取自服务端关系。客户端可提供路径、query和body参数。
- End User：opaque Cookie会话由服务端记录绑定user、tenant、environment、authVersion；会话校验检查用户/租户一致性、状态、版本、过期和运行环境，写请求再经过Origin/CSRF。
- API Client：`x-api-key`仅用于查找服务端哈希记录，tenant/environment/scope取自ApiClient记录。
- JWT：项目依赖中存在JWT库符号，但本轮没有取得实际部署JWT提供方、claim契约、刷新配置或网关验证证据。不存在把“未发现用户元数据授权字符串”写成安全通过的结论。

## 已确认可控性问题

Admin守卫构造租户判定目标时，query/body `tenantId` 的优先级高于租户详情路径 `:id`。因此攻击者虽不能改变服务端写入的 `request.fastlinkAuth.tenantId`，却能让守卫校验一个自有租户ID，而控制器继续使用另一个路径ID读取对象。该不一致已在本机原始入口动态确认。

## 尚未验证

- 实际客户端是否可到达相同路由及其代理是否保留冲突query；
- 已部署Admin令牌签发、存储、刷新、吊销与审计边界；
- JWT tenant/user/admin字段是否来自不可编辑的服务端来源；
- platform admin和后台任务的最小权限、审计及跨租户合法边界；
- 实际数据库角色、GRANT、default privilege和RLS组合。

因此DB1-T13对应的真实身份来源缺口没有关闭；本工单DB2-T06为 `LIMITED`，而真实部署阶段保持 `BLOCKED`。
