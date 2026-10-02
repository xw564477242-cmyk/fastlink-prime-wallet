# 恢复复验报告（PENDING）

基线继承原权威链及FL-CICD-002门禁5正式差量，不复制现状总表，不宣称新快照落盘。

## 基点与范围

- 业务原HEAD 49a3773e75d226ecc012134fd7db53f06f8f2eff；dev 1d059a8f0e78af595c116e22715c621857271abe；本地普通merge d33a85520aff868cdfa867c45b10911592230f77。
- 治理原HEAD 06bffab2d1bb6ed81a1f8866155166c97da761f7；dev 8ba560c58c39c30875b9ac9f59847c272d532c28；普通merge db89fd00440bff5c54f7b8fd45e3bb7b3adf4d02。后续本目录追加提交HEAD由外置HANDOFF记录。
- 两次merge均无冲突，分别保留原功能HEAD与dev两个父节点。DB5原六业务文件字节不变；既有prisma/src/package/lock未改。
- CICD三工作流及两校验脚本与已合并dev一致。本轮不重复CICD133控制/制品扫描，不访问Schema原文，不读写Secret；静态Secret引用不等于证明其远端可用。

## 本轮结果

- 本地固定PG17.11镜像sha256:25a89970a83255ae96484d709005bb35aa71f7455f941bc1634514f31c5d5c62。
- 新命名空间fl-db005-resume1002；报告轮次5/6为本命名空间新建容器和卷，不是旧r5/r6复用。
- 每轮32份原迁移+3份候选迁移均原样执行成功；合成数据在迁移完成后注入。
- 每轮29项动态、17项反例PASS；无跨租户成功，目标数据哈希不变；8事务/2连接交错隔离通过。
- 两轮目录SHA均8dcecba6e3a5982ed3167251d7ce588b23c93f56f5aef3f28382abdad82add3b，52表默认拒绝契约一致，未扩大2个正例对象权限。
- Linux Node22.23.2/Prisma6.19.3；build/lint PASS；完整Jest1766 PASS、0 FAIL、2跳过，199 suites PASS；定向5项PASS，属于完整Jest子集，不重复计入总数。
- 官方npm Bulk HTTP200；4条moderate版本匹配，high/critical匹配0。未计算元漏洞传播或证明应用可利用性，未升级依赖。
- 新任务10个容器退出且保留，卷和私有认证保留；38个旧容器State不变。无宿主端口、无外部网络的业务测试，只有获批npm公共元数据请求使用网络。

## 限制

本轮仅隔离原型证据；52表业务正向权限、实际Prisma/JWT/后台任务集成及部署环境均未验收。T17永久LIMITED；现有CI的Draft检查不代表完整非Draft作业通过。迁移为原样SQL执行，非Prisma迁移引擎验收。两跳过和4条moderate保留。业务owner初始化身份未被用于证明owner受RLS约束。资金硬前置未解除。

旧FAIL/BLOCKED、DEV1-T03/T12、GOV2-T09、旧临时目录缺失、CICD制品限制及历史正文缺口继续保留。没有恢复或清理原证据。

## 增量敏感扫描

六业务文件及本轮治理材料显式格式命中0、任务随机认证材料精确匹配0。高熵初筛26处，逐处证实为Docker非秘密设置、官方公告URL或与受控Git树匹配的治理路径片段，未解决命中0；原初筛和逐项依据均保留，不表述为原始高熵零候选。未读取历史HMAC密钥或仓库Secret。
