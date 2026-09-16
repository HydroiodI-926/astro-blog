---
title: uv-py包管理工具的使用
published: 2026-09-16
tags:
  - python
  - 包管理
category: 开发笔记
---
# [官网地址](https://docs.astral.sh/uv/)

# 1. 隔离uv与conda环境/创建单独的uv管理环境
最好效果是：
```
D:\
├─ PythonEnvs\
│  ├─ uv\
│  │  ├─ sklearn
│  │  └─ pytorch
│  │
│  └─ conda\
│     ├─ bio
│     └─ cuda
│
├─ PythonCache\
│  ├─ uv
│  └─ conda
│
└─ Projects\
```

# 2. 设置uv的缓存环境
尽量与nv的虚拟环境配置在一起
```
E:\PythonEnv\uv\
├─ envs\
│  ├─ ml
│  └─ dl
│
└─ cache\
```
或者
```
E:\PythonEnv\uv\
├─ ml
├─ dl
└─ cache
```
譬如在以上基础上，创建cache目录，将其设为uv的缓存目录
```bat
setx UV_CACHE_DIR "E:\PythonEnv\uv\cache"
```
重新开一个窗口验证
```bat
uv cache dir
```
返回以下结果:
```
E:\PythonEnv\uv\cache
```
则成功

# 3.创建虚拟环境

```bat
uv venv %安装目录% --python %具体版本%
```

---持续更新---
