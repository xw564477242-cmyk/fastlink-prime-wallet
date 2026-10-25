# 本批定向结果

| 项目 | 结果 | 依据与限制 |
|---|---|---|
| Backend新增定向Mock | PASS | 9/9；本批首轮原生Jest结果，不重跑旧业务全量测试。 |
| Wallet窄范围/缺失余额Mock | PASS | 4/4，23断言；缺值不伪装为0。 |
| Wallet真实挂载详情增量Mock | PASS | 3/3，8断言；独立详情、外租户安全拒绝、迟到A响应不覆盖B。最终输出DETAIL-MOCK-FINAL.*。 |
| Backend/Wallet类型检查与离线构建 | PASS | tsc无错误；Backend独立构建一次、Wallet两次受影响构建；第二次详情构建见DETAIL-BUILD-RESULT.json。 |
| 固定身份初始化/激活 | PASS | 原生SQL回执exit0、COMMIT_UNKNOWN=false；五函数/两新policy，不改变旧policy。 |
| 真实Access→Wallet→Backend | PASS | BROWSER-RESULTS.json；A/B登录、本人列表、独立基础详情、双向外租户404和退出清空。 |
| 后端定向HTTP | PASS | 18/18；正常合成会话，经固定Backend tier；不冒充经Access的18项浏览器测试。双向外租户404、缺失资源同错误、tenant query 403、退出后401。 |
| 事务上下文与审计 | PASS | 已采集13个same-pid/cleared=true运行回执；18项Trace中6个成功GET有数据库审计。失败事务不宣称已有数据库审计。 |
| 业务行前后完全一致 | LIMITED | 当前角色Card无写权限，全部业务请求均GET；未捕获执行前全行指纹，不能补造或声称Card/交易/账本全行字节级一致。账号认证字段及会话/审计存在获批写入。 |
| 受限退役 | PASS | 两URL OFF、官方stop及进程关闭、role20090 NOLOGIN/过期/会话0、精确授权撤回；原grantor边保留。 |
| PUBLIC CONNECT残余 | LIMITED | 精确CONNECT已撤回，但PUBLIC继承使effectiveConnect=true；NOLOGIN且密码清空。未越权改变PUBLIC。 |
| profile远端即时失效 | LIMITED | 官方删除本轮专用profile成功；不宣称已独立验证所有远端access token即时失效。 |
| 费用最终账单 | LIMITED | 原USD10上限、60分钟租期保持；1次Backend构建、2次Wallet发布，实际云账单未重新核验，不冒称金额已结算。 |
| CI、Draft、Gate1/资金/Provider | 保持 | 未触发CI/推送/合并，三个PR保持原Draft；未更新正式基线，不解除Gate1、资金或Provider冻结。 |

普通修正与失败均保留：初始化OID为十进制字符串的本地前置类型错误，未发SQL即修正；不回放初始化/账号写入。首轮详情仅列表快照，第二次获批Wallet额度补接独立详情。新详情测试先因命令路径、缺失TEST声明失败，随后3/3；React createElement类型问题以等价JSX修正，最终tsc与3/3通过。原9项Backend Mock中的语法/Mock观测问题在首轮离线阶段修正；未把首次失败改写成首次成功。

自动审批曾拒绝削弱技术批准/SHA检查及通用环境字典传输，已保留技术检查并改用固定非秘密三字段stdin。Wallet发布脚本两次因授权来源不被认可被拒绝；未换工具绕过，收到本执行对话真实所有者批准后才完成发布。当前无待审批执行动作。
