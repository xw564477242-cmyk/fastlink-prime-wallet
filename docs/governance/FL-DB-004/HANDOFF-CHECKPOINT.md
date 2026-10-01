【HANDOFF交接摘要】
✅已完成：
- FL-DB-004门禁1阶段A；两仓独立干净基点固定；51SQL哈希/OID相同，Prisma无差量。
- 本地17.11镜像与DB1摘要一致；新空白无网络实例；三测试身份均非owner、非superuser、无BYPASSRLS，成员关系0。
- 增量、继承矩阵、覆盖缺口、整改草案、UAT方案、回滚及DB4-T01～T16检查点已形成。
⚠️未改动/保留原样：
- 无业务/迁移/共享权限/正式基线改动；原风险和永久偏差保留。
- 未访问任何既有DEV/TEST/UAT/生产或Railway；无真实数据/旧凭据。
🚧遗留阻塞/待决策：
- 正式第3步DROP CONSTRAINT/INDEX不在DB4现有授权内；迁移及双租户测试未执行。DB1例外不自动继承。
- 总控已向项目所有者申请专项授权；获明确批准前不执行依赖步骤。
- 当前无新提交、PR、CI；门禁2未申请，不能称阶段A验收完成。阶段B继续BLOCKED。
📌下一任务仅需读取文件：
- README.md、SELF-TEST.md、evidence/preflight.json、evidence/isolation.json、evidence/source-delta.json。
