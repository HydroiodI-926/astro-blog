---
title: 字符串-字典树/前缀树/trie
published: 2026-09-25
tags:
  - 字符串
  - 前缀和
  - 二叉树
  - 数据结构
  - 哈希表
category: 算法笔记
description: trie来自retrieval(检索)中的trie
---
![[Pasted image 20260925193554.png]]

# 结构
- 每个样本从头结点开始根据 前缀字符/前缀数字 建出来的树
- 没有路就新建节点；有路就复用节点
- 树结构中边对应原串的字符，节点用于统计相关信息，例如经过的信息pass，终止的信息end,可以简单理解为节点就像打字时对话框的光标
- 优点：查询代价低，速度快
- 缺点：比较浪费空间，和总字符数量有关，和字符的种类有关(决定树的分叉数)

# 静态实现代码
- 测试链接：[字典树的实现_牛客题霸_牛客网](https://www.nowcoder.com/practice/7f8a8553ddbf4eaab749ec988726702b)

不用哈希表的优化
```cpp
int n;

struct trie{
	// 不用哈希表就使用静态数组模拟哈希表
	vector<array<int,26>> tr;
	vector<int> end,pass;
	
	trie():tr(2),end(2,0),pass(2,0){}
	
	void insert(const string& s){
		int cur=1;
		pass[cur]++;
		for(char c:s){
			int x=c-'a';
			if(!tr[cur][x]){
				tr[cur][x]=tr.size();
				tr.push_back({});
				end.push_back(0);
				pass.push_back(0);
			}
			cur=tr[cur][x];
			pass[cur]++;
		}
		end[cur]++;
	}
	
	int search(const string& s){
		int cur=1;
		for(int i=0,path;i<s.size();i++){
			path=s[i]-'a';
			if(tr[cur][path]==0){
				return 0;
			}
			cur=tr[cur][path];
		}
		return end[cur];
	}
	
	int prefixNumber(const string& pre){
		int cur=1;
		for(int i=0,path;i<pre.size();i++){
			path=pre[i]-'a';
			if(tr[cur][path]==0){
				return 0;
			}
			cur=tr[cur][path];
		}
		return pass[cur];
	}
	
	void del(const string& s){
		if(search(s)>0){
			int cur=1;
			pass[cur]--;
			for(int i=0,path;i<s.size();i++){
				path=s[i]-'a';
				if(--pass[tr[cur][path]]==0){
					tr[cur][path]=0;
					return;
				}
				cur=tr[cur][path];
			}
			end[cur]--;
		}
	}
};


void solve(){
	cin>>n;
	trie tree=trie();
	while(n--){
		int op;
		string s;
		cin>>op>>s;
		if(op==1){
			tree.insert(s);
		}
		if(op==2){
			tree.del(s);
		}
		if(op==3){
			if(tree.search(s)){
				cout<<"YES\n";
			}
			else{
				cout<<"NO\n";
			}
		}
		if(op==4){
			cout<<tree.prefixNumber(s)<<"\n";
		}
	} 
}
```