---
title: C++lambda表达式/匿名函数
published: 2026-08-02
tags:
  - CPP
  - 语法笔记
category: 算法笔记
---
## 核心难点

Lambda 想递归调用自己，但**定义时自己还不存在** → 需要借助参数传入 `self`

## 推荐写法：Y-combinator 风格

```cpp
// 写法1：最简洁，C++17 起
auto dfs = [&](auto&& self, int u, int fa) -> void {
    for (int v : g[u]) {
        if (v == fa) continue;
        self(self, v, u);   // 传自己进去
    }
};
dfs(dfs, 1, 0);  // 调用时也要传自己
```

`auto&& self` 接收 lambda 自身的引用，然后递归时 `self(self, ...)` 传进去 (..•˘_˘•..)

## 写法2：用 std::function 包装（更直观但略慢）

```cpp
#include <functional>
std::function<void(int, int)> dfs = [&](int u, int fa) {
    for (int v : g[u]) {
        if (v == fa) continue;
        dfs(v, u);          // 直接用名字调用，和普通函数一样
    }
};
dfs(1, 0);
```

优点是调用时不用传 `self`，但 `std::function` 有额外开销（堆分配+虚调用），竞赛中 TLE 敏感的题慎用喵 (๑•̀ㅂ•́) ✧

## 写法3：用模板包装器（零开销，工程首选）

```cpp
// C++20 auto 可以简写，C++17 用这个
template<class F>
struct YCombinator {
    F f;
    template<class... Args>
    decltype(auto) operator()(Args&&... args) {
        return f(*this, std::forward<Args>(args)...);
    }
};

// 使用
auto dfs = YCombinator{[&](auto& self, int u, int fa) -> void {
    for (int v : g[u]) {
        if (v == fa) continue;
        self(v, u);       // 不用传 self 了！
    }
}};
dfs(1, 0);
```

## 三种写法对比

| 写法 | 性能 | 代码量 | 适用场景 |
|------|------|--------|---------|
| `self(self, ...)` | ⚡ 零开销 | 最少 | **竞赛首选** |
| `std::function` | 🐢 有开销 | 少 | 要求可读性、不卡时间 |
| YCombinator 包装 | ⚡ 零开销 | 多（需预定义模板） | 工程/多次复用 |

## 竞赛模板推荐 

直接记住这个就行喵：

```cpp
auto dfs = [&](auto&& self, int u, int fa) -> void {
    // ...
    for (int v : g[u])
        if (v != fa) self(self, v, u);
};
dfs(dfs, 1, 0);
```

> **唯一注意点**：调用时别忘了 `dfs(dfs, 1, 0)` 的第一个参数是 `dfs` 自己喵～ 忘了就编译报错，不会悄悄出 bug，这点很安全 ฅ'ω'ฅ