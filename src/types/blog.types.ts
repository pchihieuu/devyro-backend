import { BlogPost } from "../entities/BlogPost.entity";

export type SanitizedBlogPost = Omit<BlogPost, "author"> & {
  author: { id: string; name: string; avatar: string | null } | null;
};
