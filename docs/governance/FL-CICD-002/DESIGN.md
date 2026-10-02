# 最小实施与边界

5个业务文件：scripts/validate-dev-railway-config.mjs、scripts/validate-dev-railway-config.spec.mjs，以及.github/workflows/下pull-request.yml、ci.yml、dev-reset-round-trip.yml。

加载器位于原校验器，随既有18项commit-bound输入一起绑定，无新增未绑定可执行模块，不放宽来源树检查、固定配置键、Dockerfile或迁移禁止规则。
单一仓库级Actions输入RAILWAY_CONFIG_SCHEMA_B64，仅在三条工作流的校验步骤环境中注入。严格Base64规范化、2MiB上限、固定字节SHA、fatal UTF8、JSON、2020-12元Schema及同步Ajv编译；没有fetch、loadSchema或在线回退。

仅在Git树外新建临时目录700与文件600；wx创建、NOFOLLOW读取、再次比对SHA。finally只清除本调用创建的临时文件和目录；不清理用户原始候选或历史证据。异常退出时依赖GitHub托管临时Runner回收，不能承诺SIGKILL时finally必定运行。
错误只输出固定类型，不输出Ajv详细错误、输入、Base64或编译文本。

summary保留旧officialSchema*字段供现有消费者读取，但另增加OWNER_SUPPLIED_PRIVATE_OFFLINE、LIMITED和无网络回退标志；URL仅为来源声明，非本轮在线抓取结果。固定Schema候选由源码内SHA钉住，不能通过环境变量更换预期摘要。

原三个模式direct/summary/verify-summary均采用同一加载器。Draft只运行控制测试、三模式校验和lint，不启动数据库。Ready作业既有数据库/构建执行条件未解锁或修改。CI安装依赖本身有网络；“离线”仅指Schema验证阶段。

fork PR没有仓库Secret时明确失败，不跳过、不回退。不得改成pull_request_target或扩大Token权限。其余工作流未获Secret分发授权；例如preflight对verifyDevCandidateSummary的间接调用将因缺少输入失败关闭，需后续专项评审，不能偷偷复制Secret。

本轮Node22.22.1、Ajv8.18.0，复用本地已安装只读依赖；隔离克隆内node_modules引用未提交、未安装或修改正式依赖。
