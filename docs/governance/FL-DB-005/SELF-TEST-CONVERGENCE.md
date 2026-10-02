# CI收敛后的18项自测承接

原SELF-TEST-C3.md及所有旧FAIL/BLOCKED记录保持不变。本记录依据项目所有者永久限制接受及新HEAD本机复验追加，不表示门禁2或门禁5已通过。

| 编号 | 测试 | 状态 | 依据及限制 |
|---|---|---|---|
| DB5-T01 | 基线继承 | PASS | 权威链和双仓基点可追溯，不重做旧盘点 |
| DB5-T02 | 两轮空白重建 | PASS | 新HEAD的r5/r6新空白卷原样32+3重放；每轮46控制通过；目录一致；非Prisma迁移引擎验证 |
| DB5-T03 | 角色与成员关系 | PASS | 所有验证角色非owner、非superuser、无BYPASSRLS，成员SET关闭 |
| DB5-T04 | 可信身份映射 | PASS | 隔离映射及防重放复验通过；初始FAIL保留，不证明生产集成 |
| DB5-T05 | 连接池上下文隔离 | PASS | 每库8事务/2连接交错通过，提交/回滚后无残留 |
| DB5-T06 | 54表归属覆盖 | PASS | 所有者批准52表默认拒绝契约；逐表与r5/r6目录匹配；仅承接契约覆盖，未知业务归属和可用性未被证明 |
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
| DB5-T17 | 相关测试、构建、扫描和CI | LIMITED | 永久限制：远端等价CI受官方Prisma引擎HTTP403阻塞，项目所有者接受；本地Linux等价验证用于门禁证据。新HEAD完整Jest1766通过/2跳过、5定向通过、build/lint通过；原完整远端CI未通过，4 moderate保留 |
| DB5-T18 | 双PR范围、回滚及基线差量 | LIMITED | 业务恢复原6新增文件/563行；治理仅追加批准、失败保留和新复验证据；两个PR保持Draft，门禁2待评审；回滚仅失效关闭草案，未更新正式基线 |

汇总：**8 PASS / 10 LIMITED / 0 BLOCKED / 0 FAIL**（编号验收项）；实际Prisma/JWT/后台任务集成仍BLOCKED，不被汇总隐藏。T17永久LIMITED不得升级为PASS。52表默认拒绝、2对象正例边界和所有历史风险均保留，资金硬前置不解除。
