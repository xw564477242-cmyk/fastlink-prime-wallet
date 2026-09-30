# FL-DEP-001 依赖安全最小升级

状态：PENDING，门禁1通过；提交门禁2评审，不代表已合并、部署或关闭风险。

继承 BASE-V1.0-20260930 + FL-GOV-002 + FL-DB-001 + FL-DB-002正式差量及FL-DB-003阻断记录。仅将后端直接依赖undici 8.9.0升级至8.10.2；业务差异仅package.json和package-lock.json。

业务PR：[fastlik-backend #335](https://github.com/xw564477242-cmyk/fastlik-backend/pull/335)，HEAD `9d95caa41fa5bbb9e46a5a7c6b73f5505a5cb359`。两仓PR必须保持Draft，目标dev。最终治理PR HEAD和CI在门禁2交接中绑定，不进行自引用哈希。

文件入口：SELF-TEST.md、DEPENDENCY-AND-RISK.md、COMPATIBILITY.md、SCOPE-AND-PROTECTION.md、CHANGE-AND-ROLLBACK.md、BASELINE-DELTA.md、HANDOFF.md。完整业务diff、审计JSON、测试摘要及运行时证据位于evidence/。

SHA256SUMS覆盖除自身之外的所有交付文件；清单自身SHA在最终交接外置报告。
