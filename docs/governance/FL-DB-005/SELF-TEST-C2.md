# C2远端实施后状态承接

R1/R2/R3和原始FAIL/BLOCKED/LIMITED均保留。T01～T16复用已验收隔离证据，没有本轮重跑或扩大结论；只追加T17的失败阻塞。

| 编号 | 测试 | 状态 | 依据及限制 |
|---|---|---|---|
| DB5-T01 | 基线继承 | PASS | 权威链和双仓基点可追溯，不重做旧盘点 |
| DB5-T02 | 两轮空白重建 | PASS | 新r3/r4独立空白卷原样32+3文件一次性重放，顺序/哈希/目录一致；每轮46控制通过；非Prisma迁移引擎验证 |
| DB5-T03 | 角色与成员关系 | PASS | 所有验证角色非owner、非superuser、无BYPASSRLS，成员SET关闭 |
| DB5-T04 | 可信身份映射 | PASS | 隔离映射及防重放复验通过；初始FAIL保留，不证明生产集成 |
| DB5-T05 | 连接池上下文隔离 | PASS | 每库8事务/2连接交错通过，提交/回滚后无残留 |
| DB5-T06 | 54表归属覆盖 | PASS | 所有者批准52表默认拒绝契约；逐表与r3/r4目录匹配；仅承接契约覆盖，未知业务归属和可用性未被证明 |
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
| DB5-T17 | 相关测试、构建、扫描和CI | BLOCKED | 等价隔离CI 36825857182在准备阶段失败；仅input_hashes通过，未到达测试或新库；不得重跑/修复。既有本地1766通过/2跳过、4 moderate及历史LIMITED保留 |
| DB5-T18 | 双PR范围、回滚及基线差量 | LIMITED | 精确C2实施和双PR范围可追溯；治理失败记录待本轮CI，业务T17阻塞，回滚仅失效关闭草案；禁止合并和正式基线更新 |

汇总：8 PASS、9 LIMITED、1 BLOCKED。T17的CI执行结果本身为failure；整项验收因证据未形成保持BLOCKED，不改为PASS。实际Prisma/JWT/后台任务集成仍BLOCKED。52表默认拒绝不证明业务可用，资金硬前置不解除。62项C2离线检查通过仅证明审阅控制，不代替运行结果。
