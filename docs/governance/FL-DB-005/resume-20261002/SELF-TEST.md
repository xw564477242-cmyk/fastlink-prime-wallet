# DB5-T01～T18恢复轮次追加状态

原测试定义及历史状态不覆盖。8 PASS / 10 LIMITED；实际身份集成仍BLOCKED，资金硬前置未解除。

| 编号 | 定义 | 状态 | 依据与限制 |
|---|---|---|---|
| DB5-T01 | 基线继承 | PASS | 原8 PASS/10 LIMITED状态继承；本轮对应控制及输入对账见RESULTS与evidence |
| DB5-T02 | 两轮空白重建 | PASS | 原8 PASS/10 LIMITED状态继承；本轮对应控制及输入对账见RESULTS与evidence |
| DB5-T03 | 角色与成员关系 | PASS | 原8 PASS/10 LIMITED状态继承；本轮对应控制及输入对账见RESULTS与evidence |
| DB5-T04 | 可信身份映射 | PASS | 原8 PASS/10 LIMITED状态继承；本轮对应控制及输入对账见RESULTS与evidence |
| DB5-T05 | 连接池上下文隔离 | PASS | 原8 PASS/10 LIMITED状态继承；本轮对应控制及输入对账见RESULTS与evidence |
| DB5-T06 | 54表归属覆盖 | PASS | 原8 PASS/10 LIMITED状态继承；本轮对应控制及输入对账见RESULTS与evidence |
| DB5-T07 | RLS启用 | PASS | 原8 PASS/10 LIMITED状态继承；本轮对应控制及输入对账见RESULTS与evidence |
| DB5-T08 | FORCE RLS适用性 | LIMITED | 保留原对象/集成/owner/覆盖边界，不扩为全业务安全 |
| DB5-T09 | 同租户SELECT | LIMITED | 保留原对象/集成/owner/覆盖边界，不扩为全业务安全 |
| DB5-T10 | 跨租户SELECT | LIMITED | 保留原对象/集成/owner/覆盖边界，不扩为全业务安全 |
| DB5-T11 | INSERT | LIMITED | 保留原对象/集成/owner/覆盖边界，不扩为全业务安全 |
| DB5-T12 | UPDATE | LIMITED | 保留原对象/集成/owner/覆盖边界，不扩为全业务安全 |
| DB5-T13 | DELETE | LIMITED | 保留原对象/集成/owner/覆盖边界，不扩为全业务安全 |
| DB5-T14 | Admin/任务身份 | LIMITED | 保留原对象/集成/owner/覆盖边界，不扩为全业务安全 |
| DB5-T15 | 函数、视图、序列与间接访问 | LIMITED | 保留原对象/集成/owner/覆盖边界，不扩为全业务安全 |
| DB5-T16 | default privileges及PUBLIC | PASS | 原8 PASS/10 LIMITED状态继承；本轮对应控制及输入对账见RESULTS与evidence |
| DB5-T17 | 相关测试、构建、扫描和CI | LIMITED | 永久LIMITED；本轮本地build/lint/Jest及定向验证通过；远端完整作业未运行；2跳过/4 moderate及历史CI限制保留 |
| DB5-T18 | 双PR范围、回滚及基线差量 | LIMITED | 双Draft待新门禁2/3；治理提交及对应CI须由外置HANDOFF核验；未部署/晋升 |
