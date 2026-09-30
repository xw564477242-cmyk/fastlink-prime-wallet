# 校验边界与复现

使用Python 3标准库，只读执行：

`python3 -B docs/governance/FL-DEP-001/tools/validate.py --backend <FL-DEP-001后端独立工作区> --check-manifest`

工具仅读取本工单治理文件和已知后端提交/锁文件；不安装、不访问网络、不运行应用、不刷新索引、不读取环境凭据、不接触原正式工作区。结果只输出检查名称、状态及命中文件/规则，不输出匹配值。首次失败记录保留，最终复查以validation-final.json及外置SHA复核为准。

敏感扫描包含私钥头、GitHub令牌、AWS访问标识、JWT、带口令URL和秘密赋值六类格式，以及长度至少32、Shannon熵至少4.5的字面量候选。明确识别公开OID/SHA-256、npm SHA-512包完整性字段、精确GitHub/官方registry URL结构及三个已知受保护路径名；不按目录、包名或风险等级整体白名单。仅扫描新增治理材料，不读取HMAC密钥，不宣称覆盖所有未知秘密形态或全项目无秘密。

`SHA256SUMS`覆盖全部新增文件（清单自身除外）。清单自身哈希和治理提交SHA在外置最终HANDOFF中给出，避免自引用。最终双PR和治理CI在同一外置交接绑定；仓库HANDOFF保留提交前时点信息。

本次续作仅验证已有结果、治理范围、秘密格式及文件校验；未重跑依赖安装、审计、build、lint、Cregis Mock、适配探针或完整Jest。远端治理仓库原有verify由PR事件自动触发，其既有检查不属于手动重复全量验证。
