import type { SuiteFn } from "../types";
import { sleep } from "../harness";
import { GroupChatService } from "../../../src/services/group-chat.service";
import { GroupChatRepository } from "../../../src/repositories/group-chat.repository";
import {
  OutboxRepository,
  outboxRepository,
} from "../../../src/repositories/outbox.repository";
import { OutboxRelay, backoffSeconds } from "../../../src/workers/outbox-relay";
import { MessageType } from "../../../src/entities/GroupMessage.entity";

export const run: SuiteFn = async (t, { ds, fx, truncate }) => {
  await truncate("outbox_events"); // an toàn: truncate() kiểm lại DB là *_test
  const outbox = new OutboxRepository();
  const events = () => ds.query(`SELECT * FROM outbox_events ORDER BY id`);

  // Tin nhắn + event cùng transaction
  const [a, b] = [await fx.user(), await fx.user()];
  const svc = new GroupChatService(new GroupChatRepository());
  const g = await svc.createGroup(a.id, {
    name: `Outbox ${fx.runId}`,
    memberIds: [b.id],
  });
  await svc.acceptInvitation(b.id, g.id);
  const m = await svc.sendGroupMessage(a.id, g.id, { content: "hi outbox" });
  let rows = await events();
  t.ok(
    rows.length === 1 &&
      rows[0].topic === "group.message.new" &&
      rows[0].payload.message.id === m.id &&
      rows[0].published_at === null,
    "Send message → there is exactly one unpublished event in the outbox, with the payload containing the message.id"
  );
  t.eq(
    (await svc.getUserGroups(b.id))[0].unreadCount,
    1,
    "The recipient's unread count increases within the same transaction."
  );

  // Rollback: lỗi giữa chừng không để lại tin lẫn event mồ côi
  const before = (await events()).length;
  await new GroupChatRepository()
    .createMessageWithEffects(
      {
        groupId: g.id,
        senderId: a.id,
        content: "boom",
        type: MessageType.TEXT,
        fileUrl: null,
        filePublicId: null,
        fileName: null,
        fileSize: null,
        fileMimeType: null,
        replyToId: null,
      },
      "boom",
      () => {
        throw new Error("boom");
      }
    )
    .catch(() => undefined);
  t.eq(
    (await events()).length,
    before,
    "error within a transaction → no orphaned events"
  );
  t.eq(
    (await svc.getGroupMessages(a.id, g.id, 1, 50)).total,
    1,
    "…and the message was also rolled back"
  );

  /* Lỗi xảy ra SAU khi đã ghi outbox (vd commit thất bại): event phải biến mất cùng tin nhắn.
  Test này mới chứng minh event được ghi bằng CHÍNH transaction của tin nhắn;
  test ở trên (ném lỗi trước khi ghi) không phân biệt được. */
  const original = outboxRepository.enqueue.bind(outboxRepository);
  outboxRepository.enqueue = async (manager, topic, payload) => {
    await original(manager, topic, payload);
    throw new Error("crashes immediately after writing to the outbox");
  };
  try {
    await new GroupChatRepository()
      .createMessageWithEffects(
        {
          groupId: g.id,
          senderId: a.id,
          content: "late-fail",
          type: MessageType.TEXT,
          fileUrl: null,
          filePublicId: null,
          fileName: null,
          fileSize: null,
          fileMimeType: null,
          replyToId: null,
        },
        "late-fail",
        () => ({ topic: "group.message.new", payload: { late: true } })
      )
      .catch(() => undefined);
  } finally {
    outboxRepository.enqueue = original;
  }
  t.eq(
    (await events()).length,
    before,
    "error after writing to the outbox → event is rolled back along with the transaction (no orphaned events)"
  );
  t.eq(
    (await svc.getGroupMessages(a.id, g.id, 1, 50)).total,
    1,
    "…and the corresponding message is also rolled back"
  );

  // Relay: MQ chết → giữ event, tăng attempts, đặt backoff
  const published: any[] = [];
  let mqUp = false;
  const relay = new OutboxRelay(outbox, {
    "group.message.new": async (p) => {
      if (!mqUp) return false; // publisher thật trả false khi kênh MQ chưa sẵn sàng
      published.push(p);
      return true;
    },
  });
  await relay.processBatch();
  rows = await events();
  t.ok(
    published.length === 0 &&
      rows[0].published_at === null &&
      rows[0].attempts === 1 &&
      /not ready/.test(rows[0].last_error ?? ""),
    "MQ dead → event is retained, attempts=1, last_error is recorded"
  );
  const wait =
    (new Date(rows[0].next_attempt_at).getTime() - Date.now()) / 1000;
  t.ok(
    wait > 0 && wait <= backoffSeconds(1) + 1,
    `schedule a retry with backoff (~${wait.toFixed(1)}s)`
  );
  await relay.processBatch();
  t.eq(published.length, 0, "Do not retest early before the scheduled time.");

  // MQ sống lại → gửi đúng 1 lần
  await ds.query(`UPDATE outbox_events SET next_attempt_at = NOW()`);
  mqUp = true;
  await relay.processBatch();
  rows = await events();
  t.ok(
    published.length === 1 &&
      published[0].message.id === m.id &&
      rows[0].published_at !== null,
    "MQ reactivated → publish the correct event and mark as sent"
  );
  await relay.processBatch();
  t.eq(
    published.length,
    1,
    "An event that has already been sent will not be sent again."
  );

  // Dead-letter
  const prevMax = process.env.OUTBOX_MAX_ATTEMPTS;
  process.env.OUTBOX_MAX_ATTEMPTS = "2";
  try {
    await ds.transaction((manager) =>
      outbox.enqueue(manager, "group.message.new", { x: 1 })
    );
    mqUp = false;
    for (let i = 0; i < 3; i++) {
      await ds.query(
        `UPDATE outbox_events SET next_attempt_at = NOW() WHERE published_at IS NULL AND dead_at IS NULL`
      );
      await relay.processBatch();
    }
  } finally {
    if (prevMax === undefined) delete process.env.OUTBOX_MAX_ATTEMPTS;
    else process.env.OUTBOX_MAX_ATTEMPTS = prevMax;
  }
  t.ok(
    (await outbox.countDead()) === 1 && (await outbox.countPending()) === 0,
    "exceeded maximum number of attempts → dead (no infinite retries)"
  );
  const unknown = await events();
  t.ok(
    unknown.at(-1).dead_at !== null && unknown.at(-1).attempts === 2,
    "For the 'dead' event, keep 'attempts=2' and 'dead_at' unchanged."
  );

  // Nhiều relay đồng thời không lấy trùng
  await truncate("outbox_events");
  for (let i = 0; i < 20; i++)
    await ds.transaction((m2) => outbox.enqueue(m2, "t", { i }));
  const [c1, c2, c3] = await Promise.all([
    outbox.claimDue(10, 60),
    outbox.claimDue(10, 60),
    outbox.claimDue(10, 60),
  ]);
  const ids = [...c1, ...c2, ...c3].map((e) => e.id);
  t.ok(
    new Set(ids).size === ids.length && ids.length === 20,
    `3 relay claims simultaneously: no overlap, total 20 (${c1.length}/${c2.length}/${c3.length})`
  );
  t.ok(
    c1.every((e, i) => i === 0 || BigInt(e.id) > BigInt(c1[i - 1].id)),
    "each claim returns events in id order"
  );

  // Crash recovery: lease hết hạn → nhận lại
  await ds.query(
    `UPDATE outbox_events SET locked_until = NOW() - interval '1 second'`
  );
  t.eq(
    (await outbox.claimDue(100, 60)).length,
    20,
    "Lease expires (relay dies prematurely) → event is received again"
  );

  // Dọn event cũ
  await ds.query(
    `UPDATE outbox_events SET published_at = NOW() - interval '10 days'`
  );
  t.eq(
    await outbox.purgePublishedOlderThan(7),
    20,
    "purge removes sent events that are older than the specified threshold"
  );

  // Vòng poll + kick() bằng timer thật
  await truncate("outbox_events");
  const got: unknown[] = [];
  const prevPoll = process.env.OUTBOX_POLL_MS;
  process.env.OUTBOX_POLL_MS = "200";
  const live = new OutboxRelay(outbox, { t: async (p) => (got.push(p), true) });
  try {
    live.start();
    await ds.transaction((m3) => outbox.enqueue(m3, "t", { n: 1 }));
    live.kick();
    await sleep(400);
    t.eq(
      got.length,
      1,
      "kick() dispatches an event immediately after the commit."
    );
    await ds.transaction((m3) => outbox.enqueue(m3, "t", { n: 2 }));
    await sleep(700);
    t.eq(
      got.length,
      2,
      "You can still pick it up during the poll phase without needing to kick."
    );
  } finally {
    await live.stop();
    if (prevPoll === undefined) delete process.env.OUTBOX_POLL_MS;
    else process.env.OUTBOX_POLL_MS = prevPoll;
  }
};
