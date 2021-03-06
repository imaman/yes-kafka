'use strict';

/* global describe, it, before, sinon, after  */

var Kafka   = require('../lib/index');
var kafkaTestkit = require('./testkit/kafka');

describe('requiredAcks: 0', function () {
  var producer;
  var consumer;

  var dataHanlderSpy = sinon.spy(function () {});

  before(async () => {
    producer = new Kafka.Producer({
      requiredAcks: 0,
      clientId: 'producer',
    });
    consumer = new Kafka.SimpleConsumer({
      idleTimeout: 100,
      clientId: 'simple-consumer',
    });

    await kafkaTestkit.createTopics(['kafka-require-acks-0-topic',]);

    await Promise.all([
      producer.init(),
      consumer.init(),
    ]);
  });

  after(async () => {
    await Promise.all([
      producer.end(),
      consumer.end(),
    ]);
  });

  it('should send/receive messages', async () => {
    await consumer.subscribe('kafka-require-acks-0-topic', 0, dataHanlderSpy);
    await producer.send({
      topic: 'kafka-require-acks-0-topic',
      partition: 0,
      message: { value: 'p00', },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    dataHanlderSpy.should.have.been.called; // eslint-disable-line
    dataHanlderSpy.lastCall.args[0].should.be.an('array').and.have.length(1);
    dataHanlderSpy.lastCall.args[1].should.be.a('string', 'kafka-require-acks-0-topic');
    dataHanlderSpy.lastCall.args[2].should.be.a('number', 0);

    dataHanlderSpy.lastCall.args[0][0].should.be.an('object');
    dataHanlderSpy.lastCall.args[0][0].should.have.property('message').that.is.an('object');
    dataHanlderSpy.lastCall.args[0][0].message.should.have.property('value');
    dataHanlderSpy.lastCall.args[0][0].message.value.toString('utf8').should.be.eql('p00');
  });
});

describe('null and empty', function () {
  var producer;
  var consumer;

  var dataHanlderSpy = sinon.spy(function () {});

  before(async () => {
    producer = new Kafka.Producer({
      requiredAcks: 0,
      clientId: 'producer',
    });
    consumer = new Kafka.SimpleConsumer({
      idleTimeout: 100,
      clientId: 'simple-consumer',
    });

    await kafkaTestkit.createTopics(['kafka-null-and-empty-topic',]);

    await Promise.all([
      producer.init(),
      consumer.init(),
    ]);
  });

  beforeEach(() => {
    dataHanlderSpy.reset();
  });

  after(async () => {
    await Promise.all([
      producer.end(),
      consumer.end(),
    ]);
  });

  it('should send/receive null byte string', async () => {
    await consumer.subscribe('kafka-null-and-empty-topic', 0, dataHanlderSpy);
    await producer.send({
      topic: 'kafka-null-and-empty-topic',
      partition: 0,
      message: { value: null, key: null, },
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    dataHanlderSpy.should.have.been.called; // eslint-disable-line
    dataHanlderSpy.lastCall.args[0].should.be.an('array').and.have.length(1);
    dataHanlderSpy.lastCall.args[1].should.be.a('string');
    dataHanlderSpy.lastCall.args[1].should.be.eql('kafka-null-and-empty-topic');
    dataHanlderSpy.lastCall.args[2].should.be.a('number', 0);

    dataHanlderSpy.lastCall.args[0][0].should.be.an('object');
    dataHanlderSpy.lastCall.args[0][0].should.have.property('message').that.is.an('object');
    dataHanlderSpy.lastCall.args[0][0].message.should.have.property('value', null);
    dataHanlderSpy.lastCall.args[0][0].message.should.have.property('key', null);
  });

  it('should send/receive empty byte string', async () => {
    await consumer.subscribe('kafka-null-and-empty-topic', 0, dataHanlderSpy);
    await producer.send({
      topic: 'kafka-null-and-empty-topic',
      partition: 0,
      message: { value: '', key: '', },
    })

    await new Promise(resolve => setTimeout(resolve, 100));

    dataHanlderSpy.should.have.been.called; // eslint-disable-line
    dataHanlderSpy.lastCall.args[0].should.be.an('array').and.have.length(1);
    dataHanlderSpy.lastCall.args[1].should.be.a('string');
    dataHanlderSpy.lastCall.args[1].should.be.eql('kafka-null-and-empty-topic');
    dataHanlderSpy.lastCall.args[2].should.be.a('number', 0);

    dataHanlderSpy.lastCall.args[0][0].should.be.an('object');
    dataHanlderSpy.lastCall.args[0][0].should.have.property('message').that.is.an('object');
    dataHanlderSpy.lastCall.args[0][0].message.should.have.property('value');
    dataHanlderSpy.lastCall.args[0][0].message.value.toString('utf8').should.be.eql('');
    dataHanlderSpy.lastCall.args[0][0].message.should.have.property('key');
    dataHanlderSpy.lastCall.args[0][0].message.key.toString('utf8').should.be.eql('');
  });
});

describe('connectionString', function () {
  it('should throw when connectionString is wrong', function () {
    var producer = new Kafka.Producer({ connectionString: 'localhost', });

    return producer.init().should.be.rejectedWith('No initial hosts to connect');
  });
});

describe('brokerRedirection', function () {
  it('Should execute a function passed for direction', async () => {
    var latched = false;
    var producer = new Kafka.Producer({
      brokerRedirection: function (host, port) {
        latched = true;
        return {
          host: host,
          port: port,
        };
      },
    });

    await producer.init();

    latched.should.eql(true);
  });

  it('Should apply function remapping', async () => {
    var latched = false;
    var producer = new Kafka.Producer({
      connectionString: 'does-not-exist:9092',
      ssl: false,
      brokerRedirection: function () {
        latched = true;
        return {
          host: 'localhost',
          port: 9092,
        };
      },
    });

    // If the init is succesful, then we remapped the bad
    // broker name.
    await producer.init();
    latched.should.eql(true);
  });

  it('Should apply lookup remap (host:port)', async () => {
    var producer = new Kafka.Producer({
      connectionString: 'does-not-exist:9092',
      ssl: false,
      brokerRedirection: {
        'does-not-exist:9092': 'localhost:9092',
      },
    });

    // If the init is succesful, then we remapped the bad
    // broker name.
    await producer.init();
  });

  it('Should apply lookup remap (kafka://host:port)', async () => {
    var producer = new Kafka.Producer({
      connectionString: 'does-not-exist:9092',
      ssl: false,
      brokerRedirection: {
        'kafka://does-not-exist:9092': 'localhost:9092',
      },
    });

    // If the init is succesful, then we remapped the bad
    // broker name.
    await producer.init();
  });

  it('Should apply lookup remap prefixed with Kafka', async () => {
    var producer = new Kafka.Producer({
      connectionString: 'does-not-exist:9092',
      ssl: false,
      brokerRedirection: {
        'kafka://does-not-exist:9092': 'kafka://localhost:9092',
      },
    });

    // If the init is succesful, then we remapped the bad
    // broker name.
    await producer.init();
  });
});
