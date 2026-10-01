# DB5-T01～T18 当前交付状态

历史检查点状态保留，不覆盖。范围限制不能解释为安全通过。

| 编号 | 测试 | 状态 | 依据及限制 |
|---|---|---|---|
| DB5-T01 | 基线继承 | PASS | 权威链和双仓基点可追溯，不重做旧盘点 |
| DB5-T02 | 两轮空白重建 | LIMITED | 两独立空白库原32步一致；最终三迁移组合未重新从零一次性重放 |
| DB5-T03 | 角色与成员关系 | PASS | 所有验证角色非owner、非superuser、无BYPASSRLS，成员SET关闭 |
| DB5-T04 | 可信身份映射 | PASS | 隔离映射及防重放复验通过；初始FAIL保留，不证明生产集成 |
| DB5-T05 | 连接池上下文隔离 | PASS | 每库8事务/2连接交错通过，提交/回滚后无残留 |
| DB5-T06 | 54表归属覆盖 | BLOCKED | 54/54有记录，但52对象业务操作契约未批准 |
| DB5-T07 | RLS启用 | PASS | 54/54最终RLS=true |
| DB5-T08 | FORCE RLS适用性 | LIMITED | 54/54 FORCE=true；表owner仍为仅初始化使用的superuser，不能以它证明安全 |
| DB5-T09 | 同租户SELECT | LIMITED | 仅两个获批对象正例，52对象未验证合法路径 |
| DB5-T10 | 跨租户SELECT | LIMITED | 仅Customer/地址簿样本；不扩为全部对象安全 |
| DB5-T11 | INSERT | LIMITED | 地址簿本人成功，伪造归属拒绝；Customer写明确拒绝 |
| DB5-T12 | UPDATE | LIMITED | 地址簿本人成功，跨租户及归属改变拒绝；无资金写验证 |
| DB5-T13 | DELETE | LIMITED | 地址簿本人成功、跨租户拒绝；不等于52对象验收 |
| DB5-T14 | Admin/任务身份 | LIMITED | 租户admin Customer读取、平台/任务默认拒绝；无其他业务授权 |
| DB5-T15 | 函数、视图、序列与间接访问 | LIMITED | 新函数/trigger/序列检查通过；未全量验证52对象间接业务路径 |
| DB5-T16 | default privileges及PUBLIC | PASS | 运行身份仅2对象5项DML授权，PUBLIC执行/私有序列权限受限 |
| DB5-T17 | 相关测试、构建、扫描和CI | LIMITED | 新增5单测/build/lint及Linux1766测试通过；2跳过、依赖审计待授权、完整CI未执行 |
| DB5-T18 | 双PR范围、回滚及基线差量 | LIMITED | Draft双PR待CI记录，回滚仅失效关闭草案，禁止合并和基线更新 |

当前：6 PASS、11 LIMITED、1 BLOCKED。52表操作契约仍BLOCKED。门禁2待审，门禁3未进入，资金硬前置未解除。

## CI格式补正（追加记录）

治理首次CI运行36819354068对应20d3921b97c0f31275d7e10ee201934516c7ea54，在Lint步骤失败，原因是四份治理工具副本的Prettier格式。只修订tools下四份.cjs的排版；归一化AST逐份一致，本地ESLint通过。已执行的私有脚本、SQL、动态证据及业务HEAD均未改动，未重跑数据库测试。原提交及失败保留；新HEAD对应CI在外置HANDOFF记录。

业务Draft PR #336的三个工作流36819344723、36819344750、36819344721中lint成功，完整流水线因Draft跳过，不等同完整CI通过。治理Draft PR #88继续保持Draft；无门禁2/3通过结论。
