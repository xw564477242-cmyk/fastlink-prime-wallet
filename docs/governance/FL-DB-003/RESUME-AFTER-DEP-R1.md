# FL-DB-003 依赖基点同步后复评 R1

状态：PENDING，等待新HEAD门禁2/3复评。未合并本工单PR，未部署或晋升。

## 授权与继承

总控确认FL-DEP-001门禁5闭环，正式差量仅涵盖dev代码成果。undici8.10.2、指定两项High解除及兼容性证据可复用；5个Moderate继续保留。Railway意外UAT部署归档为平台CI/CD治理覆盖盲区，不作为合规晋升或UAT安全结论。总控确认指定自动部署已关闭；本轮不再操作、核验或请求Railway/UAT。原偏差记录和环境未知项不删除。

## 两仓普通merge

| 仓库 | 旧功能HEAD | 合入dev | 普通merge HEAD |
|---|---|---|---|
| fastlik-backend | 4fead5f3e007d6226d63e263991c2de680744424 | 3f29b332f665e98082def9209df3bd799a429789 | d8dc183f6ff91f3d00c9e2e533e57ee68fce8b9e |
| fastlink-prime-wallet | 2db834ee5fe79a1aed19426924a3e8543250ee7d | 74f0d9c8a2374759f09632d3549908680b0d61dd | fc5174c677ed48e81aa117f5dddff2965bd9597f |

无冲突，无手动业务代码修改。业务普通merge相对旧功能HEAD只变更2个依赖文件；相对最新dev仍是原6个业务文件（+251/-11）。6文件Git blob逐项与旧功能HEAD一致。治理最终HEAD包含普通merge及其后的本目录证据追加提交，由最终交接绑定。

## 131路由与旧证据复用

原131/131矩阵保留：1 PASS_LOCAL、92 PASS_STATIC、38 LIMITED。原静态矩阵绑定旧业务HEAD；不将其backendHead改写成新值。本轮通过6个业务文件blob不变、merge仅依赖文件变化以及定向和完整回归，建立新HEAD复用关系。未重新全量盘点路由/迁移或执行全项目秘密扫描。38项LIMITED不因此变成安全通过。

## 本轮复测与口径更正

- 守卫admin-bearer.guard.spec.ts：10项；控制器tenants.controller.spec.ts：2项。指定命令合计12项PASS。
- HTTP双租户回归：admin-tenant-scope.integration.e2e-spec.ts，10项PASS。
- 完整Jest：1,761 PASS、2既有跳过、0 FAIL，198套件PASS。
- build、lint、仓库敏感扫描PASS；生产依赖审计0 High/0 Critical/5 Moderate。
- 三个动态阶段非回环连接尝试0；只使用合成/内存Mock，不连接数据库、既有环境或真实供应商。连接拦截为进程级，不冒充操作系统防火墙。

旧报告称“守卫与控制器合计16项”，但本轮按明确两文件命令实际为12项。未恢复旧执行命令口径，因此原16项数量作为历史记录保留并标记口径依据不足；本轮仅以机器结果12项为准，不虚增4项，也不为凑数重复扩测。完整Jest与HTTP结果分别报告，不相加为唯一测试总数。

## DB3-T01～T16 本轮状态

| 测试 | 状态 | 本轮依据及限制 |
|---|---|---|
| T01 | PASS | 继承原基线及FL-DEP-001门禁5正式差量，闭环记录已追加 |
| T02 | PASS | 相对新dev仅原6文件，无新业务改动 |
| T03 | PASS | 131/131结论复用有blob依据，38路由LIMITED仍在 |
| T04 | PASS | 可信上下文实现未变，守卫/控制器定向测试通过 |
| T05 | PASS | path/query冲突HTTP回归通过 |
| T06 | PASS | path/body冲突回归通过 |
| T07 | PASS | 会话/资源冲突回归通过，部署平台身份仍未验证 |
| T08 | PASS | 本机跨租户读取拒绝，同一P0旧前后证据保留 |
| T09 | PASS | Mock POST冲突拒绝，不执行真实写入 |
| T10 | PASS | Mock PATCH冲突拒绝，不执行真实更新 |
| T11 | PASS | Mock DELETE冲突拒绝，不执行真实删除 |
| T12 | PASS | 合法同租户路径成功 |
| T13 | PASS | 普通管理员及既有显式platform授权回归，不新增权限 |
| T14 | PASS | 无数据库/外部连接，资金和供应商使用Mock |
| T15 | PASS | 定向12、HTTP10、完整1,761通过；2项既有跳过；历史16口径不沿用 |
| T16 | LIMITED | 双PR保持未合并；等待新HEAD CI、最终范围/SHA/敏感扫描完成后按真实结果追加 |

## 仍存风险与范围

DB-R02潜在P0；FL-DB-001 T08/T09 FAIL、T13 BLOCKED；真实GRANT、部署JWT、客户端可达性、platform运行态和阶段B仍未解决。DB2-R01本工单修复仅在本机隔离验证，正式修复闭环和已部署环境安全不作提前声明。

DEV1-T03、DEV1-T12、GOV2-T09及早期原始历史缺口持续保留。未读取受保护覆盖层正文或重新采集其元数据；仅声明本轮没有对正式工作区执行操作，不补造新的字节级现场证明。

回滚继承CHANGE-AND-ROLLBACK.md：另行批准独立revert PR，禁止强推、reset、历史改写或删除证据；不得为本工单恢复已修复的undici旧版本或解除环境发布限制。

本轮验证命令、退出码、数量、环境限制见evidence/resume-R1/test-results.json。旧测试、CI失败、SHA清单和审计历史完整保留。

## R1 远端CI完成追加

业务新HEAD `d8dc183f6ff91f3d00c9e2e533e57ee68fce8b9e` 的三项远端CI均为 completed/success：

| 工作流 | 运行编号 | 结论 |
|---|---|---|
| Backend Pull Request Gate | 36764566816 | success |
| Dev Reset Round Trip | 36764566826 | success |
| FastLink Backend Non-Production CI | 36764566814 | success |

完整工作流、job与step状态见 `evidence/resume-R1/business-ci.json`。Draft专用job被跳过符合Ready状态，实际完整门禁job成功，不能以跳过job替代通过。远端工作流中的临时CI数据库验证不代表对既有数据库执行操作；本机本轮测试未连接数据库。CI中的TEST/SANDBOX安全测试名称不代表已部署环境验证。

旧交付快照校验5项通过；新增R1核验保留旧指纹清单并绑定新业务HEAD。修复前后同一D04用例的既有200/403证据保留，当前HTTP回归10项通过。治理提交本身的最终HEAD、范围、清单自身SHA及新CI运行将在提交后HANDOFF绑定，不伪造自身提交或提前宣称CI通过。上表T16为提交前时点状态；最终结果以对应治理HEAD的提交后追加交接为准。

本轮新增治理检查仅覆盖本工单目录及隔离报告/业务工作区，不访问三个受保护文件，不重新加载正式总表全文，不重新搭建六仓或全项目扫描。所有成果继续PENDING，等待新HEAD门禁2/3复评。
