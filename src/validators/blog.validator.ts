import { z } from "zod";
import { BlogPostStatus } from "../entities/BlogPost.entity";

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().min(5).max(255),
    excerpt: z.string().max(500).optional(),
    content: z.string().min(1),
    categoryId: z.string().uuid(),
    tags: z.array(z.string().max(50)).optional().default([]),
    thumbnail: z.string().url().optional(),
    status: z
      .nativeEnum(BlogPostStatus)
      .optional()
      .default(BlogPostStatus.DRAFT),
  }),
});

export const updatePostSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(5).max(255).optional(),
    excerpt: z.string().max(500).optional(),
    content: z.string().min(1).optional(),
    categoryId: z.string().uuid().optional(),
    tags: z.array(z.string().max(50)).optional(),
    thumbnail: z.string().url().optional().nullable(),
    status: z.nativeEnum(BlogPostStatus).optional(),
  }),
});

export const listPostsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default("1"),
    limit: z.string().regex(/^\d+$/).optional().default("10"),
    category: z.string().optional(),
    tag: z.string().optional(),
    status: z.nativeEnum(BlogPostStatus).optional(),
    search: z.string().optional(),
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    description: z.string().optional(),
    type: z.enum(["portal_news", "industry_news"]),
  }),
});
