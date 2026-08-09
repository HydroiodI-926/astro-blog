---
title: 动态规划-区间dp
published: 2026-08-09
tags:
  - 动态规划
category: 算法笔记
description: 大范围的问题拆分成若干小范围的问题来求解
---
可能性展开的常见方式
1. 基于两侧端点讨论的可能性展开
2. 基于范围上划分点的可能性展开

# 例题
## [1312. 让字符串成为回文串的最少插入次数](https://leetcode.cn/problems/minimum-insertion-steps-to-make-a-string-palindrome/)
### 回文串分析
-  a       最基本的回文串 长度为一
-  aa     最基本的回文串 长度为二
-  aba   
-  abba

以上回文串解释了回文串的构成。当回文串的长度为奇数时，长度为1肯定是回文的，长度n大于1时，中心点为$n/2$（向下取整，下标从0开始）左右分布对应字符串对应相等如aba；当回文串为偶数时，长度为2时，左边起点定义为l，右边起点定义为r，l+1=r，长度大于2时，左边起点定义为l，右边起点定义为r，$$s[l+i]=s[r-i],\qquad

0\le i<\left\lfloor\frac{r-l+1}{2}\right\rfloor$$如abba
### 变成回文串的最小开销
- bca ->bcacb / acbca        2
- bcab -> bcacb / bacab    1

基于以上分析，发现变成回文串的诀窍在于补充对应位置上的字符，并且发现利用中心的特性可以少用一个开销（虽然说用不上）并且存在某种意义上的对称性，从最左边l最右边r开始扫描，如果对应，则l++，r--，如果不对应，有两种尝试方式：
- 补充左边对应位置的字符，逻辑上说就是r+1上补充l位置的字符，那么l解决了问题l++，r没有对称，不变r
- 同理补右边，l，r--

那么就存在了递归的可能性，可以通过记忆化搜索解决这个问题
```cpp
int dfs(string s,int l,int r){ // 基于以上分析写的暴力
	if(l==r){  // a
		return 0;
	}
	if(l+1==r){ // aa
		return s[l]==s[r]?0:1;
	} 
	if(s[l]==s[r]){ // 相等情况下 
		return dfs(s,l+1,r-1);
	}
	else{  // 不相等 
		return min(dfs(s,l,r-1),dfs(s,l+1,r))+1;
	}
}
```
### 记忆化搜索解
```cpp
int minInsertions(string s) {
	int n=s.size();
	vector<vector<int>> dp(n,vector<int>(n,-1));
	auto mems = [&](auto&& self,int l,int r)->int{
		if(dp[l][r]!=-1) return dp[l][r];
		int ans;
		if(l==r){
			ans=0;
		}
		else if(l+1==r){
			ans=(s[l]==s[r]?0:1);
		}
		else{
			if(s[l]==s[r]){
				ans=self(self,l+1,r-1);
			}
			else{
				ans=min(self(self,l+1,r),self(self,l,r-1))+1;
			}
		}
		dp[l][r]=ans;
		return ans;
	};
	
	return mems(mems,0,n-1);
}
```
### 递推解
根据刚刚的分析，我们会先聚焦到某一个单独的字符或者两个字符。边界值就是单个字符和两个字符的情况，单个字符的代价一定为0，两个字符相等为0，不相等为1，然后其他情况开始判断是否$s[l]==s[r]$是的话，说明对应位置是相等的，代价为0，那么这个位置的答案就等于他的里面字串的情况就是$dp[l+1][r-1]$；不是的话，那么他需要选择上述两种尝试方式的代价其中一个，代价都是1，选择第一个方式，那么就是选择$dp[l+1][r]$，如果选择第二种方式，那么就是选择$dp[l][r-1]$。（解释见补充）为了使答案最小，那么选择的是两种方式中小的那个情况，整理一下就是$min(dp[l+1][r],dp[l][r-1])+1$。那么整个dp表纵坐标可以表示l，横坐标可以表示r，那么遍历顺序就是r从0到n-1,l从r到0的双层循环
因此dp状态
$$dp[l][r]=\text{将子串 }s[l..r]\text{ 变成回文串所需的最少插入次数}$$
结果从l到r，也就是从0到n-1就是$dp[0][n-1]$
状态转移方程如下：

$$dp[l][r]= \begin{cases} 0,&l=r\\ 0,&r=l+1\text{ 且 }s[l]=s[r]\\ 1,&r=l+1\text{ 且 }s[l]\ne s[r]\\ dp[l+1][r-1],&s[l]=s[r]\\ \min(dp[l+1][r],dp[l][r-1])+1,&s[l]\ne s[r] \end{cases} $$

```cpp
int minInsertions(string s) {
	int n=s.size();
	vector<vector<int>> dp(n,vector<int>(n,-1));
	for(int r=0;r<n;r++){
		for(int l=r;l>=0;l--){
			if(l==r) dp[l][r]=0;
			else if(r-l==1){
				dp[l][r]=s[l]==s[r]?0:1;
			}
			else{
				if(s[l]==s[r]) dp[l][r]=dp[l+1][r-1];
				else dp[l][r]=min(dp[l+1][r],dp[l][r-1])+1;
			}
		}
	} 
	return dp[0][n-1];
}
```
#### 补充
虽然不理解不影响过题，但是还是补充一下为什么：

这里的 $dp[l][r]$ 表示将**原字符串的子串** $s[l\dots r]$ 变成回文串所需的最少插入次数。DP 下标只记录原字符串的区间，后来插入的字符只会产生 $1$ 的代价，不会进入新的 DP 状态。

当 $s[l]\ne s[r]$ 时，两个原端点无法直接配对，因此有两种选择：

1. **在右侧插入 $s[l]$**

   结构变为：

   $$
   \underbrace{s[l]}_{\text{原左端}}\quad
   \underbrace{s[l+1]\dots s[r]}_{\text{剩余的原子串}}\quad
   \underbrace{s[l]}_{\text{新插入}}
   $$

   原来的左端点 $s[l]$ 和新插入的 $s[l]$ 已经形成一对回文字符。去掉这对已经解决的字符后，剩下的原字符串区间是 $[l+1,r]$，所以这种选择的代价为：

   $$
   dp[l+1][r]+1
   $$

2. **在左侧插入 $s[r]$**

   结构变为：

   $$
   \underbrace{s[r]}_{\text{新插入}}\quad
   \underbrace{s[l]\dots s[r-1]}_{\text{剩余的原子串}}\quad
   \underbrace{s[r]}_{\text{原右端}}
   $$

   新插入的 $s[r]$ 和原来的右端点 $s[r]$ 已经形成一对回文字符。去掉这对已经解决的字符后，剩下的原字符串区间是 $[l,r-1]$，所以这种选择的代价为：

   $$
   dp[l][r-1]+1
   $$

为了使插入次数最少，在两种选择中取最小值：

$$
dp[l][r]=\min(dp[l+1][r],dp[l][r-1])+1
$$

可以记成：**在右边插入左端字符，就解决原左端点；在左边插入右端字符，就解决原右端点。**
