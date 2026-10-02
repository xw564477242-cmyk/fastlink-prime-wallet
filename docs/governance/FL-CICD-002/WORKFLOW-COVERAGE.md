# 三条工作流覆盖

固定原始基点b5f3cda4e31cef177c952b8c0c3a1b220246e998。提交后的精确HEAD与文件范围见HANDOFF及CI证据。

| 工作流 | Draft新增范围 | 原完整作业修改 |
|---|---|---|
| pull-request.yml | 既有117＋新增16控制，direct/summary/verify-summary，lint | 原dev校验步骤仅增加私有输入 |
| ci.yml | 同上 | 原校验注入；最终verify-summary拆成独立受限输入步骤，其他制品校验不变 |
| dev-reset-round-trip.yml | 同上 | 原安装/校验/构建拆步骤，只给Schema步骤注入输入 |

所有触发器、Draft/Ready分流、权限、环境及部署语义不变；无workflow_dispatch调用、无转Ready操作。自动触发的Draft CI可证明本轮输入链，但不是完整非Draft作业通过。

原18项sourceBindings计数不变，校验器与测试本来已绑定；候选值不在git archive及Docker上下文。制品上传路径没有加入临时文件，临时输入也不位于工作目录。后续需门禁另行授权完整作业验证。


## 追加：完整作业结果

三条完整CI已成功，见FULL-CI-AND-ARTIFACT-REVIEW.md。原Draft覆盖描述保留为历史；本轮没有重跑。T12按总控要求继续LIMITED，不扩大至其他工作流和环境。


## 追加：恢复门禁3及业务merge

最新状态按NEW-ARTIFACT-OWNER-ACCEPTANCE.md与BUSINESS-MERGE-AND-GOVERNANCE-HANDOFF.md承接；早期“待授权/双Draft/未合并”均为历史时点，不覆盖原文。

业务#337普通merge 1d059a8f0e78af595c116e22715c621857271abe，获批HEAD未变，父节点/tree/5文件核验通过，新三完整CI成功；业务merge SHA CI不适用/未触发，不手动触发，不写success。部署记录0，test/uat/main未变。

新制品11215441212由所有者在外部确认完整下载和扫描通过；本机部分46,333,952字节经授权TERM/CONT终止，0600及元数据不变，未删除/读取部分内容。不能把所有者确认改写为本机复现；外部压缩包实算SHA、机器报告SHA、命令及Schema专项机器报告仍缺失。旧制品失败、扫描0、大小权限漂移永久保留。

最新仍11 PASS、T02/T04/T12三LIMITED；T13的PASS依据所有者接受，限制不消失。治理#89仅追加证据，最新HEAD及CI由外置HANDOFF提供；治理merge前仍须核验，无提前闭环或正式基线更新。FL-DB-005冻结保持。未部署、Release、晋升、访问真实环境、修改Secret或清理证据。
