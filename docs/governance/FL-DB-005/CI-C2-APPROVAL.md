# C2精确实施批准原文

来源：FastLink总控对话019fa6b7-4f28-7b62-b676-757be88c22f8直接发送，2026-10-01。以下原文追加保留：

【FL-DB-005 C2精确实施批准】批准实施未应用补丁SHA-256 `2d8770f4e1d997d9dec7cef60b543623b82aa7b7a469cd59943e5d52bd16eca3`，范围严格为C2包记录的10个新增文件、2,115行新增、0删除。不得实施C1 `a4ecd6...`，不得修改原6个业务文件、既有工作流、迁移SQL、schema、package/lock、测试断言或权限模型。批准网络边界：GitHub checkout/只读PR状态；匿名拉取固定digest的PG/Node镜像；宿主无认证GET lock中精确`registry.npmjs.org` tarball及两份固定`binaries.prisma.sh`引擎，逐跳精确URL、HTTPS、无proxy/auth/query/私有registry并做SRI/双SHA校验。禁止任何npm Bulk/QuickAudit/npm audit请求；历史4 moderate结果仅离线关联。下载阶段不得存在DB认证；npm ci/Prisma generate/build/lint/Jest/DB动态阶段按C2离线或internal网络执行。批准将C2精确应用到业务PR #336分支并提交推送；该`synchronize`可触发“DB5等价隔离检查 (Draft only)”。PR必须保持OPEN/Draft/dev/指定同仓分支/autoMerge=null；禁止Ready、自动合并、merge、Release、镜像push、部署或晋升。专用检查实际成功且绑定新HEAD后，可作为本工单T17的等价远端CI证据，但必须明确原Backend Gate/verify/reset仍SKIPPED。若补丁SHA、文件范围、输入哈希、下载目标、HEAD/PR状态、容器停止或摘要artifact任一不符，立即失败并保持BLOCKED，不放宽网络、不自动重跑、不修复。完成后追加治理证据、新HEAD、运行编号、范围、扫描和HANDOFF供门禁2复核；资金硬前置继续不解除。

C1未实施，C2实施仅限批准文件；禁止自动修改运行失败。
