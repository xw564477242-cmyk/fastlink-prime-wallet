# npm审计精确授权与执行边界R2

来源：FastLink总控对话019fa6b7-4f28-7b62-b676-757be88c22f8转发项目所有者授权，本执行对话收到后执行。

> 我授权 FL-DB-005 将SHA-256为 `afc58daba124d5073884690020487b5c5042fb1cc66e8aa4148c20ff6b8e53f4` 的174条公共npm包名与版本发送至官方npm审计端点。我已知悉依赖清单可能暴露项目技术栈。禁止发送项目名称、源码、完整锁文件、私有或内部包、路径、环境信息、凭据及认证材料；载荷SHA不一致时必须停止。

发送前源文件SHA已核对完全一致。源文件是本机审批清单包装，网络请求仅把其中packages姓名/版本转换为官方Bulk Advisory要求的包名→版本数组；不发送destination、excluded、unknown、sent包装字段。174条包名/版本对应165个包名。源SHA与协议请求体SHA分别记录，不把两种序列化字节说成相同。官方格式依据：[npm audit Bulk Advisory文档](https://docs.npmjs.com/cli/v7/commands/npm-audit/)。

仅HTTPS POST至https://registry.npmjs.org/-/npm/v1/security/advisories/bulk；禁止重定向、代理和Quick Audit回退，不读取npm认证配置。结果仅保留批准包的公告ID、范围、等级、标题和公共引用，未保存额外原始响应。未运行npm audit fix或修改包/锁文件。

原自动审批阻断记录继续保留；本轮精确授权仅解除该174项公共元数据发送阻断，不授权其他内容外发。
