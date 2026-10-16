# project-master-summary.md（项目总表·指定入口）

> 本文件是执行流程中以 `docs/governance/project-master-summary.md` 命名引用的**总表入口**。
> 权威「活摘要总表」唯一正本位于：[`baseline/PROJECT-STATUS-SUMMARY.md`](baseline/PROJECT-STATUS-SUMMARY.md)。
> 为避免基线分叉，日常状态以该正本为准；本文件只登记条款与指向，不另建一套并行总表。
> 变更历史（只追加）：[`baseline/CHANGE-HISTORY.md`](baseline/CHANGE-HISTORY.md)。

当前基线增量版本：`BASE-V1.1-20261011`（上一正式基线 `BASE-V1.0-20260930` 原样保留）。

## 2026-10-11｜FL-DB-015 V13 回滚只读审查一次性特例豁免（已到期）

- 该条款与审定结论已追加写入权威正本 [`baseline/PROJECT-STATUS-SUMMARY.md`](baseline/PROJECT-STATUS-SUMMARY.md) 及 [`baseline/CHANGE-HISTORY.md`](baseline/CHANGE-HISTORY.md)，永久留存。
- 豁免：一次性、仅服务当次 V13 回滚只读审查（23505 约束行为确认 + 回滚后数据指纹取证），任务结束自动失效，不可复用至其他 Gate1 补证项。
- 审定结论：两项取证均 `NOT_VERIFIED`（23505 不能确认预期 Customer_pkey；回滚后指纹未采集）；Gate1 仍未通过；未启动环境、未执行 SQL、未覆盖旧记录。
- HANDOFF：`/private/tmp/FL-DB-015-v13-final-readonly-review-20261011/HANDOFF.md`。

## 2026-10-11｜重复记录关系澄清｜BASE-V1.2-20261011

- 本增量仅为文档关系澄清；既有 BASE-V1.0、BASE-V1.1 正文和历史时点状态完整保留。
- 权威摘要与历史日志中的两段 BASE-V1.1 特例记录指向同一次授权及审查，不构成第二次授权、重新生效、新增指标或第二次版本升级。
- 原特例已到期，不可复用；两项取证仍为 NOT_VERIFIED，Gate1 仍未通过，资金硬前置保持冻结。
- 原 FAIL、错误证据、更正包、备份、工具引用和历史缺口继续保留，不恢复、删除或覆盖。
- 剩余补证仅按实际可读的冻结原始清单规划，不以摘要重构，不增加指标；执行权限、资源、次数与窗口另待审批。本次不执行动态验证。

## 2026-10-16｜真 DEV 客服迁移与 I01—I07 验证收口｜BASE-V1.3-20261016

- 本轮状态登记增量为 `BASE-V1.3-20261016`；原正式快照及全部历史条目原样保留。权威当前状态见 [`baseline/PROJECT-STATUS-SUMMARY.md`](baseline/PROJECT-STATUS-SUMMARY.md) 本日同名追加，变更历史同步追加，不另建并行总表。
- 真 DEV（项目 `vjauheoyeysgezbxhbcc`，Session pooler:5432，`postgres/public`）客服限定迁移已完成：原九表最小模型及合成 fixture，随后本批四个身份/SANLX 模型投影与一个受保护任务 key 载体；不是全平台迁移、生产迁移或应用部署。
- I01—I05 引用 2026-10-15 已接受的真实运行与后续独立受限收尾；I06/I07 于 2026-10-16 北京时间 11:21:54—11:27:12 一次运行通过、exit 0，受限认证收尾确认。合并状态为 **I01—I07 全部 PASS（限定真 DEV 客服与补充审计/Trace 范围）**，不是七组在同一原始轮次一次通过。
- 交付已提交 backend 新归档分支：`codex/b6-dev-i01-i07-20261016`，提交 [`bcb04983db3f7a2f0bf739cbd2d3c3b680a6bdf4`](https://github.com/xw564477242-cmyk/fastlik-backend/commit/bcb04983db3f7a2f0bf739cbd2d3c3b680a6bdf4)。原备份分支与 dev/main 不改，未合并、未部署。
- 维持：**FL-DB-015 Gate1 `NOT_PASSED`，资金 `FROZEN`**；完整 END_USER 登录/注册/refresh/CSRF/HTTP 认证仍未验证，API_CLIENT `BLOCKED`，生产/UAT 与资金 Provider 未开放。本阶段限定交付收口不等于历史全部风险解除或整体可运营上线。
- 原 STOP、缺失、失败及重复记录全部保留；新审定不回填旧回执。退出资源、数据、私有材料、CONNECT、原 ADMIN 关系、extensions USAGE 及合成租约残余按授权保留，非完整退役。
