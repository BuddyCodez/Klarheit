import { Kafka } from "kafkajs";
import amqp from "amqplib";
// import { db } from "@Klarheit/db"; // we'll integrate Prisma shortly

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || "localhost:9092";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";

const kafka = new Kafka({
    clientId: "klarheit-rules-engine",
    brokers: KAFKA_BROKERS.split(","),
});

const consumer = kafka.consumer({ groupId: "fraud-evaluators" });

// In-memory cache for Rule 2: Impossible Travel
// Maps sender_id -> { country: string, timestamp: Date }
const userLastLocation = new Map<string, { country: string; timestamp: Date }>();

export async function startKafkaConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: "raw-transactions", fromBeginning: true });

    const rabbitConn = await amqp.connect(RABBITMQ_URL);
    const channel = await rabbitConn.createChannel();
    const queue = "fraud-alerts";
    await channel.assertQueue(queue, { durable: true });

    console.log("Rules Engine Consumer connected and listening");

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            const tx = JSON.parse(message.value.toString());
            let txStatus = "VERIFIED";
            let ruleTriggered: string | null = null;

            // Rule 1: Amount > 10,000
            if (tx.amount > 10000) {
                txStatus = "FLAGGED";
                ruleTriggered = "High Volume Transaction (>10k)";
            }

            // Rule 2: Impossible Travel (same user, diff country < 5 mins)
            const lastLoc = userLastLocation.get(tx.sender_id);
            const txTime = new Date(tx.timestamp);
            if (lastLoc && lastLoc.country !== tx.country) {
                const diffMins = (txTime.getTime() - lastLoc.timestamp.getTime()) / 60000;
                if (diffMins < 5) {
                    txStatus = "FLAGGED";
                    ruleTriggered = `Impossible Travel: ${lastLoc.country} to ${tx.country} in <5 mins`;
                }
            }

            // Update location cache
            userLastLocation.set(tx.sender_id, { country: tx.country, timestamp: txTime });

            if (txStatus === "FLAGGED") {
                console.log(`[ALERT] Transaction ${tx.tx_id} flagged: ${ruleTriggered}`);
                // Push to RabbitMQ
                const alertPayload = {
                    transaction: tx,
                    rule_triggered: ruleTriggered,
                };
                channel.sendToQueue(queue, Buffer.from(JSON.stringify(alertPayload)), { persistent: true });
            } else {
                console.log(`[OK] Transaction ${tx.tx_id} verified.`);
                // Note: Prisma integration will be added here to save verified transactions to the DB
            }
        },
    });
}
