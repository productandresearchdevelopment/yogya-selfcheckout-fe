// Shared TypeScript interfaces and types for Product Recognition Studio
export * from "@/lib/api";

export interface NavItem {
  title: string;
  href: string;
  iconName: string;
  badge?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
