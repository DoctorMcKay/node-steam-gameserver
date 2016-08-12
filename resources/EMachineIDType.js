/**
 * What type of machine ID SteamGameServer will use to logon to Steam with, if logging into a persistent account.
 * @readonly
 * @enum {number}
 */
module.exports = {
	/** No machine ID will be provided to Steam */
	"None": 1,

	/** A randomly-generated machine ID will be created on each logon */
	"AlwaysRandom": 2,

	/** A machine ID will be generated from your account's login token */
	"AccountTokenGenerated": 3,

	/** A random machine ID will be generated and saved to the {dataDirectory}, and will be used for future logons */
	"PersistentRandom": 4
};
