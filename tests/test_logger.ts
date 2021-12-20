import { Logger, ConsoleSink, FileSink, KafkaSink } from "../winston_logger";
const path = require('path')
import { v4 as uuid } from 'uuid';
import {CompressionTypes, Kafka, Producer, Consumer, PartitionAssigner, RetryOptions} from "kafkajs";

class thisClass {
    private _clsLogger = new Logger({
        module: path.basename(__filename),
        component: "thisClass",
        serviceID: uuid()
    });
    private _logger = this._clsLogger.getLogger([
        ConsoleSink,
        new FileSink({
            filename: 'log.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: false,
            maxSize: '20m',
            maxFiles: '14d'
        }),
        new KafkaSink({
            client_config: {brokers: ['192.168.2.190:9092'], clientId: uuid()},
            producer_config: {allowAutoTopicCreation: false},
            sink_topic: 'test_topic'
        })
    ]);

    public async doSomething () {
        this._logger.info('HELOOOOO AGAIN!!!')
        // this._logger.close();
    }
}



(async () => {
    const cls = new thisClass();
    const kafka = new Kafka({brokers: ['192.168.2.190:9092'], clientId: uuid()});
    const kafka_consumer = kafka.consumer({
        groupId: 'test_group',
        sessionTimeout: 25000,
        allowAutoTopicCreation: false
    });
    await kafka_consumer.connect().then(r => {
        console.log('Consumer connected to Kafka.');
    });
    await kafka_consumer.subscribe({
            topic : 'test_topic',
            fromBeginning : false
    });

    await kafka_consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log(
                // @ts-ignore
                JSON.parse(message.value.toString())
            )
        }
    })

    await cls.doSomething();
})()


// async function subscribe(topic:object | any, fromBeginning = true, groupId:string, eachMessage?:Function):Promise<Consumer>{
//      const kafka = new Kafka({brokers: ['192.168.2.190:9092'], clientId: uuid()});
//      const kafka_consumer = kafka.consumer({
//          groupId: 'test_group',
//          sessionTimeout: 25000,
//          allowAutoTopicCreation: false
//      });
//
//      await kafka_consumer.connect().then(r => {
//          console.log('Consumer connected to Kafka.');
//      });
//      await kafka_consumer.subscribe({
//          topic : 'test_topic',
//          fromBeginning : false
//      });
//
//      (() => {
//          kafka_consumer.run({
//              // @ts-ignore
//              eachMessage : async ({ topic, partition, message }) => {
//                  if(eachMessage) eachMessage(topic, partition, message)
//              }
//          });
//      })() ;
//      return kafka_consumer;
//     }
// console.log(__filename);