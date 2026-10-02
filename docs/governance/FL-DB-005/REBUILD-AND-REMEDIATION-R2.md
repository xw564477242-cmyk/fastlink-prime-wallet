# 门禁2整改补证R2

总控门禁2不通过后，仅实施获准的新空白重放及审批材料；未改业务HEAD或迁移字节。

- 新建r3/r4各独立新卷，预先确认名称不存在、public目录为空、实际版本17.11、内部网络且无宿主端口。
- 每轮按原51SQL索引中32份formal_forward顺序执行原字节，再顺序执行最终三份候选迁移；每步退出0，SHA一致。合成Tenant/Customer及随机任务角色在最终迁移链完成后初始化。
- 两轮目录的表、列、策略、函数、角色属性与成员、权限、default privileges、trigger及约束规范化摘要相同：8dcecba6e3a5982ed3167251d7ce588b23c93f56f5aef3f28382abdad82add3b。摘要排除OID、随机认证、票据、时间戳和动态消费序列，不能宣称整个物理数据库字节相同。
- 每轮29项核心+17项补充控制PASS，共92项。所有跨租户目标数据哈希前后相同；pool交错、回滚与保存点控制通过。合法正例仍仅限Customer及WithdrawalAddress。
- 新r3/r4完成后已停止；r1/r2未启动或复用。四套卷、认证、票据、序列及历史失败保留，不做清理。
- T02由旧LIMITED追加承接为PASS；T06继续BLOCKED。10个schema-only和4个catalog-only继续STALE，54表分母未变。
- 完成52条逐表审批建议；所有正向权限均未应用。完整CI方案仅提案，未改工作流或转Ready，未发送npm审计数据。

证据：rebuild-final-r3-r4.json、final-chain-catalog.json、dynamic-final-r3-r4.json、negative-final-r3-r4.json、retention-r2.json、52-table-contract-approval-matrix.json。历史脚本/SQL/FAIL及R1结果均保留。

工具使用说明：tools下脚本是实际私有任务布局的脱敏执行副本。它们假定脚本位于任务根private目录、同级backend/evidence克隆与任务认证目录存在；不可直接从治理仓库tools路径运行，更不得对已有数据库重复运行重建脚本。新建前检查名称和卷不存在，失败即停止。

## R2后续承接：限定npm审计已执行

收到项目所有者精确授权后，源SHA核对一致，174条公共包名/版本按官方Bulk格式发送（165包名），HTTP200，4条moderate匹配、high/critical匹配0。前述“审计待批/未发送”为材料起草时状态；此记录承接，原自动阻断记录不删除。不含元漏洞计算，不证明应用可利用性，未升级依赖。完整业务CI与52表审批仍未完成，T17保持LIMITED。详见NPM-AUDIT-RESULT-R2.md。
