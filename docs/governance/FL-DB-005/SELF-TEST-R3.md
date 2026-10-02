# DB5-T01～T18 R3状态承接

R2、R1及所有原始FAIL/BLOCKED/LIMITED不改写。本轮仅根据新增正式契约批准和离线证据核对承接T06，数据库执行0。

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
| DB5-T17 | 相关测试、构建、扫描和CI | LIMITED | 新增5单测/build/lint及Linux1766测试通过；2跳过、限定审计4条moderate匹配、完整CI未执行 |
| DB5-T18 | 双PR范围、回滚及基线差量 | LIMITED | Draft双PR本轮治理修订等待对应CI，回滚仅失效关闭草案，禁止合并和基线更新 |



汇总：8 PASS、10 LIMITED、0 BLOCKED（仅18项编号汇总）。实际Prisma/JWT/后台任务身份集成仍BLOCKED；不因编号表不再有BLOCKED就宣称所有阻断消失。52表业务正向权限保持关闭；仅默认拒绝契约明确。T08～T15全部LIMITED，T17/T18保持LIMITED。门禁2待复核，门禁3未进入，资金硬前置不解除。

依据：OWNER-CONTRACT-APPROVAL-R3.md、TABLE-CONTRACT-APPROVED-R3.md、evidence/contract-implementation-check-r3.json。未修改RLS、迁移、业务文件、CI、锁文件或权限。
