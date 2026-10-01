【HANDOFF交接摘要】

✅已完成：

- 总控转发的项目所有者52表契约批准原文已追加固化。
- 新R3逐表矩阵明确52表对所有应用运行身份默认拒绝；R2建议及待审批记录作为历史保留。
- 离线对账r3/r4既有目录：52表均无非owner表授权、无放行策略，RLS/FORCE均启用；正向权限仍仅2对象、5项GRANT及5项策略。票据/归属函数和既有动态证据一致。
- T06从历史BLOCKED承接本轮PASS；当前DB5-T01～T18为8 PASS、10 LIMITED。没有新增SQL或动态实验。

⚠️未改动/保留原样：

- 业务HEAD 91595282b47204aabd1c0871dcb8c286e8ff841d、三份候选迁移、既有策略与权限均未改变。
- 旧FAIL、R1/R2限定结论、首次CI失败、52表原审批建议、重放/sequence失败及四套任务资产继续保留。
- 双PR Draft、目标dev、自动合并关闭；未修改CI、未转Ready、未合并。
- 未重启数据库、未连接现有环境、未使用真实数据、未改依赖或正式基线、未部署晋升或清理资产。

🚧遗留阻塞/待决策：

- 实际Prisma/JWT/后台任务集成继续BLOCKED；52表业务可用性和任何新增正向权限尚未批准。
- T08～T15继续LIMITED；T17完整业务CI未执行、4条moderate公告未处置；T18保持交付/回滚等限制。
- 10个schema-only/4个catalog-only差异、永久偏差及历史缺口继续保留。资金硬前置不解除。
- 新正向权限必须由独立FL-DB-006逐入口/角色/字段/操作授权，本次不自行开展。

📌下一任务仅需读取文件：

- OWNER-CONTRACT-APPROVAL-R3.md
- TABLE-CONTRACT-APPROVED-R3.md及evidence/52-table-approved-contract-r3.json
- evidence/contract-implementation-check-r3.json与tools/check_contract_r3.py
- SELF-TEST-R3.md、BASELINE-DELTA-R3-PROPOSED.md
- FULL-CI-PLAN-R2.md（仍为未批准方案）

治理完整HEAD、CI、文件范围和清单自身SHA于提交后外置HANDOFF补齐。门禁2等待复核，门禁3未进入。
