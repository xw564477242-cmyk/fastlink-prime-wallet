# 授权与来源边界

2026-10-02总控线程019fa6b7-4f28-7b62-b676-757be88c22f8中项目所有者原文：
> 授权创建该GitHub Actions仓库级加密Secret，并允许三条现有CI在临时Runner中使用它。

总控专项约束：仅xw564477242-cmyk/fastlik-backend，名称RAILWAY_CONFIG_SCHEMA_B64；固定候选SHA `0302fd53109298d9c277dbaedae772630506d8da43636e69875268a8782dd68f`；仅stdin输入；不输出值；仅三条既有工作流、GitHub托管临时Runner；无网络回退；禁止Schema/Base64入Git/日志/制品；fork无输入必须失败；不得删除/轮换Secret或更改其他Secrets；双Draft PR；DB5冻结。

创建时间和存在性结果见evidence/secret-creation.json。Secret不存在性在创建前核实，创建后仅查询名称/时间，不读取值。Base64无换行，编码后内存解码SHA一致；未把编码保存成文件或命令参数。

候选13044字节；来源声明URL为https://railway.com/railway.schema.json，解析声明URL为https://backboard.railway.app/railway.schema.json。项目所有者提供附件、截图及内部使用确认；人工操作精确时间未知，不编造。收到字节SHA不是官方原始摘要。

官方独立获取曾429，不能据此认定候选是官方当前版本。缺明确公开再分发许可；仅按本次私有分发专项授权使用。T02保持LIMITED。Schema正文未附本报告。

新证据基点从GitHub精确对象核验取得，source-acquisition.json和fixed-source-manifest.json可追溯。新链不冒充旧临时目录证据的持续保全。
