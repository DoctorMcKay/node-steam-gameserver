# SteamGameServer
### A handler module for node-steam v1.0.0 and greater
[![npm version](https://img.shields.io/npm/v/steam-gameserver.svg)](https://npmjs.com/package/steam-gameserver)
[![npm downloads](https://img.shields.io/npm/dm/steam-gameserver.svg)](https://npmjs.com/package/steam-gameserver)
[![dependencies](https://img.shields.io/david/DoctorMcKay/node-steam-gameserver.svg)](https://david-dm.org/DoctorMcKay/node-steam-gameserver)
[![license](https://img.shields.io/npm/l/steam-gameserver.svg)](https://github.com/DoctorMcKay/node-steam-gameserver/blob/master/LICENSE)
[![paypal](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=N36YVAT42CZ4G&item_name=node%2dsteam%2dgameserver&currency_code=USD)

SteamGameServer is a handler module for [node-steam](https://github.com/seishun/node-steam) version 1.0.0 or greater.
It also works with [node-steam-client](https://github.com/DoctorMcKay/node-steam-client).

It connects to Steam as a gameserver, either anonymously or with a game server login token (GSLT).

So as to comply with Valve's rules, this doesn't register with the master server, so no server will show up on the
server browser.

[Subscribe to release announcements](https://github.com/DoctorMcKay/node-steam-gameserver/releases.atom)

# Contents
- [Enums](#enums-)
- [Static Properties](#static-properties-)
- [Static Methods](#static-methods-)
- [Options](#options-)
- [Properties](#properties-)
- [Methods](#methods-)
- [Events](#events-)

# Enums [^](#contents)

There are a lot of enums used in Steam. They're all available directly from `SteamGameServer`. For example, access `EResult`
using `SteamGameServer.EResult`.

All enums can be viewed [on GitHub](https://github.com/DoctorMcKay/node-steam-gameserver/tree/master/enums).

Additionally, for convenience, the name of an enum value is available from any enum at the key identified by the enum
value. For example, given an EResult of `88` you can translate it using `SteamGameServer.EResult[88]` which gives you
the string `TwoFactorCodeMismatch`.

# Static Properties [^](#contents)

Static properties, or properties attached directly to `SteamGameServer`, are accessed on the root module and not on instantiated handler instances.

### Steam

The `node-steam-client` module installation used by `SteamGameServer`. You can use this in place of `require('steam-client')`
if you'd like to avoid duplicate installations.

# Options [^](#contents)

There are a number of options which can control the behavior of the `SteamGameServer` object. They are:

### dataDirectory

Controls where the Steam server list is written. If `null`, no data will be automatically stored.

Defaults to a platform-specific user data directory.

- On [OpenShift](https://www.openshift.com), this is `$OPENSHIFT_DATA_DIR/node-steamuser`
- On Windows, this is `%localappdata%\doctormckay\node-steamuser`
- On Mac, this is `~/Library/Application Support/node-steamuser`
- On Linux, this is `$XDG_DATA_HOME/node-steamuser`, or `~/.local/share/node-steamuser` if `$XDG_DATA_HOME` isn't defined or is empty

This reuses [`node-steam-user`](https://github.com/DoctorMcKay/node-steam-user)'s data directory so as to avoid duplicate files.

#### Custom Storage Engine

If you don't want to (or can't) save data to the disk, you can implement your own storage engine. To do this, simply add the following code:

```js
client.storage.on('save', function(filename, contents, callback) {
	// filename is the name of the file, as a string
	// contents is a Buffer containing the file's contents
	// callback is a function which you MUST call on completion or error, with a single error argument

	// For example:
	someStorageSystem.saveFile(filename, contents, function(err) {
		callback(err);
	});
});

client.storage.on('read', function(filename, callback) {
	// filename is the name of the file, as a string
	// callback is a function which you MUST call on completion or error, with an error argument and a Buffer argument

	// For example:
	someStorageSystem.readFile(filename, function(err, file) {
		if(err) {
			callback(err);
			return;
		}

		callback(null, file);
	});
});
```

In this manner, you can save data to a database, a cloud service, or anything else you choose.

### autoRelogin

A boolean which controls whether or not `SteamGameServer` will automatically reconnect to Steam if disconnected due to Steam going down.

Defaults to `true`.

### machineIdType

What kind of machine ID will SteamGameServer send to Steam when logging on? Should be a value from
[`EMachineIDType`](https://github.com/DoctorMcKay/node-steam-gameserver/blob/master/resources/EMachineIDType.js).

Only meaningful when logging into a persistent account with a token. Defaults to `AccountTokenGenerated`.

### machineIdFormat

If you're using `machineIdType` `AccountTokenGenerated`, this is the format it uses. This is an array of three strings,
each of which will be hashed with SHA1 before being sent to Steam. `{token}` will be replaced with the current account
login token.

Defaults to `["SteamGameServer Hash BB3 {account_name}", "SteamGameServer Hash FF2 {account_name}", "SteamGameServer Hash 3B3 {account_name}"]`.

# Properties [^](#contents)

### client

The `SteamClient` or `CMClient` which is being used to communicate with Steam.

### steamID

`null` if not connected, a [`SteamID`](https://www.npmjs.com/package/steamid) containing your SteamID otherwise.

### options

An object containing options for this `SteamGameServer`. **Read-only**, use `setOption` or `setOptions` to change an option.

### publicIP

Only defined if you're currently logged on. This is your public IP as reported by Steam, in "x.x.x.x" format.

### cellID

Only defined if you're currently logged on. This is your cell (region ID) on the Steam network.

### appID

**Read-only.** The Steam AppID for the game this server is "running".

### gameDir

**Read-only.** The game directory reported to Steam for the game this server is "running".

### gameVersion

**Read-only.** The game version reported to Steam for the game this server is "running".

### port

**Read-only.** The port reported to Steam on which this "server" is "listening" for game connections.

### queryPort

**Read-only.** The port reported to Steam on which this "server" is "listening" for UDP server browser queries.

### flags

**Read-only.** The server flags reported to Steam when we connected.

### secure

`true` if Steam reports this server as being VAC-secured. `false` if not.

# Methods [^](#contents)

### Constructor([client][, options])
- `client` - An optional `SteamClient` or `CMClient` to use to connect to Steam. If not provided, one will be created automatically.
- `options` - An optional object containing zero or more [options](#options-) to set for this `SteamGameServer`.

Constructs a new `SteamGameServer`. If you allow `SteamGameServer` to create its own `SteamClient`, then `SteamGameServer` will
automatically save and reload the CM server list.

### setOption(option, value)
- `option` - The name of the option to set
- `value` - The value to set for this option

Changes the value of an [option](#options-).

### setOptions(options)
- `options` - An object containing zero or more [options](#options-).

### logOn(details)
- `details` - An object containing details for this logon
	- `appID` - Required. The AppID for the game this "server" will be "running".
	- `gameVersion` - Required. The version for the game this "server" will be "running" to report to Steam.
	- `gameDirectory` - Required if not available in [gamedirs.json](https://github.com/DoctorMcKay/node-steam-gameserver/blob/master/resources/gamedirs.json). The game directory for the game this "server" will be "running".
	- `gamePort` - Optional. The port on which this "server" will be "listening" for game connections. Defaults to 27015.
	- `queryPort` - Optional. The port on which this "server" will be "listening" for UDP queries. Defaults to 27015.
	- `secure` - Optional. `true` if this "server" wants to be VAC-secured. `false` if not.
	- `token` - Optional. A game server login token (GSLT) ([see here](https://steamcommunity.com/dev/managegameservers)) if you want to login to a persistent gameserver account. Omit to login to an anonymous gameserver account.
	

Logs onto Steam. The `CMClient`/`SteamClient` should **not** be already logged on, although it can be
connected.

### logOff()

Logs you off of Steam and closes the connection.

### getPlayerCount(appid, callback)
- `appid` - The AppID of the app for which you'd like the current player/user count (use `0` to get current logged-in Steam user count)
- `callback` - Called when the requested data is available
	- `err` - An `Error` object on failure, or `null` on success
	- `players` - If not errored, how many Steam users are currently playing/using the app

Requests a count of how many Steam users are currently playing/using an app.

### serverQuery(conditions, callback)
- `conditions` - A [filter string](https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Filter) or an object containing one or more of the following properties:
	- `app_id` - The AppID of the game for which you want servers
	- `geo_location_ip` - The IP address of the querying client, used for geolocation (in `x.x.x.x` format)
	- `region_code` - The [region code](https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Region_codes) where you want servers
	- `filter_text` - A [filter string](https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Filter)
	- `max_servers` - Maximum number of servers to return in this response (default and hard limit 5000)
- `callback` - Called when the response is available
	- `err` - If an error occurred, this is an `Error` object. Otherwise, it's `null`.
	- `servers` - An array of objects containing server data
		- `ip` - The server's IP in `x.x.x.x` format
		- `port` - The server's game port
		- `players` - How many authenticated players are on this server (the Steam server browser will use this value if the gameserver itself reports more players and doesn't report itself as full, to prevent inflated player counts)

Requests a list of game servers from the master server.

### getServerList(filter, limit, callback)
- `filter` - A master server [filter string](https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Filter)
- `limit` - How many servers should be returned, at maximum. Hard limit is 5000.
- `callback` - Called when the requested data is available
	- `servers` - An array of objects containing server data
		- `addr` - The server's IP address in `x.x.x.x:p` format
		- `gameport` - The port the server is running on for game clients
		- `specport` - The port the server is running on for spectator clients (`null` for none)
		- `steamid` - A [`SteamID`](https://www.npmjs.com/package/steamid) object containing the server's SteamID
		- `name` - The server's hostname
		- `appid` - The AppID of the game which the server is serving
		- `gamedir` - The directory of the game which the server is serving
		- `version` - The version of the game which the server is serving
		- `product` - The product name of the game which the server is serving
		- `region` - The [region code](https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Region_codes) for where the server is located
		- `players` - How many people are currently on this server
		- `max_players` - How many people can be on the server at once
		- `bots` - How many CPU players are currently on this server
		- `map` - The name of the map which the server is currently running
		- `secure` - `true` if the server is VAC-secure, `false` if not
		- `dedicated` - `true` if the server is dedicated, `false` if listen
		- `os` - `w` if the server is running on Windows, `l` for Linux
		- `gametype` - The server's tags, separated by commas

Requests a list gameservers from Steam matching a given filter, along with information about the server as Steam knows it.

### getServerSteamIDsByIP(ips, callback)
- `ips` - An array of IP addresses, in `x.x.x.x:p` format
- `callback` - Called when requested data is available
	- `servers` - An object whose keys are IP addresses in `x.x.x.x:p` format and values are [`SteamID`](https://www.npmjs.com/package/steamid) objects

Gets current SteamIDs for servers running on given addresses.

### getServerIPsBySteamID(steamids, callback)
- `steamids` - An array of [`SteamID`](https://www.npmjs.com/package/steamid) objects, or something which can parse into one (64-bit SteamID as string, Steam3 rendered format)
- `callback` - Called when requested data is available
	- `servers` - An object whose keys are 64-bit numeric SteamIDs and values are IP addresses in `x.x.x.x:p` format

Gets current IP addresses for servers with given SteamIDs.

### getProductChanges(sinceChangenumber, callback)
- `sinceChangenumber` - The changenumber of the last known changelist. You will get changes which have occurred since then and now. You won't get any info except the current changenumber if you request more than around 5,000 changenumbers in the past.
- `callback` - Called when data is available
	- `currentChangenumber` - The changenumber of the newest changelist
	- `apps` - An array of objects for apps which have changed. Each object has these properties:
		- `appid` - The AppID of the app
		- `change_number` - The changenumber of the latest changelist in which the app has changed
		- `needs_token` - `true` if you need an access token to get most details about this app, `null` if not
	- `packages` - An array of objects for packages which have changed. Each object has the same properties as the `apps` array, except `appid` is `packageid`.

Requests a list of all apps/packages which have changed since a given changenumber.

### getProductInfo(apps, packages, callback)
- `apps` - Either an array of AppIDs, or an array of objects containing `appid` and `access_token` properties
- `packages` - Either an array of PackageIDs, or an array of objects containing `packageid` and `access_token` properties
- `callback` - Called when requested data is available
	- `apps` - An object whose keys are AppIDs and whose values are objects
		- `changenumber` - The changenumber of the latest changelist in which this app changed
		- `missingToken` - `true` if you need to provide an access token to get more details about this app
		- `appinfo` - An object whose structure is identical to the output of `app_info_print` in the [Steam console](steam://nav/console)
	- `packages` - An object whose keys are PackageIDs and whose values are objects. Each object has the same properties as the `apps` array, except `appinfo` is `packageinfo`.
	- `unknownApps` - An array of input AppIDs which don't exist
	- `unknownPackages` - An array of input PackageIDs which don't exist

Requests details about one or more apps or packages.

### getPublishedFileDetails(ids, callback)
- `ids` - Either an integer, or an array of integers containing the IDs of the published file(s) you want details for
- `callback` - A function to be called when the request has completed
    - `err` - An `Error` object on failure, or `null` on success
    - `results` - An object whose keys are published file IDs, and values are object containing a ton of information

Gets details for one or more published files. Published files are anything with a URL like
`https://steamcommunity.com/sharedfiles/filedetails/?id=662626851` (where `id` is the published file ID).

The amount of data available in `results` is huge, so I can only suggest that you `console.log` it to see what's
available.

### getPersonas(steamids[, callback])
- `steamids` - An array of `SteamID` objects or strings which can parse into `SteamID` objects
- `callback` - Optional. Called when the requested data is available.
	- `personas` - An object whose keys are 64-bit SteamIDs and whose values are objects identical to those received in the [`user`](#user) event

Requests persona data for one or more users from Steam. The response will arrive in the [`user`](#user) event, or in the callback if provided.

### getSteamLevels(steamids, callback)
- `steamids` - An array of `SteamID` objects or strings that can parse into `SteamID` objects
- `callback` - Called when the requested data is available.
	- `results` - An object whose keys are 64-bit SteamIDs (as strings) and whose values are Steam levels

Gets the Steam Level for one or more Steam users.

# Events [^](#contents)

## ID Events

Events marked as **ID events** are special. They all have a `SteamID` object as their first parameter. In addition to the event itself firing, a second event comprised of `eventName + "#" + steamID.getSteamID64()` is fired.

For example:

```js
// This will fire when we receive a chat message from ANY friend
server.on('friendMessage', function(steamID, message) {
	console.log("Friend message from " + steamID.getSteam3RenderedID() + ": " + message);
});

// This will fire when we receive a chat message from [U:1:46143802] / 76561198006409530 ONLY
server.on('friendMessage#76561198006409530', function(steamID, message) {
	console.log("Friend message from " + steamID.getSteam3RenderedID() + ": " + message);
});
```

### loggedOn
- `details` - An object containing various details about your account (see [`CMsgClientLogonResponse`](https://github.com/SteamRE/SteamKit/blob/SteamKit_1.6.3/Resources/Protobufs/steamclient/steammessages_clientserver.proto#L93-L116))

Emitted when you're successfully logged into Steam.

### error
- `err` - An `Error` object

Emitted when an error occurs during logon. Also emitted if we're disconnected and `autoRelogin` is either disabled, or it's a fatal disconnect.

If this event isn't handled, the program will crash.

The `SteamGameServer` object's `steamID` property will still be defined when this is emitted. The `Error` object will have an `eresult` parameter which is a value from the [`EResult`](https://github.com/SteamRE/SteamKit/blob/SteamKit_1.6.3/Resources/SteamLanguage/eresult.steamd) enum.

### disconnected
- `eresult` - A value from the `SteamGameServer.EResult` enum
- `msg` - A string describing the reason for the disconnect, if available (might be undefined)

Emitted when we're disconnected from Steam for a non-fatal reason and `autoRelogin` is enabled. `SteamGameServer` will
continually retry connection and will either emit `loggedOn` when logged back on, or `error` if a fatal logon error is
experienced.

Also emitted in response to a logOff() call.

The `SteamGameServer` object's `steamID` property will still be defined when this is emitted.

The `eresult` value might be 0 (Invalid), which indicates that the disconnection was due to the connection being closed
directly, without Steam sending a LoggedOff message.

### vac
- `secure` - `true` if Steam reports that this server is VAC-secured, `false` if not secured

Emitted when Steam notifies us that we're either VAC-secured or not.

### user
- `sid` - A `SteamID` object for the user whose data we just received
- `user` - An object containing the user's persona data

*This is an [ID event](#id-events).*

Emitted when Steam sends us persona information about a user. The [`users`](#users) property isn't yet updated when this is emitted, so you can compare to see what changed.
