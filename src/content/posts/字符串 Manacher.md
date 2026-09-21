---
title: 字符串-Manacher
published: 2026-09-18
tags:
  - 字符串
  - 滑动窗口
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


# 例题
### [K. Two-Tone Palindromes](https://codeforces.com/gym/106705/problem/K)
Manacher+滑动窗口
```cpp
int n;
string s,ss;

string manacherss(const string& s){
	int n=s.size()*2+1;
	string ss;
	ss.resize(n);
	for(int i=0,j=0;i<n;i++){
		ss[i]=(i&1)==0?'#':s[j++];
	}
	return ss;
}

ll manacher(const string& s){
	string ss=manacherss(s);
	int ssn=ss.size();
	vector<int> dp(ssn,0),b(ssn,0);
	for(int i=0,c=0,r=0,len;i<ssn;i++){
		len=r>i?min(dp[2*c-i]+1,r-i):1;
		while(i+len<ssn&&i-len>=0&&ss[i+len]==ss[i-len]){
			len++;
		}
		if(i+len>r){
			r=i+len;
			c=i;
		}
		dp[i]=len-1;
	}
	ll ans=0;
	// 统计一段中只有两种字符的最大长度的左端点
	vector<int> dic(26,0);
	int cnt=0;
	for(int l=0,r=0;r<ssn;r++){
		if(ss[r]!='#'){
			if(dic[ss[r]-'a']==0){
				cnt++;
			}
			dic[ss[r]-'a']++;
		}
		while(cnt>2){
			if(ss[l]!='#'){
				if(dic[ss[l]-'a']==1){
					cnt--;
				}
				dic[ss[l]-'a']--;
			}
			l++;
		}
		b[r]=l;
	}
	int q=0;
	for(int i=0;i<ssn;i++){
		if(i>0){
			q=max(0,q-1);
		}
		while(i-q-1>=0&&i+q+1<ssn&&b[i+q+1]<=i-q-1){
			q++;
		}
		int r=min(dp[i],q);
		ans+=(r+1)/2;
	}
	return ans;
}

void solve(){
	cin>>n>>s;
	cout<<manacher(s)<<"\n";
}
```