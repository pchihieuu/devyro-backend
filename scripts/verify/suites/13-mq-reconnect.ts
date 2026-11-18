import { EventEmitter } from "events";
import type { SuiteFn } from "../types";
import { sleep } from "../harness";
import {
  ExchangeName,
  MessageQueueService,
} from "../../../src/services/message-queue.service";
const amqplib = require("amqplib");

const fakeChannel = () => {
  const ch: any = new EventEmitter();
  ch.publish = () => true;
  ch.sendToQueue = () => true;
  ch.close = async () => {
    ch.emit("close");
  };
  return new Proxy(ch, {
    get: (target, key) => {
      if (typeof key === "symbol" || key === "then") return undefined;
      return key in target ? target[key] : async () => ({}); // assertQueue, bindQueue, prefetch...
    },
  });
};

const fakeConnection = () => {
  const conn: any = new EventEmitter();
  conn.channels = [] as any[];
  conn.createChannel = async () => {
    const ch = fakeChannel();
    conn.channels.push(ch);
    return ch;
  };
  conn.close = async () => {
    conn.emit("close");
  };
  return conn;
};

const waitFor = async (cond: () => boolean, ms = 3000): Promise<boolean> => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(10);
  }
  return cond();
};

export const run: SuiteFn = async (t) => {
  // MQ service ghi lỗi/cảnh báo bằng console (không qua logger) nên tắt cho output gọn, trừ khi --verbose.
  // console.log do harness dùng để in PASS/FAIL nên giữ nguyên; log "[MQ] ..." lọc ở dưới.
  const realConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  if (!process.env.VERIFY_VERBOSE) {
    console.warn = console.error = () => undefined;
    console.log = (...args: unknown[]) => {
      const first = typeof args[0] === "string" ? args[0] : "";
      if (/^(Connected to RabbitMQ|Attempting to reconnect|\[MQ\])/.test(first))
        return;
      realConsole.log(...args);
    };
  }
  const realConnect = amqplib.connect;
  const prev = {
    base: process.env.MQ_RECONNECT_BASE_MS,
    max: process.env.MQ_RECONNECT_MAX_MS,
  };
  process.env.MQ_RECONNECT_BASE_MS = "10";
  process.env.MQ_RECONNECT_MAX_MS = "40";

  let attempts = 0;
  let failuresLeft = 0;
  const conns: any[] = [];
  amqplib.connect = async () => {
    attempts++;
    if (failuresLeft > 0) {
      failuresLeft--;
      throw new Error("ECONNREFUSED (simulating RabbitMQ being down)");
    }
    const c = fakeConnection();
    conns.push(c);
    return c;
  };
  const last = () => conns[conns.length - 1];

  const mq = new MessageQueueService();
  let reconnectedCalls = 0;
  mq.onReconnected(async () => {
    reconnectedCalls++;
  });

  try {
    await mq.connectWithRetry(3, 5);
    t.ok(mq.isConnected() && attempts === 1, "Initial connection successful");

    // Mất kết nối + RabbitMQ vẫn tắt qua 3 lần thử
    failuresLeft = 3;
    const first = last();
    first.emit("error", new Error("socket closed"));
    first.emit("close");
    t.ok(!mq.isConnected(), "connection lost → isConnected = false");

    const back = await waitFor(() => mq.isConnected());
    t.ok(
      back,
      "RabbitMQ comes back online → automatic reconnection (previous bug: it would only attempt once and then give up permanently)"
    );
    t.eq(
      attempts,
      1 + 3 + 1,
      "continued trying after previous failures (3 unsuccessful attempts + 1 successful attempt)"
    );
    t.eq(
      reconnectedCalls,
      1,
      "hook onReconnected runs correctly 1 time despite both 'error' and 'close' events"
    );
    t.ok(
      await mq.publish(ExchangeName.GROUP_EVENTS, "group.message.new", {
        ok: 1,
      }),
      "publish works again after reconnection"
    );

    // Sự kiện muộn của kết nối CŨ không được phá kết nối mới
    const before = attempts;
    first.emit("close");
    first.emit("error", new Error("stale"));
    await sleep(120);
    t.ok(
      mq.isConnected() && attempts === before && reconnectedCalls === 1,
      "Late events from a previous connection are ignored (no redundant reconnections / no duplicate consumer registrations)."
    );

    // Hook lỗi → tự ép reconnect và chạy lại
    let flakyCalls = 0;
    mq.onReconnected(async () => {
      if (++flakyCalls === 1) throw new Error("consumer registration error");
    });
    const callsBefore = reconnectedCalls;
    last().emit("close");
    const recovered = await waitFor(() => flakyCalls >= 2 && mq.isConnected());
    t.ok(
      recovered,
      "Hook error → the service automatically reconnects to re-run the hook (the consumer is not left stranded)."
    );
    t.ok(
      reconnectedCalls - callsBefore >= 2,
      "Hooks are also typically re-executed as part of the same cycle."
    );

    // Publish channel chết riêng lẻ (kết nối vẫn sống)
    await sleep(60);
    const conn = last();
    const chBefore = conn.channels.length;
    conn.channels[0].emit("close");
    const recreated = await waitFor(
      () => conn.channels.length === chBefore + 1
    );
    t.ok(
      recreated && mq.isConnected(),
      "Publish channel dead → create a new channel over an active connection"
    );
    t.ok(
      await mq.publish(ExchangeName.GROUP_EVENTS, "group.message.new", {
        ok: 2,
      }),
      "publish works again after channel recreation"
    );

    // channel 'error' không có listener sẽ làm sập process
    let crashed = false;
    try {
      conn.channels[conn.channels.length - 1].emit(
        "error",
        new Error("channel error")
      );
    } catch {
      crashed = true;
    }
    t.ok(
      !crashed,
      "Emitting an 'error' event on a channel does not throw an error that can be caught (even though a listener is attached)."
    );

    // close() dừng hẳn việc reconnect
    await mq.close();
    const attemptsAtClose = attempts;
    last().emit("close");
    await sleep(150);
    t.eq(
      attempts,
      attemptsAtClose,
      "After close(): no automatic reconnection (prevents delays when shutting down the server)"
    );
  } finally {
    Object.assign(console, realConsole);
    amqplib.connect = realConnect;
    if (prev.base === undefined) delete process.env.MQ_RECONNECT_BASE_MS;
    else process.env.MQ_RECONNECT_BASE_MS = prev.base;
    if (prev.max === undefined) delete process.env.MQ_RECONNECT_MAX_MS;
    else process.env.MQ_RECONNECT_MAX_MS = prev.max;
  }
};
