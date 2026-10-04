# FL-DB-008 已记录 STOP 顺序与承接边界

> 候选与审计交付归档；安全验收未通过。本文只整理已经存在的结果及授权记录，不运行任何数据库、Docker、SQL、Git、网络或测试。原 STOP/FAIL 不覆盖、不删除；后续局部 PASS 不追溯冲销历史。

## 证据与时间口径

- 时间使用结果自身明确记载的 UTC 值（`+00:00`）。缺时间项明确标记；不使用文件mtime充当执行/创建时间。表按批次及已有结果链排列，缺时间项的精确先后不能独立证明。
- S编号对应 `evidence/source-index.json` 的完整本地路径与本次实际文件SHA-256。此索引仅涉及选定脱敏报告；未复制私有239文件清单、认证材料或原HBA。
- 下表“承接”区分后续结果与授权。直接授权存在本轮用户正文或指定授权文件；缺少独立原消息文件/时间的续行不补造审批凭证，也不把有后续成功结果解释为事前批准已独立核实。

## 批次A至最终收尾

|序号|批次/原记录时间(UTC)|原错误或状态|当时事实与限制|后续承接（原错误仍保留）|来源|
|---|---|---|---|---|---|
|1|A；原结果未记录精确时间|APPROVED_OFFLINE_LINUX_ARM64_PRISMA_BUNDLE_MISSING|缺少获批 Linux/arm64 离线依赖输入；数据库和迁移尚未开始。|项目所有者随后仅授权锁文件安装及指定官方端点；本地结果不提供该授权原消息精确时间。|S01|
|2|A；2026-10-03T16:49:52.395339+00:00|STOPPED_DEPENDENCY_PLATFORM_PRECONDITION|固定镜像未识别 OpenSSL，Prisma 选择 1.1.x fallback；未执行引擎安装或 generate。|所有者随后批准固定镜像内 Debian 官方 openssl 必要依赖；禁止 fallback 的边界保留。|S02|
|3|A；2026-10-03T16:59:40.917890+00:00|STOPPED_LOCAL_VERIFICATION_COMMAND_SYNTAX_ERROR|执行端编写的 node -e 版本检查多一个右括号，解析失败；不是已证实引擎缺陷。|后续 prisma-finish 及 Batch A 完成报告承接结果；本地独立审批正文未纳入本索引，不推定每次续行均有单独批准。|S03|
|4|A；2026-10-03T17:12:44.343700+00:00|TimeoutExpired (logs --follow, 10 seconds)|R1 就绪日志等待命令超时；当时原32步迁移未执行。|原失败保留，后续记录从已有日志恢复就绪信息；不得写成首次一次成功。|S04|
|5|A；2026-10-03T17:14:51.002730+00:00|RuntimeError:DOCKER_OR_PROCESS_FAILED:['exec', '--user', '70:70']:2|恢复日志检查后的客户端进程退出2。|后续本地客户端匹配修订和两轮完成记录承接；本报告不复制连接字段或认证材料。|S05, S06, S07|
|6|B；2026-10-03T17:41:43.790793+00:00|AssertionError:|首次网络前置断言错误地期待 Batch A 标签；SQL动作0。|BATCH-B-STOP说明网络只有任务标签，断言修正而资源标签未改。|S08, S09|
|7|B；2026-10-03T17:42:48.393900+00:00|RuntimeError:SQL_FAILED_3_SQLSTATE_ERROR,42601|S1-003 register_admission 语法错误，字符1694；失败事务回滚。原38行 CASE 定位是当时推断。|后续修订/续行报告保留原失败；未以最终结果覆盖原报错。|S10, S09, S11|
|8|B；2026-10-03T17:48:49.655156+00:00|AssertionError:|同批续行前置断言失败；原结果没有更具体错误字段。|下一 corrected 记录证明后来续行，不反推此次断言根因。|S12|
|9|B；2026-10-03T17:49:39.618204+00:00|KeyError:'role'|003、006、009 已应用后，执行端读取元数据字段失败。|已成功步骤及原 KeyError 保留；后续候选身份执行记录承接，不称零错误。|S13|
|10|B；2026-10-03T17:50:34.338879+00:00|RuntimeError:SQL_FAILED_3_SQLSTATE_ERROR,42601|011 observe_synthetic_target 出现字符759语法错误；213行 CASE 定位当时仅推断。|项目所有者随后明确授权只修正011第213行CASE括号；后续 Batch B 目录通过仅为目录事实。|S14, S15|
|11|B；原结果未记录精确时间|AssertionError:('CardEvent_cardId_tenantId_environment_fkey', 'definition_drift')|FK定义前置比对失败。|下一记录说明差异为 public schema qualification；当时未执行DDL。缺精确时间，不能用文件名或mtime补造。|S16, S17|
|12|B；原结果未记录精确时间|AssertionError:tenant_third_party_config_tenant_fk|第二次FK前置比对失败。|后续ACL应用/结果承接；此记录不含完整根因，未重构。|S17|
|13|B；原结果未记录精确时间|RuntimeError:SQL_FAILED_3_SQLSTATE_ERROR,42703|原错误：column "CONSTRAINT" of relation "Card" does not exist；错误日志时间2026-10-03 18:09:39.143 UTC。|后续最终ACL结果PASS_DDL_APPLICATION_ONLY；只表示候选DDL应用，不表示动态隔离。|S18, S19, S20|
|14|B；2026-10-03T18:19:22.023589+00:00|AssertionError:|合成身份映射前置断言失败，rounds为空。|后续 corrected 文件为 PASS_SYNTHETIC_MAPPING_ONLY，runtime/issuer凭据未启用；不冲销原断言。|S21, S22, S23|
|15|C；2026-10-03T18:35:25.044561+00:00|STATIC_FIXTURE_SOURCE_CONFLICT / GLOBAL_BEFORE_SEED|Card fixture含productTemplateId，但两轮保留目录无列；未调用播种入口，SQL/Docker/动态/issuer调用均0。|所有者授权Card可空列+复合FK的append-only候选；不删除fixture字段绕过。|S24|
|16|C；2026-10-03T18:41:30.255584+00:00|BLOCKED (CardProductTemplate dependency absent)|只读目标目录证实关联表不存在；当时只获批Card列/FK，扩建父表超范围，DDL/DML0。|所有者随后将同一迁移链对齐批次扩至10个缺失模型及64物理表；非私自扩表。|S25|
|17|C/迁移链对齐；2026-10-04T03:19:55.126568+00:00|RuntimeError:RESOURCE_ABSENCE_UNPROVEN|全新资源不存在性未被原检查证明。|后续 corrected/final 记录承接；原STOP保留。|S26|
|18|C/迁移链对齐；2026-10-04T03:26:24.189234+00:00|TimeoutExpired (logs --follow, 5 seconds)|新资源就绪日志等待命令超时。|后续 final 为 PASS_FRESH_RESOURCES_ONLY；不重构未保存的工具输出。|S27, S28|
|19|C/迁移链对齐；2026-10-04T03:31:58.884831+00:00|AssertionError: (line 12)|迁移链执行前置断言失败。|后续两轮新链PASS；原错误未包含更具体根因，本归档不推导。|S29, S30|
|20|C/迁移链对齐；2026-10-04T03:45:29.283808+00:00|RuntimeError:CATALOG_MISMATCH:59_FUNCTION_EMPTY_SEARCH_PATH|R1目录第59项函数空search_path检查失败；另记录Wallet结构缺口，业务测试BLOCKED。|所有者授权第二append-only候选补Wallet两cardId/FK/索引，并补接已批准遗漏的function-path-acl；不重跑已成功32+1步。|S31, S32, S33|
|21|C；原结果未记录精确时间|STOP_AUTHENTICATION_MATERIAL_CONTRACT_MISMATCH|既有runtime证书SAN与所需URI身份契约不一致；这里只归档结构结论，不复制证书。|所有者授权保留旧材料、仅两轮runtime重签所需URI及私有指纹更新，不延长有效期、不重签issuer。|S34, S35|
|22|C；原结果未记录精确时间|STOP_OBSERVER_INITIALIZER_CONNECT_NOT_GRANTED|两轮observer initializer缺少目标任务库CONNECT。|所有者授权最小CONNECT/禁TEMP、短期材料/精确HBA、TOAST边界修订、两个候选初始化及立即退役。|S36, S37|
|23|C；2026-10-04T04:54:46.208706+00:00|RuntimeError:SQL_RETURN_3_STATES_ERROR,42809|014应用后owner断言对不合适relation种类调用权限函数；动态0。|总控允许追加015，只加入table/sequence权限函数CASE类型保护，其余TOAST/角色/schema/ACL条件不放宽。|S38, S39, S40|
|24|C；2026-10-04T05:09:11.573279+00:00|AssertionError: (line 59)|015两轮应用及owner断言通过后，HBA激活断言失败；配置写入不等于当前生效。|后续授权调整已知任务当前活动文件，双轮规则回读通过且未重启；R1原hba_file待重启设置仍保留，不称已清理。|S41, S42|
|25|C；2026-10-04T05:33:01.008493+00:00|ASSEMBLY_STOP_RUNTIME_PLAN_SIZE_LIMIT|R1两候选绑定完成后，总runtime计划超过4MiB单源上限；runtime/issuer服务未启动，动态0。|总控允许固定五分片等价装配，保持单片4MiB、64表/1280分母、签名/路径/哈希及语义校验。|S43, S44|
|26|C；2026-10-04T05:42:18.420834+00:00|CONTROL_PRECONDITIONS_FAILED; safetyFinalizationError=FileNotFoundError|R1分片装配及权限检查通过后控制连接前置失败；动态0。失败时原快照未保存。|后续目录观察到logical replication launcher，仅能说明后来的背景进程，不能恢复原失败瞬间或断言其必然根因。|S45|
|27|C；2026-10-04T05:46:23.536349+00:00|HELD_RESULT_CARDINALITY|首次收尾结果行数/序列化检查失败；记录显示未继续自动重试。原输出字节未保存。|总控仅批准JSON结果序列化修正，单行严格检查不放宽；随后收尾动作完成但断连后独立sessions=0仍LIMITED。|S46, S47, S48|

## 原收尾时点的承接边界（专项恢复前历史记录）

- Batch A原32步完成、Batch B54表目录检查通过、迁移链对齐后的64表目录事实，均不证明动态跨租户安全。64表/1280候选中：2项仅获准动态，474项静态DENY，804项BLOCKED；实际动态执行0。
- R1两项绑定/装配是前置成功，非两项动态PASS；R2未初始化这两项候选。runtime/issuer服务均未启动。
- 最终收尾仅确认原HBA恢复、initializer退役及权限回收、R1已启用runtime/issuer关闭、bootstrap最后退役和客户端正常退出。R2 runtime/issuer未曾启用，仍是原可登录属性但凭据缺失/过期状态，不写成NOLOGIN。
- 独立断连后sessions=0缺证，保持LIMITED；控制连接内观察只覆盖五个任务login角色，不能扩大为全实例所有后台进程检查。logical replication launcher不是client backend。
- R1此前hba_file待重启设置仍未清理，受原启动参数覆盖；本次不重启、不reset、不调查、不删除。
- 数据库、volume、容器、旧材料及错误证据保留。门禁2整体不通过，Batch C、安全硬前置及资金功能仍BLOCKED。此归档不授权动态续行、业务PR、合并、部署、环境晋升或基线更新。

## 不足与未重构事项

- 本表覆盖下列选定既有结果中可直接识别的全部STOP/失败；未声称覆盖丢失终端输出或未落盘执行历史。
- 早期若干AssertionError没有具体条件字段；原失败时序、实际工具原始字节或独立审批原文不全的部分保持缺口。
- 部分后续授权依赖执行对话原文，本任务未向其他线程取证，不伪造精确收发时间。原始错误文件与其后续修订均保持原位。

## 后续STOP追加（原1～27条完整保留）

以下两项只追加已知管理入口和授权边界结论。脱敏结果未单独提供STOP发生的精确时间，不以恢复/收尾完成时间或文件mtime补造STOP时间；来源为[恢复与最终收尾证据](evidence/recovery-closeout.json)。

|序号|批次/原记录时间|原错误或状态|当时事实与限制|后续承接（原错误仍保留）|来源|
|---|---|---|---|---|---|
|28|后续管理入口；STOP独立精确时间未提供|管理入口不足STOP|既有管理入口不足，无法据此继续后续工作；不能以早期收尾LIMITED推定存在可用入口。|2026年10月4日北京时间14:56:07，R1/R2各一次获准单用户恢复bootstrap LOGIN/VALID UNTIL（15:26:06到期），原容器各stop/start一次；原入口还原、HBA不变，无新容器、卷或认证材料。仅恢复管理入口，原STOP不冲销。|[恢复与最终收尾证据](evidence/recovery-closeout.json)|
|29|恢复后动态路径；STOP独立精确时间未提供|动态路径越当前边界STOP|静态判断动态路径需要新增容器与HBA规则，与当前授权边界不符；未执行该路径，动态0。|北京时间15:00:38完成两库bootstrap NOLOGIN收尾：成员关系0、断开前其他client 0、客户端exit 0、精确`/proc` backend PID消失，受控客户端会话0；不声称断开后另一次SQL全面会话观测。|[恢复与最终收尾证据](evidence/recovery-closeout.json)|

原收尾LIMITED和“本次不重启”等表述保留其专项恢复前历史适用范围；上述专项恢复与收尾是后续事实。本次最终归档阶段不访问现场或运行任何测试。R1原pending/覆盖条目未执行清除，恢复后未查询`pg_settings.pending_restart`，当前参数标志未复测；R2初始化未完成，核心RLS、跨租户及权限动态未验收，门禁2整体不通过，资金和RLS硬前置不解除，现场继续冻结。归档PR仅治理Draft，不能宣告安全验收通过。

## 最终统一归档承接：后续STOP追加（原29条不改）

以下时间均为既有结果完成时间（UTC），不冒充每一内部事件的发生时刻。原结果、错误PASS及更正分别留存；来源索引新增条目提供原SHA，不复制秘密材料。

|序号|完成时间或时间边界|错误／停止点|边界与后续承接|
|---|---|---|---|
|30|2026-10-04T07:39:12Z|R1 SESSION_ENDED_BEFORE_RESULT|原roundCloseout PASS错误；07:41:53Z更正为退役未证实；07:55:36Z专项退役完成，pending清除；之后R1冻结|
|31|2026-10-04T08:07:00Z|R2 Docker写入失败|未初始化，安全退役；未把写入失败当认证成功|
|32|2026-10-04T08:20:13Z|诊断Healthcheck模板字段不存在|未到达原故障点；边界更正保留，不能将STOP_CLOSEOUT_INCOMPLETE写成容器仍运行|
|33|2026-10-04T08:32:47Z|只读rootfs上的docker cp失败复现|仅无认证惰性数据诊断；stderr摘要与原失败一致；非数据库验证|
|34|2026-10-04T08:51:04Z|CERTIFICATE_IDENTITY_MISMATCH|当轮未保存ssl/client_dn值，原因当时未明；后续新窗口才证明DN等价表示|
|35|独立精确时间未固化|无法证明R1有已通过的TLS断言来源|仅静态停止，未消耗R2窗口；不可将旧目录VERIFIED冒充TLS验证|
|36|2026-10-04T09:13:09Z|事件回调重复kind导致TypeError|R2与observer已初始化、TLS严格匹配通过；核心SQL未执行；退役通过|
|37|独立精确时间未固化|单key授权与CHALLENGE/BIND双用途协议不符|静态停止；随后由项目所有者明确双key及既有记录短窗，没有自行扩权|
|38|2026-10-04T09:32:56Z|register_admission返回42501|回调已修复，28前置控制记录；后续明确challenge TEXT边界修订授权；无业务读写|
|39|2026-10-04T09:42:26Z|consume_admission返回42501|challenge399字节传递一致、注册回执提交成功；业务操作未到达；完整退役、禁止回执重放/序列重置|

第38轮为27 PASS＋1 LIMITED后STOP；第39轮为28 PASS＋1 LIMITED后STOP，均不是完整业务用例成功。准备challenge修订时的一次本地编写语法错误发生在执行前，未产生文件或数据库变更，纠正记录保留；不能隐去，但不冒充动态重试。最终不再进行任何动态操作；唯一治理PR完成后批次按专项授权归档关闭，门禁2仍未通过。
