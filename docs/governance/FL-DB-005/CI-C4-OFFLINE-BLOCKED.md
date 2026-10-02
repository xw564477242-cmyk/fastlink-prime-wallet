# FL-DB-005 C4离线可行性结论：BLOCKED

当前业务HEAD：592afbeac34d3d9990cf53a627ce11b83f3178cb。C3运行36826973213在官方Prisma引擎下载HTTP403停止；C2失败36825857182保持原样。没有更换域、添加header/proxy/auth或重跑。

仅只读检查固定lock所列8个Prisma相关包的既有本机npm内容缓存。8/8压缩包的SRI与固定lock完全匹配，383个常规成员逐个完成路径、类型、大小及SHA-256校验；未展开到文件系统、未运行包脚本。未发现符号链接、硬链接、路径越界或特殊文件。没有含.gz/.node/.zip/.tgz/.xz/.bz2/.zst/.so后缀的成员，未发现可直接提取的两份目标native引擎。

@prisma/engines 6.19.3 tarball为22,666字节，共10个成员：index/localinstall/postinstall相关JS和类型声明、package.json、README、LICENSE。不包含query/schema engine二进制。其余7包同样没有任何成员匹配两份固定明文SHA。

本机既有libquery-engine、schema-engine分别匹配现有输入清单中的a2924eab1c78a0a7bb67edac5738939fa10589ef073af5542f53812a22e4a7d8、5d42b181631fd20bb0ecc5abcdba72575e7f467a0d52f4d5ef1ff28f0c74e6e9。本轮只读取摘要校验，没有复制二进制进入仓库、制品或新目录；本机存在这些缓存不构成新的远端供应授权。

结论限定：在已批准固定lock的这8个npm tarball范围内，无法直接离线提取与当前两份native引擎SHA一致的文件。因此C4方案BLOCKED，**未生成或应用C4补丁**。不尝试运行包脚本、转换WASM、解码源码载荷、更换Prisma版本或改用其他包/域/CDN；这些不属于已批准的精确提取方案。

实际动作：新网络请求0、下载0、安装0、容器/数据库0、包脚本0、文件系统展开0、二进制复制0。仅新增脱敏检查元数据，不改变cache字节或业务HEAD。并未把本次离线检查当作CI成功。

T17继续BLOCKED，门禁2未通过，资金硬前置不解除。原C2/C3失败、artifact、HEAD、全部历史记录及风险保留。后续须等待总控/所有者另行决策，不继续试错。

证据：tarball-inspection.json记录包版本、SRI通过状态、包SHA、全部公开成员名/类型/大小/摘要及0匹配，不含下载内容、包源码正文、本机认证或缓存绝对路径。
