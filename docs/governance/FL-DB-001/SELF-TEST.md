# DB1-T01～T16 自测

结果如实记录，失败/限制不转为PASS。安全目标未全部满足，门禁2待评审。

| 编号 | 状态 | 检查 | 依据 | 限制 |
|---|---|---|---|---|
| DB1-T01 | PASS | 基线链和范围可追溯 | V1.0合并1686d504 + GOV2合并5bd2f24；报告分支从5bd2f24起；源后端b337bc96；仅本工单治理目录。 | 不宣称V1.1落盘。 |
| DB1-T02 | LIMITED | 数据库对象清单完整 | 51/51 SQL静态盘点；默认55表、UAT部分54表目录全部枚举。 | 14开发文件未执行；UAT第32步阻塞；真实实例/隐藏对象未查。 |
| DB1-T03 | LIMITED | 角色、GRANT及default privilege | 重建目录角色、成员关系、schema/table ACL、默认权限全量；匿名55表无DML；服务角色54表逐表有效权限。 | 实际部署角色、tenant admin/platform admin映射未确认。 |
| DB1-T04 | LIMITED | 暴露schema表与RLS | 本地public全部表核验：默认0/55启用；UAT部分6/54启用且FORCE。 | public不等于实际Data API暴露；远端配置未知。 |
| DB1-T05 | LIMITED | policy按操作类型 | UAT部分13策略：SELECT6、INSERT4、UPDATE3；USING/WITH CHECK均为true；DELETE无策略。 | 仅后端共享角色策略，无已批准终端租户身份映射；开发策略仅静态。 |
| DB1-T06 | LIMITED | anonymous及未认证 | 新建无授权角色的8个操作拒绝；无口令TCP拒绝；55表有效DML均false。 | 测试角色不是已发现生产anonymous；未验证HTTP匿名入口。 |
| DB1-T07 | LIMITED | 同租户允许路径 | 默认直连授权夹具及UAT服务角色的允许路径已记录。 | UAT未匹配策略的模拟租户角色同租户也不可访问；服务DELETE按设计拒绝；端到端入口未验收。 |
| DB1-T08 | FAIL | 跨租户SELECT拒绝 | 默认直连授权夹具A/B均读取另一租户1行；UAT共享后端角色也可读。 | 条件性数据库边界失败；直连夹具授权不代表生产权限；后端共享角色跨租户不单独证明接口漏洞。 |
| DB1-T09 | FAIL | 跨租户INSERT/UPDATE/DELETE拒绝 | 默认直连夹具四操作跨租户均可；归属字段改写成功后回滚；UAT服务S/I/U可、D拒绝。 | 保留原SQL，不执行修复；应用层租户校验尚未完成，不认定已发现生产利用。 |
| DB1-T10 | LIMITED | view/materialized view | 两个重建库视图及物化视图均0；51源文件词法创建事件0。 | 不代表实际部署或应用外部动态DDL无视图。 |
| DB1-T11 | LIMITED | function/RPC/trigger | 应用函数/过程/用户触发器均0；默认312、UAT308个内部FK触发器已枚举。 | 内置pg_catalog函数不等于业务RPC；未知远端RPC/Storage未测试。 |
| DB1-T12 | LIMITED | SECURITY DEFINER/search_path/EXECUTE | 本地应用函数矩阵0项；default ACL显式记录0项；未发现应用SECURITY DEFINER。 | 不能据此将未来函数默认PUBLIC EXECUTE判安全；实际暴露schema待确认。 |
| DB1-T13 | BLOCKED | JWT授权字段来源 | 源码见服务端会话认证/Origin/CSRF；符号索引未发现用户可编辑JWT元数据授权用法。 | 未取得实际JWT提供方/claim契约；不以字符串搜索替代验收。 |
| DB1-T14 | LIMITED | service/backend边界 | 源码明确后端是租户执行点；UAT服务角色非owner/superuser/BYPASSRLS，逐表权限已列。 | 前端分发、真实数据库角色、平台管理员权限及API逐入口授权待业务/安全负责人确认。 |
| DB1-T15 | PASS | 原现场/秘密/生产保护 | 55源文件内容/权限/属主、源index/refs/status前后一致；只在无宿主发布端口的internal隔离网络写合成数据；42用例目标哈希一致。 | 观察区间有限；不撤销永久证据缺口。未访问3项受保护覆盖层；本工单容器/卷保留且数据库已停止。 |
| DB1-T16 | PASS | 风险/拆单/回滚/复验 | 风险表、禁止执行SQL草案、依赖扩散、复验和非破坏性回滚齐备。 | 报告完成不等于安全验收通过；Draft待总控评审。 |

运行器控制测试、提交范围和SHA结果在evidence中单独记录，不替代上述安全验收结论。

25项扫描器合成/证据一致性控制通过。新增材料6类秘密格式规则零命中（合成正例6/6检出）；高熵初筛4处，经逐项核验均为源迁移标识，未解决候选0。未读取实际HMAC密钥；不宣称全项目无秘密。SHA清单不包含自身，自身摘要在提交回执外置。

## 门禁2复核R01：状态固化

DB-R02调整为“潜在P0权限风险”：模拟直连授权下跨租户读写已证实，生产客户端/真实API相同可达权限未证实；不得写成已确认生产漏洞。独立P0工作为实际角色/GRANT/客户端可达性确认、后端/API/JWT逐入口隔离验收、UAT迁移前置租户及空白重建方案。

本轮逐项比对原evidence/test-results.json：T08/T09保持FAIL，T13保持BLOCKED，其余状态不变，合计3 PASS、10 LIMITED、1 BLOCKED、2 FAIL。保留原预期及全部实测结果；没有重跑数据库或改变整改SQL逻辑。仅执行治理文本一致性、既有证据不变、敏感扫描及SHA校验；此前25项控制与42项数据库用例沿用原证据，不冒称本轮重跑。
