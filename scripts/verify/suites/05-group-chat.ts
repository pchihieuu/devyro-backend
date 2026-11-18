import { randomUUID } from "crypto";
import type { SuiteFn } from "../types";
import { GroupChatService } from "../../../src/services/group-chat.service";
import { GroupChatRepository } from "../../../src/repositories/group-chat.repository";
import { Group } from "../../../src/entities/Group.entity";
import { MemberStatus } from "../../../src/entities/GroupMember.entity";

const status = (e: any) => e?.statusCode;

export const run: SuiteFn = async (t, { ds, fx }) => {
  const repo = new GroupChatRepository();
  const svc = new GroupChatService(repo);
  const groups = ds.getRepository(Group);
  const memberCount = async (id: string) => (await groups.findOneByOrFail({ id })).memberCount;

  const alice = await fx.user(undefined, "alice");
  const bob = await fx.user(undefined, "bob");
  const carol = await fx.user(undefined, "carol");
  const outsider = await fx.user(undefined, "outsider");

  // Tạo group
  const g = await svc.createGroup(alice.id, { name: "Dev Team", memberIds: [bob.id, carol.id, alice.id] });
  const pending = g.members.filter((m) => m.status === MemberStatus.PENDING).length;
  t.ok(g.memberCount === 1 && g.members.length === 3 && pending === 2, "createGroup: remove duplicate creator, 2 PENDING invitations, memberCount=1");

  const orphanName = `orphan-${Date.now()}`;
  await t.rejects(
    () => repo.createGroupWithMembers({ creatorId: alice.id, name: orphanName, description: null, inviteeIds: [randomUUID()] }),
    () => true,
    "createGroup with a non-existent invitee → error (FK)"
  );
  t.eq(await groups.countBy({ name: orphanName }), 0, "…and do NOT leave behind any orphaned groups (transaction rollback)");

  // Race: accept đồng thời
  const race = await Promise.allSettled([svc.acceptInvitation(bob.id, g.id), svc.acceptInvitation(bob.id, g.id)]);
  t.eq(race.filter((r) => r.status === "fulfilled").length, 1, "Two simultaneous accepts: only one wins");
  t.eq(await memberCount(g.id), 2, "memberCount only increases by 1");

  // Reject rồi mời lại
  await svc.rejectInvitation(carol.id, g.id);
  await t.rejects(() => svc.acceptInvitation(carol.id, g.id), (e) => status(e) === 400, "If rejected, accept it again → 400");
  const re = await svc.addMembers(alice.id, g.id, [carol.id, bob.id]);
  t.ok(re.invited.includes(carol.id) && re.skipped.includes(bob.id), "addMembers: re-invite individuals who previously rejected the invitation; skip those who are already members");
  await svc.acceptInvitation(carol.id, g.id);
  t.eq(await memberCount(g.id), 3, "memberCount = 3 after Carol joins");

  // Gửi tin + reply
  const m1 = await svc.sendGroupMessage(alice.id, g.id, { content: "Hello 100% _world_" });
  const m2 = await svc.sendGroupMessage(bob.id, g.id, { content: "reply here", replyToId: m1.id });
  t.eq(m2.replyTo?.senderName, "alice", "replyTo.senderName has a value when sending");
  await t.rejects(() => svc.sendGroupMessage(outsider.id, g.id, { content: "hi" }), (e) => status(e) === 403, "non-member sends message → 403");
  await t.rejects(() => svc.sendGroupMessage(alice.id, g.id, { content: "   " }), (e) => status(e) === 400, "empty message → 400");

  const after = await groups.findOneByOrFail({ id: g.id });
  t.eq(after.lastMessage, "reply here", "lastMessage = most recent message");

  const page = await svc.getGroupMessages(carol.id, g.id, 1, 50);
  t.ok(page.total === 2 && page.hasMore === false && page.messages[0].content === "Hello 100% _world_", "getGroupMessages: {messages,total,hasMore}, old → new");
  t.eq(page.messages[1].replyTo?.senderName, "alice", "message list: replyTo.senderName is correct");
  t.eq((await svc.getGroupMessages(carol.id, g.id, 1, 1)).hasMore, true, "hasMore = true when there is a subsequent page");

  // Search + escape wildcard
  const s = async (q: string) => (await svc.getGroupMessages(carol.id, g.id, 1, 50, q)).total;
  t.eq(await s("100%"), 1, "search '100%' – 1 exact match found");
  t.eq(await s("%"), 1, "Searching for '%' matches only the actual '%' character (not everything).");
  t.eq(await s("_"), 1, "The search term '_' matches only the actual '_' character.");
  t.eq(await s("REPLY"), 1, "search is case-insensitive");

  // Danh sách group
  const empty = await svc.createGroup(alice.id, { name: "Empty Group", memberIds: [] });
  const list = await svc.getUserGroups(alice.id);
  t.ok(list[0].id === g.id && list[list.length - 1].id === empty.id, "Groups with content are placed before groups without content (NULLS LAST)");
  t.eq((await svc.getUserGroups(alice.id, "dev")).length, 1, "search for group name 'dev' → 1");
  t.eq((await svc.getUserGroups(alice.id, "zzz-none")).length, 0, "search does not match → 0");
  t.eq(list.find((x) => x.id === g.id)!.members.length, 3, "preview only includes ACTIVE members");

  // Unread / read
  t.eq((await svc.getUserGroups(carol.id)).find((x) => x.id === g.id)!.unreadCount, 2, "carol has 2 unread messages");
  await svc.markGroupAsRead(carol.id, g.id);
  t.eq((await svc.getUserGroups(carol.id)).find((x) => x.id === g.id)!.unreadCount, 0, "markGroupAsRead → unread = 0");

  //Xoá tin: lastMessage không bị đoán theo dung sai thời gian
  const m3 = await svc.sendGroupMessage(alice.id, g.id, { content: "third" });
  const m4 = await svc.sendGroupMessage(alice.id, g.id, { content: "fourth" });
  await svc.deleteGroupMessage(alice.id, g.id, m3.id); // xoá tin CŨ của cùng người gửi, sát thời gian
  t.eq((await groups.findOneByOrFail({ id: g.id })).lastMessage, "fourth", "Deleting an old message (not the latest one) does NOT change the `lastMessage`.");
  await svc.deleteGroupMessage(alice.id, g.id, m4.id);
  t.eq((await groups.findOneByOrFail({ id: g.id })).lastMessage, "reply here", "Deleting the latest message changes the `lastMessage` to the previous one.");
  await t.rejects(() => svc.deleteGroupMessage(bob.id, g.id, m1.id), (e) => status(e) === 403, "Members generally cannot delete other people's messages.");

  // Gỡ thành viên
  await t.rejects(() => svc.removeMember(alice.id, g.id, alice.id), (e) => status(e) === 400, "The sole admin cannot remove themselves.");
  const rm = await Promise.allSettled([svc.removeMember(alice.id, g.id, bob.id), svc.removeMember(alice.id, g.id, bob.id)]);
  t.eq(rm.filter((r) => r.status === "fulfilled").length, 1, "Removing the same person twice simultaneously: only one succeeds.");
  t.eq(await memberCount(g.id), 2, "memberCount decreases exactly once");
  await t.rejects(() => svc.removeMember(alice.id, g.id, bob.id), (e) => status(e) === 404, "remove someone who has already been removed → 404");

  // Mỗi tin gửi thành công đều có 1 event outbox
  const [{ n }] = await ds.query(`SELECT COUNT(*)::int AS n FROM outbox_events WHERE topic = 'group.message.new'`);
  t.eq(n, 4, "Each successfully sent message generates exactly one outbox event (4 messages).");
};
