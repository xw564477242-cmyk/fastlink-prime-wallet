# 余额／交易只读增量源码交付

本批把已验收的余额、交易列表和详情读取行为交回源码评审；不重新发布。历史云结果证明固定A/TEST，不能替代本次新源码的CI，也不代表整份B17 UI源码已回收。

- Backend #338父HEAD：`d6b56486cda8c70a8d89ed497473314fca369d04`；Wallet #94父HEAD：`20a1d8731a5a44902a0944434ce70f8c23570189`。沿两仓既有`codex/fl-launch-b13-readonly-preview`仅追加提交，目标dev，保持Draft。
- 后端仅2个生产逻辑点：精确Wallet-only GET白名单；明细/历史去除不需要的cardId投影，Wallet-only跳过第三表附加关联，非preview原行为保留。附4例新增定向回归。
- 钱包仅7个必要源文件：提取Assets/History与必要helpers、余额分类hook、精确GET白名单、首页功能hunks及3个路由接点；保留原布局/非preview分支。不复制其他21文件UI恢复、KYC/资金壳、配色、profile、认证或SDK。
- 已生效22列SELECT/两条RLS仅引用既有回执；无SQL/迁移/启动逻辑夹带。金额保持原十进制字符串，不跨币种求和，错误或缺失记录不填零。

## 自测与来源

- Backend新增1套4例Jest＋严格ts-jest类型诊断通过；定向3文件ESLint 0错误0警告。初次新测试漏DTO必需limit产生TS2345，仅补limit:25后通过；生产源码未为测试放宽，原失败及本机lint包装准备记录永久保留。
- Wallet 24项源级结构/语义检查、TypeScript、7文件Prettier和ESLint通过；本机对齐脚本依赖封存来源，不冒充可移植业务测试。旧89项及5组Mock、旧云端正反读取不重复执行。
- 首个新HEAD `2fd6d617ac01aeb34f52d2ba1c47c9d2cf410b37` 的自然CI `40120078317` 保留FAIL：旧scope测试两条断言仍拒绝本批已批准的只读assets。仅同步该测试契约，补充余额/交易正例及资金写、额外对象读取和租户参数注入反例；单文件Bun 4 PASS、0 FAIL、61次断言。未改变生产白名单或放宽拒绝条件，未手动重跑CI。
- `CHECKS.json`保留新增检查明细、源SHA及初始失败；`ACCEPTED-READONLY.json`逐字继承2026-10-25已验收运行事实：余额USD0、历史交易1 USD/FAILED是原业务状态，非接口失败。
- 部署端仍为backend `1cf413e0-1ba1-421a-8246-997980a04d82`、frontend `33fd892d-2353-40aa-ba50-4fac033a447a`；它们不是本次新Git HEAD。没有启停、更新云端或延长租期。
- 推送前触发核验见`TRIGGERS.json`：exact HEAD工作流和自动链不匹配部署；Railway PR自动部署关闭且6条触发器无功能分支匹配；原已知CF账号九个Wallet应用无Git构建连接，两仓直接hooks为空。不扩大为未知账户/集成保证。
- Lovable按官方[Git同步](https://docs.lovable.dev/integrations/github)和[发布](https://docs.lovable.dev/features/publish)分离编辑器同步与发布快照；本次不调用其代理/发布动作，禁止改写已推历史。

## 保留限制及回退

Backend完整门禁被Draft跳过时记LIMITED；自然CI结果以PR当前新HEAD最终回执为准，不手动重跑、不转Ready/合并。既有无会话直接DB/RLS可见性及反例正文未取限制、两次发布失败、DEV1-T03/T12、GOV2-T09及历史缺口均保留。Gate1、资金、Provider、生产和正式基线不变。

后续若要撤销，只能经审定追加反向提交，不reset/amend/rebase/强推或删除历史；本次源码撤销不自动回退云服务、撤销已生效权限或改变运行身份。
