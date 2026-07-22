import type { ProfileConfig } from "../types/config";

// 个人资料配置
export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.jpg", // 相对于 /src 目录。如果以 '/' 开头，则相对于 /public 目录
	name: "Hydroiody",
	bio: "一个兴趣使然的人",
	typewriter: {
		enable: true, // 启用个人简介打字机效果
		speed: 80, // 打字速度（毫秒）
	},
	links: [
		{
			name: "Bilibili",
			icon: "fa7-brands:bilibili",
			url: "https://space.bilibili.com/453418403",
		},
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/HydroiodI-926",
		},
		{
			name: "CSDN",
			icon: "mdi:language-csharp",
			url: "https://blog.csdn.net/2401_88753321?type=blog",
		},
	],
};
