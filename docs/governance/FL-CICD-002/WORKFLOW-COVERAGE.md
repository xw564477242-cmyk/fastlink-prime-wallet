# 三条工作流覆盖

固定原始基点b5f3cda4e31cef177c952b8c0c3a1b220246e998。提交后的精确HEAD与文件范围见HANDOFF及CI证据。

| 工作流 | Draft新增范围 | 原完整作业修改 |
|---|---|---|
| pull-request.yml | 既有117＋新增16控制，direct/summary/verify-summary，lint | 原dev校验步骤仅增加私有输入 |
| ci.yml | 同上 | 原校验注入；最终verify-summary拆成独立受限输入步骤，其他制品校验不变 |
| dev-reset-round-trip.yml | 同上 | 原安装/校验/构建拆步骤，只给Schema步骤注入输入 |

所有触发器、Draft/Ready分流、权限、环境及部署语义不变；无workflow_dispatch调用、无转Ready操作。自动触发的Draft CI可证明本轮输入链，但不是完整非Draft作业通过。

原18项sourceBindings计数不变，校验器与测试本来已绑定；候选值不在git archive及Docker上下文。制品上传路径没有加入临时文件，临时输入也不位于工作目录。后续需门禁另行授权完整作业验证。
