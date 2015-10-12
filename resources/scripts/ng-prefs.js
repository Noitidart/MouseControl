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
	.directive('optionRowText', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/optionRowText.htm'
		};
	}])
	.directive('optionRowSelect', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/optionRowSelect.htm'
		};
	}])
	.directive('optionRowButton', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/optionRowButton.htm'
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
	.directive('modalEdit', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/configRow.htm'
		};
	}])
	.directive('modalConfirm', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mousecontrol/content/resources/directives/configRow.htm'
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
		BC.options = [
			{groupName: 'General', label:'Automatic Updates', type:'select', values:{0:'On', 1:'Off'}, desc: ''},
			{groupName: 'General', label:'Restore Defaults', type:'button', values:['Restore'], desc: ''},
			{groupName: 'General',label:'Export & Import', type:'button', values:['Export', 'Import'], desc: ''},
			{groupName: 'Timing', label:'Double Click Speed', type:'text', pref_name:'dbl-click-speed', desc: 'If you want to double click a mouse button, after the first release, you have to depress then release that button within this much time'},
			{groupName: 'Timing', label:'Hold Duration', type:'text', pref_name:'hold-duration', desc: 'A mouse button must be depressed this long before it is counted as a hold'},
			{groupName: 'Tabs', label:'New Tab Position ', type:'select', pref_name:'new-tab-pos', values:{0:'End of Tab Bar', 1:'Next to Current Tab'}, desc: ''},
			{groupName: 'Tabs', label:'Duplicated Tab Position', type:'select', pref_name:'dup-tab-pos', values:{0:'End of Tab Bar', 1:'Next to Current Tab'}, desc: ''},
			{groupName: 'Zoom', label:'Zoom Level Indicator', type:'select', pref_name:'zoom-indicator', values:{0:'Hide', 1:'Show'}, desc: 'As you zoom it will show a panel with the percent of current zoom'},
			{groupName: 'Zoom', label:'Zoom Context', type:'select', pref_name:'zoom-context', values:{0:'All Content', 1:'Text Only'}, desc: ''},
			{groupName: 'Zoom', label:'Zoom Style', type:'select', pref_name:'zoom-style', values:{0:'Global', 1:'Site Specifc', 2:'Temporary'}, desc: ''}
		];
		
		// get json config from bootstrap
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['fetchConfig'], bootstrapMsgListener.funcScope, function(aConfigJson) {
			console.log('got aConfigJson into ng:', aConfigJson);
			$scope.BC.configs = aConfigJson;
			$scope.$digest();
			console.log('digested');
		});
		
		sendAsyncMessageWithCallback(contentMMFromContentWindow_Method2(window), core.addon.id, ['fetchCore'], bootstrapMsgListener.funcScope, function(aCore) {
			console.log('got aCore:', aCore);
			core = aCore;
		});
		
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