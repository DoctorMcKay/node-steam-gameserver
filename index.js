var Steam = require('steam-client');
var AppDirectory = require('appdirectory');
var FileStorage = require('file-manager');

require('util').inherits(SteamGameServer, require('events').EventEmitter);

module.exports = SteamGameServer;

SteamGameServer.Steam = Steam;
SteamGameServer.EMachineIDType = require('./resources/EMachineIDType.js');

require('./resources/enums.js');

try {
	SteamGameServer.Steam.servers = require('./resources/servers.json');
} catch(e) {
	// It's okay if it isn't there
}

function SteamGameServer(client, options) {
	if(client && client.constructor.name !== 'SteamClient' && client.constructor.name !== 'CMClient') {
		options = client;
		client = null;
	}

	this.client = client ? client : new Steam.CMClient();
	this.steamID = null;

	// Server info
	this.appID = null;
	this.flags = SteamGameServer.EServerFlags.None;
	this.secure = null;
	this.users = null;

	this.options = options || {};

	var defaultOptions = {
		"autoRelogin": true,
		"machineIdType": SteamGameServer.EMachineIDType.AccountTokenGenerated,
		"machineIdFormat": ["SteamGameServer Hash BB3 {token}", "SteamGameServer Hash FF2 {token}", "SteamGameServer Hash 3B3 {token}"],
		"debug": false
	};

	for(var i in defaultOptions) {
		if(!defaultOptions.hasOwnProperty(i)) {
			continue;
		}

		if(typeof this.options[i] === 'undefined') {
			this.options[i] = defaultOptions[i];
		}
	}

	if (!this.options.dataDirectory) {
		// Might as well just reuse node-steamuser's data dir, as we'll be saving the same things
		if (process.env.OPENSHIFT_DATA_DIR) {
			this.options.dataDirectory = process.env.OPENSHIFT_DATA_DIR + "/node-steamuser";
		} else {
			this.options.dataDirectory = (new AppDirectory({"appName": "node-steamuser", "appAuthor": "doctormckay"})).userData();
		}
	}

	this.storage = new FileStorage(this.options.dataDirectory);

	this.client.on('message', this._handleMessage.bind(this));

	var self = this;
	this.client.on('error', function(e) {
		if(!self.steamID) {
			return; // We've already handled this
		}

		self._handleLogOff(e.eresult || SteamGameServer.EResult.NoConnection, e.message || "NoConnection");
	});

	this.client.on('servers', function(servers) {
		self.storage.writeFile('servers.json', JSON.stringify(servers, null, "\t"));
		if(!client) {
			// It's an internal client, so we know that our Steam has an up-to-date server list
			Steam['__SteamUserServersSet__'] = true;
		}
	});
}

SteamGameServer.prototype.setOption = function(option, value) {
	this.options[option] = value;

	// Handle anything that needs to happen when particular options update
	switch(option) {
		case 'dataDirectory':
			this.storage.directory = value;
			break;
	}
};

SteamGameServer.prototype.setOptions = function(options) {
	for(var i in options) {
		if(!options.hasOwnProperty(i)) {
			continue;
		}

		this.setOption(i, options[i]);
	}
};

/**
 * Same as emit() except the second argument (the first provided to the callback function) is a SteamID and will be appended to the event name with a hash.
 * @private
 */
SteamGameServer.prototype._emitIdEvent = function() {
	this.emit.apply(this, arguments);
	arguments[0] += '#' + arguments[1].getSteamID64();
	this.emit.apply(this, arguments);
};

require('./components/messages.js');
require('./components/logon.js');
require('./components/gameservers.js');
require('./components/friends.js');
require('./components/apps.js');
require('./components/pubfiles.js');

/**
 * Called when the request completes.
 * @callback SteamUser~genericEResultCallback
 * @param {EResult} eresult - The result of the operation
 */
