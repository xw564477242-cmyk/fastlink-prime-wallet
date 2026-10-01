# 完整业务CI执行/适配方案（仅提案，未执行）

固定业务HEAD：91595282b47204aabd1c0871dcb8c286e8ff841d。三个既有工作流原文未修改，SHA见evidence/ci-plan-inputs-r2.json。PR #336保持Draft；不能通过workflow_dispatch或其他分支冒充本HEAD完整CI。

## 当前差异及阻塞

1. pull-request.yml与dev-reset-round-trip.yml完整任务由非Draft PR触发；workflow_dispatch目前只运行Draft lint。ci.yml的完整verify亦未对当前Draft执行。当前三个lint成功不是完整验收。
2. PR主门禁使用postgres:17-alpine，reset任务使用postgres:16-alpine，均未固定本工单17.11镜像。普通CI库名称不满足候选迁移的隔离库断言；不得移除断言或改迁移以追求绿色。
3. 既有CI执行Prisma migrate deploy，并包含开发种子、额外开发迁移、auth RLS初始化或reset脚本。DB5当前证据为32个原SQL文件+3个候选SQL的原样psql执行，不冒充Prisma迁移引擎验收。未批准的reset、清理或权限变化不能直接复用。
4. ci.yml包含对外npm audit；公共包载荷尚未获精确发送批准。新网络任务不得顺带发送项目名、锁文件、源码或认证信息。
5. schema-only 10项/catalog-only 4项、52表业务契约和实际服务身份绑定未完成。候选RLS默认拒绝可能使未适配的应用入口失败，应如实保留，禁止放宽策略或测试断言。

## 建议分层执行方案及审批点

- A层：继续在本地隔离环境保留完整Jest/build/lint及定向身份测试证据；SQL或工具有变化才复验受影响控制。不把本地结果替代完整远端CI。
- B层：申请明确批准一个DB5专用CI任务（固定待审HEAD），使用已核验PostgreSQL17.11 digest，两个新空白卷、内部容器网络、不发布宿主端口。32+3文件按哈希和顺序原样执行；初始化身份与所有测试运行身份分离；临时认证目录700/文件600，日志不输出连接参数。原任务记录保留，不能用新任务冒充被跳过检查。
- C层：取得Prisma/JWT/后台任务身份契约后，审批应用集成与Prisma migrate deploy等价性验证方案。需逐项列出既有seed/auth-RLS/reset步骤的操作、权限和数据影响；未经专项批准不运行。正向授权必须来自52表审批，不以测试失败倒推扩大权限。
- D层：npm审计只有在载荷及官方端点获精确批准后执行。源码、完整锁文件、环境信息和任务密钥不外发；报告必须保留审计时间及载荷SHA。
- E层：仅在总控明确批准本HEAD Ready动作且上述CI范围与安全边界获准后才触发完整CI。输出每个检查的HEAD、运行编号、状态、跳过原因、保留制品与敏感扫描。任何失败不得删除历史、改断言或扩大权限。

任何工作流实质变更须先审批具体补丁；本方案没有修改工作流、触发完整任务、转Ready、创建Release、推送长期分支或应用到外部环境。CI产物不得自动推送镜像注册表、部署或晋升。若完整CI需要额外业务集成/范围变更，应另行申请，保持T17 LIMITED。

## R2后续承接：限定npm审计已执行

收到项目所有者精确授权后，源SHA核对一致，174条公共包名/版本按官方Bulk格式发送（165包名），HTTP200，4条moderate匹配、high/critical匹配0。前述“审计待批/未发送”为材料起草时状态；此记录承接，原自动阻断记录不删除。不含元漏洞计算，不证明应用可利用性，未升级依赖。完整业务CI与52表审批仍未完成，T17保持LIMITED。详见NPM-AUDIT-RESULT-R2.md。

## 总控追加问题：仅转Ready是否足够？

**不足。** Ready仅能解锁三个完整作业；现有数据库版本、库名断言、seed/reset及原应用身份与候选隔离模型不一致，不能仅切换PR状态后期待通过。

预计解锁检查：

| 工作流 | 完整作业主要内容 | 当前适配问题 |
|---|---|---|
| Backend Pull Request Gate | 依赖安装、Prisma验证/生成/迁移、开发认证RLS初始化、build、类型检查、镜像构建探针、lint、Jest、HTTP/e2e与安全/卡路径、种子拒绝、运行依赖健康及秘密扫描 | Pg17浮动版本、普通库名、额外开发迁移和auth-RLS行为未经DB5批准；实际服务契约待定 |
| Dev Reset Round Trip | Pg16、Prisma迁移、开发种子、写审计数据、reset、再种子与reset | 版本不符；reset/清理不在本次允许动作，不能顺带执行 |
| FastLink Backend Non-Production CI | 精确HEAD、锁定安装、审计、Jest/HTTP、OCI构建探针、SBOM/许可证/哈希及Actions制品上传 | 审计需维持精确外发边界；本次已批准Bulk元数据不等于任意npm audit载荷；制品需明确不含认证材料 |

仅静态查看当前源码的触发链：三个PR工作流未配置workflow_run部署链；promote-dev-candidate.yml仅workflow_dispatch，test-environment.yml的PR目标为test，均不由当前dev PR Ready自动触发。未对GitHub仓库外部集成/webhook作取证，因此这里只证明已读取工作流的触发边界，不作全平台无外部触发保证。

安全执行前应只读再次核对具体HEAD/工作流、只读GitHub部署记录、目标dev与autoMergeRequest=null。保持Draft期间不运行gh pr ready；不调用gh pr merge、--auto、发布Release或晋升工作流。即使未来获准Ready，也必须保持autoMergeRequest=null并在执行后复核；完整CI完成不构成门禁3授权。

建议审批顺序：先评审B层DB5专用检查补丁与隔离设置；再决定是否单独授权兼容性/身份集成或旧reset行为；最后对具体HEAD批准Ready。当前只提交方案，不修改任何工作流或测试预期。
