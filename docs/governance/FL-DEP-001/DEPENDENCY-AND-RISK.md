# 依赖、公告与残余风险

| 依赖 | 原版本 | 新版本 | 类型 | 变化 |
|---|---|---|---|---|
| undici | 8.9.0 | 8.10.2 | 直接生产依赖 | 精确同主版本升级 |

锁文件仅根依赖声明和node_modules/undici条目变化。包条目只变version、resolved、integrity，Node要求不变，无新增传递依赖，无其他包版本变更。完整diff见evidence/business.diff。重复仅锁文件解析前后SHA一致。

## 两项High映射

- GHSA-rfgv-xxqx-mfg5：未请求WebSocket子协议导致DoS；8.x受影响范围>=8.0.0 <8.10.2。
- GHSA-w293-vg96-wgc3：BalancedPool连接选项丢失导致TLS证书校验绕过；8.x受影响范围>=8.0.0 <8.10.2。

官方公告：https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5 和 https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3 。官方版本声明：https://raw.githubusercontent.com/nodejs/undici/v8.10.2/package.json 。

生产依赖审计由1 High/5 Moderate/0 Critical变为0 High/5 Moderate/0 Critical，退出码0。计数为npm包级汇总，非独立公告数。审计命令：`npm audit --omit=dev --audit-level=high --json`，显式指定官方registry。未运行audit fix、force或阈值豁免。前证据复用FL-DB-003基点锁文件审计；后证据分别核验锁文件与实际安装依赖。

## 保留的5个Moderate包级条目

| 包 | 锁定版本 | 类型 | 原因 |
|---|---|---|---|
| @nestjs/platform-express | 11.1.28 | 直接 | multer传递影响 |
| @nestjs/swagger | 11.4.6 | 直接 | js-yaml传递影响 |
| js-yaml | 5.2.2 | 传递 | 合并键CPU消耗控制不足 |
| multer | 2.3.0 | 传递 | 中止上传遗留写入DoS |
| qs | 6.15.3 | 传递 | 数组限制绕过及isBuffer DoS |

上述条目完整保留且与基点一致，未声明风险关闭；后续须独立评估。升级仅证明锁定依赖不再命中指定High公告，不代表生产已更新或所有可达路径安全。
