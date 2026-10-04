> 历史原文保留说明：下列原有段落按生成时点保留；当前结论由文末“最终统一归档承接”及[最终分层证据](evidence/batch-c-final.json)承接。不得把旧“动态0／R2未初始化／pending未清除”当作最新状态。

# 冻结、限制与回滚

## 专项恢复前的冻结现场（历史时点，原文保留）

保留根：`/private/tmp/FL-DB-008-private-batchA-20261004`、`/private/tmp/FL-DB-008-private-align-20261004`、`/private/tmp/FL-DB-008-alignment-20261004`及隔离候选工作区。路径仅定位；本次未打开认证原值、未重新访问数据库/容器或验证实时存活状态。

最终既有证据记载两轮原活动HBA字节恢复、5规则/0解析错误。身份initializer、observer initializer与bootstrap均NOLOGIN，initializer成员关系为0，observer CONNECT撤销、TEMP仍为false。R1 runtime/issuer已NOLOGIN；R2未曾启用，保留原canLogin=true但过期且未配置可用认证材料的状态。R2不能简写成NOLOGIN。

控制客户端断开前只有该任务角色范围内一个受控client backend；另有database为空的logical replication launcher。范围只含五个任务login角色，不是全PG辅助进程普查。断开后独立会话0没有采集，保持LIMITED；不为补证生成新材料、重连或重启。

R1早先ALTER SYSTEM的`hba_file`条目仍pending/被启动参数覆盖；恢复活动HBA不等于删除或修复该设置。保留且不reset/restart。数据库容器、卷、原/新证书、CA、密钥、短期认证材料、peer roster/private manifest与全部失败记录均原样留存；本次不打包、传输、清理或扩展生命周期。

## 10月4日专项恢复后当前冻结状态

以上“未重新访问数据库/容器”“不reset/restart”及LIMITED表述是原归档时点事实，不覆盖其后专项授权。[恢复与最终收尾证据](evidence/recovery-closeout.json)记录：2026年10月4日北京时间14:56:07，R1/R2各一次单用户恢复，仅恢复`db8_bootstrap` LOGIN/VALID UNTIL（15:26:06到期），原容器各stop/start一次；原入口还原，HBA不变，无新容器、卷或认证材料。动态路径需要新增容器和HBA规则，与当前授权边界不符，静态STOP，动态0。

北京时间15:00:38，两库bootstrap均NOLOGIN、成员关系0；同一受控连接内观察断开前其他client 0，受控客户端随后exit 0，精确`/proc` backend PID消失，受控客户端会话0。R1/R2控制backend PID分别为95、96；该进程证据不冒称断开后另一次SQL全面会话观测。原收尾LIMITED不回写或删除。

R1原pending/覆盖条目未执行清除（未执行`ALTER SYSTEM RESET hba_file`），恢复后未查询`pg_settings.pending_restart`，当前参数标志未复测。R2初始化未完成；R2 runtime/issuer仍按历史过期未启用状态承接，不推定新增角色状态观测。核心RLS、跨租户和权限动态未验收；门禁2不通过，资金与RLS硬前置不解除。现场保持冻结，本次最终归档阶段仅更新治理交付，不再访问现场或运行测试，全部原STOP及材料保留。

## 永久证据边界

原239项私有现场清单SHA为`e2eade33128e082cf40b7186ca70e0b037949228a7fcd9c5efe8574bdb85d665`。总控已核验全部239项；本次仅引用清单摘要，不复制清单、不重新读取清单涉及的秘密。原54材料完整性PASS是最终收尾时证据，不是当前私钥重读扫描。

受保护正式工作区三项覆盖层未读取、未纳入归档。新clone只继承远端已提交dev；不对旧工作区作哈希重算或写入主体归因。

## 回滚方案

本PR只新增治理资料，没有运行时入口，未改变业务/数据库，因此不需要数据库回滚。评审发现问题时仅在同一治理分支追加更正，明确错误及承接版本；如未来不再采用本交付，另行批准的治理PR追加作废说明或替代版本。不得删除原审计内容以消除失败，不强推、amend、rebase、重写历史或GC。

不自动运行候选回滚SQL；不关闭RLS、不恢复PUBLIC宽权限、不删除角色/卷/材料、不恢复旧index/工作树登记。后续任务若要处置现场、续期材料、修改pending设置或继续动态，须明确重新授权。归档完成不解锁Batch C、资金、生产或任何环境晋升。

## 最终统一归档承接

最终冻结以evidence/batch-c-final.json为准。R1后续专项退役已清除pending，之后不访问；R2已初始化，最新复用完成退役：runtime/issuer NOLOGIN，CONNECT/TEMP=false、成员关系/会话0；bootstrap NOLOGIN、其他会话0且控制进程消失；原HBA/TLS恢复，pending=false。归档仅继承该时点证据，不再次连接。

三个最新临时客户端及五个本轮材料文件已在获准退役中移除；此事实不能改写为“从未删除任何临时材料”。旧材料、旧错误、回执及一次性序列持续保留，不执行进一步清理。新回执是否消耗未知，禁止重放/重置。

项目所有者最终授权明确：唯一治理Draft PR完成后本批次归档关闭、现场永久冻结。任何后续修复验证必须另开全新隔离工单，不能再次启用当前R1/R2或覆盖本次记录。治理文档只能追加更正/替代说明；不得恢复宽权限、删除证据、GC、强推或改写历史。
