'use strict';
const assert = require('assert');
const Writer = require('../lib/writer');
const Reader = require('../lib/reader');
const Influx = require('../lib/influx');
const _ = require('lodash');

describe('Writer', () => {
  const delay = (ms) => {
    return new Promise(resolve => {
      setTimeout(resolve, ms).unref();
    });
  };
  const influx = new Influx({
    servers: [
      {
        host: '127.0.0.1',
        port: 8086,
      }
    ],
    database: 'mydb',
  });

  it('create database', done => {
    influx.query('create database if not exists mydb').then(data => {
      assert(!_.isEmpty(data));
      done();
    }).catch(done);
  });

  it('write point', done => {
    const writer = new Writer(influx);
    writer.measurement = 'http'
    assert.equal(writer.measurement, 'http');
    writer.tag({
      spdy: 'fast',
      type: '2',
    })
    .tag('method', 'get')
    .field({
      use: 500,
      size: 11 * 1024,
    })
    .field('code', 400)
    .then(() => {
        return delay(100);
    })
    .then(() => {
      const reader = new Reader(influx);
      reader.measurement = 'http';
      return reader.condition('spdy', 'fast');
    })
    .then(data => {
      assert.equal(data.results[0].series[0].values.length, 1);
      done();
    }).catch(done);
  });

  it('write point with time', done => {
    const writer = new Writer(influx);
    writer.measurement = 'http';
    writer.tag('spdy', 'lightning')
      .field('use', 100)
      .time()
      .then(() => {
        return delay(100);
      })
      .then(() => {
        const reader = new Reader(influx);
        reader.measurement = 'http';
        // return reader.tag({spdy: '  lightning'});
        return reader.condition('spdy', 'lightning');
      })
      .then(data => {
        assert.equal(data.results[0].series[0].values.length, 1);
        done();
      }).catch(done);
  });

  it('write point with time and precision', done => {
    const writer = new Writer(influx);
    writer.measurement = 'http';
    writer.precision = 'ms';
    writer.tag('usePrecision', 'true')
      .field('use', 100)
      .time(1463413422809)
      .then(() => {
        return delay(100);
      })
      .then(() => {
        const reader = new Reader(influx);
        reader.measurement = 'http';
        // return reader.tag({spdy: '  lightning'});
        return reader.condition('usePrecision', 'true');
      })
      .then(data => {
        assert.equal(data.results[0].series[0].values.length, 1);
	assert.equal(new Date(data.results[0].series[0].values[0][0]).getTime(), 1463413422809);
        done();
      }).catch(done);
  });

  it('write queue', done => {
    const set = new Set();
    const writer = new Writer(influx, set);
    writer.measurement = 'http';
    writer.tag('spdy', 'fast');
    writer.field('use', 200);
    writer.queue();
    for (let item of set) {
      assert.equal(item.measurement, 'http');
      assert.equal(item.tags.spdy, 'fast');
      assert.equal(item.fields.use, 200);
      assert.equal(item.time.length, 19);
    }
    assert.equal(set.size, 1);
    done();
  });

  it('drop db', done => {
    influx.query('drop database mydb').then(data => {
      assert(!_.isEmpty(data));
      done();
    }).catch(done);
  });
});
