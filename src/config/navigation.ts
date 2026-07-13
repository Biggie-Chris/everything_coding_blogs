export interface NavItem {
  label: string;
  href: string;
}

export const headerNav: NavItem[] = [
  { label: "文章", href: "/posts/" },
  { label: "标签", href: "/tags/" },
  { label: "系列", href: "/series/" },
  { label: "归档", href: "/archive/" },
  { label: "关于", href: "/about/" },
];

export const footerNav: NavItem[] = [
  { label: "首页", href: "/" },
  { label: "文章", href: "/posts/" },
  { label: "标签", href: "/tags/" },
  { label: "系列", href: "/series/" },
  { label: "归档", href: "/archive/" },
  { label: "关于", href: "/about/" },
  { label: "搜索", href: "/search/" },
];
