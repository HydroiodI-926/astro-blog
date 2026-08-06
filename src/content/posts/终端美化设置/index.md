---
title: vsc/Linux终端个性化设置
published: 2026-08-06
tags:
  - vscode
  - Linux
category: 美化设置
---
# 引入
常规的vscode连接Linux的虚拟机或者连接wsl的终端只有一种颜色，指令操作的时候往往没有什么辨识度，费眼睛，所以需要做一些设置使得终端的字体颜色更多样化，分为vscode编译器端的设置和Linux端的设置
# vscode编译器端的设置
vscode端的设置只会美化vscode上的终端显示，在其他地方连接虚拟机或者wsl的终端都不会有变化。
### 步骤
1. 按ctrl+shift+p或者在顶部搜索栏打“>”随后在搜索栏搜索并打开`Preferences: Open User Settings(JSON)`
2. 在配置文件中的**第一层大括号**里面追加设置选择填入所需的以下设置
```txt
"workbench.colorCustomizations": {
	"terminal.background": "#101418",
	"terminal.foreground": "#D8DEE9",
	"terminal.selectionForeground": "#000000",
	"terminal.selectionBackground": "#FFFFFF",
	"terminal.ansiRed": "#BF616A",
	"terminal.ansiGreen": "#A3BE8C",
	"terminal.ansiYellow": "#EBCB8B",
	"terminal.ansiBlue": "#81A1C1",
	"terminal.ansiMagenta": "#B48EAD",
	"terminal.ansiCyan": "#88C0D0",
	"terminal.ansiWhite": "#E5E9F0"
}
```
冒号左边是配置项，右边的颜色编号，配置项一览

| 配置项                            | 作用          |
| ------------------------------ | ----------- |
| `terminal.background`          | 终端背景颜色      |
| `terminal.foreground`          | 终端默认文字颜色    |
| `terminal.ansiBlack`           | ANSI 黑色     |
| `terminal.ansiRed`             | ANSI 红色     |
| `terminal.ansiGreen`           | ANSI 绿色     |
| `terminal.ansiYellow`          | ANSI 黄色     |
| `terminal.ansiBlue`            | ANSI 蓝色     |
| `terminal.ansiMagenta`         | ANSI 洋红色、紫色 |
| `terminal.ansiCyan`            | ANSI 青色     |
| `terminal.ansiWhite`           | ANSI 白色     |
| `terminal.selectionForeground` | 鼠标选中区域的文字颜色 |
| `terminal.selectionBackground` | 鼠标选中区域的背景颜色 |
3. （可选）设置ctrl+鼠标滚轮调节字体大小。按ctrl+shift+p或者在顶部搜索栏打“>”随后在搜索栏搜索并打开`Preferences: Open User Settings`在设置中搜索
4. 保存退出
之后终端设置就能生效了，不行的话就重启vscode
# Linux端的设置
Linux端可以配置更详细的一些内容，并且配置完后在任意可以连接上该Linux发布版的终端都能生效。在vscode的终端上，相关配置如果和vscode的终端设置的重叠并且有设置，那么默认采取Linux的设置，如果设置的是默认（没有设置）则采取vscode的设置
### 步骤
1. 连接登录虚拟机或者是wsl（vscode安装ssh remote插件即可链接，详细教程之后再上传）
2. 打开`~/.bashrc`底部写上配置
```bash
PS1='\[\e[1;33m\]\u\[\e[0m\]@\[\e[1;36m\]\h\[\e[0m\]:\[\e[1;35m\]\w\[\e[0m\]\[\e[1;31m\]\$\[\e[0m\] '
```
3. （可选）（强烈推荐，之后的设置也是基于这个步骤）安装`ble.sh`插件，这款插件可以设置指令块的颜色，并且还有命令辅助填写功能，下载命令如下：
```bash
curl -L https://github.com/akinomyoga/ble.sh/releases/download/nightly/ble-nightly.tar.xz | tar xJf -

bash ble-nightly/ble.sh --install ~/.local/share

echo 'source -- ~/.local/share/blesh/ble.sh' >> ~/.bashrc

source ~/.bashrc

rm -rf ble-nightly # 删除安装目录，可选

```

4. 打开`~/.blerc`写上配置保存
```bash
# 普通参数，例如 hdfs 后面的 dfs
ble-face syntax_default='fg=yellow'

# 外部命令，例如 hdfs、ls、grep
ble-face command_file='fg=green,bold'

# Bash 内置命令，例如 cd、echo、source
ble-face command_builtin='fg=red,bold'

# 以 - 或 -- 开头的选项，例如 -mkdir、-p
ble-face argument_option='fg=cyan,bold'

# 引号中的字符串
ble-face syntax_quoted='fg=magenta'

# 变量名
ble-face syntax_varname='fg=208,bold'

# 注释
ble-face syntax_comment='fg=244'

# 路径中的目录
ble-face filename_directory='fg=blue,underline'

# 不存在或错误的命令
ble-face syntax_error='fg=white,bg=red'

```

5. 如果做了3和4步骤，打开`~/.bashrc`，追加
```bash
if [[ $- == *i* ]]; then
    source -- ~/.local/share/blesh/ble.sh
fi
```
然后
```bash
source ~/.bashrc
```
随后就能看到效果了

--- end ---

