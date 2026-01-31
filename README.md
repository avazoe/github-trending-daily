# GitHub Trending Daily

自动获取 GitHub Trending 并发送每日邮件总结。

## 功能

- 每天自动抓取 GitHub Trending 热门项目
- 使用 Claude AI 生成中文总结和点评
- 通过 Resend 发送精美 HTML 邮件到你的邮箱

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# 智谱AI API Key（兼容 Anthropic API）
ANTHROPIC_API_KEY=你的智谱API Key

# API 地址（可选，默认为智谱AI兼容接口）
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic

# 模型名称（可选，默认为 glm-4.7）
MODEL=glm-4.7

# Resend API Key（用于发送邮件）
RESEND_API_KEY=re_xxx

# 接收邮箱
RECIPIENT_EMAIL=your-email@example.com

# 发件邮箱（需要在 Resend 验证域名）
FROM_EMAIL=noreply@yourdomain.com
```

### 3. 本地运行

```bash
npm start
```

## 部署到 GitHub Actions

### 1. 创建 GitHub 仓库并推送代码

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/github-trending-daily.git
git push -u origin main
```

### 2. 配置 GitHub Secrets

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 说明 | 获取方式 |
|------------|------|----------|
| `ANTHROPIC_API_KEY` | 智谱AI API Key | [open.bigmodel.cn](https://open.bigmodel.cn/) |
| `ANTHROPIC_BASE_URL` | API 地址 | `https://open.bigmodel.cn/api/anthropic` |
| `MODEL` | 模型名称 | `glm-4.7` |
| `RESEND_API_KEY` | Resend API Key | [resend.com](https://resend.com/api-keys) |
| `RECIPIENT_EMAIL` | 接收邮箱 | 你的邮箱地址 |
| `FROM_EMAIL` | 发件邮箱 | Resend 中验证的域名邮箱 |

### 3. 启用 GitHub Actions

推送代码后，GitHub Actions 会自动运行。
- 默认每天 UTC 00:00（北京时间 08:00）运行
- 也可以在 Actions 页面手动触发

## 配置说明

### 修改抓取语言

编辑 `index.js` 中的 `CONFIG`：

```javascript
language: 'python',  // 指定语言，空字符串表示所有语言
since: 'daily',      // daily, weekly, monthly
```

### 修改发送时间

编辑 `.github/workflows/daily-trending.yml` 中的 cron 表达式：

```yaml
cron: '0 0 * * *'  # UTC 时间，每天 00:00
```

### Resend 域名验证

1. 注册 [Resend](https://resend.com/)
2. 在 Dashboard → Domains 添加你的域名
3. 添加 DNS 记录验证域名
4. 使用验证后的域名邮箱发件

## API 密钥获取

### 智谱AI API Key

1. 访问 [open.bigmodel.cn](https://open.bigmodel.cn/)
2. 注册/登录后进入 API Keys 页面
3. 创建新的 API Key
4. 记下密钥

### Resend API Key

1. 访问 [resend.com](https://resend.com/)
2. 注册并登录
3. 进入 API Keys 页面
4. 创建新的 API Key

## 本地开发

```bash
# 安装依赖
npm install

# 运行
npm start

# 或者设置环境变量后运行
ANTHROPIC_API_KEY=xxx RESEND_API_KEY=xxx RECIPIENT_EMAIL=xxx npm start
```

## 许可证

MIT
