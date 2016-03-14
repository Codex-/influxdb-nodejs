'use strict';
const qs = require('querystring');
const _ = require('lodash');
const HTTP = require('./http');

function format(data) {
	return _.map(data, (v, k) => {
		return `${k}=${v}`;
	}).join(',');
}


function getPostData(series, tags, values) {
	const time = values.time;
	delete values.time;
	return `${series},${format(tags)} ${format(values)} ${time}`;
}

class Influx {
	constructor(options) {
		this._options = options;
		const servers = options.servers || [{
			host: options.host,
			port: options.port,
			protocol: options.protocol
		}];
		this._client = new HTTP(_.map(servers, server => {
			return _.pick(server, ['host', 'protocol', 'port']);
		}));
	}

	set timeout(v) {
		this._client.timeout = v;
	}
	get timeout() {
		return this._client.timeout;
	}

	get availableServers() {
		return this._client.availableServers;
	}
	get unavailableServers() {
		return this._client.unavailableServers;
	}
	
	query(q) {
		const options = this._options;
		const data = {
			q: q,
			db: options.database
		};
		const url = `/query?${qs.stringify(data)}`;
		return this._client.get(url);
	}

	write(data) {
		const options = this._options;
		const queryData = {
			db: options.database
		};
		/* istanbul ignore if */
		if (options.username && options.password) {
			data.u = data.username;
			data.p = data.password;
		}
		const url = `/write?${qs.stringify(queryData)}`;
		const postData = getPostData(data.series, data.tags, data.values);
		return this._client.post(url, postData);
	}

	writeSeries(data) {
		const options = this._options;
		const queryData = {
			db: options.database
		};
		/* istanbul ignore if */
		if (options.username && options.password) {
			data.u = data.username;
			data.p = data.password;
		}
		const url = `/write?${qs.stringify(queryData)}`;
		const postData = [];
		_.forEach(data, (v, series) => {
			_.forEach(v, tmp => {
				postData.push(getPostData(series, tmp.tags, tmp.values));
			});
		});
		return this._client.post(url, postData.join('\n'));
	}
}




module.exports = Influx;