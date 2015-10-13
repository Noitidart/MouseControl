// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Globals
var core = {
	addon: {
		name: 'MouseControl',
		id: 'MouseControl@jetpack',
		path: {
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
	}
};
var gAngScope;
var gAngInjector;
var gCFMM;

// Lazy imports
var myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'prefs.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });
XPCOMUtils.defineLazyGetter(myServices, 'sb_dom', function () { return Services.strings.createBundle(core.addon.path.locale + 'prefs_dom.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

function doOnBeforeUnload() {

	contentMMFromContentWindow_Method2(window).removeMessageListener(core.addon.id, bootstrapMsgListener);

}

function doOnLoad() {
	var gAngBody = angular.element(document.body);
	gAngScope = gAngBody.scope();
	gAngInjector = gAngBody.injector();
}

document.addEventListener('DOMContentLoaded', doOnLoad, false);
window.addEventListener('beforeunload', doOnBeforeUnload, false);

// Angular
var	ANG_APP = angular.module('mousecontrol_prefs', [])
	.config(['$sceDelegateProvider', function($sceDelegateProvider) {
		$sceDelegateProvider.resourceUrlWhitelist(['self', 'chrome://mousecontrol/**/*.htm']);
	}])
	.directive('header', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/header.htm'
		};
	}])
	.directive('optionGroup', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/optionGroup.htm'
		};
	}])
	.directive('optionRow', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/optionRow.htm'
		};
	}])
	.directive('configWrap', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/configWrap.htm'
		};
	}])
	.directive('configGroup', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/configGroup.htm'
		};
	}])
	.directive('configRow', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/configRow.htm'
		};
	}])
	.directive('modal', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/modal.htm'
		};
	}])
	.filter('groupBy', function() {
		// this just filters out duplicates based on a property that is a string
		return function(arr, property) {
			if (arr === undefined) {
				// the variable has not yet been initialized
				return;
			}
			if (typeof property !== 'string') {
				throw new Error('need a property to check for');
			}
			// console.info('arr:', arr, 'property:', property);
			return Object.keys(arr.reduce(function(obj,item) {
				obj[item[property]] = true;
				return obj;
			}, {}));
		}
	})
	.controller('BodyController', ['$scope', '$sce', '$q', '$timeout', function($scope, $sce, $q, $timeout) {
		var BC = this;

		// start - pref to dom modeling
		BC.options = [ // order here is the order it is displayed in, in the dom
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-gen'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-autoup'),
				type: 'select',
				pref_name: 'autoup',
				pref_type: 'bool', // pref_type is custom, so the setter handles
				values: {
					'true': myServices.sb.GetStringFromName('mousecontrol.prefs.on'),
					'false': myServices.sb.GetStringFromName('mousecontrol.prefs.off')
				},
				desc: ''
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-gen'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-restore'),
				type: 'button',
				values: [
					myServices.sb.GetStringFromName('mousecontrol.prefs.restore')
				],
				desc: ''
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-gen'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-port'),
				type: 'button',
				values: [
					myServices.sb.GetStringFromName('mousecontrol.prefs.export'),
					myServices.sb.GetStringFromName('mousecontrol.prefs.import')
				],
				desc: ''
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-time'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-dblspeed'),
				type: 'text',
				pref_name: 'dbl-click-speed',
				pref_type: 'int',
				desc: myServices.sb.GetStringFromName('mousecontrol.prefs.item_desc-dblspeed')
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-time'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-holdspeed'),
				type: 'text',
				pref_name: 'hold-duration',
				pref_type: 'int',
				desc: myServices.sb.GetStringFromName('mousecontrol.prefs.item_desc-holdspeed')
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-tabs'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-newtabpos'),
				type: 'select',
				pref_name: 'new-tab-pos',
				pref_type: 'int',
				values: {
					'0': myServices.sb.GetStringFromName('mousecontrol.prefs.endofbar'),
					'1': myServices.sb.GetStringFromName('mousecontrol.prefs.nexttocur')
				},
				desc: ''
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-tabs'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-duptabpos'),
				type: 'select',
				pref_name: 'dup-tab-pos',
				pref_type: 'int',
				values: {
					'0': myServices.sb.GetStringFromName('mousecontrol.prefs.endofbar'),
					'1': myServices.sb.GetStringFromName('mousecontrol.prefs.nexttocur')
				},
				desc: ''
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-zoom'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-zoomlabel'),
				type: 'select',
				pref_name: 'zoom-indicator',
				pref_type: 'bool',
				values: {
					'false': myServices.sb.GetStringFromName('mousecontrol.prefs.hide'),
					'true': myServices.sb.GetStringFromName('mousecontrol.prefs.show')
				},
				desc: myServices.sb.GetStringFromName('mousecontrol.prefs.item_desc-zoomlabel')
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-zoom'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-zoomcontext'),
				type: 'select',
				pref_name: 'zoom-context',
				pref_type: 'int',
				values: {
					'0': myServices.sb.GetStringFromName('mousecontrol.prefs.allcont'),
					'1': myServices.sb.GetStringFromName('mousecontrol.prefs.txtonly')
				},
				desc: ''
			},
			{
				groupName: myServices.sb.GetStringFromName('mousecontrol.prefs.group-zoom'),
				label: myServices.sb.GetStringFromName('mousecontrol.prefs.item_name-zoomstyle'),
				type: 'select',
				pref_name: 'zoom-style',
				pref_type: 'int',
				values: {
					'0': myServices.sb.GetStringFromName('mousecontrol.prefs.global'),
					'1': myServices.sb.GetStringFromName('mousecontrol.prefs.sitespec'),
					'2': myServices.sb.GetStringFromName('mousecontrol.prefs.temp')
				},
				desc: ''
			}
		];
		
		var processValAndSetPref = function(iInBcOptions) {
			if (suppressPrefSetterWatcher) {
				console.warn('pref setter watcher is currently suppressed so will not act on:', ['setPref', BC.options[iInBcOptions].pref_name, BC.options[iInBcOptions].value]);
				return;
			}
			// have to process val, because like for selects, the option vlaue is a text. same with text boxes for type int prefs
			console.log('bc calling set pref with:', ['setPref', BC.options[iInBcOptions].pref_name, BC.options[iInBcOptions].value])
			var aNewVal = BC.options[iInBcOptions].value;
			if (BC.options[iInBcOptions].pref_type == 'int') {
				// parseInt the submitted val
				aNewVal = parseInt(aNewVal);
			} else if (BC.options[iInBcOptions].pref_type == 'bool') {
				// turn to bool
				if (aNewVal == 'true') {
					aNewVal = true;
				} else if (aNewVal == 'false') {
					aNewVal = false;
				} // else its an invalid, like blank string etc
			}
			
			contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, ['setPref', BC.options[iInBcOptions].pref_name, aNewVal]);
		};

		var suppressPrefSetterWatcher = true; // after first digest, can set this to false, otherwise it will send messages to set to "" or the value it just got. so set this to true also on focus page		
		BC.updatePrefsFromServer = function(doDigest, addWatcher) {
			// doDigest
				// if false, then this function returns a promise
				// else this digests and doesnt return anything
			// addWatcher should only be set to true by the init function
				// it handles updating the server with value as user changes it in the form
			
			suppressPrefSetterWatcher = true;
			if (!doDigest) {
				var deferredMain_updatePrefsFromServer = new Deferred();
			}
			
			var promiseAllArr_singlePrefUpdated = [];
			
			for (var i=0; i<BC.options.length; i++) {
				if (BC.options[i].pref_name) {
					var deferred_singlePrefUpdated = new Deferred();
					promiseAllArr_singlePrefUpdated.push(deferred_singlePrefUpdated.promise);
					
					sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['getPref', BC.options[i].pref_name], bootstrapMsgListener.funcScope, function(iInBcOptions, aDeferred, aPrefValue) {
						console.log('got value of pref', BC.options[iInBcOptions].pref_name, ':', aPrefValue);
						
						if (BC.options[iInBcOptions].pref_type == 'bool') {
							aPrefValue = aPrefValue ? true : false;
						}
						
						switch ($scope.BC.options[iInBcOptions].type) {
							case 'select':
									
									$scope.BC.options[iInBcOptions].value = aPrefValue + '';
									
								break;
							case 'text':
									
									$scope.BC.options[iInBcOptions].value = aPrefValue;
									
								break;
							default:
								console.error('should never ever get here');
						}
						aDeferred.resolve();
					}.bind(null, i, deferred_singlePrefUpdated));
					
					if (addWatcher) {
						console.log('adding watcher to:', BC.options[i]);
						$scope.$watch('BC.options[' + i + '].value', processValAndSetPref.bind(null, i));
					}
				}
			}
			
			var promiseAll_singlePrefUpdated = Promise.all(promiseAllArr_singlePrefUpdated);
			promiseAll_singlePrefUpdated.then(
				function(aVal) {
					console.log('Fullfilled - promiseAll_singlePrefUpdated - ', aVal);
					// start - do stuff here - promiseAll_singlePrefUpdated					
					if (!doDigest) {
						deferredMain_updatePrefsFromServer.resolve(); // finished updating all the objects
						console.error('WARN: make sure devusuer manually set suppressPrefSetterWatcher = false after your digest then');
					} else {
						$scope.$digest();
						suppressPrefSetterWatcher = false;
					}
					// end - do stuff here - promiseAll_singlePrefUpdated
				},
				function(aReason) {
					var rejObj = {name:'promiseAll_singlePrefUpdated', aReason:aReason};
					console.warn('Rejected - promiseAll_singlePrefUpdated - ', rejObj);
					if (!doDigest) {
						deferredMain_updatePrefsFromServer.reject(rejObj);
					}
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promiseAll_singlePrefUpdated', aCaught:aCaught};
					console.error('Caught - promiseAll_singlePrefUpdated - ', rejObj);
					if (!doDigest) {
						deferredMain_updatePrefsFromServer.reject(rejObj);
					}
				}
			);
			
			if (!doDigest) {
				console.log('returning promise');
				return deferredMain_updatePrefsFromServer.promise;
			}
		}
		
		// end - pref to dom modeling
		
		// start - l10n injection into ng
		
		BC.l10n = {};
		// get all the localized strings into ng
		var l10ns = myServices.sb_dom.getSimpleEnumeration();
		while (l10ns.hasMoreElements()) {
			var l10nProp = l10ns.getNext();
			var l10nPropEl = l10nProp.QueryInterface(Ci.nsIPropertyElement);
			// doing console.log(propEl) shows the object has some fields that interest us

			var l10nPropKey = l10nPropEl.key;
			var l10nPropStr = l10nPropEl.value;

			BC.l10n[l10nPropKey] = l10nPropStr;
		}
		
		// set version for dom
		BC.l10n['mousecontrol.prefs.addon_version'] = core.addon.cache_key;
		// end - l10n injection into ng
		
		// start - modal stuff
		BC.modal = {
			type: 'trash', // trash/share/config
			config_type: 'add', // add/edit // if type==config
			show: false,
		};
		
		BC.hideModalIfEsc = function(aEvent) {
			if (aEvent.keyCode == 27) {
				BC.modal.show = false;
			}
		};
		BC.hideModal = function() {
			BC.modal.show = false;
		};
		BC.showModal = function(type, aObjKeys={}) {
			// update the keys that are in modal and also aObjKeys, to value of aObjKeys
			// and delete what is not found in aObjkeys
			BC.modal.type = type;
			for (var p in BC.modal) {
				if (p == 'show') { continue }
				if (p == 'type') { continue }
				if (p in aObjKeys) {
					BC.modal[p] = aObjKeys[p];
				} else {
					delete BC.modal[p];
				}
			}
			
			// add from aObjKeys to BC.modal, the keys that are not in BC.modal
			for (var p in aObjKeys) {
				BC.modal[p] = aObjKeys[p];
			}
			
			// show it
			BC.modal.show = true;
		};
		// end - modal stuff
		
		// start - create/add new function
		BC.building = {};
		
		// end - create/add new function
		
		
		// start - init
		var init = function() {
			
			var promiseAllArr_digest = [];
			
			// get core obj
			var deferred_getCore = new Deferred();
			promiseAllArr_digest.push(deferred_getCore.promise);
			sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['fetchCore'], bootstrapMsgListener.funcScope, function(aCore) {
				console.log('got aCore:', aCore);
				core = aCore;
				$scope.BC.core = core;
				deferred_getCore.resolve();
			});
			
			// update prefs object
			var promise_updatePrefs = BC.updatePrefsFromServer(false, true);
			promiseAllArr_digest.push(promise_updatePrefs);
			
			// get json config from bootstrap
			var deferred_getUserConfig = new Deferred();
			promiseAllArr_digest.push(deferred_getUserConfig.promise);
			sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['fetchConfig'], bootstrapMsgListener.funcScope, function(aConfigJson) {
				console.log('got aConfigJson into ng:', aConfigJson);
				$scope.BC.configs = aConfigJson;
				deferred_getUserConfig.resolve();
			});
			
			// wait for all to finish then digest
			var promiseAll_digest = Promise.all(promiseAllArr_digest);
			promiseAll_digest.then(
				function(aVal) {
					console.log('Fullfilled - promiseAll_digest - ', aVal);
					// start - do stuff here - promiseAll_digest
					$scope.$digest();
					console.log('ok digested');
					suppressPrefSetterWatcher = false;
					// end - do stuff here - promiseAll_digest
				},
				function(aReason) {
					var rejObj = {name:'promiseAll_digest', aReason:aReason};
					console.warn('Rejected - promiseAll_digest - ', rejObj);
					// deferred_createProfile.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promiseAll_digest', aCaught:aCaught};
					console.error('Caught - promiseAll_digest - ', rejObj);
					// deferred_createProfile.reject(rejObj);
				}
			);
		};
		init();
		// end - init
	}]);

// start - server/framescript comm layer
// sendAsyncMessageWithCallback - rev3
var bootstrapCallbacks = { // can use whatever, but by default it uses this
	// put functions you want called by bootstrap/server here
};
const SAM_CB_PREFIX = '_sam_gen_cb_';
var sam_last_cb_id = -1;
function sendAsyncMessageWithCallback(aMessageManager, aGroupId, aMessageArr, aCallbackScope, aCallback) {
	sam_last_cb_id++;
	var thisCallbackId = SAM_CB_PREFIX + sam_last_cb_id;
	aCallbackScope = aCallbackScope ? aCallbackScope : bootstrap; // :todo: figure out how to get global scope here, as bootstrap is undefined
	aCallbackScope[thisCallbackId] = function(aMessageArr) {
		delete aCallbackScope[thisCallbackId];
		aCallback.apply(null, aMessageArr);
	}
	aMessageArr.push(thisCallbackId);
	aMessageManager.sendAsyncMessage(aGroupId, aMessageArr);
}
var bootstrapMsgListener = {
	funcScope: bootstrapCallbacks,
	receiveMessage: function(aMsgEvent) {
		var aMsgEventData = aMsgEvent.data;
		console.log('framescript getting aMsgEvent, unevaled:', uneval(aMsgEventData));
		// aMsgEvent.data should be an array, with first item being the unfction name in this.funcScope
		
		var callbackPendingId;
		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
			callbackPendingId = aMsgEventData.pop();
		}
		
		var funcName = aMsgEventData.shift();
		if (funcName in this.funcScope) {
			var rez_fs_call = this.funcScope[funcName].apply(null, aMsgEventData);
			
			if (callbackPendingId) {
				// rez_fs_call must be an array or promise that resolves with an array
				if (rez_fs_call.constructor.name == 'Promise') {
					rez_fs_call.then(
						function(aVal) {
							// aVal must be an array
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, aVal]);
						},
						function(aReason) {
							console.error('aReject:', aReason);
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aReason]]);
						}
					).catch(
						function(aCatch) {
							console.error('aCatch:', aCatch);
							contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aCatch]]);
						}
					);
				} else {
					// assume array
					contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, [callbackPendingId, rez_fs_call]);
				}
			}
		}
		else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
		
	}
};
contentMMFromContentWindow_Method2(content).addMessageListener(core.addon.id, bootstrapMsgListener);
// end - server/framescript comm layer
// start - common helper functions
function contentMMFromContentWindow_Method2(aContentWindow) {
	if (!gCFMM) {
		gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIDocShell)
							  .QueryInterface(Ci.nsIInterfaceRequestor)
							  .getInterface(Ci.nsIContentFrameMessageManager);
	}
	return gCFMM;

}
function Deferred() {
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
		console.log('Promise not available!', ex);
		throw new Error('Promise not available!');
	}
}
// end - common helper functions