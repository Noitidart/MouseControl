// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Globals
const core = {
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
	},
};
var gAngScope;
var gAngInjector;
var gCFMM;

// Lazy imports
var myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'prefs.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

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
	.controller('BodyController', ['$scope', '$sce', '$q', '$timeout', function($scope, $sce, $q, $timeout) {
		
		
		
		
	}]);

var bootstrapMsgListener = {
	receiveMessage: function(aMsgEvent) {
		console.log('framescript getting aMsgEvent:', aMsgEvent);
		// aMsgEvent.data should be an array, with first item being the unfction name in bootstrapCallbacks
		bootstrapCallbacks[aMsgEvent.data.shift()].apply(null, aMsgEvent.data);
	}
};

var bootstrapCallbacks = {
	fetchConfig_response: function(aConfigJson) {
		console.log('aConfigJson:', aConfigJson);
	}
};

function doOnBeforeUnload() {

	contentMMFromContentWindow_Method2(window).removeMessageListener(core.addon.id, bootstrapMsgListener);

}

function doOnLoad() {
	var gAngBody = angular.element(document.body);
	gAngScope = gAngBody.scope();
	gAngInjector = gAngBody.injector();
}

contentMMFromContentWindow_Method2(window).addMessageListener(core.addon.id, bootstrapMsgListener);
contentMMFromContentWindow_Method2(window).sendAsyncMessage(core.addon.id, ['fetchConfig_request', 'fetchConfig_response'])
document.addEventListener('DOMContentLoaded', doOnLoad, false);
window.addEventListener('beforeunload', doOnBeforeUnload, false);

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
// end - common helper functions