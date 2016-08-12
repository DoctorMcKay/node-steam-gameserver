var SteamGameServer = require('../index.js');
var VDF = require('vdf');
var BinaryKVParser = require('binarykvparser');

SteamGameServer.prototype.getPlayerCount = function(appid, callback) {
	this._send(SteamGameServer.EMsg.ClientGetNumberOfCurrentPlayersDP, {"appid": appid}, (body) => {
		if (body.eresult != SteamGameServer.EResult.OK) {
			var err = new Error(SteamGameServer.EResult[body.eresult] || body.eresult);
			err.eresult = body.eresult;
			callback(err);
			return;
		}

		callback(null, body.player_count);
	});
};

SteamGameServer.prototype.getProductChanges = function(sinceChangenumber, callback) {
	this._send(SteamGameServer.EMsg.ClientPICSChangesSinceRequest, {
		"since_change_number": sinceChangenumber,
		"send_app_info_changes": true,
		"send_package_info_changes": true
	}, (body) => {
		callback(body.current_change_number, body.app_changes, body.package_changes);
	});
};

SteamGameServer.prototype.getProductInfo = function(apps, packages, callback) {
	// Steam can send us the full response in multiple responses, so we need to buffer them into one callback
	var appids = [];
	var packageids = [];
	var response = {
		"apps": {},
		"packages": {},
		"unknownApps": [],
		"unknownPackages": []
	};

	apps = apps.map((app) => {
		if (typeof app === 'object') {
			appids.push(app.appid);
			return app;
		} else {
			appids.push(app);
			return {"appid": app};
		}
	});

	packages = packages.map((pkg) => {
		if (typeof pkg === 'object') {
			packageids.push(pkg.packageid);
			return pkg;
		} else {
			packageids.push(pkg);
			return {"packageid": pkg};
		}
	});
	
	this._send(SteamGameServer.EMsg.ClientPICSProductInfoRequest, {
		"apps": apps,
		"packages": packages
	}, (body) => {
		// If we're using the PICS cache, then add the items in this response to it
		if (this.options.enablePicsCache) {
			var cache = this.picsCache;
			cache.apps = cache.apps || {};
			cache.packages = cache.packages || {};

			(body.apps || []).forEach((app) => {
				var data = {
					"changenumber": app.change_number,
					"missingToken": !!app.missing_token,
					"appinfo": VDF.parse(app.buffer.toString('utf8')).appinfo
				};

				app._parsedData = data;
			});

			(body.packages || []).forEach((pkg) => {
				var data = {
					"changenumber": pkg.change_number,
					"missingToken": !!pkg.missing_token,
					"packageinfo": BinaryKVParser.parse(pkg.buffer)[pkg.packageid]
				};

				pkg._parsedData = data;
			});
		}

		if (!callback) {
			return;
		}

		(body.unknown_appids || []).forEach((appid) => {
			response.unknownApps.push(appid);
			var index = appids.indexOf(appid);
			if (index != -1) {
				appids.splice(index, 1);
			}
		});

		(body.unknown_packageids || []).forEach((packageid) => {
			response.unknownPackages.push(packageid);
			var index = packageids.indexOf(packageid);
			if (index != -1) {
				packageids.splice(index, 1);
			}
		});

		(body.apps || []).forEach((app) => {
			response.apps[app.appid] = app._parsedData || {
					"changenumber": app.change_number,
					"missingToken": !!app.missing_token,
					"appinfo": VDF.parse(app.buffer.toString('utf8')).appinfo
				};

			var index = appids.indexOf(app.appid);
			if (index != -1) {
				appids.splice(index, 1);
			}
		});

		(body.packages || []).forEach((pkg) => {
			response.packages[pkg.packageid] = pkg._parsedData || {
					"changenumber": pkg.change_number,
					"missingToken": !!pkg.missing_token,
					"packageinfo": BinaryKVParser.parse(pkg.buffer)[pkg.packageid]
				};

			var index = packageids.indexOf(pkg.packageid);
			if (index != -1) {
				packageids.splice(index, 1);
			}
		});

		if (appids.length === 0 && packageids.length === 0) {
			callback(response.apps, response.packages, response.unknownApps, response.unknownPackages);
		}
	});
};

SteamGameServer.prototype.getProductInfo = function(apps, packages, callback) {
	// Steam can send us the full response in multiple responses, so we need to buffer them into one callback
	var appids = [];
	var packageids = [];
	var response = {
		"apps": {},
		"packages": {},
		"unknownApps": [],
		"unknownPackages": []
	};

	apps = apps.map((app) => {
		if (typeof app === 'object') {
			appids.push(app.appid);
			return app;
		} else {
			appids.push(app);
			return {"appid": app};
		}
	});

	packages = packages.map((pkg) => {
		if (typeof pkg === 'object') {
			packageids.push(pkg.packageid);
			return pkg;
		} else {
			packageids.push(pkg);
			return {"packageid": pkg};
		}
	});
	
	this._send(SteamGameServer.EMsg.ClientPICSProductInfoRequest, {
		"apps": apps,
		"packages": packages
	}, (body) => {
		// If we're using the PICS cache, then add the items in this response to it
		if (this.options.enablePicsCache) {
			var cache = this.picsCache;
			cache.apps = cache.apps || {};
			cache.packages = cache.packages || {};

			(body.apps || []).forEach((app) => {
				var data = {
					"changenumber": app.change_number,
					"missingToken": !!app.missing_token,
					"appinfo": VDF.parse(app.buffer.toString('utf8')).appinfo
				};

				app._parsedData = data;
			});

			(body.packages || []).forEach((pkg) => {
				var data = {
					"changenumber": pkg.change_number,
					"missingToken": !!pkg.missing_token,
					"packageinfo": BinaryKVParser.parse(pkg.buffer)[pkg.packageid]
				};

				pkg._parsedData = data;
			});
		}

		if (!callback) {
			return;
		}

		(body.unknown_appids || []).forEach((appid) => {
			response.unknownApps.push(appid);
			var index = appids.indexOf(appid);
			if (index != -1) {
				appids.splice(index, 1);
			}
		});

		(body.unknown_packageids || []).forEach((packageid) => {
			response.unknownPackages.push(packageid);
			var index = packageids.indexOf(packageid);
			if (index != -1) {
				packageids.splice(index, 1);
			}
		});

		(body.apps || []).forEach((app) => {
			response.apps[app.appid] = app._parsedData || {
					"changenumber": app.change_number,
					"missingToken": !!app.missing_token,
					"appinfo": VDF.parse(app.buffer.toString('utf8')).appinfo
				};

			var index = appids.indexOf(app.appid);
			if (index != -1) {
				appids.splice(index, 1);
			}
		});

		(body.packages || []).forEach((pkg) => {
			response.packages[pkg.packageid] = pkg._parsedData || {
					"changenumber": pkg.change_number,
					"missingToken": !!pkg.missing_token,
					"packageinfo": BinaryKVParser.parse(pkg.buffer)[pkg.packageid]
				};

			var index = packageids.indexOf(pkg.packageid);
			if (index != -1) {
				packageids.splice(index, 1);
			}
		});

		if (appids.length === 0 && packageids.length === 0) {
			callback(response.apps, response.packages, response.unknownApps, response.unknownPackages);
		}
	});
};
