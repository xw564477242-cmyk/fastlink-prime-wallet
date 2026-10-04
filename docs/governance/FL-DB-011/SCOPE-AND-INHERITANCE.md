# 范围与继承

基于正式BASE-V1.0与后续获批差量，继承DB9/DB10及FL-DB-011已固化输入。仅新增本目录；正式基线和后端均不修改。原DEV1-T03/T12、GOV2-T09、早期历史正文缺口、DB-R02及尚未关闭的安全阻塞继续携带。

本目录：9份说明、24份白名单JSON、一份SHA256SUMS，共34文件。无可执行工具；工具字节不进入PR，仅记录摘要与适用范围。

必须保留的历史链：
1. DB9门禁2失败，不由本轮结果覆盖。
2. DB10首轮数据库名契约失败，完整退役未通过；旧现场冻结。
3. DB10替代R1：2 PASS、2 LIMITED、cross_delete回滚FAIL、后5项未运行；完整退役PASS。
4. DB11静态66项断言通过但stderr未分类STOP；经专项分类复跑，静态PASS追加承接。
5. DB11本地化逆替换检查STOP；专项授权以一次正向字节比对承接。
6. DB11单次R1：6 PASS、4 LIMITED、完整退役PASS；门禁2/3范围限定通过，仅治理Draft PR获准。

上述为依据总控正式结论整理的状态索引，不是补造DB9/DB10原始日志。缺失原文只保留引用和限制。

原始JSON来源：静态任务证据与dynamic-r1-20261005证据。仅batch-result删除资源标识和cluster标识，新增无标识计数摘要；源文件不写回。未复制任何private目录内容、SQL、迁移manifest、认证材料、容器/网络/卷ID、HBA、材料生命周期、资源或隔离原JSON、旧SHA清单、consume/core_runner/core-cases/diagnostics。

## 原始与归档字节溯源

| 文件 | 原SHA-256 | 归档SHA-256 | 处理 |
|---|---|---|---|
| [batch-result.json](evidence/batch-result.json) | `6312ed8d80dc216bf235de64008d02959825e80e1fcc010349b1dc57047c755e` | `9ada017c61c0587d094e0efaf1edfb76cdecef9ac87eb329f54d639f88270c75` | rounds[].resources (resource identifiers); rounds[].initialIdentity.cluster |
| [change-and-stop.json](evidence/change-and-stop.json) | `2f5c6c6a760121b1066bf9cc7cae11e65dbc28bf3489e9129faff039c2c57082` | `2f5c6c6a760121b1066bf9cc7cae11e65dbc28bf3489e9129faff039c2c57082` | 原字节保留 |
| [docker-preflight.json](evidence/docker-preflight.json) | `121f5fbd04ade1837d8a31ba6d96b4de963d99f308ca7e0dece98a3f5c616a44` | `121f5fbd04ade1837d8a31ba6d96b4de963d99f308ca7e0dece98a3f5c616a44` | 原字节保留 |
| [final-summary.json](evidence/final-summary.json) | `a66dc31b7054810222f382e2a6fb0d0964f331112cf190fb44ae38a3476cdf44` | `a66dc31b7054810222f382e2a6fb0d0964f331112cf190fb44ae38a3476cdf44` | 原字节保留 |
| [input-copy.json](evidence/input-copy.json) | `9c352716bf96b5c50b09034c7a290d24c2834527d15146a5dee3ee42388fdfc9` | `9c352716bf96b5c50b09034c7a290d24c2834527d15146a5dee3ee42388fdfc9` | 原字节保留 |
| [localization-forward-pass.json](evidence/localization-forward-pass.json) | `e28fafbc350f4a956e290ced951497bda803f00daa5f6badf2356eaba90293ba` | `e28fafbc350f4a956e290ced951497bda803f00daa5f6badf2356eaba90293ba` | 原字节保留 |
| [localization-stop.json](evidence/localization-stop.json) | `32014bcbda8cc748d736bb2e62b3cb2c56bbb7d78dd16c3fc3c52baed3d95e7f` | `32014bcbda8cc748d736bb2e62b3cb2c56bbb7d78dd16c3fc3c52baed3d95e7f` | 原字节保留 |
| [r1-case-cross_delete.json](evidence/r1-case-cross_delete.json) | `8f56633a8a3ad7cdfad1412af1e17c7beea7ffc279bf27db4df193b727ec5498` | `8f56633a8a3ad7cdfad1412af1e17c7beea7ffc279bf27db4df193b727ec5498` | 原字节保留 |
| [r1-case-cross_insert.json](evidence/r1-case-cross_insert.json) | `d4ba8879d2353748f14a427c57ce31649e01f6b1649a5119f1ce5de1f42c704f` | `d4ba8879d2353748f14a427c57ce31649e01f6b1649a5119f1ce5de1f42c704f` | 原字节保留 |
| [r1-case-cross_select.json](evidence/r1-case-cross_select.json) | `41ff854664096d9fcbb6d41f4d936806341a27499941681aa0963153b14879f9` | `41ff854664096d9fcbb6d41f4d936806341a27499941681aa0963153b14879f9` | 原字节保留 |
| [r1-case-cross_update.json](evidence/r1-case-cross_update.json) | `0d50378cbddb462796d0b22fda23eae7f9678d4ee06de8ef5de5facc94891cec` | `0d50378cbddb462796d0b22fda23eae7f9678d4ee06de8ef5de5facc94891cec` | 原字节保留 |
| [r1-case-expired_grant.json](evidence/r1-case-expired_grant.json) | `86bbf1786a4dccd2d6464a92c6848b24b238636a9c78b883bca7d372e622cdda` | `86bbf1786a4dccd2d6464a92c6848b24b238636a9c78b883bca7d372e622cdda` | 原字节保留 |
| [r1-case-expired_request.json](evidence/r1-case-expired_request.json) | `1a78e6b66a7575ec81dd0b16fa62cd550e0dac9fef2c88fe5bf9f350f4b7eb69` | `1a78e6b66a7575ec81dd0b16fa62cd550e0dac9fef2c88fe5bf9f350f4b7eb69` | 原字节保留 |
| [r1-case-ownership_tamper.json](evidence/r1-case-ownership_tamper.json) | `d6fea14e6b6560864d5937f5d5e09cb0ad415e1b0c2c6ceef5a20ac44e6ca512` | `d6fea14e6b6560864d5937f5d5e09cb0ad415e1b0c2c6ceef5a20ac44e6ca512` | 原字节保留 |
| [r1-case-revoked_key.json](evidence/r1-case-revoked_key.json) | `83ccc9f79949cb87e88497800b7d36fe1235f064936bf4a33dc0bb2e5f08d3f4` | `83ccc9f79949cb87e88497800b7d36fe1235f064936bf4a33dc0bb2e5f08d3f4` | 原字节保留 |
| [r1-case-same_select.json](evidence/r1-case-same_select.json) | `c78efbd1ffd3cef7bc94444899df08454b327bb3a3b37400e9e1123ead194251` | `c78efbd1ffd3cef7bc94444899df08454b327bb3a3b37400e9e1123ead194251` | 原字节保留 |
| [r1-case-unbound.json](evidence/r1-case-unbound.json) | `f1e0c6d0a622dbfff2b29aaaac5c73449b474e33b4f1199a94394d3a350bfb48` | `f1e0c6d0a622dbfff2b29aaaac5c73449b474e33b4f1199a94394d3a350bfb48` | 原字节保留 |
| [r1-catalog.json](evidence/r1-catalog.json) | `a04f0714a5abebc40b8e95a5ee646b4da7c9bc9152feb202c3a7b2b564b8b8ba` | `a04f0714a5abebc40b8e95a5ee646b4da7c9bc9152feb202c3a7b2b564b8b8ba` | 原字节保留 |
| [r1-initializer-retired.json](evidence/r1-initializer-retired.json) | `af86ea342c7667f7a755fd4e8e45e91e1a81919dd50111bc72c0abe4f832b8d1` | `af86ea342c7667f7a755fd4e8e45e91e1a81919dd50111bc72c0abe4f832b8d1` | 原字节保留 |
| [r1-migrations.json](evidence/r1-migrations.json) | `b02b9955e073bef14d22319532e0a00cedf96b2e7d560c8274da115cc0c13af6` | `b02b9955e073bef14d22319532e0a00cedf96b2e7d560c8274da115cc0c13af6` | 原字节保留 |
| [r1-retirement-step-202610041628487753850000.json](evidence/r1-retirement-step-202610041628487753850000.json) | `41c19ba0ba6833b091bb9405a3948f11bdd333e334bcf8cca15b60d2bfea9fec` | `41c19ba0ba6833b091bb9405a3948f11bdd333e334bcf8cca15b60d2bfea9fec` | 原字节保留 |
| [static-classification-retest.json](evidence/static-classification-retest.json) | `5c71c547a9a90ac1e87a4e5169b8679947dfab7a0a9ae3e184857c8aaba27a2b` | `5c71c547a9a90ac1e87a4e5169b8679947dfab7a0a9ae3e184857c8aaba27a2b` | 原字节保留 |
| [static-result.json](evidence/static-result.json) | `5c435a9a22a3fc147606756eff41c1e688afb9d9dcb23038328e4fc5b923b2b9` | `5c435a9a22a3fc147606756eff41c1e688afb9d9dcb23038328e4fc5b923b2b9` | 原字节保留 |
| [stderr-classification.json](evidence/stderr-classification.json) | `4092368de5531da2763bbabddbfc67657aee7f17c15c57fd1aaad4ebb64be866` | `4092368de5531da2763bbabddbfc67657aee7f17c15c57fd1aaad4ebb64be866` | 原字节保留 |

JSON内输入SHA或文件路径仅为已授权元数据，不代表所引用私有文件内容已归档。SHA256SUMS覆盖除自身外全部归档文件，自身摘要由最终回传外置记录。
