// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);
Cu.import('resource://gre/modules/AddonManager.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
const {TextDecoder, TextEncoder, OS} = Cu.import('resource://gre/modules/osfile.jsm', {});
Cu.import('resource://gre/modules/Promise.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Globals
const core = {
	addon: {
		name: 'MouseControl',
		id: 'MouseControl@jetpack',
		path: {
			id: -1 * Math.random(),
			name: 'mousecontrol',
			content: 'chrome://mousecontrol/content/',
			images: 'chrome://mousecontrol/content/resources/images/',
			locale: 'chrome://mousecontrol/locale/',
			modules: 'chrome://mousecontrol/content/modules/',
			resources: 'chrome://mousecontrol/content/resources/',
			scripts: 'chrome://mousecontrol/content/resources/scripts/',
			styles: 'chrome://mousecontrol/content/resources/styles/',
			workers: 'chrome://mousecontrol/content/modules/workers/'
		},
		cache_key: Math.random() // set to version on release
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase(),
		toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version
	}
};

const JETPACK_DIR_BASENAME = 'jetpack';
const OSPath_simpleStorage = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage');
const myPrefBranch = 'extensions.' + core.addon.id + '.';

var ADDON_MANAGER_ENTRY;

// Global config stuff

var gConfigJson;
var gConfigJsonDefault = function() {
	// :todo: once setup server, ensure that these items get the id here. or whatever id they get there submit it here
	// because if id is negative, then that means it hasnt got a server id yet. but i need to keep decrementing the negative id, as i cant have multiple of the same ids
	// on share to server, then the negative id should be replaced with $insertId from server
	return [
		{
			id: 1,
			name: myServices.sb.GetStringFromName('config_name-jumptab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-jumptab'),
			config:'0+2',
			func:''
		},
		{
			id: 2,
			name: myServices.sb.GetStringFromName('config_name-duptab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-duptab'),
			config:'0+2',
			func:''
		},
		{
			id: 3,
			name: myServices.sb.GetStringFromName('config_name-newtab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-newtab'),
			config:'0+2',
			func:''
		},
		{
			id: 4,
			name: myServices.sb.GetStringFromName('config_name-nexttab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-nexttab'),
			config:'0+2',
			func:''
		},
		{
			id: 5,
			name: myServices.sb.GetStringFromName('config_name-prevtab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-prevtab'),
			config:'0+2',
			func:''
		},
		{
			id: 6,
			name: myServices.sb.GetStringFromName('config_name-closetab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-closetab'),
			config:'0+2',
			func:''
		},
		{
			id: 7,
			name: myServices.sb.GetStringFromName('config_name-resetzoom'),
			group: myServices.sb.GetStringFromName('config_group-zoom'),
			desc: myServices.sb.GetStringFromName('config_desc-resetzoom'),
			config:'2+1',
			func:''
		},
		{
			id: 8,
			name: myServices.sb.GetStringFromName('config_name-zoomin'),
			group: myServices.sb.GetStringFromName('config_group-zoom'),
			desc: myServices.sb.GetStringFromName('config_desc-zoomin'),
			config:'2+1',
			func:''
		},
		{
			id: 9,
			name: myServices.sb.GetStringFromName('config_name-zoomout'),
			group: myServices.sb.GetStringFromName('config_group-zoom'),
			desc: myServices.sb.GetStringFromName('config_desc-zoomout'),
			config:'2+1',
			func:''
		},
		{
			id: 10,
			name: myServices.sb.GetStringFromName('config_name-removeel'),
			group: myServices.sb.GetStringFromName('config_group-dom'),
			desc: myServices.sb.GetStringFromName('config_desc-removeel'),
			config:'2+1',
			func:''
		},
		{
			id: 11,
			name: myServices.sb.GetStringFromName('config_name-memscrolltop'),
			group: myServices.sb.GetStringFromName('config_group-dom'),
			desc: myServices.sb.GetStringFromName('config_desc-memscrolltop'),
			config:'2+1',
			func:''
		},
		{
			id: 12,
			name: myServices.sb.GetStringFromName('config_name-memscrollbot'),
			group: myServices.sb.GetStringFromName('config_group-dom'),
			desc: myServices.sb.GetStringFromName('config_desc-memscrollbot'),
			config:'2+1',
			func:''
		},
		{
			id: 13,
			name: myServices.sb.GetStringFromName('config_name-memscrollmemy'),
			group: myServices.sb.GetStringFromName('config_group-dom'),
			desc: myServices.sb.GetStringFromName('config_desc-memscrollmemy'),
			config:'2+1',
			func:''
		}
	];
};

// Preferences
// custom - -1, must specify an getter and setter on value
// Ci.nsIPrefBranch.PREF_INVALID 0
// Ci.nsIPrefBranch.PREF_STRING 32
// Ci.nsIPrefBranch.PREF_INT 64
// Ci.nsIPrefBranch.PREF_BOOL 128
var prefs = {
	autoup: {
		default: true,
		type: -1, // -1 means custom
		values: [false, true],
		get value () { // false - disabled, true - enabled - uses the autoUpdateDefault value to convert default value

			var deferredMain_autoup = new Deferred();
			
			if (ADDON_MANAGER_ENTRY) {
				// block link16515151
				var autoupRaw = parseInt(ADDON_MANAGER_ENTRY.applyBackgroundUpdates); // have to parseInt because its string
				// addon.applyBackgroundUpdates = '0'; // off
				// addon.applyBackgroundUpdates = '1'; // default
				// addon.applyBackgroundUpdates = '2'; // on
				
				if (autoupRaw === 1) {
					AddonManager.autoUpdateDefault ? deferredMain_autoup.resolve(true) : deferredMain_autoup.resolve(false);
					// return AddonManager.autoUpdateDefault ? true : false;
				} else if (autoupRaw === 0) {
					deferredMain_autoup.resolve(false);
					// return false;
				} else if (autoupRaw === 2) {
					deferredMain_autoup.resolve(true);
					// return true;
				} else {
					console.error('should never ever get here');
				}
				// end block link16515151
			} else {
				AddonManager.getAddonByID(core.addon.id, function(addon_manager_entry) {
					// addon.applyBackgroundUpdates = '0'; //off
					// addon.applyBackgroundUpdates = '1'; //default
					// addon.applyBackgroundUpdates = '2'; //on
					ADDON_MANAGER_ENTRY = addon_manager_entry;
					
					// copy of block link16515151
					var autoupRaw = parseInt(ADDON_MANAGER_ENTRY.applyBackgroundUpdates); // have to parseInt because its string
					// addon.applyBackgroundUpdates = '0'; // off
					// addon.applyBackgroundUpdates = '1'; // default
					// addon.applyBackgroundUpdates = '2'; // on
					
					if (autoupRaw === 1) {
						AddonManager.autoUpdateDefault ? deferredMain_autoup.resolve(true) : deferredMain_autoup.resolve(false);
						// return AddonManager.autoUpdateDefault ? true : false;
					} else if (autoupRaw === 0) {
						deferredMain_autoup.resolve(false);
						// return false;
					} else if (autoupRaw === 2) {
						deferredMain_autoup.resolve(true);
						// return true;
					} else {
						console.error('should never ever get here');
					}
					// end copy of block link16515151
				});
			}
			
			return deferredMain_autoup.promise;
		},
		set value (aApplyBackgroundUpdates) {
				// addon.applyBackgroundUpdates = '0'; // off
				// addon.applyBackgroundUpdates = '1'; // default
				// addon.applyBackgroundUpdates = '2'; // on
				console.error('doing set on applyBackgroundUpdates, aApplyBackgroundUpdates is:', aApplyBackgroundUpdates);
				if ([0, 1, 2, '0', '1', '2', 'true', 'false', false, true].indexOf(aApplyBackgroundUpdates) == -1) {
					console.error('WARN will not set pref, prefName:', 'autoup', 'to val:', aApplyBackgroundUpdates, 'because it has a list of accepted values, and the aNewVal is not among them, the accepted values are:', [0, 1, 2, '0', '1', '2']);
				} else {
					aApplyBackgroundUpdates = ensureBool(aApplyBackgroundUpdates); // ok to use ensureBool here, as the if in the top did the === check
					if (aApplyBackgroundUpdates) {
						// user set to on
						if (AddonManager.autoUpdateDefault) {
							// meaning default setting is ON, so set it to DEFAULT
							aApplyBackgroundUpdates = 1;
						} else {
							// meaning default setting is OFF, so set it to ON
							aApplyBackgroundUpdates = 2;
						}
					} else {
						// user set to off
						if (AddonManager.autoUpdateDefault) {
							// meaning default setting is ON, so set it to OFF
							aApplyBackgroundUpdates = 0;
						} else {
							// meaning default setting is OFF, so set it to DEFAULT
							aApplyBackgroundUpdates = 1;
						}
					}
					ADDON_MANAGER_ENTRY.applyBackgroundUpdates = aApplyBackgroundUpdates;
				}
		}
	},
	'zoom-context': {
		default: 0,
		type: Ci.nsIPrefBranch.PREF_INT,
		values: [0, 1]
		// values
			// 0 - all content
			// 1 - text only
	},
	'zoom-indicator': {
		default: false,
		type: Ci.nsIPrefBranch.PREF_BOOL
		// values
			// true - show
			// false - hide
	},
	'zoom-style': {
		default: 1,
		type: Ci.nsIPrefBranch.PREF_INT,
		values: [0, 1, 2]
		// values
			// 0 - all content
			// 1 - site specific
			// 2 - text only
	},
	'dbl-click-speed': {
		default: 200,
		type: Ci.nsIPrefBranch.PREF_INT
	},
	'hold-duration': {
		default: 200,
		type: Ci.nsIPrefBranch.PREF_INT
	},
	'new-tab-pos': {
		default: 1,
		values: [0, 1],
		type: Ci.nsIPrefBranch.PREF_INT
		// values
			// 0 - end of tab bar
			// 1 - next to current tab
	},
	'dup-tab-pos': {
		default: 1,
		values: [0, 1],
		type: Ci.nsIPrefBranch.PREF_INT
		// values
			// 0 - end of tab bar
			// 1 - next to current tab
	}
};

// set up getters and setters on .value
function prefGetter(aPrefName) {
	var typeAsStr = prefTypeAsStr(prefs[aPrefName].type);
	
	try {
		var rez_pref_val = Services.prefs['get' + typeAsStr + 'Pref'](myPrefBranch + aPrefName);
	} catch (ex) {
		// probably the pref doesnt exist
		return prefs[aPrefName].default;
	}
	
	if (prefs[aPrefName].values && prefs[aPrefName].values.indexOf(rez_pref_val) === -1) {
		console.error('WARN will not return gotten pref from pref system, will return default. BECAUSE gotten pref from pref system is:', rez_pref_val, 'and this prefName has a list of accepted values, and the aNewVal is not among them, the accepted values are:', prefs[aPrefName].values);
		return prefs[aPrefName].default;
	} else {
		return rez_pref_val;
	}
}

function prefSetter(aPrefName, aNewVal) {
	if (prefs[aPrefName].values && prefs[aPrefName].values.indexOf(aNewVal) == -1) {
		console.error('WARN will not set pref, prefName:', aPrefName, 'to val:', aNewVal, 'because it has a list of accepted values, and the aNewVal is not among them, the accepted values are:', prefs[aPrefName].values);
		return false;
	} else if (prefs[aPrefName].type == Ci.nsIPrefBranch.PREF_INT && (isNaN(aNewVal) || aNewVal === '')) {
		console.error('WARN will not set pref, prefName:', aPrefName, 'to val:', aNewVal, 'because its type is PREF_INT and aNewVal isNaN or blank string');
		return false;
	}

	var typeAsStr = prefTypeAsStr(prefs[aPrefName].type);

	try {
		Services.prefs['set' + typeAsStr + 'Pref'](myPrefBranch + aPrefName, aNewVal);
		console.error('ok set aPrefName:', aPrefName, 'to aNewVal:', aNewVal);
		return true;
	} catch (ex) {
		console.error('error when setting pref, prefName:', aPrefName, 'to val:', aNewVal, 'ex:', ex);
	}
}
for (var aPrefName in prefs) {
	if (prefs[aPrefName].type != -1) {
		
		// set the values arr on bool type
		if (prefs[aPrefName].type == Ci.nsIPrefBranch.PREF_BOOL) {
			prefs[aPrefName].values = [0, 1, false, true]; // it seems firefox pref system stores them as 0 or 1, not as false or true
		}
		
		// set the setter and getter
		Object.defineProperty(prefs[aPrefName], 'value', {
			get: prefGetter.bind(null, aPrefName),
			set: prefSetter.bind(null, aPrefName)
		});
	}
}

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });


// START - Addon Functionalities					
// start - about module
var aboutFactory_mousecontrol;
function AboutMouseControl() {}
AboutMouseControl.prototype = Object.freeze({
	classDescription: 'MouseControl Pages',
	contractID: '@mozilla.org/network/protocol/about;1?what=mousecontrol',
	classID: Components.ID('{56d1f290-5310-11e5-b970-0800200c9a66}'),
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

	getURIFlags: function(aURI) {
		return Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.URI_MUST_LOAD_IN_CHILD;
	},

	newChannel: function(aURI, aSecurity) {

		var channel;
		if (aURI.path.toLowerCase().indexOf('?community') > -1) {
			channel = Services.io.newChannel(core.addon.path.content + 'comm.xhtml', null, null);
		} else {
			channel = Services.io.newChannel(core.addon.path.content + 'ng-prefs.xhtml', null, null);
		}
		channel.originalURI = aURI;
		return channel;
	}
});

function AboutFactory(component) {
	this.createInstance = function(outer, iid) {
		if (outer) {
			throw Cr.NS_ERROR_NO_AGGREGATION;
		}
		return new component();
	};
	this.register = function() {
		Cm.registerFactory(component.prototype.classID, component.prototype.classDescription, component.prototype.contractID, this);
	};
	this.unregister = function() {
		Cm.unregisterFactory(component.prototype.classID, this);
	}
	Object.freeze(this);
	this.register();
}
// end - about module


var MMWorkerFuncs = {
	init: function() {
		console.log('ok calling init main thread callback');
		MMWorker.postMessage(['syncMonitorMouse']);
		
		// Services.wm.getMostRecentWindow('navigator:browser').setTimeout(function() {
			// console.log('stopping mouse monitor');
			// MMWorker.postMessage(['stopMonitor']);
		// }, 10000);
	}
};

function readConfigFromFile() {
	// reads file and sets global
	// resolves with array with single element being json. if file does not exist it gives gConfigJsonDefault
		// array because this function is used by fsFuncs
		
	var mainDeferred_readConfigFromFile = new Deferred();
	var promise_readConfig = OS.File.read(OS.Path.join(OSPath_simpleStorage, 'config.json'), {encoding:'utf-8'});
	promise_readConfig.then(
		function(aVal) {
			console.log('Fullfilled - promise_readConfig - ', aVal);
			// start - do stuff here - promise_readConfig
			gConfigJson = JSON.parse(aVal);
			console.log('on readConfigFromFile file not found so retruning defaults');
			mainDeferred_readConfigFromFile.resolve([gConfigJson]); // aMsgEvent.target is the browser it came from, so send a message back to its frame manager
			// end - do stuff here - promise_readConfig
		},
		function(aReason) {
			if (aReasonMax(aReason).becauseNoSuchFile) {
				console.log('on readConfigFromFile file not found so retruning defaults');
				gConfigJson = gConfigJsonDefault();
				mainDeferred_readConfigFromFile.resolve([gConfigJson]); // aMsgEvent.target is the browser it came from, so send a message back to its frame manager
				return;
			}
			var rejObj = {name:'promise_readConfig', aReason:aReason};
			console.error('Rejected - promise_readConfig - ', rejObj);
			mainDeferred_readConfigFromFile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readConfig', aCaught:aCaught};
			console.error('Caught - promise_readConfig - ', rejObj);
			mainDeferred_readConfigFromFile.reject(rejObj);
		}
	);
	
	return mainDeferred_readConfigFromFile.promise;
}
// END - Addon Functionalities

function install() {}

function uninstall(aData, aReason) {
	if (aReason == ADDON_UNINSTALL) {
		// delete prefs
	}
}

function startup(aData, aReason) {
	// core.addon.aData = aData;
	extendCore();
	
	// read in config from file
	readConfigFromFile();
	
	// startup worker
	var promise_getMMWorker = SICWorker('MMWorker', core.addon.path.workers + 'MMSyncWorker.js', MMWorkerFuncs);
	promise_getMMWorker.then(
		function(aVal) {
			console.log('Fullfilled - promise_getMMWorker - ', aVal);
			// start - do stuff here - promise_getMMWorker
			// end - do stuff here - promise_getMMWorker
		},
		function(aReason) {
			var rejObj = {
				name: 'promise_getMMWorker',
				aReason: aReason
			};
			console.warn('Rejected - promise_getMMWorker - ', rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {
				name: 'promise_getMMWorker',
				aCaught: aCaught
			};
			console.error('Caught - promise_getMMWorker - ', rejObj);
		}
	);
	
	// register about page
	aboutFactory_mousecontrol = new AboutFactory(AboutMouseControl);
	
	// register about pages listener
	Services.mm.addMessageListener(core.addon.id, fsMsgListener);
	
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }
	
	if (MMWorker) {
		MMWorker.terminate();
	}
	
	// an issue with this unload is that framescripts are left over, i want to destory them eventually
	aboutFactory_mousecontrol.unregister();
	
	// unregister about pages listener
	Services.mm.removeMessageListener(core.addon.id, fsMsgListener);
}

// start - server/framescript comm layer
// functions for framescripts to call in main thread
var fsFuncs = { // can use whatever, but by default its setup to use this
	fetchConfig: function(bootstrapCallbacks_name, aMsgEvent) {
		if (gConfigJson) {
			return [gConfigJson];
		} else {
			// i do start read as soon as startup happens. however if options page is open and it sends message to here, ill do double read to ensure it gets it, no biggie
			return readConfigFromFile();
		}
	},
	fetchCore: function() {
		return [core];
	},
	getPref: function(aPrefName) {
		
		var rezPrefVal = prefs[aPrefName].value;
		if (rezPrefVal.constructor.name == 'Promise') {
			var deferredMain_fsGetPref = new Deferred();
			
			rezPrefVal.then(
				function(aVal) {
					console.log('Fullfilled - rezPrefVal - ', aVal);
					// start - do stuff here - rezPrefVal
					deferredMain_fsGetPref.resolve([aVal]);
					// end - do stuff here - rezPrefVal
				},
				function(aReason) {
					var rejObj = {name:'rezPrefVal', aReason:aReason};
					console.warn('Rejected - rezPrefVal - ', rejObj);
					deferredMain_fsGetPref.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'rezPrefVal', aCaught:aCaught};
					console.error('Caught - rezPrefVal - ', rejObj);
					deferredMain_fsGetPref.reject(rejObj);
				}
			);
			return deferredMain_fsGetPref.promise;
			
		} else {
			return [rezPrefVal];
		}
	},
	setPref: function(aPrefName, aNewVal) {
		prefs[aPrefName].value = aNewVal;
	}
};
var fsMsgListener = {
	funcScope: fsFuncs,
	receiveMessage: function(aMsgEvent) {
		var aMsgEventData = aMsgEvent.data;
		console.log('fsMsgListener getting aMsgEventData:', aMsgEventData, 'aMsgEvent:', aMsgEvent);
		// aMsgEvent.data should be an array, with first item being the unfction name in bootstrapCallbacks
		
		var callbackPendingId;
		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
			callbackPendingId = aMsgEventData.pop();
		}
		
		aMsgEventData.push(aMsgEvent); // this is special for server side, so the function can do aMsgEvent.target.messageManager to send a response
		
		var funcName = aMsgEventData.shift();
		if (funcName in this.funcScope) {
			var rez_parentscript_call = this.funcScope[funcName].apply(null, aMsgEventData);
			
			if (callbackPendingId) {
				// rez_parentscript_call must be an array or promise that resolves with an array
				if (rez_parentscript_call.constructor.name == 'Promise') {
					rez_parentscript_call.then(
						function(aVal) {
							// aVal must be an array
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, aVal]);
						},
						function(aReason) {
							console.error('aReject:', aReason);
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aReason]]);
						}
					).catch(
						function(aCatch) {
							console.error('aCatch:', aCatch);
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aCatch]]);
						}
					);
				} else {
					// assume array
					aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, rez_parentscript_call]);
				}
			}
		}
		else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
		
	}
};
// end - server/framescript comm layer

// start - common helper functions
function Deferred() {
	if (Promise && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (PromiseUtils && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else if (Promise) {
		try {
			/* A method to resolve the associated Promise with the value passed.
			 * If the promise is already settled it does nothing.
			 *
			 * @param {anything} value : This value is used to resolve the promise
			 * If the value is a Promise then the associated promise assumes the state
			 * of Promise passed as value.
			 */
			this.resolve = null;

			/* A method to reject the assocaited Promise with the value passed.
			 * If the promise is already settled it does nothing.
			 *
			 * @param {anything} reason: The reason for the rejection of the Promise.
			 * Generally its an Error object. If however a Promise is passed, then the Promise
			 * itself will be the reason for rejection no matter the state of the Promise.
			 */
			this.reject = null;

			/* A newly created Pomise object.
			 * Initially in pending state.
			 */
			this.promise = new Promise(function(resolve, reject) {
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this));
			Object.freeze(this);
		} catch (ex) {
			console.error('Promise not available!', ex);
			throw new Error('Promise not available!');
		}
	} else {
		throw new Error('Promise not available!');
	}
}

var bootstrap = this; // needed for SIPWorker and SICWorker - rev8
const SIC_CB_PREFIX = '_a_gen_cb_';
const SIC_TRANS_WORD = '_a_gen_trans_';
var sic_last_cb_id = -1;
function SICWorker(workerScopeName, aPath, aFuncExecScope=bootstrap, aCore=core) {
	// creates a global variable in bootstrap named workerScopeName which will hold worker, do not set up a global for it like var Blah; as then this will think something exists there
	// aScope is the scope in which the functions are to be executed
	// ChromeWorker must listen to a message of 'init' and on success of it, it should sendMessage back saying aMsgEvent.data == {aTopic:'init', aReturn:true}
	// "Start and Initialize ChromeWorker" // based on SIPWorker
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`	
	var deferredMain_SICWorker = new Deferred();

	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new ChromeWorker(aPath);
		
		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}
		
		var afterInitListener = function(aMsgEvent) {
			// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
			var aMsgEventData = aMsgEvent.data;
			console.log('mainthread receiving message:', aMsgEventData);
			
			// postMessageWithCallback from worker to mt. so worker can setup callbacks after having mt do some work
			var callbackPendingId;
			if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SIC_CB_PREFIX) == 0) {
				callbackPendingId = aMsgEventData.pop();
			}
			
			var funcName = aMsgEventData.shift();
			
			if (funcName in aFuncExecScope) {
				var rez_mainthread_call = aFuncExecScope[funcName].apply(null, aMsgEventData);
				
				if (callbackPendingId) {
					if (rez_mainthread_call.constructor.name == 'Promise') {
						rez_mainthread_call.then(
							function(aVal) {
								if (aVal.length >= 2 && aVal[aVal.length-1] == SIC_TRANS_WORD && Array.isArray(aVal[aVal.length-2])) {
									// to transfer in callback, set last element in arr to SIC_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
									console.error('doing transferrrrr');
									aVal.pop();
									bootstrap[workerScopeName].postMessage([callbackPendingId, aVal], aVal.pop());
								} else {
									bootstrap[workerScopeName].postMessage([callbackPendingId, aVal]);
								}
							},
							function(aReason) {
								console.error('aReject:', aReason);
								bootstrap[workerScopeName].postMessage([callbackPendingId, ['promise_rejected', aReason]]);
							}
						).catch(
							function(aCatch) {
								console.error('aCatch:', aCatch);
								bootstrap[workerScopeName].postMessage([callbackPendingId, ['promise_rejected', aCatch]]);
							}
						);
					} else {
						// assume array
						if (rez_mainthread_call.length > 2 && rez_mainthread_call[rez_mainthread_call.length-1] == SIC_TRANS_WORD && Array.isArray(rez_mainthread_call[rez_mainthread_call.length-2])) {
							// to transfer in callback, set last element in arr to SIC_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
							rez_mainthread_call.pop();
							bootstrap[workerScopeName].postMessage([callbackPendingId, rez_mainthread_call], rez_mainthread_call.pop());
						} else {
							bootstrap[workerScopeName].postMessage([callbackPendingId, rez_mainthread_call]);
						}
					}
				}
			}
			else { console.warn('funcName', funcName, 'not in scope of aFuncExecScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out

		};
		
		var beforeInitListener = function(aMsgEvent) {
			// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
			var aMsgEventData = aMsgEvent.data;
			if (aMsgEventData[0] == 'init') {
				bootstrap[workerScopeName].removeEventListener('message', beforeInitListener);
				bootstrap[workerScopeName].addEventListener('message', afterInitListener);
				deferredMain_SICWorker.resolve(true);
				if ('init' in aFuncExecScope) {
					aFuncExecScope[aMsgEventData.shift()].apply(null, aMsgEventData);
				}
			}
		};
		
		// var lastCallbackId = -1; // dont do this, in case multi SICWorker's are sharing the same aFuncExecScope so now using new Date().getTime() in its place // link8888881
		bootstrap[workerScopeName].postMessageWithCallback = function(aPostMessageArr, aCB, aPostMessageTransferList) {
			// lastCallbackId++; // link8888881
			sic_last_cb_id++;
			var thisCallbackId = SIC_CB_PREFIX + sic_last_cb_id; // + lastCallbackId; // link8888881
			aFuncExecScope[thisCallbackId] = function() {
				delete aFuncExecScope[thisCallbackId];
				// console.log('in mainthread callback trigger wrap, will apply aCB with these arguments:', arguments, 'turned into array:', Array.prototype.slice.call(arguments));
				aCB.apply(null, arguments[0]);
			};
			aPostMessageArr.push(thisCallbackId);
			// console.log('aPostMessageArr:', aPostMessageArr);
			bootstrap[workerScopeName].postMessage(aPostMessageArr, aPostMessageTransferList);
		};
		
		bootstrap[workerScopeName].addEventListener('message', beforeInitListener);
		bootstrap[workerScopeName].postMessage(['init', aCore]);
		
	} else {
		deferredMain_SICWorker.reject('Something is loaded into bootstrap[workerScopeName] already');
	}
	
	return deferredMain_SICWorker.promise;
	
}

function SIPWorker(workerScopeName, aPath, aCore=core) {
	// "Start and Initialize PromiseWorker"
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`
	
	// :todo: add support and detection for regular ChromeWorker // maybe? cuz if i do then ill need to do ChromeWorker with callback
	
	var deferredMain_SIPWorker = new Deferred();

	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new PromiseWorker(aPath);
		
		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}
		
		var promise_initWorker = bootstrap[workerScopeName].post('init', [aCore]);
		promise_initWorker.then(
			function(aVal) {
				console.log('Fullfilled - promise_initWorker - ', aVal);
				// start - do stuff here - promise_initWorker
				deferredMain_SIPWorker.resolve(true);
				// end - do stuff here - promise_initWorker
			},
			function(aReason) {
				var rejObj = {name:'promise_initWorker', aReason:aReason};
				console.warn('Rejected - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initWorker', aCaught:aCaught};
				console.error('Caught - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		);
		
	} else {
		deferredMain_SIPWorker.reject('Something is loaded into bootstrap[workerScopeName] already');
	}
	
	return deferredMain_SIPWorker.promise;
	
}

function aReasonMax(aReason) {
	var deepestReason = aReason;
	while (deepestReason.hasOwnProperty('aReason') || deepestReason.hasOwnProperty()) {
		if (deepestReason.hasOwnProperty('aReason')) {
			deepestReason = deepestReason.aReason;
		} else if (deepestReason.hasOwnProperty('aCaught')) {
			deepestReason = deepestReason.aCaught;
		}
	}
	return deepestReason;
}

// sendAsyncMessageWithCallback - rev3
const SAM_CB_PREFIX = '_sam_gen_cb_';
var sam_last_cb_id = -1;
function sendAsyncMessageWithCallback(aMessageManager, aGroupId, aMessageArr, aCallbackScope, aCallback) {
	sam_last_cb_id++;
	var thisCallbackId = SAM_CB_PREFIX + sam_last_cb_id;
	aCallbackScope = aCallbackScope ? aCallbackScope : bootstrap;
	aCallbackScope[thisCallbackId] = function(aMessageArr) {
		delete aCallbackScope[thisCallbackId];
		aCallback.apply(null, aMessageArr);
	}
	aMessageArr.push(thisCallbackId);
	aMessageManager.sendAsyncMessage(aGroupId, aMessageArr);
}


function extendCore() {
	// adds some properties i use to core based on the current operating system, it needs a switch, thats why i couldnt put it into the core obj at top
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			core.os.version = parseFloat(Services.sysinfo.getProperty('version'));
			// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
			if (core.os.version == 6.0) {
				core.os.version_name = 'vista';
			}
			if (core.os.version >= 6.1) {
				core.os.version_name = '7+';
			}
			if (core.os.version == 5.1 || core.os.version == 5.2) { // 5.2 is 64bit xp
				core.os.version_name = 'xp';
			}
			break;
			
		case 'darwin':
			var userAgent = myServices.hph.userAgent;

			var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);

			
			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {
				var version_osx_str = version_osx[1];
				var ints_split = version_osx[1].split('.');
				if (ints_split.length == 1) {
					core.os.version = parseInt(ints_split[0]);
				} else if (ints_split.length >= 2) {
					core.os.version = ints_split[0] + '.' + ints_split[1];
					if (ints_split.length > 2) {
						core.os.version += ints_split.slice(2).join('');
					}
					core.os.version = parseFloat(core.os.version);
				}
				// this makes it so that 10.10.0 becomes 10.100
				// 10.10.1 => 10.101
				// so can compare numerically, as 10.100 is less then 10.101
				
				//core.os.version = 6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
			}
			break;
		default:
			// nothing special
	}
	

}

function prefTypeAsStr(aTypeAsInt) {
	// Ci.nsIPrefBranch.PREF_INVALID 0
	// Ci.nsIPrefBranch.PREF_STRING 32
	// Ci.nsIPrefBranch.PREF_INT 64
	// Ci.nsIPrefBranch.PREF_BOOL 128
	switch (prefs[aPrefName].type) {
		case Ci.nsIPrefBranch.PREF_BOOL:
				
				return 'Bool';
				
			break;
		case Ci.nsIPrefBranch.PREF_INT:
				
				return 'Int';
				
			break;
		case Ci.nsIPrefBranch.PREF_STRING:
				
				return 'Char';
				
			break;
		default:
			console.error('got invalid aTypeAsInt:', aTypeAsInt);
			throw new Error('got invalid aTypeAsInt');
	}
}
function ensureBool(aVal) {
	if (aVal === 'false' || aVal === false || !aVal) { // !aVal covers blank string '', null, undefined
		return false;
	} else {
		return true;
	}
}
// end - common helper functions