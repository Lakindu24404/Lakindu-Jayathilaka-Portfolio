/** Cache tags shared by the public read layer and the dashboard mutations. */
export const CACHE_TAGS = {
  stack: "portfolio:stack",
  projects: "portfolio:projects",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
