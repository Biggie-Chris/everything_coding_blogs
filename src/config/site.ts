export const site = {
  name: "CHRIS's Blogs",
  title: "Everything Coding",
  description: "Mainly some rants of Linux C/C++, RDMA, AI Infra and system programming",
  siteUrl: "https://biggie-chris.github.io/everything_coding_blogs",
  author: "Chris",
  githubUrl: "https://github.com/Biggie-Chris",
  language: "zh-CN",
  locale: "zh_CN",
  timezone: "Asia/Beijing",

  seo: {
    defaultImage: "/images/og-default.png",
    twitterCard: "summary_large_image" as const,
    twitterHandle: "",
  },
};

export type SiteConfig = typeof site;
