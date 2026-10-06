import { Router } from "express";
import { idempotency } from "../middlewares/idempotency.middleware";
import { protect } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";
import { validate } from "../middlewares/validation.middleware";
import upload from "../middlewares/upload.middleware";
import {
  listPosts,
  getPost,
  getRelatedPosts,
  getLatestPosts,
  listCategories,
  adminListPosts,
  createPost,
  updatePost,
  deletePost,
  uploadBlogImage,
  createCategory,
  updateCategory,
  deleteCategory,
  getPostById,
  adminListCategories,
} from "../controllers/blog.controller";
import {
  createPostSchema,
  updatePostSchema,
  listPostsSchema,
  createCategorySchema,
  latestPostsSchema,
  postIdParamSchema,
  getBySlugSchema,
  adminListPostsSchema,
  updateCategorySchema,
  categoryIdParamSchema,
} from "../validators/blog.validator";
import { ROUTES } from "../constants/routes";

const router = Router();

// Public
router.get(ROUTES.BLOGS.LIST, validate(listPostsSchema), listPosts);
router.get(ROUTES.BLOGS.LATEST, validate(latestPostsSchema), getLatestPosts);
router.get(ROUTES.BLOGS.CATEGORIES, listCategories);
router.get(ROUTES.BLOGS.RELATED, validate(postIdParamSchema), getRelatedPosts);
router.get(ROUTES.BLOGS.BY_SLUG, validate(getBySlugSchema), getPost);

// Admin
router.get(
  ROUTES.BLOGS.ADMIN.POSTS,
  protect,
  adminOnly,
  validate(adminListPostsSchema),
  adminListPosts
);
router.get(
  ROUTES.BLOGS.ADMIN.POST_BY_ID,
  protect,
  adminOnly,
  validate(postIdParamSchema),
  getPostById
);

router.get(
  ROUTES.BLOGS.ADMIN.CATEGORIES,
  protect,
  adminOnly,
  adminListCategories
);

router.post(
  ROUTES.BLOGS.ADMIN.UPLOAD_IMAGE,
  protect,
  adminOnly,
  upload.single("image"),
  uploadBlogImage
);
router.post(
  ROUTES.BLOGS.ADMIN.POSTS,
  protect,
  adminOnly,
  idempotency(),
  validate(createPostSchema),
  createPost
);

router.put(
  ROUTES.BLOGS.ADMIN.POST_BY_ID,
  protect,
  adminOnly,
  validate(updatePostSchema),
  updatePost
);
router.delete(
  ROUTES.BLOGS.ADMIN.POST_BY_ID,
  protect,
  adminOnly,
  validate(postIdParamSchema),
  deletePost
);

router.post(
  ROUTES.BLOGS.ADMIN.CATEGORIES,
  protect,
  adminOnly,
  validate(createCategorySchema),
  createCategory
);
router.put(
  ROUTES.BLOGS.ADMIN.CATEGORY_BY_ID,
  protect,
  adminOnly,
  validate(updateCategorySchema),
  updateCategory
);
router.delete(
  ROUTES.BLOGS.ADMIN.CATEGORY_BY_ID,
  protect,
  adminOnly,
  validate(categoryIdParamSchema),
  deleteCategory
);

export default router;
