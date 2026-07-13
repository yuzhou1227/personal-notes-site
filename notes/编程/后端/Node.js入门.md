# Node.js 入门

Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时。

## 安装

从 https://nodejs.org 下载 LTS 版本安装。

## 第一个程序

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.end('Hello World');
});

server.listen(3000);
```

## npm 常用命令

- `npm init` 初始化项目
- `npm install <包名>` 安装依赖
- `npm run <脚本>` 运行脚本
