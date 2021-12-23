import {CompressionTypes, Kafka, Producer, Consumer, PartitionAssigner, RetryOptions, KafkaMessage} from "kafkajs";


interface Config {
    client_config: {brokers: string[], clientId: string},
    consumer_config: {
        groupId: string,
        sessionTimeout: number,
        allowAutoTopicCreation: boolean
    },
}

export class KafkaListener {
    private readonly _config: Config;
    private _kafka_consumer: Consumer;
    constructor(config: Config) {
        this._config = config;
        this._kafka_consumer = (new Kafka(this._config.client_config)).consumer(this._config.consumer_config)
    }

    public async listen(
        topic: string,
        fromBeginning: boolean,
        onMessage: (topic: string, partition: number, message: KafkaMessage) => any
    ) {
        try {
            await this._kafka_consumer.connect().then(r => {
                console.log('Consumer connected to Kafka.');
            });
            await this._kafka_consumer.subscribe({
                    topic : topic,
                    fromBeginning : fromBeginning
            });

            await this._kafka_consumer.run({
                autoCommit: true,
                eachMessage: async ({ topic, partition, message }) => {
                    onMessage(topic, partition, message);
                }
            })
        }
        catch (e) {
            console.log(e)
        }

    }

    public async close() {
        console.log('Closing consumer...');
        await this._kafka_consumer.disconnect().then(_ => {
            console.log('Consumer disconnected.');
        });
        // this._kafka_consumer.stop().then( _ => {
        //     this._kafka_consumer.disconnect().then( _ => {
        //         console.log('Consumer disconnected.');
        //     });
        // })
    }
}