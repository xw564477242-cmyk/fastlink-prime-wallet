# DB5-T01～T18补证R2

原SELF-TEST-R1及其T02 LIMITED保留，R2仅以新增证据承接T02。

| 编号 | 测试 | 状态 | 依据及限制 |
|---|---|---|---|
| DB5-T01 | 基线继承 | PASS | 权威链和双仓基点可追溯，不重做旧盘点 |
| DB5-T02 | 两轮空白重建 | PASS | 新r3/r4独立空白卷原样32+3文件一次性重放，顺序/哈希/目录一致；每轮46控制通过；非Prisma迁移引擎验证 |
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
| DB5-T17 | 相关测试、构建、扫描和CI | LIMITED | 新增5单测/build/lint及Linux1766测试通过；2跳过、限定审计4条moderate匹配、完整CI未执行 |
| DB5-T18 | 双PR范围、回滚及基线差量 | LIMITED | Draft双PR治理修订等待对应CI，回滚仅失效关闭草案，禁止合并和基线更新 |


汇总：7 PASS、10 LIMITED、1 BLOCKED。T06仍BLOCKED；其他限制不因新重建自动解除。T04仅隔离身份；实际服务Prisma/JWT/任务集成BLOCKED。T08～T15保持原覆盖限制。T17完整业务CI待批，限定依赖审计已执行且4条moderate公告待评估。52/52审批建议完成不等于52表获得授权。

## R2后续承接：限定npm审计已执行

收到项目所有者精确授权后，源SHA核对一致，174条公共包名/版本按官方Bulk格式发送（165包名），HTTP200，4条moderate匹配、high/critical匹配0。前述“审计待批/未发送”为材料起草时状态；此记录承接，原自动阻断记录不删除。不含元漏洞计算，不证明应用可利用性，未升级依赖。完整业务CI与52表审批仍未完成，T17保持LIMITED。详见NPM-AUDIT-RESULT-R2.md。
