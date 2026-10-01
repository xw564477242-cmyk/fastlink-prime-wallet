# 公共依赖审计结果R2

- 审计UTC时间：2026-10-01T05:43:50.613759+00:00
- 官方Bulk端点HTTP 200；四条moderate公告匹配三个已安装公共包；high/critical匹配0。
- 依赖范围命中不证明本应用路径可利用；不属于数据库跨租户P0，也没有实施依赖升级。
- 离线semver匹配，无npm元漏洞依赖传播计算；完整业务CI仍未执行，T17保持LIMITED。

| 包 | 已安装匹配版本 | 公告 | 等级 | 后续 |
|---|---|---|---|---|
| js-yaml | 5.2.2 | [1239991](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm) | moderate | 依赖资产负责人评估可达路径、升级兼容性与独立整改工单；当前不自动修复 |
| multer | 2.3.0 | [1239935](https://github.com/advisories/GHSA-3pph-fpjx-jg34) | moderate | 依赖资产负责人评估可达路径、升级兼容性与独立整改工单；当前不自动修复 |
| qs | 6.15.3 | [1158506](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) | moderate | 依赖资产负责人评估可达路径、升级兼容性与独立整改工单；当前不自动修复 |
| qs | 6.15.3 | [1158507](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | moderate | 依赖资产负责人评估可达路径、升级兼容性与独立整改工单；当前不自动修复 |

请求体SHA-256：b90bf1b07a0949b2345cd72686ea500ec8021aff84ebe02a9eb771386acc883e

精确授权、实际版本匹配及限制见NPM-AUDIT-AUTHORIZATION-R2.md和evidence/npm-audit-r2.json。
