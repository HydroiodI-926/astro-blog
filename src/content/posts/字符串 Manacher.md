---
title: 字符串-Manacher
published: 2026-09-18
tags:
  - 字符串
category: 算法笔记
---
# 板子
```cpp
string s;

// 预处理成Manacher字符串
string manacherss(const string& s){
	int n=s.size()*2+1;
	string ss;
	ss.resize(n);
	for(int i=0,j=0;i<n;i++){
		ss[i]=(i&1)==0?'#':s[j++];
	}
	return ss;
}

int manacher(const string& s){
	string ss=manacherss(s);
	int ans=0,ssn=ss.size();
	vector<int> dp(ssn,0);
	for(int i=0,c=0,r=0,len;i<ssn;i++){
		len=r>i?min(dp[2*c-i],r-i):1;
		while(i+len<ssn&&i-len>=0&&ss[i+len]==ss[i-len]){
			len++;
		}
		if(i+len>r){
			r=i+len;
			c=i;
		}
		ans=max(ans,len);
		dp[i]=len;
	}
	return ans-1;
}
```