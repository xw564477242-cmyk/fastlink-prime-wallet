**FL-DB-008 — consume_admission 离线根因矩阵（2026-10-04）**

结论：已证实 R2 在注册提交后调用 `consume_admission` 返回 42501，随后 STOP 并完整退役；尚未确定内部首个失败点，也未核验一次性序列是否已 burn。42501 是统一错误出口，不能据此认定唯一根因或跨租户拒绝成功。

本次仅阅读指定既有记录、调用方源码及候选 SQL 的相关纯 SQL 依赖；未访问 Docker、数据库、网络或 Git，未执行 SQL、测试或重试，未读取材料或密钥文件。以下是单次归档分析，不构成修复、验收、额外审批节点或执行安排；候选 SQL 不进入正式迁移。

| 阶段／候选项 | 判定 | 已有依据与推断边界 | 源码／记录位置 |
|---|---|---|---|
| challenge 文本交接 | 已证实 | 两端均为 399 字节，issuer 数据库侧 SHA-256 与客户端一致，未保留正文。该次传递改变可排除；不能外推为后续 BIND 验证成功。 | R:458–470；H:6；C:209–228 |
| 注册与提交 | 已证实 | `register_admission` 成功、回执格式检查通过且 issuer COMMIT 完成；随后到达消费调用。注册时通过不代表消费时的时效、目标或内部条件仍通过。 | H:7；C:229–239；R:494–496 |
| runtime 身份、隔离级别、合约规范化 | 未确认具体失败点 | 既有身份／函数权限目录检查已通过，调用方显式请求 READ COMMITTED；消费函数仍重新检查载体与隔离级别并规范化输入。未读取消费时内部状态，不能仅凭先前检查完全排除。 | H:8；C:236；S3:99–101；S2:14–55 |
| `target` 名称解析 | 静态风险已证实；运行归因未确认 | 候选函数声明局部变量 `target`，admission 表也有同名列，取行条件使用未限定名称。存在名称解析冲突或错误绑定的候选；实际运行函数定义及变量冲突策略未核验，不能断言本轮由此失败。该候选位于 `nextval` 前。 | S3:97、102–103；S1:74 |
| admission 查找及授权／实例复核 | 未确认 | STRICT 取行要求目标匹配且未过期，随后复核合约、轮次、请求／授权有效性及实例配置；取行失败、时效变化或条件不一致均可进入统一拒绝。注册提交不排除随后过期。 | S3:102–113；S2:57–62 |
| 序列目录校验及 `nextval` | 未确认；burn 分界 | 先校验序列身份、归属和参数，再调用一次性序列并校验返回值。目录不符、序列已耗尽或执行异常均为候选。未核验序列状态，不能认定已 burn、未 burn、可复用或可重签。 | S3:114–123；S3:79–90 |
| burn 后绑定、签名、内部身份复核 | 未确认 | 取得事务目标、插入绑定、BIND 签名、设置事务内证明、内部 `current_identity` 复核均在 `nextval` 后；约束冲突、时效／签名状态、绑定或身份条件异常仍可能落入同一错误出口。challenge 验证成功不能证明 BIND 路径成功。 | S3:124–152；S2:64–94；S1:86–89 |
| 异常包装及回滚 | 已证实失败边界；内部顺序未知 | 消费函数和内部身份函数都把广泛异常映射为 42501；现有栈只定位到调用方消费语句。调用方回滚及退役已记录，但回滚不能证明序列未消耗；源码明确把序列与事务性绑定记录分开。 | S3:121–132、152；S1:84–89；C:72–80、256–258；R:480–516；H:17 |
| 业务与身份后续调用 | 已证实未完成 | 调用方独立的 `current_identity` 及业务 SELECT 未执行，跨租户读写改删未完成。消费函数内部的 `current_identity` 是否曾触达仍未知，不能与调用方后续调用混同。没有形成业务 RLS 成功／拒绝验证结论。 | C:238–249；S3:130；H:18–19 |
| STOP、退役与门禁 | 已证实 | 本轮停止后完整退役 PASS；动态轮次未完成、门禁 2 为 NOT_MET。注册记录及一次性序列保留；没有重放、重置序列或自动重新签发的依据。 | R:6、611–629；H:9–10、14、17–20 |

源文件索引（仅位置与非秘密摘要；未复制函数正文、认证参数、回执 ID、challenge 或密钥内容）：

- S1：[001-roles-storage.sql](/private/tmp/FL-DB-005-resume-20261002/backend/tools/fl-db-008/architecture-candidate-v3/sql/001-roles-storage.sql:32)
- S2：[002-validation-crypto.sql](/private/tmp/FL-DB-005-resume-20261002/backend/tools/fl-db-008/architecture-candidate-v3/sql/002-validation-crypto.sql:4)
- S3：[003-admission-binding.sql](/private/tmp/FL-DB-005-resume-20261002/backend/tools/fl-db-008/architecture-candidate-v3/sql/003-admission-binding.sql:95)
- C：[core_adapter.py](/private/tmp/FL-DB-008-unified-c-20261004/core_adapter.py:238)
- R：[RESULT.json](/private/tmp/FL-DB-008-r2-challenge-20261004/RESULT.json:458)
- H：[HANDOFF.md](/private/tmp/FL-DB-008-r2-challenge-20261004/HANDOFF.md:6)

候选源码仅用于说明可能的失败分支，不等于运行中函数定义的逐字证据；本矩阵不覆盖历史失败，也不替代尚未完成的核心业务验证。
