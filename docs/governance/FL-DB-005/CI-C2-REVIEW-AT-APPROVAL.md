# FL-DB-005｜DB5等价隔离检查｜C2未应用补丁

本文件承接总控对C1的评审。C1补丁`a4ecd6c80b13ad8adf79b070d87665e68e181a6c7ee75ecad7adaa5eec57904f`不得实施，原稿及其历史检查记录保持原样。C2同样未应用、未提交、未推送、未触发CI，双仓HEAD无变化。门禁2仍待技术证据，门禁3未进入。

## 1. C1到C2的改动

1. 删除run.py中的HTTP审计发送实现，禁止Bulk/QuickAudit、npm audit命令及fallback；不在新运行中获取公告。
2. 保留批准载荷原字节和SHA，新增既有`completed-audit-evidence.json`原字节，运行时仅验证批准载荷、lock、实际安装集合与历史结果关联。
3. 新增`prepare_downloads.py`，只以无认证HTTPS GET预取固定lock包及固定引擎，不发送包清单或审计payload。精确URL白名单和重定向检查在下载前及每跳生效。
4. npm cache导入、npm ci及Prisma generate移至`network=none`容器，始终offline/ignore-scripts/no-audit/no-fund。引擎使用固定本地文件，无运行时联网回退。
5. 工作流正式名称改为“DB5等价隔离检查 (Draft only)”。原Backend Gate/verify/reset仍不运行，不能称其已通过；总控已接受专用检查可作为T17等价远端证据，但**只有批准实施且对应新HEAD实际运行成功后**才能评定T17。
6. 修正离线复核发现的计数断言：174条批准源记录，经去重为172个包名/版本对，165个包名；不是174个独立对。重新编码摘要与历史wire SHA完全一致，批准payload及旧记录未修改。本次初次离线失败单独保留于OFFLINE-INITIAL-FAILURE.json；C1未运行，未影响数据库。
7. 加强原停止设计的证据判定：docker stop返回失败、无法查询状态或仍在运行均不能报告stop_completed=true；只停止具有本次资源标签的容器，其他资源不动。四种合成停止场景已覆盖。

最终业务补丁共10个新增文件；原C1的8个文件加下载控制和历史审计证据2个文件。逐文件行数和SHA见FILE-MANIFEST.json；完整补丁为proposed.patch，相对C1变化见C1-TO-C2.diff。没有修改原有业务6文件、迁移、schema、package/lock或旧CI文件。

## 2. 一次授权对应一次审计

批准载荷SHA：`afc58daba124d5073884690020487b5c5042fb1cc66e8aa4148c20ff6b8e53f4`。

既有审计时间：`2026-10-01T05:43:50.613759+00:00`。

既有端点类别：官方npm Bulk Advisory；HTTP200；4项已安装版本moderate匹配，0项high/critical；未认证、未发送私有上下文、无fallback。

原wire摘要：`b90bf1b07a0949b2345cd72686ea500ec8021aff84ebe02a9eb771386acc883e`。

脱敏结果文件SHA：`d0667a02758c67dc753d52196eedad192b897a19b00318b584deda3137ab0fc9`，来自治理R2的`evidence/npm-audit-r2.json`，字节未改。它包含经筛选且已做版本匹配的响应摘要；**不是原始HTTP响应体，不能冒称原始响应SHA**。

CI仅离线重算批准wire摘要（不发送）、核对历史文件SHA/HTTP状态/时间/四个公告，再用安装的semver复核版本范围。固定lock/package/schema SHA必须不变，172个唯一版本对必须存在于实际安装集合；不一致即停止，不请求新审计或刷新证据。

摘要artifact明确`REUSED_OFFLINE_NOT_FRESH_AUDIT`和network_requests=0。仅继承历史时点结果，不能宣称覆盖之后的新公告、npm元漏洞计算、完整依赖可利用性或风险处置。4项moderate仍保留为待独立评估风险。

## 3. 安装与引擎下载控制

- 开始下载前检查任务private目录为空，不生成或读取数据库认证；拒绝HTTP(S)/ALL proxy及npm代理、NPM_TOKEN、NODE_AUTH_TOKEN环境。
- Python opener显式禁用代理；不读取.npmrc、netrc、cookie或认证配置，无认证handler，只发送GET和普通Accept头。
- 包下载只能是固定lock中的完整HTTPS tarball URL：`registry.npmjs.org`，必须带`/-/`且以`.tgz`结尾。
- Prisma只允许固定commit/platform下两份引擎URL，域为`binaries.prisma.sh`，版本commit为`c2990dca591cba766e3b7ef5d9e8a84796e47ab7`、平台`debian-openssl-3.0.x`。
- 每次重定向重新校验完整URL。非官方域、未列明官方地址、非HTTPS、userinfo、query、fragment和非443端口均失败。遇到HTTP401/407/其他非200立即失败，不注入凭据、不更换镜像源。
- 包字节按lock SRI校验；引擎同时校验gzip SHA和解压后SHA。引擎明文SHA已与本机既有验证缓存字节核对，压缩SHA来自同缓存的既有校验记录，CI下载时必须实际匹配；没有重新下载来验证。
- 单下载128MiB、总下载2GiB、引擎展开256MiB上限，每次下载前磁盘余量至少6GiB；任一超限失败。固定lock目前745个独立tarball URL，未在本轮下载。
- 之后Node安装/Prisma生成/build/lint/Jest均`network=none`。npm只从预取tarball构建缓存，`npm ci --offline --ignore-scripts --no-audit --no-fund`；Prisma设置固定本地query/schema engine和禁止自动安装标志。缓存未满足或工具要求联网即失败，不放宽网络。
- Docker Hub固定镜像拉取沿用C1，只有公开镜像pull，没有docker login、镜像push或Release。GitHub只读PR查询及唯一摘要artifact上传沿用C1。

**限制：**Python下载在托管runner宿主进行，执行路径受精确URL检查，但不是整个宿主的网络防火墙证明。它不执行源码或安装脚本；所有包安装和携带认证的验证容器才具有Docker网络隔离。官方镜像注册表匿名协议不等于使用项目真实凭据。受限离线安装及Prisma生成尚未实际运行，缓存或引擎兼容性问题须记录BLOCKED，禁止临时联网绕过。

## 4. 保持不变的边界

- 仅同仓PR336、指定分支、dev、Draft且opened/reopened/synchronize运行；不含ready_for_review、push、dispatch、release、pull_request_target或workflow_run。
- 精确checkout事件head，persist-credentials=false；运行前后PR仍open/Draft/dev/同HEAD/auto_merge=null。仅contents:read和pull-requests:read；token只用于元数据查询，不进入测试容器。
- 固定PG17.11与既有Node镜像digest，两个全新数据库和独立卷；内网、无宿主端口；32原迁移+3增量按SHA顺序原样执行，无旧seed/reset/auth-RLS。
- 完整Jest/build/lint、5项针对测试、两轮29+17隔离控制、52表默认拒绝/2表例外及54表目录对账。2项原条件DB Jest测试仍skip，完整Jest不得增加skip或隐藏失败。
- 任何跨租户成功或目标变化立即P0_STOP，不扩展、不修复；失败不自动重跑。
- 原始认证、源码、SQL返回数据、目录全文、Jest原日志、审计原始响应均不上传。只构造一个非秘密摘要artifact，7日保留；不使用项目或生产凭据。
- finally/取消尝试停止本次标签容器，不删除卷/容器/网络、不GC。强制取消仍可能无法完成停止及上传，不能据此判PASS；临时runner不是长期原始证据保全方案。
- 双PR继续Draft，不Ready、不合并、不部署晋升、不更新正式基线，不修改DB5权限或资金硬前置。

## 5. 本轮验证及状态

62项离线/合成检查PASS，包含语法、YAML、输入哈希及篡改拒绝、审计关联重放、非官方重定向、401/407、代理、完整性失败、下载认证前置、停止失败和非本任务资源保护。全部使用本地文件或mock，没有真实网络、下载、Docker、数据库、安装、CI或审计请求。

报告：offline-review.json。初次错误及修正：OFFLINE-INITIAL-FAILURE.json。测试脚本一并作为仓库外评审材料提供，不自动纳入业务PR。

旧8PASS/10LIMITED不改；T17未因“方案可接受”变PASS。DB-R02潜在P0、DB1/DB4失败阻塞、实际身份集成BLOCKED、38AdminLIMITED及永久偏差继续保留。门禁2仍等待C2审批、实施及绑定新HEAD的CI证据。

## 6. 下一审批与回滚

请求仅复核此新的未应用C2补丁。批准前不改仓库、不提交、不推送、不触发工作流。获准后产生新业务HEAD，双PR分别重新出具范围、SHA与CI证据；不自动转Ready。

弃用评审草案无需仓库回滚。若未来实施后需撤回，按普通追加/revert PR处理，保留C1/C2、原失败及历史证据，不关闭RLS、不恢复宽权限、不清理本机既有数据库或认证材料。
