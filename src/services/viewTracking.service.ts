// src/services/ViewTrackingService.ts
import { DataSource, Repository } from "typeorm";
import { AppDataSource } from "../config/database.config";
import { BlogPostView } from "../entities/BlogPostView.entity";
import { BlogRepository } from "../repositories/blog.repository";

const VIEW_WINDOW_MS = 30 * 60 * 1000;

export class ViewTrackingService {
  private viewRepo: Repository<BlogPostView>;

  constructor(
    private blogRepo: BlogRepository,
    dataSource: DataSource = AppDataSource
  ) {
    this.viewRepo = dataSource.getRepository(BlogPostView);
  }

  /**
   * Fire-and-forget: calls can be made without needing `await` in `getBySlug`.
   *Errors are swallowed so they don't affect the main response.
   */
  trackAsync(
    postId: string,
    ipAddress?: string,
    userId?: string,
    userAgent?: string
  ): void {
    this.track(postId, ipAddress, userId, userAgent).catch((err) => {
      // Log but don't throw — view tracking must not block API response
      console.error("[ViewTracking] Failed to track view:", err);
    });
  }

  private async track(
    postId: string,
    ipAddress?: string,
    userId?: string,
    userAgent?: string
  ): Promise<void> {
    // There must be at least one identifier
    if (!userId && !ipAddress) return;

    const since = new Date(Date.now() - VIEW_WINDOW_MS);

    const qb = this.viewRepo
      .createQueryBuilder("v")
      .where("v.postId = :postId", { postId })
      .andWhere("v.viewedAt > :since", { since });

    if (userId) {
      qb.andWhere("v.userId = :userId", { userId });
    } else {
      qb.andWhere("v.ipAddress = :ip", { ip: ipAddress });
    }

    const recentView = await qb.getOne();
    if (recentView) return;

    await this.viewRepo.save(
      this.viewRepo.create({ postId, ipAddress, userId, userAgent })
    );

    await this.blogRepo.incrementViewCount(postId);
  }
}
