var Steam = require('steam-client');
var SteamGameServer = require('../index.js');
var SteamID = require('steamid');
var Helpers = require('./helpers.js');
var Schema = require('./protobufs.js');
var Crypto = require('crypto');
var ByteBuffer = require('bytebuffer');

SteamGameServer.prototype.logOn = function(details) {
	if (this.client.loggedOn) {
		throw new Error("Already logged on, cannot log on again");
	}

	this.steamID = null;
	this.secure = false;
	this.users = {};

	this._loggingOff = false;

	if(details !== true) {
		// We're not logging on with saved details
		details = details || {};

		var gamedirs = require('../resources/gamedirs.json');

		this.appID = details.appID;
		this.gameDir = details.gameDirectory || gamedirs[details.appID];
		this.gameVersion = details.gameVersion;
		this.port = details.gamePort || 27015;
		this.queryPort = details.queryPort || 27015;

		if (!this.appID || !this.gameDir || !this.gameVersion) {
			throw new Error("AppID, gameDirectory, and gameVersion are required to log on to Steam");
		}

		this.flags = SteamGameServer.EServerFlags.Private;
		if (details.secure) {
			this.flags |= SteamGameServer.EServerFlags.Secure;
		}

		if (details.dedicated !== false) {
			// default true
			this.flags |= SteamGameServer.EServerFlags.Dedicated;
		}

		if (['freebsd', 'linux', 'openbsd'].indexOf(require('os').platform()) != -1) {
			this.flags |= SteamGameServer.EServerFlags.Linux;
		}

		// Find private IP
		var privateIp = null;
		var interfaces = require('os').networkInterfaces();
		var i, j;
		ifaceLoop:
		for (i in interfaces) {
			if (interfaces.hasOwnProperty(i)) {
				for (j = 0; j < interfaces[i]; j++) {
					if (!interfaces[i][j].internal && interfaces[i][j].family == 'IPv4') {
						privateIp = Helpers.ipStringToInt(interfaces[i][j].address);
						break ifaceLoop;
					}
				}
			}
		}

		this._logOnDetails = {
			"game_server_token": details.token || "",
			"obfustucated_private_ip": privateIp ? (privateIp ^ 0xBAADF00D) : 0,
			"protocol_version": 65575
		};
	}

	var anonLogin = !this._logOnDetails.game_server_token;

	// Read the required files
	var filenames = [];

	if(!Steam['__SteamGameServerServersSet__']) {
		filenames.push('servers.json');
	}

	if (!this._logOnDetails.cell_id) {
		// Some people might be redirecting their storage to a database and running across multiple servers in multiple regions
		// Let's account for this by saving cellid by a "machine ID" so different boxes will store different cellids
		filenames.push('cellid-' + Helpers.getInternalMachineID() + '.txt');
	}

	this.storage.readFiles(filenames, (err, files) => {
		files = files || [];

		files.forEach((file) => {
			if (file.filename == 'servers.json' && file.contents) {
				try {
					Steam.servers = JSON.parse(file.contents.toString('utf8'));
					Steam['__SteamGameServerServersSet__'] = true;
				} catch(e) {
					// don't care
				}
			}

			if (file.filename.match(/^cellid/) && file.contents) {
				var cellID = parseInt(file.contents.toString('utf8'), 10);
				if(!isNaN(cellID)) {
					this._logOnDetails.cell_id = cellID;
				}
			}
		});

		// Do the login
		var sid = new SteamID();
		sid.universe = SteamID.Universe.PUBLIC;
		sid.type = anonLogin ? SteamID.Type.ANON_GAMESERVER : SteamID.Type.GAMESERVER;
		sid.instance = SteamID.Instance.ALL;
		sid.accountid = 0;
		this.client.steamID = sid.getSteamID64();

		if (this.client.connected) {
			onConnected.call(this);
		} else {
			this.client.connect();

			this._onConnected = onConnected.bind(this);
			this.client.once('connected', this._onConnected);
		}
	});
};

function onConnected() {
	if (this.client.constructor.name === 'CMClient') {
		// We need to use this since CMClient defines the protocol version itself
		this.client.logOn(this._logOnDetails);
	} else {
		this._send(SteamGameServer.EMsg.ClientLogon, this._logOnDetails);
	}
}

SteamGameServer.prototype.logOff = SteamGameServer.prototype.disconnect = function(suppressLogoff) {
	this.client.removeListener('connected', this._onConnected);

	if (this.client.connected && !suppressLogoff) {
		this._loggingOff = true;
		this._send(SteamGameServer.EMsg.ClientLogOff, {});

		var timeout = setTimeout(() => {
			this.emit('disconnected', 0, "Logged off");
			this._loggingOff = false;
			this.client.disconnect();
		}, 4000);

		this.once('disconnected', (eresult) => {
			clearTimeout(timeout);
		});
	} else {
		this.client.disconnect();
	}
};

// Handlers

SteamGameServer.prototype._handlers[SteamGameServer.EMsg.ClientLogOnResponse] = function(body) {
	var self = this;
	switch(body.eresult) {
		case SteamGameServer.EResult.OK:
			this.steamID = new SteamID(body.client_supplied_steamid.toString());

			this.publicIP = Helpers.ipIntToString(body.public_ip);
			this.cellID = body.cell_id;

			this.storage.saveFile('cellid-' + Helpers.getInternalMachineID() + '.txt', body.cell_id);

			// Send the GS info
			this._send(SteamGameServer.EMsg.GSServerType, {
				"app_id_served": this.appID,
				"flags": this.flags,
				"game_ip_address": 0,
				"game_port": this.port,
				"game_dir": this.gameDir,
				"game_version": this.gameVersion,
				"game_query_port": this.queryPort
			});

			this.emit('loggedOn', body);

			break;

		case SteamGameServer.EResult.ServiceUnavailable:
		case SteamGameServer.EResult.TryAnotherCM:
			this.emit('debug', 'Log on response: ' + (body.eresult == SteamGameServer.EResult.ServiceUnavailable ? "ServiceUnavailable" : "TryAnotherCM"));
			this.disconnect(true);

			setTimeout(function() {
				self.logOn(true);
			}, 1000);

			break;

		default:
			var result = SteamGameServer.EResult[body.eresult] || body.eresult;

			var error = new Error(result);
			error.eresult = body.eresult;
			this.disconnect(true);
			this.emit('error', error);
	}
};

SteamGameServer.prototype._handlers[SteamGameServer.EMsg.ClientLoggedOff] = function(body) {
	var msg = SteamGameServer.EResult[body.eresult] || body.eresult;

	this.emit('debug', 'Logged off: ' + msg);
	this._handleLogOff(body.eresult, msg);
};

SteamGameServer.prototype._handleLogOff = function(result, msg) {
	var fatal = true;

	if (this.options.autoRelogin && [0, SteamGameServer.EResult.Fail, SteamGameServer.EResult.NoConnection, SteamGameServer.EResult.ServiceUnavailable, SteamGameServer.EResult.TryAnotherCM].indexOf(result) != -1) {
		fatal = false;
	}

	delete this.publicIP;
	delete this.cellID;

	if (fatal && !this._loggingOff) {
		var e = new Error(msg);
		e.eresult = result;

		var steamID = this.steamID;
		this.disconnect(true);

		this.steamID = steamID;
		this.emit('error', e);
		this.steamID = null;
	} else {
		// Only emit "disconnected" if we were previously logged on
		if (this.steamID) {
			this.emit('disconnected', result, msg);
		}

		this.disconnect(true);

		if (!this._loggingOff) {
			setTimeout(() => {
				this.logOn(true);
			}, 1000);
		}

		this._loggingOff = false;
	}
};

SteamGameServer.prototype._handlers[SteamGameServer.EMsg.GSStatusReply] = function(body) {
	this.emit('vac', body.is_secure);
	this.secure = body.is_secure;
};
