import amqp from "amqplib";
// import { db } from "@Klarheit/db"; // we'll integrate Prisma shortly

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";

export async function startAlertWorker() {
    try {
        const conn = await amqp.connect(RABBITMQ_URL);
        const channel = await conn.createChannel();
        const queue = "fraud-alerts";

        await channel.assertQueue(queue, { durable: true });

        // Process 1 alert at a time to ensure durability and prevent overwhelming DB
        channel.prefetch(1);

        console.log(`Alert Worker listening on queue: ${queue}`);

        channel.consume(queue, async (msg) => {
            if (msg !== null) {
                const payload = JSON.parse(msg.content.toString());
                console.log(`[WORKER] Processing Fraud Alert for TX: ${payload.transaction.tx_id}`);

                // Note: Prisma integration will be added here to save the alert into Postgres.

                // Example:
                // await db.alert.create({
                //   data: {
                //     transaction_id: payload.transaction.tx_id,
                //     rule_triggered: payload.rule_triggered,
                //     status: "PENDING"
                //   }
                // });

                // TODO: Emit to frontend via Socket.io to push real-time alerts

                // Acknowledge the message so it's removed from the queue
                channel.ack(msg);
            }
        }, { noAck: false });

    } catch (error) {
        console.error("Alert Worker failed to connect", error);
    }
}
