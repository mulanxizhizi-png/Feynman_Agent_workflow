# 跨项目安装与调用

完整克隆本仓库。费曼 Agent 入口依赖仓库内的协议和离线工具，不要只复制 SKILL.md。

```sh
git clone https://github.com/mulanxizhizi-png/sol-gemini-workflow.git
cd sol-gemini-workflow
node bin/workflow.mjs help
npm run validate
```

## 用户级入口

将用户技能目录中的 `feynman-agent` 链接到此仓库的 `.agents/skills/feynman-agent`。先检查同名入口：不存在时新建；已存在时保留并核对其指向，不自动覆盖其他安装。

macOS / Linux，在仓库根目录执行：

```sh
mkdir -p "$HOME/.agents/skills"
ln -s "$PWD/.agents/skills/feynman-agent" "$HOME/.agents/skills/feynman-agent"
```

Windows PowerShell，在仓库根目录执行（目录联接适用于本地文件系统）：

```powershell
New-Item -ItemType Directory -Force -Path "$HOME/.agents/skills" | Out-Null
New-Item -ItemType Junction -Path "$HOME/.agents/skills/feynman-agent" -Target "$PWD/.agents/skills/feynman-agent"
```

安装后检查技能列表中是否出现“费曼 Agent”；未出现时重启 Codex 后再检查。入口读取时先解析真实路径，按真实目录定位完整工作流。保留克隆目录，移动后须重新建立链接。

## 如何使用

新会话选择 GPT-6.1 Sol / high，说明目标项目和任务：

```text
启动费曼 Agent，帮我完成当前项目的……
```

“开启／执行／调用／使用费曼agent”与之同义，允许空格和大小写变体。明确调用备用形式：

```text
$feynman-agent
目标项目：<项目绝对路径>
任务：<实际要求>
```

主会话统筹，执行子 Agent 为 GPT-6 Sol / low，独立审核子 Agent 为 GPT-6.1 Sol / high。技能声明不是模型切换开关；宿主必须正确委派并检查实际能力。缺少对应模型时说明限制，不静默继承后声称符合配置。

用户级技能可服务同一用户环境中的不同项目、聊天、侧栏分组和磁盘目录；实际文件访问仍受权限限制。不同电脑、系统账号、远程或云主机需要分别安装。技能发现并不共享项目上下文，首次审核仅使用当前任务中性材料，不读取其他项目历史报告或本机偏好记忆。

## 更新与检查

在克隆目录运行 `git pull --ff-only`，再运行 `npm run validate`。更新前保留自己的改动；不要用强制重置覆盖本地配置。仓库不包含个人定位文件、全局 AGENTS.md、记忆或运行报告，也不自动安装模型配置或调用外部服务。
