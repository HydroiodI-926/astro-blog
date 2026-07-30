---
title: 动态规划-线性dp
published: 2026-07-30
tags:
  - 动态规划
category: 算法笔记
---
只要一个问题同时满足：最优子结构、无后效性、线性递推，就能进行dp。线性dp在定义状态的时候经常考虑某类有序事件中前若干个子时间的答案，因而它的核心特征是状态按线性顺序递推

1. 基础题型
2. 单序列模型
3. 双序列模型
4. 环状序列模型
5. 矩阵路径模型
6. 多维状态模型
# 基础题型
[P1216 数字三角形 Number Triangles - 洛谷](https://www.luogu.com.cn/problem/P1216)
### [B3637 最长上升子序列 - 洛谷](https://www.luogu.com.cn/problem/B3637)
最基础的LIS问题
```cpp
#include <bits/stdc++.h>
using namespace std;
typedef long long ll;

const int N = 51;
const int MAXN = 1e9;

const ll MOD = 998244353;
const ll INF = 4e18;

void solve(){
	int n;
	cin>>n;
	vector<int> arr(n);
	vector<int> dp(n,0);
	for(int i=0;i<n;i++){
		cin>>arr[i];
	}	
	int ans=0;
	for(int i=0;i<n;i++){
		dp[i]=1;
		for(int j=0;j<i;j++){
			if(arr[j]<arr[i]){
				dp[i]=max(dp[i],dp[j]+1);
			}
		}
		ans=max(ans,dp[i]);
	}
	// for(int i=0;i<n;i++){
	// 	ans=max(ans,dp[i]);
	// }
	cout<<ans;
}

int main(){
	ios::sync_with_stdio(0);
	cin.tie(0),cout.tie(0);
	int T=1;
	// cin>>T;
    while(T--){
    	solve();
    }
    // while(scanf("%d,%d",&n,&k)!=EOF){
    	// solve(n,k);
    // }
	return 0;
}
```
上述复杂度为o($n^2$),可以用二分查找优化内层循环使得复杂度变为o($nlogn$)
```cpp
ll n;

void solve() {
	cin>>n;
	vector<int> a(n),b;
	for(int i=0;i<n;i++){
		cin>>a[i];
	}
	for(int i=0;i<n;i++){
		if(b.empty()||b.back()<a[i]){
			b.push_back(a[i]);
		}
		else{
			auto it=lower_bound(b.begin(),b.end(),a[i]);
			*it=a[i];
		}
	}
	cout<<b.size();
}
```
### [P1115 最大子段和 - 洛谷](https://www.luogu.com.cn/problem/P1115)
### [U651833 游戏4 - 洛谷](https://www.luogu.com.cn/problem/U651833)
### 最长公共子序列 LCS
求两个字符串的最长公共子序列长度。
#### 输入格式:
输入长度≤100的两个字符串。
#### 输出格式:
输出两个字符串的最长公共子序列长度。
#### 输入样例1:
```in
ABCBDAB
BDCABA
```
#### 输出样例1:
```out
4
```
#### 输入样例2:
```in
ABACDEF
PGHIK
```
#### 输出样例2:
```out
0
```
#### 解法
```cpp
string a,b;

void solve() {
	cin>>a>>b;
	int n=a.size(),m=b.size();
	vector<vector<int>> dp(n+1,vector<int>(m+1,0));
	vector<vector<int>> pre(n+1,vector<int>(m+1,0));
	for(int i=1;i<=n;i++){
		for(int j=1;j<=m;j++){
			if(a[i-1]==b[j-1]){
				dp[i][j]=dp[i-1][j-1]+1;
			}
			else
			dp[i][j]=max(dp[i-1][j],dp[i][j-1]);
		}
	}
	cout<<dp[n][m];
}
```
# 单序列模型
### [P1091 [NOIP 2004 提高组] 合唱队形 - 洛谷](https://www.luogu.com.cn/problem/P1091)
## 优化
### [P1020 [NOIP 1999 提高组] 导弹拦截 - 洛谷](https://www.luogu.com.cn/problem/P1020)
需要用到二分维护最长不上升子序列来优化，第二小问用到Dilworth定理通过求最长上升子序列来得到最少需要几台机器拦截导弹，用到greater比较器使得lower_bound在递减序列中使用

### [P2008 大朋友的数字 - 洛谷](https://www.luogu.com.cn/problem/P2008)
```cpp
int n;

void solve() {
	cin>>n;
	vector<ll> a(n),dp(n,0),res(n,0);
	for(int i=0;i<n;i++){
		cin>>a[i];
	}
	for(int i=0;i<n;i++){
		dp[i]=1;
		for(int j=0;j<i;j++){
			if(a[j]<=a[i]&&dp[j]>=dp[i]){
				dp[i]=max(dp[i],dp[j]+1);
				res[i]=res[j];
			}
		}
		res[i]+=a[i];
	}
	for(int i=0;i<n;i++){
		cout<<res[i]<<" ";
	}
}
```

# 进阶dp的优化
[P9242 [蓝桥杯 2023 省 B] 接龙数列 - 洛谷](https://www.luogu.com.cn/problem/P9242)
仔细分析和求最长上升子序列差不多，LIS的做法是判断dp\[i]的尾和dp\[j]的头是否相等，如果相等，使用LIS的状态转移方程持续更新dp，但是数据量更大，o($n^2$)会tle，所以需要一定的优化，这里换一种遍历和dp的存储方式（同时也更改了状态转移方程）为什么会超时，就是因为dp存了大量的数据，然后更新dp的时候计算量大，导致超时，这种题注意到以i为尾的更新方式只有10中，如果我的dp表也只记录十种，那么不就大大减少计算量了吗
```cpp
int n;
int ans=0;

void solve() {
	cin>>n;
    vector<string> a(n);
    for(int i=0;i<n;i++){
        cin>>a[i];
    }
    vector<int> dp(10,0);
    for(int i=0;i<n;i++){
        int f=a[i][0]-'0',t=a[i][a[i].size()-1]-'0';
        dp[t]=max(dp[t],dp[f]+1);
    }
    for(int i=0;i<10;i++){
        ans=max(ans,dp[i]);
    }
    cout<<n-ans; // 最后，要求的是最少修改量，因此总数减掉最长的情况即可
}
```

