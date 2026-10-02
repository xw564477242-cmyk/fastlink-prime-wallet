# FL-DB-007 自测报告（提交前时点）

范围仅为治理静态验收。数据库/应用/角色/RLS/JIT动态测试均未运行，不将政策决定当作运行安全通过。

| 编号 | 检查 | 状态 | 依据 | 限制 |
|---|---|---|---|---|
| DB7-T01 | 权威原文与来源SHA | PASS | sources/*; evidence/SOURCE-INDEX.json | 总控经所有者授权作出并转达决策，不伪称执行端批准 |
| DB7-T02 | 产品纠正及标准API边界 | PASS | PRODUCT-BOUNDARY.md; POLICY-CONTRACTS.json | 只固化决策，未实现API/适配器 |
| DB7-T03 | 54表与P1～P12完整唯一 | PASS | PROFILE-MAP.json; TABLE-POLICY-MATRIX.md | 不扩展10模型独有/4目录独有差异 |
| DB7-T04 | 旧新状态分离及54项承接 | PASS | STATE-SUCCESSION.json | 54 OWNER_APPROVED_POLICY不等于RLS VERIFIED |
| DB7-T05 | 6角色CRUD与直连禁止 | PASS | ROLE-CRUD-MATRIX.csv; ROLE-AND-COMMAND-BOUNDARIES.md | 有效业务行为，不是数据库授权 |
| DB7-T06 | 外部投影/秘密/不可变字段 | PASS | POLICY-CONTRACTS.json | 上界须再经归属与脱敏；运行序列化未验证 |
| DB7-T07 | 状态边/终态/单向撤销 | PASS | STATE-CONTRACTS.json | 仅治理定义，无状态机动态测试 |
| DB7-T08 | schema映射与实施缺口 | LIMITED | IMPLEMENTATION-GAPS.json; FIELD-AND-STATE-BOUNDARIES.md | 9类缺口保留，缺字段不补造，所有实施仍BLOCKED |
| DB7-T09 | JIT审批和时限 | PASS | POLICY-CONTRACTS.json; ROLE-AND-COMMAND-BOUNDARIES.md | 60/30分钟及24小时为正式决策，未实现运行机制 |
| DB7-T10 | 任务分权/retention/scheduler | PASS | POLICY-CONTRACTS.json | 模拟writer身份缺口保留，未授scheduler写入 |
| DB7-T11 | P12 QUARANTINED_DENY | PASS | POLICY-CONTRACTS.json | 四表不恢复到正式业务/RLS范围 |
| DB7-T12 | 交叉约束与冲突不扩权 | LIMITED | CONFLICT-QUEUE.json | 6条记录，3项实施语义未决，不合并更宽权限 |
| DB7-T13 | 旧文件及授权治理范围 | PASS | evidence/scope-check.json | 局部证据，不冒称原现场全机字节级证明 |
| DB7-T14 | 治理结构/合成/敏感/SHA | PASS | evidence/validation.json; evidence/sensitive-scan.json; SHA256SUMS | 最终提交前须执行新增目录静态、敏感扫描和清单精确校验；无实际密钥等值检查 |
| DB7-T15 | 无SQL/业务变更及回滚完整 | PASS | CHANGE-ROLLBACK-AND-SCOPE.md | 不执行回滚，不删除历史 |
| DB7-T16 | Draft PR精确HEAD及CI | BLOCKED | HANDOFF.md | 生成时未建立PR；后续追加承接，不提前PASS |

提交前汇总：13 PASS、2 LIMITED、1 BLOCKED（T16尚无PR）。本报告保留生成时点；取得PR/CI后以独立最终记录承接，不覆盖此前状态。T08保留9类schema/身份实施缺口；T12保留6条冲突记录中的3条实施语义未决。

治理检查器31项通过，其中14项为内存合成篡改拒绝测试；初始31项中的3个工具FAIL留存validation-initial.json，修正解析边界和标识后复测，未改变源决策。生成SHA256SUMS后另做第32项清单精确校验，最终运行输出保留在任务私有交付目录。

隔离报告克隆1061个既有受控文件的工作区diff为空；检查执行前后index SHA、引用摘要、stage摘要、权限摘要及status相同。5个DB6复用文件SHA与已登记值一致。此证明限本轮隔离克隆检查窗口，不冒称原现场历史字节已恢复或全机进程未变化。提交前暂存/提交是另行获准的报告克隆Git操作。

敏感检查只覆盖新增治理目录，分别记录显式秘密格式和高熵字面值命中。Git/SHA形式摘要仅在上下文可证明为摘要时排除；不读取真实密钥，不作实际密钥等值检查，不重跑全项目扫描。SHA256SUMS覆盖除清单自身外全部交付文件；自身摘要在仓库外最终HANDOFF记录，避免自指。

执行命令：`python3 tools/check_policy.py`、`python3 tools/scan_governance.py`（脚本以自身位置定位本目录）。采用现有Python标准库，无新增工具、系统配置或业务依赖。

未运行数据库、业务Jest、迁移、服务启动、环境验收、供应商调用及全量扫描；原因是本工单仅批准治理材料。未应用任何整改或回滚方案。
