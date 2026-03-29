import { Kafka } from "kafkajs";

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || "localhost:9092";

const kafka = new Kafka({
    clientId: "klarheit-generator",
    brokers: KAFKA_BROKERS.split(","),
});

const producer = kafka.producer();

const COUNTRIES = ["DE", "FR", "ES", "IT", "NL", "UK", "PL", "CH"];

function generateTransaction() {
    // 5% chance of being an obvious high-volume fraud (>10k)
    const isHighVolumeFraud = Math.random() < 0.05;

    return {
        tx_id: crypto.randomUUID(),
        amount: isHighVolumeFraud ? Math.floor(Math.random() * 50000) + 10001 : Math.floor(Math.random() * 9000) + 10,
        currency: "EUR",
        country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
        timestamp: new Date().toISOString(),
        sender_id: `USR_${Math.floor(Math.random() * 1000)}`,
        receiver_id: `USR_${Math.floor(Math.random() * 1000)}`,
    };
}

async function run() {
    await producer.connect();
    console.log("Connected to Kafka as Producer");

    console.log("Starting Transaction Firehose...");
    setInterval(async () => {
        const tx = generateTransaction();
        try {
            await producer.send({
                topic: "raw-transactions",
                messages: [{ value: JSON.stringify(tx) }],
            });
            console.log(`Sent tx: ${tx.tx_id} | Amount: €${tx.amount} | Country: ${tx.country} | Sender: ${tx.sender_id}`);
        } catch (e) {
            console.error("Failed to send msg", e);
        }
    }, 2000); // 1 transaction every 2 seconds
}

run().catch(console.error);
