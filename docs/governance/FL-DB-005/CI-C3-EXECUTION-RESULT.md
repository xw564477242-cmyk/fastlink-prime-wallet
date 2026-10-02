# C3一次运行结果：官方Prisma引擎下载HTTP403

批准原文见CI-C3-APPROVAL.md；精确补丁SHA 1b6ffa69933e30b5eed2d937e214bf0c18e525ec7d5a064580c5e0892022106d。仅run.py与prepare_downloads.py两个文件改动77行新增/4行删除，不改变C2安全或测试逻辑。业务HEAD 592afbeac34d3d9990cf53a627ce11b83f3178cb，父节点571199a5b990ba0f616a68fa101f0cc93119fdf9。业务累计16个新增文件、2751行新增、0个既有基点文件删除；C3相对父节点的4行删除全部发生于本工单新增CI脚本，旧业务文件与原6文件未修改。

唯一获批新运行：36826973213，DB5等价隔离检查 (Draft only)，failure，绑定上述HEAD。PR前后Draft/dev/HEAD/autoMerge=null检查及摘要上传均success。没有rerun或dispatch。

有限诊断（2026-10-01T06:51:47.758162+00:00）：
- stage：DOWNLOAD_HTTP_GET
- target_domain_class：OFFICIAL_PRISMA_ENGINE
- category：HTTP_ERROR
- http_status：403
- status：STOPPED_REVIEW_REQUIRED
- stop_completed：true

这是原受限下载被拒绝，不是已确认RLS漏洞。具体远端403原因仍未知，不输出完整URL、文件路径、错误正文、下载内容或环境变量。没有修改地址、认证、代理、白名单、校验或重跑。C2未知根因记录继续保留，不能把本次分类追写成C2已证实根因。

到达引擎下载时，按固定控制流，源码准备、固定镜像步骤及包下载循环已完成；但摘要只持有最终失败点和input_hashes，不能扩写为具有逐包独立证据的安装成功。本次没有downloads完整成功结果，更没有npm安装/Prisma生成/build/lint/Jest/离线历史审计关联或新库测试结果。DB认证与数据库创建位于之后，未到达。

T17继续BLOCKED，当前8PASS/9LIMITED/1BLOCKED。资金硬前置继续有效。C1/C2/C3原稿、两次远端失败及旧全部测试记录保留。任何引擎供应、网络方案或再次运行须另行批准。
