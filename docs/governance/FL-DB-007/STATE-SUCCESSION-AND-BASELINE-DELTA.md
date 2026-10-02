# 状态承接与基线拟追加差量

交付PENDING；本工单尚未门禁5闭环，未更新正式基线或生成新快照。

所有者决策本身记录为OWNER_APPROVED_POLICY，治理交付状态、实施状态和验证状态分开。此字段不是对五状态模型的替换，也不是VERIFIED的新别名。DB6的0 VERIFIED、47 BLOCKED、7 UNKNOWN原文原文件原SHA均保留；STATE-SUCCESSION.json逐表从旧状态引用到新决策记录，不覆盖历史。

拟新增可复用：54表正式决策来源与唯一主profile、6角色有效业务CRUD/字段/状态矩阵、标准API与内部适配器边界、JIT/任务限制、冲突和schema缺口索引。拟作废解释：向B端透传第三方IPA接口/身份/秘密；只追加纠正，保留旧正文。

保持：54项implementation BLOCKED、validation NOT_RUN；DB-R02、DB1/DB4原FAIL/BLOCKED、DB5 T17永久LIMITED、38 Admin LIMITED、DEV1-T03、DEV1-T12、GOV2-T09、HISTORY-GAP、88 High/2917候选及所有旧证据。资金/RLS硬前置未解除，实际角色/GRANT/部署JWT/外部阶段B未验证。

新增禁止重复：无输入变化复用DB6结构与本轮决策，不重做54表静态提取、51迁移盘点、数据库实验、六仓搭建、全量业务测试或秘密扫描。后续实施必须针对已批准决策和明确缺口另立工单，不自动创建。

门禁5后由总控决定正式追加与版本，不因本PR合并就宣布实施或运行安全通过。
