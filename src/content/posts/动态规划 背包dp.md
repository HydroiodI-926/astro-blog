---
title: 动态规划-背包dp
published: 2026-07-28
tags:
  - 动态规划
  - 背包dp
category: 算法笔记
---

背包dp是一个动规问题的模板
对于有多个物品可选，但又有一定限制，求某种最优情况
根据限制的不同，可归为以下问题
- 01背包  每件物品只有一个，也就是只有选和不选两种状态
- 多重背包  每件物品只有an个（有限个），可以选择的次数是有限的
- 完全背包  每件物品可以无限次选择
- 分组背包  物品分组，一组内的物品只能选一次，不同组之间的物品不影响

# 01背包
## 例题
给定n(n<=100)种物品和一个背包。物品i的重量是wi(wi<=100)，价值为vi(vi<=100)，背包的容量为C(C<=1000)。  
应如何选择装入背包中的物品，使得装入背包中物品的总价值最大? 在选择装入背包的物品时，对每种物品i只有两个选择：装入或不装入。不能将物品i装入多次，也不能只装入部分物品i。
###### 输入格式:
本题目有多个测试样例
共有n+2行输入：
第一行T表示测试样例个数；
第二行为n值和c值，表示n件物品和背包容量c；  
接下来的n行，每行有两个数据，分别表示第i(1≤i≤n)件物品的重量和价值。
###### 输出格式:
每一行输出对应样例的装入背包中物品的最大总价值。
###### 输入样例:
```in
2
5 10
2 6
2 3
6 5
5 4
4 6
4 7
1 2
2 4
3 4
4 5
```
###### 输出样例:
```out
15
11
```
#### 解法

每隔物品只有两种状态选择或者不选择，可以用记忆化数组来解决，用dp的做法，可以想象一个二维数组，纵坐标代表前i个物品，最多为n个，横坐标代表前j个容量，最多c个
依次填入数据，每次填入有两种决策：
- if 当前物品<=当前容量 选择该物品放入背包比较与上一行数据相比取最大
- 不放入，继承上一行数据
可以发现当前容量只与上一行数据有关，因此可得到以下代码
```cpp
int n,c;

void solve() {
    cin>>n>>c;
    vector<vector<int>> dp(n+1,vector<int>(c+1,0));
    vector<int> wi(n+1,0);
    vector<int> vi(n+1,0);
    for(int i=1;i<=n;i++){
    	cin>>wi[i]>>vi[i];
    }
    for(int i=1;i<=n;i++){
    	for(int j=1;j<=c;j++){
    		if(wi[i]<=j){
    			dp[i][j]=max(dp[i-1][j],dp[i-1][j-wi[i]]+vi[i]);
    		}
    		else{
    			dp[i][j]=dp[i-1][j];
    		}
    	}
    }
    cout<<dp[n][c]<<'\n';
}
```
但是，当数据量增大的时候，用二维数组做记忆化会有爆内存(mle)的风险，因此改为滚动数组数组循环迭代，用两个一维数组(也就是当前情况和上一行的情况)不断更新，这样会大大减少内存占用
```cpp
// 滚动数组版本
int n,c;
void solve() {
    cin>>n>>c;
    vector<int> dp(c+1,0);
    vector<int> wi(n+1,0);
    vector<int> vi(n+1,0);
    for(int i=1;i<=n;i++){
    	cin>>wi[i]>>vi[i];
    }
    for(int i=1;i<=n;i++){
    	vector<int> cur(c+1,0);
    	for(int j=1;j<=c;j++){
    		if(wi[i]<=j){
    			cur[j]=max(dp[j],dp[j-wi[i]]+vi[i]);
    		}
    		else{
    			cur[j]=dp[j];
    		}
    	}
    	dp=cur;
    }
    cout<<dp[c]<<'\n';
}
```
此外如果逆向维护dp数组甚至可以优化掉一个数组
```cpp
int n,c;
void solve() {
    cin>>n>>c;
    vector<int> dp(c+1,0);
    for(int i=1;i<=n;i++){
    	int w,v;
    	cin>>w>>v;
    	for(int j=c;j>=w;j--){
    		dp[j]=max(dp[j],dp[j-w]+v);
    	}
    }
    cout<<dp[c]<<'\n';
}
```
三种方法各有优劣，按需使用，必要时做适当修改
## 真实的背包故事
0-1背包问题是经典的动态规划问题，这个问题大多用这样的故事开场：一个小偷溜进了一家博物馆，博物馆里排列着N件珍稀古董，每件古董都有重量和价值，而小偷带来的背包有重量限制W。因此，小偷的目的就是要选择部分古董，使其总重量不超过W且总价值最大。这故事听上去就像小偷在逛超市一样能轻松自如地挑选，而真实的情况是小偷提心吊胆，尤其是每拿下一件古董，随时都有触动警报的危险，所以小偷想尽可能少带几件古董立马跑路，但他的职业“素养”又不允许他不把背包装满。你能帮他解决这个困境吗？
#### 输入格式:
第一行中给出2个整数值N和W, 其中1<N≤100表示古董的数量，1<W≤2000表示背包的重量限制。  
接下来N行数据，每行两个正整数。第i行（1≤i≤N)的整数vi​和wi​分别表示第i件古董的价值和重量。  
vi​和wi​的值均不超过2000。
#### 输出格式:
在一行中输出两个整数值，用空格分开。第一个整数表示装背包能获得的最大总价值，第二个整数表示在获得最大价值的条件下装入背包里的古董的最少数量。
#### 输入样例:
```in
6 6
1 1
2 2
3 3
4 4
5 5
6 6
```
#### 输出样例:
```out
6 1
```
#### 解题代码
```cpp
int n,c;

void solve() {
    cin>>n>>c;
    vector<int> dpw(c+1,0);
    vector<int> dpn(c+1,0);
    for(int i=1;i<=n;i++){
    	int w,v;cin>>w>>v;
    	for(int j=c;j>=v;j--){
    		if(dpw[j-v]+w>dpw[j]||(dpw[j-v]+w==dpw[j]&&dpn[j-v]+1<dpn[j])){
    			dpw[j]=dpw[j-v]+w;
    			dpn[j]=dpn[j-v]+1;
    		}
    	}
    }
    cout<<dpw[c]<<" "<<dpn[c];
}
```

## 其他例题
### [P1049 \[NOIP 2001 普及组\] 装箱问题 - 洛谷](https://www.luogu.com.cn/problem/P1049)

### [P1164 小 A 点菜 - 洛谷](https://www.luogu.com.cn/problem/P1164)
01背包算方案数
### [二维01背包](https://leetcode.cn/problems/ones-and-zeroes/description/)
多了一层限制，就用二维数组做背包
```cpp
int findMaxForm(vector<string>& strs, int m, int n) {
    vector<int> w0,w1;
    for(auto s:strs){
    	int u0=0,u1=0;
    	for(char c:s){
    		if(c=='0') u0++;
    		else u1++;
		}
		w0.push_back(u0);
		w1.push_back(u1);
	}
	int l=strs.size();
	vector<vector<int>> dp(m+1,vector<int>(n+1,0));
	for(int i=0;i<l;i++){
		for(int j=m;j>=0;j--){
			for(int k=n;k>=0;k--){
				if(j>=w0[i]&&k>=w1[i]){
					dp[j][k]=max(dp[j][k],dp[j-w0[i]][k-w1[i]]+1);
				}
			}
		}
	}
	return dp[m][n];
}
```
### [879. 盈利计划](https://leetcode.cn/problems/profitable-schemes/)
记忆化搜索解
```cpp
int dp[105][105][105];
int mod = 1e9+7;
int profitableSchemes(int n, int m, vector<int>& g, vector<int>& p) {
	int l=g.size();
	memset(dp,-1,sizeof(dp));
	auto mems = [&](auto&& self,int i,int j,int k)->int{
		if(j<=0) return k<=0?1:0;
		if(i==l) return k<=0?1:0;
		if(dp[i][j][k]!=-1) return dp[i][j][k];
		if(j>=g[i]){
			dp[i][j][k]=(self(self,i+1,j,k)+self(self,i+1,j-g[i],max(0,k-p[i])))%mod;	
		}
		else{
			dp[i][j][k]=self(self,i+1,j,k)%mod;
		}
		return dp[i][j][k]%mod;
	};
	return mems(mems,0,n,m);
}
```
# 完全背包
## [B2174 完全背包 - 洛谷](https://www.luogu.com.cn/problem/B2174)
## [P1616 疯狂的采药 - 洛谷](https://www.luogu.com.cn/problem/P1616)
```cpp
#include <bits/stdc++.h>
using namespace std;
typedef long long ll;


const int N = 51;
const int MAXN = 1e9;

const ll MOD = 1e9+7;
const ll INF = 4e18;


struct drag{
	ll t,w;
};
int n,m,ans;

void solve() {
    cin>>n>>m;
	vector<drag> arr(m+1,{0,0});
	vector<ll> dp(n+1,0);
	for(int i=1;i<=m;i++){
		cin>>arr[i].t>>arr[i].w;
	}
	for(int i=1;i<=m;i++){
		for(int j=1;j<=n;j++){
			if(arr[i].t<=j){
				dp[j]=max(dp[j],dp[j-arr[i].t]+arr[i].w);
			}
		}
	}
	cout<<dp[n];
}

int main(){
	ios::sync_with_stdio(0);
	cin.tie(0),cout.tie(0);
	int T=1;
	// cin>>T;
    while(T--){
    	solve();
    }
	return 0;
}

```
# 多重背包
## [B2173 多重背包 - 洛谷](https://www.luogu.com.cn/problem/B2173)
在数据量不大的情况下可以看成c重01背包 朴素算法
```cpp
int n,v;

void solve(){
	cin>>n>>v;
	vector<int> a(n),b(n),c(n);
	vector<ll> dp(v+1,0);
	ll w=0;
	for(int i=0;i<n;i++){
		cin>>a[i]>>b[i]>>c[i];
	}
	for(int i=0;i<n;i++){
		for(int k=0;k<c[i];k++)
		for(int j=v;j>=a[i];j--){
			dp[j]=max(dp[j],dp[j-a[i]]+b[i]);
			w=max(w,dp[j]);
		}
	}
	cout<<w;
}
```
## [P1776 宝物筛选 - 洛谷](https://www.luogu.com.cn/problem/P1776)
但是数据量增大后上述写法效率不高，此时可以使用二进制优化个数
```cpp
int n,v;
void solve(){
	cin>>n>>v;
	vector<int> a,b;
	vector<ll> dp(v+1,0);
	ll va,w,m;
	for(int i=0;i<n;i++){
		cin>>va>>w>>m;
		for(int k=1;k<=m;k<<=1){
			a.push_back(va*k);
			b.push_back(w*k);
			m-=k;
		}
		if(m){
			a.push_back(va*m);
			b.push_back(w*m);
		}
	}
	int len=a.size();
	for(int i=0;i<=len;i++){
		for(int j=v;j>=b[i];j--){
			dp[j]=max(dp[j],dp[j-b[i]]+a[i]);
		}
	}
	cout<<dp[v];
}
```

## [P10973 Coins - 洛谷](https://www.luogu.com.cn/problem/P10973)
```cpp
int n,m;
vector<int> a,c,dp;
vector<pair<int,int>> b;

void solve(int n,int m){
	a.resize(n);
	c.resize(n);
	dp.assign(m+1,0);
	b.clear();
	for(int i=0;i<n;i++){
		cin>>a[i];
	}
	for(int i=0;i<n;i++){
		cin>>c[i];
	}
	for(int i=0;i<n;i++){
		for(int j=1;j<=c[i];j<<=1){
			b.push_back({a[i]*j,j});
			c[i]-=j;
		}
		if(c[i]){
			b.push_back({a[i]*c[i],c[i]});
		}
	}
	int len=b.size(),res=0;
	for(int i=0;i<len;i++){
		for(int j=m;j>=b[i].first;j--){
			if(dp[j]<j){
				dp[j]=max(dp[j],dp[j-b[i].first]+b[i].first);
				if(dp[j]==j&&j>0) {
					res++;
				}
			}
			
		}
	}
	cout<<res<<"\n";
}
```
# 分组背包
## [P1757 通天之分组背包 - 洛谷](https://www.luogu.com.cn/problem/P1757)
```cpp
int n,m;
vector<int> ag[101],bg[101];
unordered_map<int,int> idx;

void solve(){
	cin>>m>>n;
	int a,b,c,tar,g=0;
	for(int i=0;i<n;i++){
		cin>>a>>b>>c;
		if(idx.count(c)==0){
			tar=idx[c]=++g;			
		}
		else{
			tar=idx[c];
		}
		ag[tar].push_back(a);
		bg[tar].push_back(b);
	}
	vector<vector<ll>> dp(g+1,vector<ll>(m+1));
	for(int i=1;i<=g;i++){
		for(int j=0;j<=m;j++){
			dp[i][j]=dp[i-1][j];
			int len=ag[i].size();
			for(int k=0;k<len;k++){
				if(ag[i][k]<=j) 
				dp[i][j]=max(dp[i][j],dp[i-1][j-ag[i][k]]+bg[i][k]);
			}
		}
	}
	cout<<dp[g][m];
}
```


# 换维dp
常出现在背包dp的问题中，当数据量异常，原本作为容量的数据很大而原本作为状态的数据很小的时候就得想到换维，如以下例题：
### [Knapsack 2 - AtCoder dp_e - Virtual Judge](https://vjudge.net/problem/AtCoder-dp_e#author=translator:1281309:zh)
这道题与常规01背包不同的是它的重量数据很大，原本以重量为大小设置的dp背包开不了那么大，那么此时要换一种思维，以价格大小开背包
```cpp
const ll INF = 2e18;

ll n,m;

struct gd{
	int v;
	ll w;
};

void solve(){
	cin>>n>>m;
	vector<gd> gds(n);
	int zv=0,ans=0,len=0;
	for(int i=0;i<n;i++){
		cin>>gds[i].w>>gds[i].v;
		zv+=gds[i].v;
	}
	vector<ll> dp(zv+1,INF);
	dp[0]=0;
	for(int i=0;i<n;i++){
		len+=gds[i].v;
		for(int j=len;j>0;j--){
			if(j<=gds[i].v){
				dp[j]=min(dp[j],gds[i].w);
			}
			else{
				dp[j]=min(dp[j],dp[j-gds[i].v]+gds[i].w);
			}
			if(ans<j&&dp[j]<=m){
				ans=j;
			}
		}
	}
	cout<<ans;
}
```