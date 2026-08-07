# mingtian-home

明天的个人主页，一个以连续场景和交互动效串联内容的静态网站。

网站包含首页、关于、兴趣、博客、旅行、作品集、日常和音乐等内容，并针对桌面端、小宽屏和移动端进行了响应式适配。页面正文、媒体资源、导航、音乐和 SEO 信息集中配置在 `site.config.yaml` 中，再由生成脚本同步至页面运行文件。

## 主要功能

- 视频 Hero 与加载过渡动画
- 基于物理效果的 3D 工牌
- 游戏、音乐和电视组成的兴趣场景
- 音乐球、播放列表、歌词、音量及播放状态同步
- 旅行图片堆叠转场与可拖动的环游世界画廊
- WebGL 作品集轮播
- 移动端半页笔记本及翻页效果
- YAML 内容配置、旅行图片整理和 SEO 文件生成

## 技术栈

- HTML5、CSS3、原生 JavaScript
- React
- Three.js、React Three Fiber、React Three Drei
- Rapier 3D 物理引擎
- OGL / WebGL
- GSAP、ScrollTrigger
- Lottie
- jQuery、Turn.js
- HTML5 Audio、Meting 音乐接口
- YAML、Node.js 构建与审计脚本

项目为静态网站，部署后不依赖服务端应用。建议通过 HTTP/HTTPS 服务器访问；直接打开 `index.html` 时会使用项目保留的 standalone 运行时兜底。

## 项目结构

```text
mingtian-home/
├─ index.html                 页面入口
├─ site.config.yaml          网站内容与资源配置
├─ css/                      页面与组件样式
├─ js/                       页面逻辑、运行时和生成数据
├─ src/                      需要构建的组件源码
├─ scripts/                  配置生成、构建和审计脚本
├─ script-output/            脚本生成的审计与资源信息
├─ images/                   图片资源
├─ videos/                   视频资源
├─ music/                    本地音乐与网络音乐元数据
├─ models/                   3D 模型资源
├─ fonts/                    字体资源
├─ vendor/                   本地第三方依赖
├─ robots.txt                搜索引擎规则
└─ sitemap.xml               站点地图
```

## 本地运行

不要直接依赖双击打开进行开发，推荐在项目根目录启动任意静态文件服务器，例如：

```powershell
npx serve .
```

然后访问命令输出的本地地址。

## 修改配置

网站的可替换文案、链接、图片、视频、音乐和 SEO 信息位于：

```text
site.config.yaml
```

修改配置或旅行图片后执行：

```powershell
node scripts/generate-site-assets.mjs
```

该脚本会更新页面配置、音乐数据、旅行画廊数据、`robots.txt`、`sitemap.xml` 和资源清单。运行前请确认旅行图片目录内容，因为脚本会按照统一规则整理并重命名图片。

配置与资源检查：

```powershell
node scripts/audit-site-config.mjs
node scripts/audit-resources.mjs
```

## 设计参考与致谢

本项目在构思、视觉设计和交互实现过程中参考了以下优秀网站与项目，在此表示感谢：

- [Heo](https://zhheo.com/)：为网站的萌芽及整体视觉方向提供参考。
- [React Bits](https://www.reactbits.dev/)：提供文字、工牌和轮播图等交互动效参考。
- [Motion Sites](https://motionsites.ai/)：提供丰富的设计提示词与网站模板参考。
- [Wero Merchant](https://sowieso.wero-wallet.eu/nl-en/merchant)：提供纸飞机视觉素材。
- [Talia Cotton](https://taliahhh.com/)：为日常页面的设计提供特别的思路。
- [Hanako's Forum](https://forum.hanakos.cc/)：为音乐界面的设计与交互提供思路。
- [JioJio](https://jiojiojoy.com/)：提供视觉审美参考。

同时感谢 Codex 与人工智能技术的发展，让我能够通过 Vibe Coding 更轻松地把脑海中的想法逐步变成现实。

上述网站及项目的名称、内容与素材版权归各自权利人所有。致谢仅用于说明本项目的灵感和参考来源，不代表其对本项目的合作、认可或背书。

## 使用与授权

本项目由明天原创并公开源码。

- 允许个人学习、研究和非商业用途使用。
- 允许在非商业用途下复制、修改和再发布代码，但必须保留作者署名及本声明。
- 未经作者书面授权，禁止将本项目或其修改版本用于任何商业用途，包括销售、付费交付、商业产品、商业服务或以盈利为目的的宣传与运营。
- 项目中由作者创作、拍摄或持有的图片及视觉素材，版权归作者个人所有。源码公开不代表这些素材获得自由使用授权，未经许可不得复制、转载、再发布或用于其他项目。
- 第三方库、字体、音乐及其他外部资源仍遵循其各自的许可证和版权规则。

如需商业授权或素材使用许可，请先取得作者的书面同意。

Copyright © 2026 明天. All rights reserved.
