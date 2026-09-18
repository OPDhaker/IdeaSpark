import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
};

// Plugins are named as strings, not imported: Turbopack cannot pass JavaScript
// functions across to Rust. `rehype-slug` gives every heading an `id`, which is
// what the playbook's table of contents and its deep links are built on.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
