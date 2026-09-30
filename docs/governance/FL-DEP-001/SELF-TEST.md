# DEP1-T01～T12

| 编号 | 状态 | 依据与限制 |
|---|---|---|
| DEP1-T01 | PASS | 最新远端dev基点、独立分支；DB3冻结；范围记录完整 |
| DEP1-T02 | PASS | 两项官方High映射8.10.2最小修复版本 |
| DEP1-T03 | PASS | Agent/Dispatcher1Wrapper直接使用及静态边界已记录 |
| DEP1-T04 | PASS | 业务仅2文件、锁文件仅根和undici条目；无传递漂移 |
| DEP1-T05 | PASS | 第二次仅锁文件解析后SHA不变，npm ci成功 |
| DEP1-T06 | PASS | npm audit生产依赖High 0、Critical 0、退出0 |
| DEP1-T07 | PASS | 5个Moderate逐项保留且无版本变更 |
| DEP1-T08 | PASS | build通过 |
| DEP1-T09 | PASS | lint通过 |
| DEP1-T10 | PASS | Cregis Mock 76项及回环适配探针通过；外部连接0 |
| DEP1-T11 | PASS | 完整既有Jest 1,755通过、2既有跳过、0失败 |
| DEP1-T12 | LIMITED | 本地敏感扫描、SHA、范围、回滚通过；双Draft PR最终HEAD/CI由外置交接绑定，业务完整远端检查因Draft跳过，等待独立Ready授权 |

门禁2不自行判通过。保持Draft会令后端完整远端检查按原工作流跳过；不能将Draft检查冒充完整CI。门禁3需要授权Ready后补齐完整远端CI。
