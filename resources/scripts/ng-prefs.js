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

// Initial framescript setup
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
// contentMMFromContentWindow_Method2(window).sendAsyncMessage(core.addon.id, ['fetchConfig_request', 'fetchConfig_response'])
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
		// purely ng-gui function
		return function(arr,property) {
			if (typeof property !=='string') {
				throw new Error('need a property to check for')
			}
			return Object.keys(arr.reduce(isUn,{}));

			function isUn(obj,item) {
				obj[item[property]] = true;
				return obj;
			}
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
		var init = function() {
			bootstrapCallbacks['ng-fetchConfig_request'] = function(aConfigJson) {
				delete bootstrapCallbacks['ng-fetchConfig_request'];
				console.log('got aConfigJson into ng:', aConfigJson);
				$scope.BC.configs = aConfigJson;
				$scope.$digest();
				console.log('digested');
			};
			contentMMFromContentWindow_Method2(window).sendAsyncMessage(core.addon.id, ['fetchConfig_request', 'ng-fetchConfig_request'])
		};
		
		init();
		
	}]);
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