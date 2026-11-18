# Chen Shuoyu's Portfolio｜陈烁羽的个人作品集

一个以**精装立体纸艺书**为载体的个人综合作品集网站。页面初始是一本合上的黄色硬壳书，点击封面后翻开为「左侧说明页 + 中央可拖拽 3D 展区 + 右侧注解页」的三栏结构。项目使用 Three.js + 原生 HTML/CSS/JavaScript，无重型框架、无构建步骤，源码可直接归档或部署到任意静态托管服务。

## 项目简介

- 视觉定位：温暖写实的纸艺绘本质感，低饱和黄色、鼠尾草绿、牛皮纸与墨绿色调；不使用霓虹、赛博朋克或夸张游戏 UI。
- 交互方式：鼠标点击封面开书；拖拽中央 3D 场景旋转视角；滚轮缩放；点击展品弹出高清图与注解；个人介绍后一页为可滚动的作品总览，点击作品卡片可直达对应展区；底部控制栏支持目录、上一项、下一项、氛围音与视角重置。
- 内容单元：个人介绍、作品总览、联系方式、手绘作品、视觉设计、交互设计、音画交互、3D 建模、装置艺术、IP 设计，共 10 个独立场景。每个单元都有独立的场景配置、文案、图片与相机参数。
- 翻页逻辑：切换单元时，当前立体场景先向内收合，配合书页翻转动效；新场景随书页展开逐步成型，不做模型闪现替换。
- 手机端：另有独立手机版入口 `mobile/`，针对触屏重排为单栏滚动、展区快捷导航与横向滑动图集，图片点击可全屏查看。

## 本地启动

项目不需要 `npm install` 或打包。因为浏览器对 ES Module 的安全限制，请通过本地 HTTP 服务打开，不要直接双击 `index.html`。

### 方式一：Windows 一键启动（推荐）

双击项目根目录的 `start-website.bat`。它会启动本地服务并自动打开浏览器。

访问地址：

```text
http://localhost:8080
```

关闭标题为 **Paper Book Portfolio Server** 的命令行窗口即可停止服务。

### 方式二：Python 命令

```bash
cd d:/作品集
python -m http.server 8080
```

### 方式三：VS Code Live Server

右键 `index.html`，选择 **Open with Live Server**。

### 线上部署

将整个项目目录上传到静态托管服务（如 GitHub Pages、Netlify、Vercel、Cloudflare Pages 或普通 Nginx 静态目录），入口文件为 `index.html`。所有依赖、模型与图片均已放在 `public/` 内，无需联网 CDN。

## 目录结构

```text
作品集/
├── index.html                  # 页面入口与 import map
├── README.md                   # 本文档
├── public/
│   ├── images/                 # 肖像、插画、海报、原型、二维码、纸张纹理
│   ├── models/                 # 9 份 GLTF 2.0 纸艺模型（嵌入二进制缓冲）
│   └── vendor/three/           # 本地化的 Three.js r160 与 GLTFLoader
├── scripts/
│   └── generate_models.py      # 可重复生成 GLTF 模型的脚本
└── src/
    ├── styles.css              # 全部界面样式与动效
    ├── main.js                 # 状态编排、渲染循环、事件绑定
    ├── ui.js                   # 三栏内容、目录、弹窗、控制栏
    ├── data/units.js           # 所有页面单元配置（新增作品只改这里）
    └── core/
        ├── book.js             # 书本模型、桌面场景、开书与纸张弯曲动效
        ├── stage.js            # 中央 3D 舞台、拖拽控制、点击拾取、场景切换
        ├── audio.js            # Web Audio 生成的低音量氛围音
        └── textures.js         # 木纹、桌垫、阴影、封面标题等程序化纹理
```

## 如何修改成你自己的作品集

1. **个人信息与联系方式**
   - 打开 `src/data/units.js`，修改顶部 `siteMeta` 中的姓名、职业与邮箱。
   - 修改 `contact` 单元 `left.facts` 与 `hotspots` 中的社交链接、文案。
2. **替换二维码**
   - 用你的真实二维码图片覆盖 `public/images/qr-contact.jpg`。
   - 若更换文件名，请同步修改 `contact` 单元中的 `textures` 与 `hotspots`。
3. **替换作品大图**
   - 把你的图片放进 `public/images/`，修改对应单元的 `hotspots[].image`。
   - 推荐比例：手绘/海报 3:4，横版作品 16:10，分辨率不低于 1200px。
4. **新增作品单元（现有 3D 建模、装置艺术、IP 设计即为扩展示例）**
   - 在 `src/data/units.js` 的 `units` 数组中追加一个对象，配置项说明如下：
     - `id`：唯一标识，用于模型缓存与目录。
     - `model`：GLTF 文件路径。
     - `camera`：中央舞台的初始半径、水平角、俯仰角与目标点。
     - `left`：标签、标题、简介、段落与事实列表。
     - `right`：展品注解、创作思路、灵感、技术说明。
     - `textures`：把图片贴到 GLTF 节点的绑定关系，例如 `{ node: 'hotspot_poster_a', src: './public/images/poster.svg' }`。
     - `hotspots`：点击热区对应的节点名、大图、元数据与说明。
   - 目录、上一项/下一项、翻页动画会自动适配，不需要改核心 JS。
5. **替换或修改 3D 模型**
   - 模型必须放在 `public/models/`，格式为 `.gltf` 或 `.glb`，材质使用 PBR。
   - 现有模型由 `scripts/generate_models.py` 生成；如需重新生成，执行：
     ```bash
     python scripts/generate_models.py
     ```
   - 若使用外部建模软件导出，请保持节点命名与 `textures` / `hotspots` 中的 `node` 一致。
   - 建议模型面数控制在 10 万面以内，单文件小于 2MB。

## 交互与键盘快捷键

| 操作 | 说明 |
| --- | --- |
| 点击封面 / 按 Enter 或空格 | 打开书本 |
| 拖拽中央区域 | 旋转 3D 视角 |
| 滚轮 | 缩放 3D 视角 |
| 点击展品 / 右侧缩略图 | 打开高清图与注解 |
| 目录 | 跳转到任意单元 |
| ← / → | 上一项 / 下一项 |
| Esc | 关闭弹窗或目录 |
| 氛围音 | 开启/关闭由 Web Audio 实时合成的轻柔环境声 |

## 已实现的技术要点

- Three.js WebGL 渲染，GLTFLoader 加载 PBR 模型，统一主光 + 补光 + 接触阴影 + AO 观感。
- 书本封面、左右页堆、书签与页码均为真实 3D 物件；开书时封面绕书脊旋转，另有带顶点弯曲的纸张页面。
- 中央展区使用独立相机与 scissor 视口渲染，与 HTML 三栏布局对齐。
- 场景切换采用「收合 → 换页 → 展开」状态机，并以 CSS 3D 书页翻转作为联动层。
- 点击拾取通过 Three.js Raycaster 与 GLTF 节点名绑定；数据与动画逻辑解耦。
- Web Audio 生成低通噪声与低频 drone，不依赖外部音频文件。

## 浏览器建议

优先支持桌面端 Chrome、Edge、Firefox、Safari 最新版。需要 WebGL 2 与 ES Module 支持。窄屏下会自动降级为单栏中央展示，保证内容仍可浏览。

## 许可与素材说明

项目中的模型、SVG 插画、程序化纹理与代码均作为示例素材随项目提供，可直接用于你的作品集归档；请将示例姓名、邮箱、二维码和作品内容替换为真实信息后再上线。
