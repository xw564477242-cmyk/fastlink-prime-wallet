【HANDOFF交接摘要】

✅已完成：

- 总控门禁2整改要求的两套另外新建空白库r3/r4已原样完成32+3迁移重放；顺序、SHA及对象/权限目录一致，每轮46项控制PASS。T02由R1 LIMITED追加承接为本轮PASS，仍须评审接受。
- 52/52审批矩阵及12组审批摘要完整，包含逐表CRUD、归属、角色、敏感字段名、间接访问和批准角色；没有新增正向权限，全部BLOCKED。
- 仅在项目所有者精确授权及源SHA一致后发送174公共包名/版本至官方Bulk端点；HTTP200，4条moderate匹配、high/critical0。仅公告版本命中，不证明应用可利用。
- 完整CI适配方案已提交；明确不是只需Ready，当前未修改工作流或触发完整CI。
- 当前18项：7 PASS、10 LIMITED、1 BLOCKED。见SELF-TEST-R2.md。

⚠️未改动/保留原样：

- 业务HEAD保持91595282b47204aabd1c0871dcb8c286e8ff841d；三份新增迁移和32原迁移逐字未变。
- 两个PR均Draft、目标dev、自动合并关闭；当前门禁2不通过，门禁3未进入。
- 四套任务库均已停止，新旧卷、700/600任务认证、票据、序列和失败证据保留。
- R1 LIMITED、首次CI失败、宿主25失败、保存点重放FAIL及sequence边界失败均保留，未覆盖历史。
- 未连接任何现有环境，未用真实数据/原凭据，未改依赖/锁文件、业务身份链或正式基线，未部署晋升或清理。

🚧遗留阻塞/待决策：

- 52表契约待项目所有者逐项批准；10个schema-only和4个catalog-only继续STALE，不改变54表范围。
- 实际Prisma/JWT/任务身份集成BLOCKED；本机隔离封装不等于运行服务集成。
- 完整业务CI未执行；需评审具体适配方案及可能涉及的身份集成/reset边界，未经批准不转Ready。
- 4条moderate依赖公告需独立可达性/兼容性评估，不自动修复。Bulk审计不含npm元漏洞传播计算。
- 票据sequence生命周期、其余T08～T15覆盖限制和历史安全风险继续保留。资金硬前置未解除。

📌下一任务仅需读取文件：

- REBUILD-AND-REMEDIATION-R2.md、SELF-TEST-R2.md
- TABLE-CONTRACT-GROUP-SUMMARY-R2.md、TABLE-CONTRACT-APPROVAL-R2.md
- FULL-CI-PLAN-R2.md、NPM-AUDIT-AUTHORIZATION-R2.md、NPM-AUDIT-RESULT-R2.md
- BASELINE-DELTA-R2-PROPOSED.md
- evidence/rebuild-final-r3-r4.json、final-chain-catalog.json、dynamic-final-r3-r4.json、negative-final-r3-r4.json、retention-r2.json
- evidence/52-table-contract-approval-matrix.json、r2-document-controls.json、r2-sensitive-scan.json

新治理HEAD、PR累计范围、CI与清单自身SHA在提交后外置HANDOFF补齐，不创建提交自引用。
