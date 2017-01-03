'use strict';

const _ = require('lodash');

const map = new Map();

exports.set = function set(name, fieldSchema, tagSchema, options) {
  const sortTagSchema = {};
  _.forEach(tagSchema, (v, k) => {
    if (v === '*') {
      sortTagSchema[k] = v;
    }
    if (_.isArray(v)) {
      sortTagSchema[k] = v.sort();
    }
  });
  map.set(name, {
    fieldSchema,
    tagSchema: sortTagSchema,
    options,
  });
};

exports.get = function get(name) {
  return map.get(name);
};

// influxdb data-types
// Integers - append an i to the field value to tell InfluxDB to store the number as an integer. Store the field value 82 as an integer:
// t, T, true, True, or TRUE. Specify FALSE with f, F, false
exports.validateFields = function validateFields(name, data) {
  const schema = exports.get(name);
  if (!schema) {
    return data;
  }
  const definition = schema.fieldSchema;
  const options = schema.options || {};
  const stripUnknown = options.stripUnknown;
  const result = {};
  const booleanList = 't T true True TRUE FALSE f F false'.split(' ');
  _.forEach(data, (value, key) => {
    const type = definition[key];
    if (stripUnknown && !type) {
      return;
    }
    switch (type) {
      case 'float': {
        const v = parseFloat(value);
        if (_.isNaN(v)) {
          break;
        }
        result[key] = v;
        break;
      }
      case 'integer': {
        const v = parseInt(value, 10);
        if (_.isNaN(v)) {
          break;
        }
        result[key] = `${v}i`;
        break;
      }
      case 'boolean': {
        if (_.includes(booleanList, value)) {
          result[key] = value;
        } else if (value) {
          result[key] = 'T';
        } else {
          result[key] = 'F';
        }
        break;
      }
      case 'string': {
        result[key] = value.toString();
        break;
      }
      default: {
        result[key] = value;
        break;
      }
    }
  });
  return result;
};

exports.validateTags = function validateTags(name, data) {
  const schema = exports.get(name);
  if (!schema) {
    return data;
  }
  const definition = schema.tagSchema;
  const options = schema.options || {};
  const stripUnknown = options.stripUnknown;
  const result = {};
  _.forEach(data, (value, key) => {
    const opts = definition[key];
    if (stripUnknown && !opts) {
      return;
    }
    const v = String(value).toString();
    if (opts === '*' || _.sortedIndexOf(opts, v) !== -1) {
      result[key] = v;
    }
  });
  return result;
};
