var SteamGameServer = require('../index.js');
var ByteBuffer = require('bytebuffer');

var Schema = require('./protobufs.js');

var protobufs = {};
protobufs[SteamGameServer.EMsg.ClientLogon] = Schema.CMsgClientLogon;
protobufs[SteamGameServer.EMsg.ClientLogOnResponse] = Schema.CMsgClientLogonResponse;
protobufs[SteamGameServer.EMsg.ClientLogOff] = Schema.CMsgClientLogOff;
protobufs[SteamGameServer.EMsg.ClientLoggedOff] = Schema.CMsgClientLoggedOff;
protobufs[SteamGameServer.EMsg.GSServerType] = Schema.CMsgGSServerType;
protobufs[SteamGameServer.EMsg.GSStatusReply] = Schema.CMsgGSStatusReply;
protobufs[SteamGameServer.EMsg.ClientServiceMethod] = Schema.CMsgClientServiceMethod;
protobufs[SteamGameServer.EMsg.ClientServiceMethodResponse] = Schema.CMsgClientServiceMethodResponse;
protobufs[SteamGameServer.EMsg.ClientGMSServerQuery] = Schema.CMsgClientGMSServerQuery;
protobufs[SteamGameServer.EMsg.GMSClientServerQueryResponse] = Schema.CMsgGMSClientServerQueryResponse;
protobufs[SteamGameServer.EMsg.ClientFSGetFriendsSteamLevels] = Schema.CMsgClientFSGetFriendsSteamLevels;
protobufs[SteamGameServer.EMsg.ClientFSGetFriendsSteamLevelsResponse] = Schema.CMsgClientFSGetFriendsSteamLevelsResponse;
protobufs[SteamGameServer.EMsg.ClientRequestFriendData] = Schema.CMsgClientRequestFriendData;
protobufs[SteamGameServer.EMsg.ClientPersonaState] = Schema.CMsgClientPersonaState;
protobufs[SteamGameServer.EMsg.ClientGetNumberOfCurrentPlayersDP] = Schema.CMsgDPGetNumberOfCurrentPlayers;
protobufs[SteamGameServer.EMsg.ClientGetNumberOfCurrentPlayersDPResponse] = Schema.CMsgDPGetNumberOfCurrentPlayersResponse;
protobufs[SteamGameServer.EMsg.ClientAuthList] = Schema.CMsgClientAuthList;
protobufs[SteamGameServer.EMsg.ClientAuthListAck] = Schema.CMsgClientAuthListAck;
protobufs[SteamGameServer.EMsg.ClientTicketAuthComplete] = Schema.CMsgClientTicketAuthComplete;
protobufs[SteamGameServer.EMsg.ClientPICSChangesSinceRequest] = Schema.CMsgClientPICSChangesSinceRequest;
protobufs[SteamGameServer.EMsg.ClientPICSChangesSinceResponse] = Schema.CMsgClientPICSChangesSinceResponse;
protobufs[SteamGameServer.EMsg.ClientPICSProductInfoRequest] = Schema.CMsgClientPICSProductInfoRequest;
protobufs[SteamGameServer.EMsg.ClientPICSProductInfoResponse] = Schema.CMsgClientPICSProductInfoResponse;
protobufs[SteamGameServer.EMsg.ClientPICSAccessTokenRequest] = Schema.CMsgClientPICSAccessTokenRequest;
protobufs[SteamGameServer.EMsg.ClientPICSAccessTokenResponse] = Schema.CMsgClientPICSAccessTokenResponse;

// Unified protobufs
protobufs['GameServers.GetServerList#1_Request'] = Schema.CGameServers_GetServerList_Request;
protobufs['GameServers.GetServerList#1_Response'] = Schema.CGameServers_GetServerList_Response;
protobufs['GameServers.GetServerSteamIDsByIP#1_Request'] = Schema.CGameServers_GetServerSteamIDsByIP_Request;
protobufs['GameServers.GetServerSteamIDsByIP#1_Response'] = Schema.CGameServers_IPsWithSteamIDs_Response;
protobufs['GameServers.GetServerIPsBySteamID#1_Request'] = Schema.CGameServers_GetServerIPsBySteamID_Request;
protobufs['GameServers.GetServerIPsBySteamID#1_Response'] = Schema.CGameServers_IPsWithSteamIDs_Response;
protobufs['PublishedFile.GetDetails#1_Request'] = Schema.CPublishedFile_GetDetails_Request;
protobufs['PublishedFile.GetDetails#1_Response'] = Schema.CPublishedFile_GetDetails_Response;
protobufs['Player.GetGameBadgeLevels#1_Request'] = Schema.CPlayer_GetGameBadgeLevels_Request;
protobufs['Player.GetGameBadgeLevels#1_Response'] = Schema.CPlayer_GetGameBadgeLevels_Response;

ByteBuffer.DEFAULT_ENDIAN = ByteBuffer.LITTLE_ENDIAN;

SteamGameServer.prototype._send = function(emsg, body, callback) {
	if((!this.steamID || !this.client.connected) && [SteamGameServer.EMsg.ChannelEncryptRequest, SteamGameServer.EMsg.ChannelEncryptResponse, SteamGameServer.EMsg.ChannelEncryptResult, SteamGameServer.EMsg.ClientLogon].indexOf(emsg) == -1) {
		// We're disconnected, drop it
		this.emit('debug', 'Dropping message ' + emsg + ' because we\'re not logged on.');
		return;
	}

	var header = {
		"msg": emsg
	};

	var Proto = protobufs[emsg];
	if(Proto) {
		header.proto = {};
		body = new Proto(body).toBuffer();
	} else if(ByteBuffer.isByteBuffer(body)) {
		body = body.toBuffer();
	}

	var cb = null;
	if(callback) {
		cb = function(header, body) {
			if(protobufs[header.msg]) {
				body = protobufs[header.msg].decode(body);
			} else {
				body = ByteBuffer.wrap(body);
			}

			callback(body);
		};
	}

	if(this.options.debug) {
		for(var i in SteamGameServer.EMsg) {
			if(SteamGameServer.EMsg.hasOwnProperty(i) && SteamGameServer.EMsg[i] == emsg) {
				emsg = i;
				break;
			}
		}
	}

	this.emit('debug', 'Sending message: ' + emsg);
	this.client.send(header, body, cb);
};

SteamGameServer.prototype._handleMessage = function(header, body, callback) {
	var msgName = header.msg;

	if(this.options.debug) {
		for(var i in SteamGameServer.EMsg) {
			if(SteamGameServer.EMsg.hasOwnProperty(i) && SteamGameServer.EMsg[i] == header.msg) {
				msgName = i;
				break;
			}
		}
	}

	if(!this._handlers[header.msg]) {
		if(header.msg != SteamGameServer.EMsg.Multi) {
			this.emit('debug', 'Unhandled message: ' + msgName);
		}

		return;
	}

	if(protobufs[header.msg]) {
		body = protobufs[header.msg].decode(body);
	} else {
		body = ByteBuffer.wrap(body);
	}

	this.emit('debug', 'Handled message: ' + msgName);

	var cb = null;
	if(callback) {
		cb = function(emsg, body) {
			var header = {"msg": emsg};

			if(protobufs[emsg]) {
				header.proto = {};
				body = new protobufs[emsg](body).toBuffer();
			}

			callback(header, body);
		}
	}

	this._handlers[header.msg].call(this, body, cb);
};

SteamGameServer.prototype._handlers = {};

// Unified messages

SteamGameServer.prototype._sendUnified = function(methodName, methodData, notification, callback) {
	var cb;
	if(callback && protobufs[methodName + '_Response']) {
		cb = function(body) {
			var Proto = protobufs[methodName + '_Response'];
			callback(Proto.decode(body.serialized_method_response));
		};
	}

	var Proto = protobufs[methodName + '_Request'];
	this._send(SteamGameServer.EMsg.ClientServiceMethod, {
		"method_name": methodName,
		"serialized_method": new Proto(methodData).toBuffer(),
		"is_notification": notification
	}, cb);
};
