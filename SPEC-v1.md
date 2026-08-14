# PSG Credentials V1 — 技术规格说明书

纯静态方案：GitHub 管数据与代码 → Cloudflare Pages 部署 → 浏览器端查询/验证/生成证书。
不使用 D1 / KV / R2 / Worker API / 任何数据库或后端服务。

---

## 0. 数据流

```
source/certificates.csv   (人工维护，唯一真源)
        │  npm run assign-ids   (本地脚本：为新行补全 certificate_id / token，写回 CSV)
        ▼
source/certificates.csv   (已补全)
        │  npm run build        (Cloudflare Pages 构建阶段自动执行)
        ▼
public/data/certificates.json   (仅公开字段，构建产物，不手工编辑)
        ▼
Cloudflare Pages 静态站点 (credentials.panorama-sg.com)
```

CSV 是唯一可编辑的数据源；JSON 永远是构建产物。任何人不应该手改 `certificates.json`。

---

## 1. 页面结构（路由）

SPA，History 模式，Cloudflare Pages 用 `public/_redirects` 做 `/* /index.html 200` 兜底。

| 路由 | 说明 | 关键状态 |
|---|---|---|
| `/` | 首页，姓名查询入口 | 初始 / 查询中 / 无结果 |
| `/search?q=` | 查询结果（可能多条同名） | 单条命中 → 直接跳 `/certificate/:id`；多条 → 列表消歧（显示期刊+职位+编号后4位） |
| `/certificate/:id` | 证书预览 + 下载 PDF/PNG | 正常 / 已撤销 / 已过期（仍可查看，但标注状态） |
| `/verify?id=&token=` | 二维码扫码后的验证结果页 | 有效 / 编号不存在 / token 不匹配 / 已撤销 / 已过期 |
| `*` | 404 | — |

**查询逻辑**：`name` 不是唯一键（重名可能存在），所以首页搜索允许返回多条，用户选择具体一条后才进入证书页；证书页和验证页统一用 `certificate_id` 作为唯一定位键。

---

## 2. CSV 字段规范（`source/certificates.csv`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 用于查询匹配，允许重复 |
| `display_name` | string | 是 | 证书上显示的正式称谓，如 `Dr. Yulei Tao` |
| `certificate_id` | string | 否（自动生成） | 见第 3 节编号规则；留空则由 `assign-ids` 脚本补全 |
| `journal` | string | 是 | 期刊全称 |
| `role` | enum | 是 | 见第 3 节角色代码表，决定编号前缀 |
| `issue_date` | date `YYYY-MM-DD` | 是 | 签发日期，决定编号年份 |
| `valid_from` | date `YYYY-MM-DD` | 是 | 任期开始 |
| `valid_until` | date `YYYY-MM-DD` | 是 | 任期结束 |
| `token` | string | 否（自动生成） | 见第 4 节，8 位随机字符，一旦生成不可更改 |
| `status` | enum `active` \| `revoked` | 是 | 人工维护；`expired` 不存库，由前端用 `valid_until` 与当前日期实时计算 |
| `revoked_at` | date `YYYY-MM-DD` | 仅 `status=revoked` 时必填 | 撤销日期，用于计算第 2.5 节的删除宽限期；`status=active` 时必须留空 |

**校验规则**（`validate-data.js`）：
- `certificate_id` 全局唯一；`token` 全局唯一
- `valid_from <= valid_until`
- 日期必须是合法 ISO 格式
- `status` 只能是 `active` / `revoked`
- `role` 必须在角色代码表中
- `status=revoked` 必须同时填 `revoked_at`（且不晚于今天、不早于 `issue_date`）；`status=active` 时 `revoked_at` 必须为空

**安全边界（重要）**：CSV / JSON 中只允许放"公开信息"：姓名、职位、期刊、证书编号、任期、状态、验证 token。**禁止**放邮箱、电话、身份证、住址、内部备注、合同信息——因为构建产物 `certificates.json` 是任何访客可直接下载的公开文件，token 只起"防止随手猜测/枚举"的作用，不是服务器端保密机制。如果未来需要记录内部字段（如联系方式），必须放在单独的、不参与构建的私有文件里。这也是第 2.5 节"到期/撤销自动删除"只通知 PSG 内部人员、而不直接联系证书持有人的原因——系统本来就没存联系方式。

---

## 2.5 证书生命周期：到期与撤销后自动清理

任期固定 3 年（`valid_from` 到 `valid_until`）。到期或提前撤销后，记录不会永久留在公开 registry 里，而是走一个"宽限期 + 内部通知 + 自动删除并推送"的流程，由 `.github/workflows/lifecycle.yml` 每天定时跑（也支持手动触发）：

| 触发条件 | 宽限期 | 宽限期内 | 宽限期满 |
|---|---|---|---|
| `status=active` 且 `valid_until` 已过（自然到期） | 90 天 | 仍可查询/验证，标注"任期已结束" | 从 `certificates.csv` 中移除该行 |
| `status=revoked`（提前撤销，如离职） | 30 天 | 仍可查询/验证，标注"已撤销" | 从 `certificates.csv` 中移除该行 |

**流程**（`scripts/prune-expired.js`）：
1. 每天扫描一次 `source/certificates.csv`，计算每条记录的"删除日期"（到期/撤销日期 + 对应宽限天数）
2. 删除日期已到 → 直接从 CSV 里删掉这一行，脚本自动 `git commit` + `git push`，触发 Cloudflare Pages 重新构建上线（这就是"自动删除然后推送"）
3. 删除日期在未来 14 天以内 → 不删除，但记入本次运行的汇总
4. GitHub Action 把"本次已删除"和"14 天内即将删除"两份清单写进一个持续更新的 GitHub Issue（标题固定为 `Certificate Registry: Lifecycle Report`），交给 PSG 内部人员复核。**不会联系证书持有人本人**——CSV 里没有存邮箱等联系方式，这是刻意的隐私边界（见上一节），需要留人的话，内部人员在删除日期之前把 `status` 改回 `active` 并延长 `valid_until`，或者做相应修正即可

本地手动跑一次（不会自动 commit，只改本地文件）：`npm run prune-expired`

---

## 3. 编号规则

格式：`PSG-{ROLE}-{YEAR}-{SEQ}`

角色代码表：

| role（CSV 原值） | 代码 |
|---|---|
| Editor-in-Chief | `EIC` |
| Editorial Board Member | `EB` |
| Youth Editorial Board Member | `YEB` |
| Associate Editor | `AE` |
| Guest Editor | `GE` |
| Reviewer | `REV` |

- `YEAR`：取 `issue_date` 的年份，4 位
- `SEQ`：**同一年份内全局递增**（不按角色分别计数，与用户给出的示例 `...000128` / `...000129` 一致），6 位零填充，从 `000001` 起

生成算法（`assign-ids.js`）：
1. 扫描 CSV 中所有已存在的 `certificate_id`，按年份分组，取每年已用的最大 `SEQ`
2. 对每一行缺失 `certificate_id` 的记录，按 CSV 行序依次分配 `年份最大SEQ + 1`
3. 写回 CSV（保持列顺序与其余字段不变）

编号一经分配即视为永久，不允许因为后续排序变化而重新生成。

---

## 4. 二维码规则

验证 URL 模板：

```
https://credentials.panorama-sg.com/verify/?id={certificate_id}&token={token}
```

- `token`：8 位随机字符，字母表排除易混淆字符 `0 O 1 I L`，大写，使用 `crypto.randomInt` 生成，**只在编号首次分配时生成一次，此后永不改变**（否则已打印/下载的证书上的二维码会失效）
- QR 码由前端在运行时用 `qrcode` 库根据上面的 URL 实时生成，不预先生成图片
- `/verify` 页面逻辑：
  1. 取 `id` 查 `certificates.json`
  2. 不存在 → "Certificate record not found"
  3. 存在但 `token` 不匹配 → "Invalid verification link"
  4. `status === 'revoked'` → 显示"已撤销"，但仍展示原始信息以便核查
  5. `today > valid_until` → 显示"任期已结束"提示，同时展示原始信息
  6. 否则 → 显示绿色 "Verified" 状态 + 完整信息

---

## 4.5 视觉系统与证书模板

统一沿用德系工业精密语言（详见 [public/BRAND.md](public/BRAND.md)）：黑 `#000000` / 红 `#E30613`（取自官方 logo） / 钢灰 `#6B6D72`（特意选的偏冷灰，不用纯 `#808080`） / 纸白 `#FFFFFF`，全程单一无衬线字体（Arial/Helvetica，与 logo 一致），不引入衬线体或花体。

- `public/logo/psg-logo.svg` — 官方 logo（甲方提供）
- `public/seal/psg-official-seal.svg` — 官方印章：仪表刻度环 + 红色细线环 + 黑色主环，环内文字 `PANORAMA SCHOLARLY GROUP` / `ZERTIFIZIERT · CERTIFIED`（德英双语呼应"德系风格"要求），中心为 logo 几何图形缩放
- `public/templates/certificate.svg` — 证书主模板，A4 横向（`viewBox="0 0 842 595"`，单位 pt，与 pdf-lib 页面尺寸 1:1 对应），占位符 `{{DISPLAY_NAME}}` `{{ROLE}}` `{{JOURNAL}}` `{{VALID_FROM}}` `{{VALID_UNTIL}}` `{{CERTIFICATE_ID}}` `{{SIGNATORY_NAME}}` `{{SIGNATORY_TITLE}}` `{{ISSN}}`，`<g id="qr-slot">` 标记二维码注入位置

**渲染层必须做、模板文件本身做不到的事**：
- `DISPLAY_NAME`（42px）/ `ROLE`（26px）/ `JOURNAL`（19px）三处文字必须在前端用 JS 测量实际宽度，超出边框内可用宽度（约 700pt）时缩小字号或对 `JOURNAL` 做两行折行。已用长姓名（`Prof. Alessandra Werthmüller-Nakamura`）和长期刊名压测确认：不做这一步会直接顶穿边框
- `SIGNATORY_NAME`（连笔签名，32px）签名线只有 160pt 宽，同样需要测宽缩字号（最小 16px）
- `ISSN` 若为空（期刊还没申请下来 ISSN，`source/journals.csv` 里留空）则整行 `#field-issn` 从 DOM 里移除，不能打印出"ISSN "后面空白的半成品效果
- 用 `getElementById`/`getComputedTextLength` 做测量时，SVG 必须临时挂到 `document.body`（离屏）才能拿到布局信息；**序列化导出前必须清掉临时加的 `style` 属性**，否则 `position:fixed;left:-9999px` 会被一起写进最终 SVG，导致证书永远渲染在屏幕外（真实踩过的坑，见 `src/lib/renderCertificate.js`）

这是 Phase 2 前端实现证书渲染组件时的硬性要求，不是可选项。

### 签名字体

证书签名使用 Google Fonts 的 Alex Brush（连笔手写体），OFL 开源协议。因为 PNG/PDF 导出走的是"把 SVG 当图片加载进 `<img>` 再画到 canvas"这条路径，这个渲染上下文不会继承页面级 `<link>` 加载的网页字体，所以字体必须以 base64 `@font-face` 的形式直接内嵌进 `certificate.svg` 模板本身（见模板文件顶部 `<defs><style>`），网站在线预览则额外通过 `public/fonts/AlexBrush-Regular.woff2` + `src/styles.css` 里的 `@font-face` 加载，两边保持视觉一致。

### 期刊数据（`source/journals.csv`）

签名人姓名和 ISSN 是"期刊"维度的数据，不是"证书"维度的，所以单独放一张表，构建时按 `journal` 字段做精确匹配 join 进 `certificates.json`：

| 字段 | 说明 |
|---|---|
| `journal` | 必须和 `certificates.csv` 里的 `journal` 完全一致（构建脚本按此字段 join，不一致会直接报错退出） |
| `editor_in_chief` | 主编真实姓名，留空则证书上连笔签名区域留白（不编造姓名） |
| `signatory_title` | 签名下方印刷体职衔，默认 `Editor-in-Chief` |
| `issn` | 期刊 ISSN，留空则证书上不显示 ISSN 行 |

当前 21 本期刊的真实列表与主编姓名已从 journals.panorama-sg.com 核实（每本期刊编委页地址并不统一，按各期刊自己配置的 slug 分别核对；ISSN 以 panorama-sg.com/journals 的权威数据 `data/journals.json` 为准，比单本期刊页面更新更及时，例如 Contemporary Review of Political Thought 的 ISSN 就是先在这里发现已经从 Pending 变成 `3056-0977`）。目前 14 本期刊已核实到真实主编姓名并填入 `editor_in_chief`；剩余几本官网编委页确实还没有公开人选，留空处理，不编造。

### 编委会成员名单（`source/editorial-boards.csv`，仅供参考）

`journal,role,name,affiliation` 四列，记录目前所有 ISSN 已注册期刊（含 Contemporary Review of Political Thought 和短标题的 "Health Nexus"）编委会的完整名单，不止主编一人。**这是纯参考数据，不参与构建、不会自动变成证书**——生成正式证书需要真实的任期起止日期和 PSG 内部对"确实要发证书给这个人"的确认，这两点都没法从官网名单里推断出来，所以这张表和 `certificates.csv` / `journals.csv` 都没有 join 关系，纯粹是抓取归档。

---

## 5. GitHub 项目开发说明

### 目录结构（V1 骨架）

```
psg-credentials/
├── source/
│   └── certificates.csv          # 唯一数据源，人工维护
├── scripts/
│   ├── lib/roleCodes.js          # 角色代码表（单一来源，构建/校验/分配脚本共用）
│   ├── assign-ids.js             # 本地运行：补全 certificate_id / token 并写回 CSV
│   ├── build-registry.js         # CSV -> public/data/certificates.json（构建期执行）
│   └── validate-data.js          # 校验 CSV（CI 与本地均可跑，不写文件）
├── public/
│   ├── data/certificates.json    # 构建产物，不手工编辑
│   ├── templates/                # 证书 SVG 模板（待品牌素材到位后补充）
│   └── _redirects                # Cloudflare Pages SPA 兜底
├── src/                          # 前端（React + Vite，Phase 2 实现）
├── .github/workflows/ci.yml      # PR 时跑 validate-data，防止坏数据合入
├── package.json
└── SPEC-v1.md
```

### 开发流程

1. 人员编辑 `source/certificates.csv` 新增一行，`certificate_id` / `token` 留空
2. 本地运行 `npm run assign-ids`，脚本补全并写回 CSV
3. 提交 PR；CI 跑 `npm run validate`，唯一性/格式/必填校验不过则 CI 失败
4. 合并后 Cloudflare Pages 自动触发构建：`npm run build`（内部会先跑 `build-registry.js` 生成 JSON，再跑前端构建）
5. 部署到 `credentials.panorama-sg.com`

### Cloudflare Pages 设置

- Build command: `npm run build`
- Build output directory: `dist`
- 无需任何环境变量、无需绑定 D1/KV/R2
- 自定义域名：`credentials.panorama-sg.com`

### 明确不做的事（V1）

- 不做 GitHub Actions 自动回写 CSV（避免 bot 提交 + 并发冲突的复杂度），编号分配始终由人在本地跑 `assign-ids` 后再提交
- 不做服务端 PDF 生成，证书预览/下载全部在浏览器端用 `pdf-lib` + `html2canvas`/SVG 实时合成
- 不存储任何 PII 之外的联系方式类字段
