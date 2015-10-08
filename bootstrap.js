const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const self = {
	id: 'MouseControl',
	suffix: '@jetpack',
	path: 'chrome://mousecontrol/content/',
	aData: 0,
};

const myServices = {};
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');
XPCOMUtils.defineLazyGetter(myServices, 'as', function(){ return Cc['@mozilla.org/alerts-service;1'].getService(Ci.nsIAlertsService) });

var funcsFileContentsDefault = ''; //holds the default unparsed json
var funcsFileObjDefault = [
	{
		name: 'Jump to Last Tab',
		desc: 'Selects the previously focused tab across all windows',
		group: 'tabs',
		script: '',
		combo: ''		
	},
	{
		name: 'Select Tab to Right',
		desc: 'Moves tab focus to the right of the currently selected tab',
		group: 'tabs',
		script: '',
		combo: ''
	},
	{
		name: 'Select Tab to Left',
		desc: 'Moves tab focus to the left of the currently selected tab',		group: 'tabs',
		script: '',
		combo: ''	
	},
	{
		name: 'Jump to Back to Original Tab',
		desc: 'If moved tab focus, and have not released trigger, this will jump back to the tab that was initally selected (Trigger: `Select Tab to Right` OR `Select Tab to Left`)',		group: 'tabs',
		script: '',
		combo: ''		
	},
	{
		name: 'Close Tab',
		desc: 'Closes the current tab and if this was the only tab in the window, the window will be closed',		group: 'tabs',
		script: '',
		combo: ''		
	},
	{
		name: 'Undo Close Tab',
		desc: 'Re-opens tab that was last closed',		group: 'tabs',
		script: '',
		combo: ''		
	},
	{
		name: 'Close All Tabs of Current Site',
		desc: 'Finds adn closes all tabs (within the current window) that have the same domain as the current tab',		group: 'tabs',
		script: '',
		combo: ''		
	},
	{
		name: 'New Tab',
		desc: 'Opens a new tab with respect to option of `New Tab Position`',		group: 'tabs',
		script: '',
		combo: ''		
	},
	{
		name: 'Duplicate Tab',
		desc: 'Clones the current tab and positions it with respect to option of `Duplicated Tab Position`',		group: 'tabs',
		script: '',
		combo: ''		
	},
	{
		name: 'Zoom In',
		desc: 'Decreases the zoom of the document in the tab',		group: 'zoom',
		script: '',
		combo: ''		
	},
	{
		name: 'Zoom Out',
		desc: 'Decreases the zoom of the document in the tab',		group: 'zoom',
		script: '',
		combo: ''		
	},
	{
		name: 'Reset Zoom',
		desc: 'Reset the zoom of the document in the tab to one-hundred percent',		group: 'zoom',
		script: '',
		combo: ''		
	}
];

function startup(aData, aReason) {
	self.aData = aData;
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) return;
}

function install() {}

function uninstall() {}