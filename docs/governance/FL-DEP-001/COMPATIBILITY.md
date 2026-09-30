# 使用路径与兼容性

源码直接使用位于src/third-party/providers/cregis.provider.ts：Agent配置固定解析地址，通过Dispatcher1Wrapper适配Node 22内置fetch。既有cregis.provider.spec.ts验证Mock请求使用该适配器、请求投影和失败关闭行为。

src/test静态检索未发现直接BalancedPool或WebSocket使用；不把静态未发现等同于不可利用。兼容性关注DNS固定、TLS主机名、Dispatcher ABI、资源关闭及外部调用阻断。

原版与8.10.2均要求Node >=22.19.0；本机Node 22.22.1/npm 10.9.4符合要求，业务Draft CI实际Node 22.23.2/npm 10.9.8，证据见evidence/business-ci.json。未升级Node。

验证结果：Cregis provider 76项Mock测试通过；独立127.0.0.1合成HTTP服务以Agent + Dispatcher1Wrapper + Node fetch取得200；请求1次，服务关闭，真实供应商调用0。测试进程内net.Socket连接拦截拒绝非回环连接；这不等同于操作系统级防火墙隔离。，三个动态测试阶段的外部连接尝试均为0。测试继承仓库合成fixtures，不读取原环境凭据。

build和lint通过；完整dev基点既有Jest 1,755项通过、2项既有跳过、0失败、197个套件通过。此数量不包括冻结的FL-DB-003新增用例。没有为满足数量而改断言或混入其他工单。既有Mock覆盖及独立适配探针已足够，本工单没有修改或新增业务测试文件。

依赖安装禁用生命周期脚本；Prisma客户端只执行生成，不执行迁移或数据库连接。
