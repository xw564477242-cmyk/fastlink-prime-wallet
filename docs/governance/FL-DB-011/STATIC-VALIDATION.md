# 静态验证与一次分类复核

原50项保留、新增16项；两次均66/66、failure=0、error=0、exit=0。第二次仅依专项授权分类stderr，代码SHA不变，并非新增动态验证。

覆盖：42501→ROLLBACK→下一命令同通道、分段帧/缓冲、EOF与数据库拒绝区分、COMMIT/ROLLBACK固定SQLSTATE、预期拒绝分类、runtime/issuer分别一次清理、首因不被覆盖、三个合成标记不进入证据。

首次110字节stderr未分类导致STOP，保留[原结果](evidence/static-result.json)与[停止记录](evidence/change-and-stop.json)。专项复核全文固定匹配非敏感Python启动器本地临时目录查询回退警告，扫描零命中，见[分类](evidence/stderr-classification.json)和[复核结果](evidence/static-classification-retest.json)。原stderr未保存原字节，不能证明两轮字节级相同；本轮原文受限保留但不纳入PR。

限制：测试绑定本地化前driver路径，且保留DB10资源/TLS断言。66/66仅证明本地化前静态修订；不能称最终动态文件已获精确静态覆盖，不能作为自洽可复跑套件。

本地化前置先STOP，后续专项一次正向字节校验PASS；旧STOP不覆盖。归档阶段不重跑上述测试或任何动态用例。
