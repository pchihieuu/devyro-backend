/**
 * scripts/keep-rabbitmq-alive.js
 *
 * Kết nối tới CloudAMQP instance, publish + consume một message "heartbeat"
 * trên một queue riêng (không đụng vào các queue nghiệp vụ).
 *
 * Mục đích: tạo real activity (connection + publish + consume) để CloudAMQP
 * không đánh dấu instance là "unused" và lên lịch xóa sau 2 tháng.
 *
 * Yêu cầu biến môi trường: RABBITMQ_URL (amqps://user:pass@host/vhost)
 * Chạy: node scripts/keep-rabbitmq-alive.js
 */

const amqplib = require("amqplib");

const HEARTBEAT_QUEUE = "keepalive.heartbeat";

async function main() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.error("Missing RABBITMQ_URL env var");
    process.exit(1);
  }

  console.log(`[keepalive] Connecting... (${new Date().toISOString()})`);
  const conn = await amqplib.connect(url);
  const ch = await conn.createChannel();

  // Queue riêng, tự xóa sau khi không dùng 1 ngày — không ảnh hưởng
  // tới các queue nghiệp vụ chính của app (group.message, group.notification, chat.message).
  await ch.assertQueue(HEARTBEAT_QUEUE, {
    durable: false,
    arguments: { "x-expires": 24 * 60 * 60 * 1000 }, // 1 ngày
  });

  const payload = Buffer.from(
    JSON.stringify({ ping: new Date().toISOString() })
  );
  ch.sendToQueue(HEARTBEAT_QUEUE, payload);
  console.log("[keepalive] Published heartbeat message");

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting to consume heartbeat message"));
    }, 10_000);

    ch.consume(
      HEARTBEAT_QUEUE,
      (msg) => {
        if (msg) {
          console.log(
            "[keepalive] Consumed heartbeat message:",
            msg.content.toString()
          );
          ch.ack(msg);
          clearTimeout(timeout);
          resolve();
        }
      },
      { noAck: false }
    );
  });

  await ch.close();
  await conn.close();
  console.log("[keepalive] Done, connection closed cleanly.");
}

main().catch((err) => {
  console.error("[keepalive] Failed:", err);
  process.exit(1);
});