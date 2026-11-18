import { z } from "zod";
import { OpCatalog } from "../types";
import { blogCategory, blogPost, uploadedImage } from "../schemas/misc";

export const blogsCatalog: OpCatalog = {
  "GET /blogs": {
    summary: "Published article",
    data: blogPost,
    paginated: true,
  },
  "GET /blogs/latest": { summary: "Latest post", data: z.array(blogPost) },
  "GET /blogs/categories": {
    summary: "Active category",
    data: z.array(blogCategory),
  },
  "GET /blogs/related/:id": {
    summary: "Related articles",
    data: z.array(blogPost),
  },
  "GET /blogs/:slug": {
    summary: "Article details",
    description: "Increase `viewCount` (dedupe by user/user-agent).",
    data: blogPost,
  },
  "GET /blogs/admin/posts": {
    summary: "[Admin] List of all posts",
    data: blogPost,
    paginated: true,
  },
  "GET /blogs/admin/posts/:id": {
    summary: "[Admin] Article details",
    data: blogPost,
  },
  "GET /blogs/admin/categories": {
    summary: "[Admin] All categories",
    data: z.array(blogCategory),
  },
  "POST /blogs/admin/posts/upload-image": {
    summary: "[Admin] Upload post image",
    status: 201,
    data: uploadedImage,
    multipart: { field: "image" },
  },
  "POST /blogs/admin/posts": {
    summary: "[Admin] Create a post",
    status: 201,
    data: blogPost,
  },
  "PUT /blogs/admin/posts/:id": {
    summary: "[Admin] Update the article",
    data: blogPost,
  },
  "DELETE /blogs/admin/posts/:id": { summary: "[Admin] Delete post" },
  "POST /blogs/admin/categories": {
    summary: "[Admin] Create category",
    status: 201,
    data: blogCategory,
  },
  "PUT /blogs/admin/categories/:id": {
    summary: "[Admin] Edit category",
    data: blogCategory,
  },
  "DELETE /blogs/admin/categories/:id": {
    summary: "[Admin] Delete category",
    description:
      "If the category is still in use, it is merely disabled (`isActive=false`); the `message` field indicates the specific reason.",
  },
};
