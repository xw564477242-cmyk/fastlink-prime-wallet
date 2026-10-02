# FL-DB-006｜52表业务权限契约与正式RLS实施设计

状态：PENDING，门禁1通过，申请门禁2。正式权限契约、正式RLS及资金硬前置继续BLOCKED。本交付只有治理设计，没有SQL、数据库变更或业务修复。

## 固定基点与继承

后端dev：`2b120bc18a1e2ef3bb5ae42197c625764441db0c`；树：`8e292089b0eb275eea98d188b6bd17cd93cc586c`。只读源码视图为已批准HEAD `cb92513b266ead8a0cabeff297e4f4c5ffc381d6`，树相等，不切换或拉取覆盖正式后端工作区。

治理dev及本分支起点：`eb59a0d54621693da20e9913461c076891967f7d`；树：`f21e21e76e2556cd2afaa0480b8d807465f46569`。报告分支 `feature/FL-DB-006-permission-contract-design`，仅在干净独立报告克隆中新增本目录。核验时远端dev与以上检查点一致；不是对未来远端不变的保证。

继承BASE-V1.0-20260930、FL-GOV-002、FL-DB-001～005、FL-DEP-001及相关正式差量；不复制现状总表。DB5门禁5承接记录目前为本机证据，文件路径与SHA见 [来源清单](evidence/source-manifest.json)，不冒称已入旧PR。

持续携带：DB-R02潜在P0；DB1 T08/T09 FAIL、T13 BLOCKED；DB4 T07 FAIL、T08～T11 BLOCKED；131 Admin审计中的38条LIMITED；DB5 T17永久LIMITED及原8 PASS/10 LIMITED历史；4项moderate依赖风险按原记录保留。本轮没有重测或关闭这些结果。

DEV1-T03永久证据缺口、DEV1-T12流程越权、GOV2-T09接受偏差及HISTORY-GAP均保留。原FAIL、错误证据、更正包、21项备份、工具引用、密钥及旧证据不得删除或覆盖；不恢复index/登记、不GC。三项受保护本地覆盖层不访问、不读取正文、不重算摘要、不认定写入主体。

## 结果口径

54/54是历史默认重建54张业务表的契约记录覆盖率，不是生产对象完整率，也不是权限通过率。6角色×4操作＝1,296格，全部正式正向权限仍待批准。完整正式契约VERIFIED 0、结构可定位但审批BLOCKED 47、归属UNKNOWN 7。54项均进入责任角色决策队列。

当前Prisma有60模型：50匹配历史表、10仅模型、4仅历史目录；这些是继承的未解决差异，不是本轮新增迁移。两套集合不得合并冒充已部署目录。

52表原批准默认拒绝仅适用于DB5隔离验收；Customer/WithdrawalAddress两个正向隔离样例也不等于生产运行授权。未知项不会通过全拒绝被标为业务可用。

复用216路由和131 Admin清单，本轮只对216个处理符号定位；不重新运行路由动态测试。源码成员名启发式共699处delegate-shaped调用、65处事务调用；不宣称完整类型/数据流解析。

## 阅读顺序

1. [逐表矩阵](TABLE-CONTRACT-MATRIX.md)、[完整契约](TABLE-CONTRACTS.json)、[角色操作矩阵](OPERATION-MATRIX.csv)、[决策队列](DECISION-QUEUE.json)。
2. [身份链及运行架构](IDENTITY-ARCHITECTURE.md)、[字段与状态决策](FIELD-AND-STATE-DECISIONS.md)。
3. [迁移与回滚设计](MIGRATION-ROLLOUT-ROLLBACK.md)、[风险与拆单](RISKS-AND-FOLLOWUPS.md)、[依赖扩散](STALE-MATRIX.md)。
4. [未来验收定义](FUTURE-ACCEPTANCE.json)、[本轮测试定义](TEST-DEFINITIONS.json)、[自测](SELF-TEST.md)、[HANDOFF](HANDOFF.md)。

PR只能为Draft、目标dev、自动合并关闭。CI只证明对应提交的仓库门禁，不等于数据库权限验证。不得合并、部署、晋升、更新正式基线或解除资金关闭。
