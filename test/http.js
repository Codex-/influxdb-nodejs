'use strict';
const assert = require('assert');
const HTTP = require('../lib/http');
const _ = require('lodash');
const request = require('superagent');
const db = 'vicanso';
describe('HTTP', () => {
  const http = new HTTP([
    {
      host: 'localhost',
      port: 8086,
    }
  ], 'round-robin');

  it('get from backend', done => {
    http.get('/ping').then(res => {
      assert.equal(res.status, 204);
      assert(res.get('X-Influxdb-Version'));
      done();
    }).catch(done);    
  });

  it('create database by post', done => {
    http.post('/query', {
      q: `create database ${db}`,
    }).then(res => {
      assert(!_.isEmpty(res.body));
      done();
    }).catch(done);
  });

  it('post data to backend', done => {
    http.post('/write', 'cpu_load_short,host=server01,region=us-west value=0.64', {
      db,
    }).then(res => {
      done();
    }).catch(done);
  });

  it('drop db', done => {
    http.post('/query', {
      q: `drop database ${db}`,
    }).then(res => {
      assert(!_.isEmpty(res.body));
      done();
    }).catch(done);
  });

  it('set global timeout', done => {
    http.timeout = 1;
    assert(http.timeout, 1);
    http.get('/ping').then().catch(err => {
      assert.equal(err.code, 'ECONNABORTED');
      http.timeout = 0;
      done();
    });
  });

  it('set single timeout', done => {
    http.get('/ping').timeout(1).then().catch(err => {
      assert.equal(err.code, 'ECONNABORTED');
      done();
    });
  });
});
