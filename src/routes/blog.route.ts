import { Router } from "express";
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
} from "../controllers/blog.controller";
import {
  createPostSchema,
  updatePostSchema,
  listPostsSchema,
  createCategorySchema,
} from "../validators/blog.validator";
import { ROUTES } from "../constants/routes";

const router = Router();

// Public
router.get("/", validate(listPostsSchema), listPosts);
router.get(ROUTES.BLOGS.LATEST, getLatestPosts);
router.get(ROUTES.BLOGS.CATEGORIES, listCategories);
router.get(ROUTES.BLOGS.RELATED, getRelatedPosts);
router.get(ROUTES.BLOGS.BY_SLUG, getPost);

// Admin
router.get(ROUTES.BLOGS.ADMIN.POSTS, protect, adminOnly, adminListPosts);
router.get(ROUTES.BLOGS.ADMIN.POST_BY_ID, protect, adminOnly, getPostById);

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
router.delete(ROUTES.BLOGS.ADMIN.POST_BY_ID, protect, adminOnly, deletePost);

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
  updateCategory
);
router.delete(
  ROUTES.BLOGS.ADMIN.CATEGORY_BY_ID,
  protect,
  adminOnly,
  deleteCategory
);

export default router;
