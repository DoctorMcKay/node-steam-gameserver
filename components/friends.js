var SteamGameServer = require('../index.js');
var SteamID = require('steamid');
var ByteBuffer = require('bytebuffer');
var Helpers = require('./helpers.js');

/**
 * Requests information about one or more user profiles.
 * @param {(SteamID[]|string[])} steamids - An array of SteamID objects or strings which can parse into them.
 * @param {function} [callback] - Optional. Called with an object whose keys are 64-bit SteamIDs as strings, and whose values are persona objects.
 */
SteamGameServer.prototype.getPersonas = function(steamids, callback) {
	var Flags = SteamGameServer.EClientPersonaStateFlag;
	var flags = Flags.Status|Flags.PlayerName|Flags.QueryPort|Flags.SourceID|Flags.Presence|
		Flags.Metadata|Flags.LastSeen|Flags.ClanInfo|Flags.GameExtraInfo|Flags.GameDataBlob|
		Flags.ClanTag|Flags.Facebook;

	var ids = steamids.map(function(id) {
		if (typeof id === 'string') {
			return (new SteamID(id)).getSteamID64();
		}

		return id.toString();
	});

	this._send(SteamGameServer.EMsg.ClientRequestFriendData, {
		"friends": ids,
		"persona_state_requested": flags
	});

	if (callback) {
		var output = {};

		var self = this;
		ids.forEach(function(id) {
			self.once('user#' + id, receive);
		});

		function receive(sid, user) {
			var sid64 = sid.getSteamID64();
			output[sid64] = user;

			var index = ids.indexOf(sid64);
			if (index != -1) {
				ids.splice(index, 1);
			}

			if (ids.length === 0) {
				callback(output);
			}
		}
	}
};

/**
 * Gets the Steam Level of one or more Steam users.
 * @param {(SteamID[]|string[])} steamids - An array of SteamID objects, or strings which can parse into one.
 * @param {function} callback - Called on completion with an object whose keys are 64-bit SteamIDs as strings, and whose values are Steam Level numbers.
 */
SteamGameServer.prototype.getSteamLevels = function(steamids, callback) {
	var accountids = steamids.map(function(steamID) {
		if (typeof steamID === 'string') {
			return (new SteamID(steamID)).accountid;
		} else {
			return steamID.accountid;
		}
	});

	this._send(SteamGameServer.EMsg.ClientFSGetFriendsSteamLevels, {"accountids": accountids}, function(body) {
		var output = {};

		var sid = new SteamID();
		sid.universe = SteamID.Universe.PUBLIC;
		sid.type = SteamID.Type.INDIVIDUAL;
		sid.instance = SteamID.Instance.DESKTOP;

		(body.friends || []).forEach(function(user) {
			sid.accountid = user.accountid;
			output[sid.getSteamID64()] = user.level;
		});

		callback(output);
	});
};

// Handlers

SteamGameServer.prototype._handlers[SteamGameServer.EMsg.ClientPersonaState] = function(body) {
	body.friends.forEach((user) => {
		var sid = new SteamID(user.friendid.toString());
		var sid64 = sid.getSteamID64();
		delete user.friendid;

		var i;
		if (!this.users[sid64]) {
			this.users[sid64] = user;
			processUser(this.users[sid64]);
		} else {
			// Replace unknown data in the received object with already-known data
			for (i in this.users[sid64]) {
				if(this.users[sid64].hasOwnProperty(i) && user.hasOwnProperty(i) && user[i] === null) {
					user[i] = this.users[sid64][i];
				}
			}
		}

		processUser(user);

		/**
		 * Emitted when we receive persona info about a user.
		 * You can also listen for user#steamid64 to get info only for a specific user.
		 *
		 * @event SteamGameServer#user
		 * @param {SteamID} steamID - The SteamID of the user
		 * @param {Object} user - An object containing the user's persona info
		 */

		this._emitIdEvent('user', sid, user);

		for (i in user) {
			if (user.hasOwnProperty(i) && user[i] !== null) {
				this.users[sid][i] = user[i];
			}
		}
	});
};

function processUser(user) {
	if (typeof user.gameid === 'object' && user.gameid !== null) {
		user.gameid = user.gameid.toNumber();
	}

	if (typeof user.last_logoff === 'number') {
		user.last_logoff = new Date(user.last_logoff * 1000);
	}

	if (typeof user.last_logon === 'number') {
		user.last_logon = new Date(user.last_logon * 1000);
	}

	if (typeof user.avatar_hash === 'object' && (Buffer.isBuffer(user.avatar_hash) || ByteBuffer.isByteBuffer(user.avatar_hash))) {
		var hash = user.avatar_hash.toString('hex');
		user.avatar_url_icon = "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/" + hash.substring(0, 2) + "/" + hash;
		user.avatar_url_medium = user.avatar_url_icon + "_medium.jpg";
		user.avatar_url_full = user.avatar_url_icon + "_full.jpg";
		user.avatar_url_icon += ".jpg";
	}
}
