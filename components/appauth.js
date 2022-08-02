const SteamGameServer = require('../index.js');

const AppTicket = require('steam-appticket');
const ByteBuffer = require('bytebuffer');
const StdLib = require('@doctormckay/stdlib');
const SteamID = require('steamid');

const EAuthSessionResponse = require('../enums/EAuthSessionResponse');
const EMsg = require('../enums/EMsg.js');

SteamGameServer.prototype.activateAuthSessionTickets = function(appid, tickets, callback) {
	if (!Array.isArray(tickets)) {
		tickets = [tickets];
	}

	return StdLib.Promises.timeoutCallbackPromise(10000, null, callback, true, async (resolve, reject) => {
		tickets.forEach((ticket, idx) => {
			if (ticket instanceof Buffer) {
				ticket = AppTicket.parseAppTicket(ticket);
			}

			if (!ticket || !ticket.isValid || !Buffer.isBuffer(ticket.authTicket)) {
				let invalidReason = 'is invalid';
				if (ticket.isExpired) {
					invalidReason = 'is expired';
				}
				if (!ticket.hasValidSignature) {
					invalidReason = ticket.signature ? 'has an invalid signature' : 'has no signature';
				}

				return reject(new Error(`Ticket ${idx} ${invalidReason}`));
			}

			// Make sure this is for the game we expect
			if (ticket.appID != appid) {
				return reject(new Error(`Ticket ${idx} is for the wrong app: ${ticket.appID}`));
			}

			let sid = ticket.steamID.getSteamID64();

			let isOurTicket = (sid == this.steamID.getSteamID64());
			let thisTicket = {
				estate: isOurTicket ? 0 : 1,
				steamid: isOurTicket ? 0 : sid,
				gameid: ticket.appID,
				h_steam_pipe: this._hSteamPipe,
				ticket_crc: StdLib.Hashing.crc32(ticket.authTicket),
				ticket: ticket.authTicket
			};

			// Check if this ticket is already active
			if (this._activeAuthTickets.find(tkt => tkt.steamid == thisTicket.steamid && tkt.ticket_crc == thisTicket.ticket_crc)) {
				this.emit('debug', `Not attempting to activate already active ticket ${thisTicket.ticket_crc} for ${appid}/${isOurTicket ? 'self' : sid}`);
				return;
			}

			// If we already have an active ticket for this appid/steamid combo, remove it, but not if it's our own
			if (!isOurTicket) {
				let existingTicketIdx = this._activeAuthTickets.findIndex(tkt => tkt.steamid == thisTicket.steamid && tkt.gameid == thisTicket.gameid);
				if (existingTicketIdx != -1) {
					let existingTicket = this._activeAuthTickets[existingTicketIdx];
					this.emit('debug', `Canceling existing ticket ${existingTicket.ticket_crc} for ${existingTicket.gameid}/${existingTicket.steamid}`);
					this._activeAuthTickets.splice(existingTicketIdx, 1);
				}
			}

			this._activeAuthTickets.push(thisTicket);
		});

		await this._sendAuthList();
		resolve();
	});
};

SteamGameServer.prototype._sendAuthList = function(forceAppId) {
	return StdLib.Promises.timeoutPromise(10000, (resolve) => {
		let uniqueAppIds = this._activeAuthTickets.map(tkt => tkt.gameid).filter((appid, idx, arr) => arr.indexOf(appid) == idx);
		if (forceAppId && !uniqueAppIds.includes(forceAppId)) {
			uniqueAppIds.push(forceAppId);
		}

		this.emit('debug', `Sending auth list with ${this._activeAuthTickets.length} active tickets`);

		this._send(EMsg.ClientAuthList, {
			tokens_left: 0, // servers don't need GC tokens
			last_request_seq: this._authSeqMe,
			last_request_seq_from_server: this._authSeqThem,
			tickets: this._activeAuthTickets,
			app_ids: uniqueAppIds,
			message_sequence: ++this._authSeqMe
		}, (body) => {
			this._authSeqThem = body.message_sequence;
			resolve();
		});
	});
};

SteamGameServer.prototype._handlers[EMsg.ClientTicketAuthComplete] = function(body) {
	// First find the ticket in our local cache that matches this crc
	let idx = this._activeAuthTickets.findIndex(tkt => tkt.ticket_crc == body.ticket_crc);
	if (idx == -1) {
		this.emit('debug', `Cannot find CRC ${body.ticket_crc} for ticket from user ${body.steam_id} with state ${body.eauth_session_response}`);
		return;
	}

	let cacheTicket = this._activeAuthTickets[idx];

	// If the auth session response is anything besides OK, we need to remove the ticket from our auth list
	if (body.eauth_session_response != EAuthSessionResponse.OK) {
		this._activeAuthTickets.splice(idx, 1);
		this.emit('debug', `Removed canceled ticket ${body.ticket_crc} with state ${body.eauth_session_response}. Now have ${this._activeAuthTickets.length} active tickets.`);
	}

	// Update the cached ticket's state
	cacheTicket.estate = body.estate;

	// Get the GC token
	let authTicket = ByteBuffer.wrap(cacheTicket.ticket, ByteBuffer.LITTLE_ENDIAN);
	authTicket.skip(4);
	let ticketGcToken = authTicket.readUint64();

	let eventBody = {
		steamID: new SteamID(body.steam_id.toString()), // if our own ticket, this is the steamid that just validated it
		appOwnerSteamID: body.owner_steam_id.toString() == '0' ? null : new SteamID(body.owner_steam_id.toString()),
		appID: parseInt(body.game_id.toString(), 10),
		ticketCrc: body.ticket_crc,
		ticketGcToken,
		state: body.estate,
		authSessionResponse: body.eauth_session_response
	};

	this.emit(cacheTicket.steamid == 0 ? 'authTicketStatus' : 'authTicketValidation', eventBody);
};
