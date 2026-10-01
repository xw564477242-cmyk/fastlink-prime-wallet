# C4离线评估授权原文

来源：总控019fa6b7-4f28-7b62-b676-757be88c22f8，2026-10-01，追加记录。

【FL-DB-005 C3失败后续：仅离线评估C4，不得实施】确认HTTP403失败停止正确，T17继续BLOCKED。禁止更换Prisma下载域、加proxy/auth/header、放宽URL/完整性、重跑或访问其他CDN。授权仅离线检查固定lock中已批准的`@prisma/engines`及相关公共npm tarball结构，以及本机既有已验证缓存字节，判断是否能从已经允许的`registry.npmjs.org`精确tarball中提取所需query/schema engine并匹配现有明文SHA。不得发起新网络请求、安装、容器或数据库。若可行，提交未应用C4补丁：移除`binaries.prisma.sh`下载，只从固定npm tarball离线提取，校验tarball SRI、成员路径/类型/大小、解压后固定SHA，拒绝符号链接/路径越界/额外候选；不得运行包脚本。网络目标只能减少，不能新增。若npm tarball不含精确引擎或SHA不匹配，报告BLOCKED并停止，不得从本机路径复制二进制进仓库或制品。C4须含补丁SHA、精确diff、合成测试和风险边界，未获批准不得应用或触发CI。原C2/C3失败记录全部保留。
