【HANDOFF交接摘要】

✅已完成：

- 按所有者正式授权先归档三份候选SQL原字节及SHA，再移出业务正式迁移目录；原源提交保留。
- 正式迁移集合38个受控条目路径/mode/blob与批准dev一致；原型、原单测及非自动fail-closed草案原字节不变。
- 新增静态放置契约4项+原型5项单测共9项通过，build/lint通过。仅无网络任务容器；无数据库或全量Jest重跑。
- 三SQL原始字节和来源映射、门禁2失败及范围更正只追加固化。

⚠️未改动/保留原样：

- 工单新结论为“隔离候选验证交付；正式RLS整改仍BLOCKED”。资金硬前置不解除。
- 旧8 PASS/10 LIMITED属于原隔离候选历史；T17永久LIMITED、4条moderate及全部历史风险继续保留。
- 未Ready/合并/部署/晋升/真实环境或正式基线操作；旧报告及SHA不重算、不覆盖。

🚧遗留阻塞/待决策：

- 本文形成时尚未推送新提交，新双HEAD和自动Draft CI由外置HANDOFF记录，不预写成功。
- 实际身份/52表正向契约/正常链动态验证/完整非Draft CI仍未完成；本轮静态链一致不代表正式数据库安全已通过。
- 未经新门禁2/3批准不得Ready、合并或解除发布限制。

📌下一任务仅需读取文件：

- SOURCE-MANIFEST.json、PLACEMENT-CHECK.json、RESULTS.json、SELF-TEST-ADDENDUM.md。
- REVIEW-AND-SCOPE-CORRECTION.md、ISOLATION-ONLY-BOUNDARY.md、ROLLBACK.md、BASELINE-DELTA-PROPOSED.md、SHA256SUMS。
