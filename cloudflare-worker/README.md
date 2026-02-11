# LibreTV Puppeteer Worker 适配器

这个模块允许 LibreTV 采集动态渲染（JavaScript 渲染）的影视站点。

## 部署步骤

1. **环境准备**：
   确保你本地安装了 Node.js。

2. **安装依赖**：
   在当前目录下运行：
   ```bash
   npm install
   ```

3. **登录 Cloudflare**：
   ```bash
   npx wrangler login
   ```

4. **开启服务**：
   去 Cloudflare 控制台 -> **Workers & Pages** -> **Browser Rendering** 确保已点击 **Enable**。

5. **部署**：
   ```bash
   npx wrangler deploy
   ```

## 如何在 LibreTV 中使用

部署成功后，你会得到一个 URL（如 `https://libretv-puppeteer-adapter.yourname.workers.dev`）。

在 LibreTV 的设置项中添加自定义源：

- **搜索示例 (IYF)**:
  `[WorkerURL]?type=web&render=1&target=https://www.iyf.tv/search/{wd}`

- **详情示例 (IYF)**:
  `[WorkerURL]?type=web&render=1&target=https://www.iyf.tv/play/{id}`

## 参数说明

- `type`: `web` (网页解析) 或 `api` (JSON接口处理)。
- `render`: `1` (使用 Puppeteer 自动化渲染) 或 `0` (普通 fetch)。
- `target`: 目标地址，支持 `{wd}` 和 `{id}` 占位符。
