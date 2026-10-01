【HANDOFF交接摘要】

✅已完成：

- 双仓固定基点及独立分支；6个新增业务文件，治理变更仅本目录。
- 54表RLS/FORCE目录核验；两个获批对象的隔离策略及可信事务绑定。
- 两轮新库每轮32步原迁移，随后追加三份候选迁移，全部保留原文件和哈希。
- 最终每库29核心+17补充控制通过，共92项；初始FAIL及修订轨迹保留。
- Linux完整Jest1766通过、0失败、2跳过；宿主5单测/build/lint通过。
- 当前格式和任务认证材料扫描0命中，高熵9项结构性非秘密、未决0。

⚠️未改动/保留原样：

- 不改既有迁移、JWT、路由、资金逻辑、正式覆盖层或基线。
- 原两轮25项HTTP失败、保存点重放FAIL、sequence参数失败均保留。
- 两库已停止，卷、700/600认证文件、旧票据、sequence及证据全部保留。
- 未连接现有环境，未使用真实数据/凭据，未部署、晋升或清理资产。

🚧遗留阻塞/待决策：

- DB5-T01～T18：6 PASS、11 LIMITED、1 BLOCKED，详见SELF-TEST-R1.md。
- 52表操作契约BLOCKED；10模型/4旧表差异STALE；生产身份集成未验收。
- 最终三迁移链未再从另两新空白库一次性重放，T02 LIMITED。
- 依赖审计外发等待精确批准；后端Draft CI仅lint，完整CI未执行。
- 每票据sequence长期容量/保留策略LIMITED；不自动删除。
- 门禁2待评审、门禁3未进入；资金硬前置和全部历史风险未解除。

📌下一任务仅需读取文件：

- REPORT-R1.md
- SELF-TEST-R1.md
- RISKS-AND-FOLLOWUPS.md
- evidence/table-scope-final.json
- evidence/dynamic-r1.json、dynamic-r2.json、dynamic-r3.json、negative-r1.json
- CHANGE-AND-ROLLBACK.md
- BASELINE-DELTA-R1-PROPOSED.md

双PR链接、当前完整HEAD、CI及清单自身SHA在提交后的外置HANDOFF补齐，避免提交自引用。

## CI格式补正（追加记录）

治理首次CI运行36819354068对应20d3921b97c0f31275d7e10ee201934516c7ea54，在Lint步骤失败，原因是四份治理工具副本的Prettier格式。只修订tools下四份.cjs的排版；归一化AST逐份一致，本地ESLint通过。已执行的私有脚本、SQL、动态证据及业务HEAD均未改动，未重跑数据库测试。原提交及失败保留；新HEAD对应CI在外置HANDOFF记录。

业务Draft PR #336的三个工作流36819344723、36819344750、36819344721中lint成功，完整流水线因Draft跳过，不等同完整CI通过。治理Draft PR #88继续保持Draft；无门禁2/3通过结论。
