# 基线拟追加摘要（PENDING）

继承链：`BASE-V1.0 + GOV-002差量 + DB-001差量 + DB-002差量`。本文件不修改正式基线或历史日志。

拟新增：业务提交 `4fead5f3e007d6226d63e263991c2de680744424` 对DB2-R01实施最小修复；同一冲突query反例由200并返回外租户合成数据变为403且无资源返回；合法同租户和现有显式platform权限本机回归通过；131个Admin守卫路由已全部形成结论，其中1项PASS_LOCAL、92项PASS_STATIC、38项LIMITED。

拟状态转换：DB2-R01从“已确认P0、未修复”转为“本机当前源码修复已验证、待双PR合并及非生产部署复验”。不得写成部署风险关闭。

继续保留：DB-R02潜在P0；FL-DB-001 T08/T09 FAIL、T13 BLOCKED；实际GRANT、RLS、部署JWT、客户端可达性和阶段B未验证；38项LIMITED定向复验；资金功能关闭；受影响后端在门禁5及后续发布门禁前不得晋升。

继续继承DEV1-T03、DEV1-T12、GOV2-T09、HISTORY-GAP、580链接证据缺口、88 High、2,917候选及全部证据保留要求。

## FL-DEP-001闭环后追加（R1）

原文保留为旧HEAD时点记录。本轮已普通merge继承最新dev，业务HEAD为`d8dc183f6ff91f3d00c9e2e533e57ee68fce8b9e`；当前结果、定向12项与旧16项口径区别、CI与风险边界以`RESUME-AFTER-DEP-R1.md`及`evidence/resume-R1/`为准。业务#334保持Ready未合并，治理#85保持Draft未合并；等待新HEAD门禁2/3复评。正式基线文件未修改。
