# 缪斯酒馆 (Muse Tavern) - 本地运行指南

这是一个基于 React + Vite + Express + SQLite + Tailwind CSS 构建的全栈应用。
要在您的本地电脑上运行这个项目，请按照以下步骤操作：

## 环境要求

1. **Node.js**: 请确保您的电脑上安装了 Node.js (建议版本 v18 或更高)。
   - 您可以在终端中运行 `node -v` 来检查是否已安装。
   - 如果未安装，请前往 [Node.js 官网](https://nodejs.org/) 下载并安装。

## 步骤 1：下载项目代码

将项目的所有文件下载或克隆到您的本地电脑上的一个文件夹中。

## 步骤 2：安装依赖

打开终端（或命令行工具），进入到您存放项目代码的文件夹，然后运行以下命令来安装所有需要的依赖包：

```bash
npm install
```

## 步骤 3：配置环境变量(可选)

1. 在项目的根目录下，找到 `.env.example` 文件。
2. 复制该文件并重命名为 `.env`。
3. 打开 `.env` 文件，填入您的 Gemini API Key：

```env
GEMINI_API_KEY="您的_GEMINI_API_KEY"
```
*(如果您还没有 Gemini API Key，可以前往 Google AI Studio 申请一个免费的 Key)*

## 步骤 4：启动项目

在终端中运行以下命令启动开发服务器：

```bash
npm run dev
```

启动成功后，终端会显示类似以下的提示：
```
Server running on http://localhost:3000
```

## 步骤 5：访问应用

打开您的浏览器，访问 `http://localhost:3000`，即可开始使用“缪斯酒馆”！

---

### 关于数据库

本项目已经移除了所有 C++ 依赖（如 `better-sqlite3`），现在是一个**纯 JavaScript** 项目，无需任何复杂的编译环境，占用内存和磁盘空间极小。

当您第一次运行项目并进行操作（如创建作品）时，它会自动在项目根目录下生成一个名为 `muse_tavern_data.json` 的文件。您的所有数据都会保存在这个 JSON 文件中。如果您想重置数据，只需删除该文件即可。
