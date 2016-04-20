'use strict';
const pkg = require('../package');
const Influx = require('./influx');
const _ = require('lodash');
const debug = require('debug')(pkg.name);
const InfluxQL = require('./influx-ql');
const Writer = require('./writer');
const Reader = require('./reader');
const internal = require('./internal');

class Client {
  constructor(uri, options) {
    const reg = /(\S+?):\/\/(\S+?:\S+?@)?(\S+?)\/(\S+)/;
    const result = reg.exec(uri);
    /* istanbul ignore if */
    if (!result || !result[1] || !result[3] || !result[4]) {
      throw new Error(
        'Connect URI is wrong, eg: http://user:pass@localhost:port,anotherhost:port,yetanother:port/mydatabase'
      );
    }
    const opts = _.extend({}, options);
    opts.servers = _.map(result[3].split(','), str => {
      const arr = str.split(':');
      return {
        protocol: result[1],
        host: arr[0],
        port: parseInt(arr[1], 10),
      };
    });

    opts.database = result[4];
    /* istanbul ignore else */
    if (result[2]) {
      const authInfos = result[2].substring(0, result[2].length - 1).split(
        ':');
      opts.username = authInfos[0];
      opts.password = authInfos[1];
    }
    debug('init options:%j', opts);
    const internalData = internal(this);
    internalData.opts = opts;
    internalData.writeQueue = [];
    internalData.queryQueue = [];
    internalData.influx = new Influx(opts);
  }

  /**
   * [availableServers description]
   * @return {[type]} [description]
   */
  get availableServers() {
    return internal(this).influx.availableServers;
  }

  /**
   * [unavailableServers description]
   * @return {[type]} [description]
   */
  get unavailableServers() {
    return internal(this).influx.unavailableServers;
  }

  /**
   * timeout 获取request timeout的值
   * @return {[type]} [description]
   */
  get timeout() {
    return internal(this).influx.timeout;
  }

  /**
   * timeout 设置request timeout的值
   * @return {[type]} [description]
   */
  set timeout(v) {
    internal(this).influx.timeout = v;
  }

  /**
   * writeQueueLength 获取写队列长度
   * @return {[type]} [description]
   */
  get writeQueueLength() {
    return internal(this).writeQueue.length;
  }

  /**
   * queryQueueLength 获取查询队列长度
   * @return {[type]} [description]
   */
  get queryQueueLength() {
    return internal(this).queryQueue.length;
  }

  get options() {
    return _.clone(internal(this).opts);
  }

  /**
   * dropDatabase 删除数据库
   * @return {Promise}
   */
  dropDatabase() {
    const ql = new InfluxQL();
    const opts = internal(this).opts;
    return internal(this).influx.query(ql.dropDatabase(opts.database)).then(_
      .noop);
  }

  /**
   * createDatabase 创建数据库
   * @return {Promise}
   */
  createDatabase() {
    const ql = new InfluxQL();
    const opts = internal(this).opts;
    return internal(this).influx.query(ql.createDatabase(opts.database)).then(
      _.noop);
  }

  /**
   * [createDatabaseNotExists description]
   * @return {[type]} [description]
   */
  createDatabaseNotExists() {
    const ql = new InfluxQL();
    const opts = internal(this).opts;
    return internal(this).influx.query(ql.createDatabaseNotExists(opts.database))
      .then(_.noop);
  }

  /**
   * getMeasurements 获取数据库的所有measurements
   * @return {Promise}
   */
  getMeasurements() {
    const ql = new InfluxQL();
    return internal(this).influx.query(ql.showMeasurements());
  }

  /**
   * dropMeasurement 删除measurement
   * @param  {String} measurement measurement名称
   * @return {[type]}             [description]
   */
  dropMeasurement(measurement) {
    const ql = new InfluxQL();
    return internal(this).influx.query(ql.dropMeasurement(measurement));
  }

  /**
   * queue 添加到queue队列
   * @param  {Reader|Writer} inst Reader or Writer实例
   * @return {[type]}      [description]
   */
  queue(inst) {
    if (inst instanceof Reader) {
      internal(this).queryQueue.push(inst);
    } else {
      internal(this).writeQueue.push(inst);
    }
  }

  /**
   * syncWrite 同步write queue
   * @return {[type]} [description]
   */
  syncWrite() {
    return this._sync('write');
  }

  /**
   * syncQuery 同步read queue
   * @return {[type]} [description]
   */
  syncQuery() {
    return this._sync('query');
  }

  /**
   * [writePoint description]
   * @param  {[type]} measurement [description]
   * @param  {[type]} fields      [description]
   * @param  {[type]} tags        [description]
   * @return {[type]}             [description]
   */
  writePoint(measurement, fields, tags) {
    const writer = this.write(measurement);
    writer.field(fields);
    if (tags) {
      writer.tag(tags);
    }
    return writer.end();
  }
    /**
     * write write point to measurement
     * @param  {String} measurement measurement名称
     * @return {Writer}        [description]
     */
  write(measurement) {
    const writer = new Writer(this);
    writer.measurement(measurement);
    return writer;
  }

  influxWrite(data) {
    return internal(this).influx.write(data);
  }

  /**
   * [query description]
   * @param  {[type]} measurement [description]
   * @return {[type]}        [description]
   */
  query(measurement) {
    return new Reader(this, measurement);
  }

  influxQuery(q) {
    return internal(this).influx.query(q);
  }

  /**
   * [_sync description]
   * @param  {[type]} type [description]
   * @return {[type]}      [description]
   */
  _sync(type) {
    const arr = type === 'query' ? internal(this).queryQueue : internal(this).writeQueue;
    if (!arr.length) {
      return Promise.resolve();
    }
    if (type === 'query') {
      const queryArr = _.map(arr, tmp => tmp.q());
      arr.length = 0;
      return internal(this).influx.query(queryArr.join(';'));
    }
    const data = _.map(arr, item => item.toJSON());
    arr.length = 0;
    return internal(this).influx.writePoints(data).catch(e => {
      const err = e;
      err.data = data;
      throw err;
    });
  }
}

module.exports = Client;
