# FL-DB-006自测报告

本轮为静态治理设计验证。PASS仅按测试名称解释；没有运行数据库/动态安全测试。

| 编号 | 测试项 | 状态 | 依据 | 限制 |
|---|---|---|---|---|
| DB6-T01 | 权威基线/固定SHA与复用边界 | PASS | evidence/basepoints.json; evidence/source-manifest.json | 门禁5本机记录与Git归档分开；不声称已部署一致 |
| DB6-T02 | 历史目录与当前模型集合对账 | PASS | evidence/catalog-reconciliation.json | 54历史表/60模型，14项已知差异未解决，不是现场目录查询 |
| DB6-T03 | 54表结构化契约覆盖 | PASS | TABLE-CONTRACTS.json; TABLE-CONTRACT-MATRIX.md | 仅记录完整率，非权限审批或运行覆盖率 |
| DB6-T04 | 6角色×4操作矩阵及决策映射完整 | PASS | OPERATION-MATRIX.csv; DECISION-QUEUE.json | 324角色行/1296格，正式正向审批0 |
| DB6-T05 | 正式正向业务权限获批 | BLOCKED | TABLE-CONTRACTS.json; DECISION-QUEUE.json | 47 BLOCKED/7 UNKNOWN，缺所有者逐项业务规则与审批 |
| DB6-T06 | 身份来源和调用路径可核验 | LIMITED | IDENTITY-ARCHITECTURE.md; evidence/identity-structure.json; evidence/route-reuse.json | 静态符号及调用启发式；部署身份/JWT/实际GRANT未验证 |
| DB6-T07 | 可信事务绑定正式落地可验证 | LIMITED | IDENTITY-ARCHITECTURE.md | 方案比较已完成；issuer、连接池及正式运行集成未实施/动态未运行 |
| DB6-T08 | 池复用/重放/失败关闭未来用例覆盖 | PASS | FUTURE-ACCEPTANCE.json | 仅检查设计用例完整；NOT_RUN不能解释为动态PASS |
| DB6-T09 | 字段白名单与状态转换业务批准 | BLOCKED | FIELD-AND-STATE-DECISIONS.md; TABLE-CONTRACTS.json | 源码字段/enum不能代替允许列/状态边审批 |
| DB6-T10 | 平台及任务例外批准 | BLOCKED | IDENTITY-ARCHITECTURE.md; DECISION-QUEUE.json | 暂无正式跨租户例外，自然人和期限待指定 |
| DB6-T11 | 正式新增迁移分批设计完整 | PASS | MIGRATION-ROLLOUT-ROLLBACK.md | 无SQL、未建迁移、未执行两轮重建 |
| DB6-T12 | 灰度与fail-closed回滚边界 | PASS | MIGRATION-ROLLOUT-ROLLBACK.md | 设计通过不授权环境应用或回滚操作 |
| DB6-T13 | 依赖扩散/P0拆单/差量完整 | PASS | RISKS-AND-FOLLOWUPS.md; STALE-MATRIX.md; BASELINE-PROPOSED-DELTA.md | 建议工单未创建，正式基线未改 |
| DB6-T14 | 只读分析与受保护现场边界 | LIMITED | evidence/scope-check.json; SCOPE-AND-METHOD.md | 验证仅覆盖本次固定源码/治理与检查器执行区间；不读取受保护覆盖层，不声称全机逐字不变 |
| DB6-T15 | 新增材料结构/敏感格式/SHA检查 | PASS | evidence/validation.json; evidence/sensitive-scan.json; SHA256SUMS | 仅本目录，不扫描全项目或读取真实密钥 |
| DB6-T16 | Draft PR范围/CI/回滚及HANDOFF | BLOCKED | HANDOFF.md; CHANGE-AND-ROLLBACK.md | 生成时尚未创建Draft PR或取得该HEAD CI；提交后追加承接，禁止提前PASS |

结构检查23项通过，其中8项为内存合成破坏反例拒绝；新增SHA清单完成后再执行全量摘要核验。25项未来运行验收场景全部NOT_RUN。敏感扫描只覆盖新增包，不读取实际密钥。

本轮局部检查器执行前后：index SHA、refs摘要、1026个受控文件mode及index条目摘要相等，受控工作内容diff为空。290个选定后端源码及Prisma schema摘要复核相等。不对三项受保护覆盖层或全机状态作字节不变断言。

工具修订历史：静态提取首次空参数节点TypeError、更正后成功；检查器首次admin_routes整数长度误用TypeError、更正后成功。未删除旧失败或掩盖真实数据库限制。

禁止重复执行结果：未重新解析51份迁移、未搭建六仓、未重建数据库、未重跑Jest/业务测试/全项目秘密扫描。PR现有自动CI单列，不属于数据库安全动态复验。

## PR/CI追加承接记录

首次提交 `38a3ae385187e43f9e2ecf7638d9786ba722e2da` 已建立Draft PR #90，目标dev、自动合并关闭，31新增治理文件、0删除。CI `37011510188` 对该HEAD的verify成功。原生成时T16 BLOCKED保留，按该证据承接为PASS；本追加提交的新HEAD须另核其自动CI，外置最终HANDOFF提供，不将首提交CI冒充最终提交结果。

最终设计测试汇总：10 PASS、3 LIMITED、3 BLOCKED。见TEST-RESULTS-FINAL.json；T05/T09/T10继续BLOCKED，T06/T07/T14继续LIMITED。本地检查器23项＋完整SHA核验1项通过。运行/数据库动态用例仍为0，25项未来场景NOT_RUN。

仓库现有自动CI包含其既有前端检查，本工单没有手动运行后端完整Jest或动态数据库测试，没有触发部署workflow。CI成功只证明治理PR对应仓库门禁。
