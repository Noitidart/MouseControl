'use strict';

// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

// Globals
var core = { // have to set up the main keys that you want when aCore is merged from mainthread in init
	addon: {
		path: {
			content: 'chrome://mousecontrol/content/',
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};
var WORKER = this;
var OSStuff = {}; // global vars populated by init, based on OS

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
// imported scripts have access to global vars on MainWorker.js
importScripts(core.addon.path.content + 'modules/cutils.jsm');
importScripts(core.addon.path.content + 'modules/ctypes_math.jsm');

// Setup SICWorker 092915
// instructions on using SICWorker
	// to call a function in the main thread function scope (which was determiend on SICWorker call from mainthread) from worker, so self.postMessage with array, with first element being the name of the function to call in mainthread, and the reamining being the arguments
	// the return value of the functions here, will be sent to the callback, IF, worker did worker.postWithCallback
const SIC_CB_PREFIX = '_a_gen_cb_';
self.onmessage = function(aMsgEvent) {
	// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
	var aMsgEventData = aMsgEvent.data;
	
	console.log('worker receiving msg:', aMsgEvent);
	var callbackPendingId;
	if (typeof aMsgEventData[aMsgEventData.length-1] == 'String' && aMsgEventData[aMsgEventData.length-1].indexOf(SIC_CB_PREFIX) == 0) {
		callbackPendingId = aMsgEventData.pop();
	}
	
	var rez_worker_call = WORKER[aMsgEventData.shift()].apply(null, aMsgEventData);
	
	if (callbackPendingId) {
		self.postMessage([callbackPendingId, rez_worker_call]);
	}
};

////// end of imports and definitions

function init(objCore) {
	//console.log('in worker init');
	
	// merge objCore into core
	// core and objCore is object with main keys, the sub props
	
	core = objCore;
	
	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.content + 'modules/ostypes_win.jsm');
			break
		case 'gtk':
			importScripts(core.addon.path.content + 'modules/ostypes_x11.jsm');
			break;
		case 'darwin':
			importScripts(core.addon.path.content + 'modules/ostypes_mac.jsm');
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
	// OS Specific Init
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		default:
			// do nothing special
	}
	
	console.log('init worker done');
	
	self.postMessage(['init']);
}

// Start - Addon Functionality

self.onclose = function() {
	console.error('doing onclose');
	stopMonitor();
}

function winStartMessageLoop(wMsgFilterMin, wMsgFilterMax) {
	// as setting hooks requires a message loop, have to do that from a thread. from main thread, we have window message loop so dont need this. but here i do.
	// based on http://stackoverflow.com/questions/6901063/how-to-create-a-pure-winapi-window
	
	// great thing about handling my own message loop is that i can make it not respond to mouse move by setting minFilter to one above WM_MOUSEMOVE, thankfully WM_MOUSEMOVE is the lowest at 0x200
	
	// this sets up the thread message loop
	var LMessage = ostypes.TYPE.MSG();
	var rez_PeekMessage = ostypes.API('PeekMessage')(LMessage.address(), null, wMsgFilterMin, wMsgFilterMax, ostypes.CONST.PM_NOREMOVE);
	console.info('rez_PeekMessage:', rez_PeekMessage);
	
	var nowTime = new Date().getTime();
	// your main loop
	// while (new Date().getTime() - nowTime < 10000) { // run it for 10 sec
		// look for messages in the threads message queue and process them in turn.
		// You can use GetMessage here instead and it will block waiting for messages
		// which is good if you don't have anything else to do in your thread.
		var checkForMessage = function() {
			var rez_PeekMessage = ostypes.API('PeekMessage')(LMessage.address(), null, wMsgFilterMin, wMsgFilterMax, ostypes.CONST.PM_REMOVE);
			if (rez_PeekMessage) {
				console.log('message found:', LMessage);
			} else {
				console.log('no message found:', rez_PeekMessage);
			}
			if (new Date().getTime() - nowTime < 10000) { // run it for 10 sec
				setTimeout(checkForMessage, 1000);
			} else {
				console.log('message loop ended');
			}
		};
		checkForMessage();
	// }
	
	// console.log('message loop ended');
}

function syncMonitorMouse() {
	// this will get events and can block them
	
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				if (OSStuff.winHooked_aHhk) {
					throw new Error('already monitoring');
				}
				
				if (!OSStuff.mouseConsts) {
					OSStuff.mouseConsts = {
						WM_MOUSEMOVE: 0x200,
						WM_LBUTTONDOWN: 0x201,
						WM_LBUTTONUP: 0x202,
						WM_LBUTTONDBLCLK: 0x203,
						WM_RBUTTONDOWN: 0x204,
						WM_RBUTTONUP: 0x205,
						WM_RBUTTONDBLCLK: 0x206,
						WM_MBUTTONDOWN: 0x207,
						WM_MBUTTONUP: 0x208,
						WM_MBUTTONDBLCLK: 0x209,
						WM_MOUSEWHEEL: 0x20A,
						WM_XBUTTONDOWN: 0x20B,
						WM_XBUTTONUP: 0x20C,
						WM_XBUTTONDBLCLK: 0x20D,
						WM_MOUSEHWHEEL: 0x20E
					};
				};
				
				/*
				OSStuff.myLLMouseHook_js = function(nCode, wParam, lParam) {

					console.error('in hook callback!!');
					var eventType;
					for (var p in OSStuff.mouseConsts) {
						if (cutils.jscEqual(OSStuff.mouseConsts[p], wParam)) {
							eventType = p;
							break;
						}
					}

					var mhs = ostypes.TYPE.MSLLHOOKSTRUCT.ptr(ctypes.UInt64(lParam));

					console.info('myLLMouseHook | ', cutils.jscGetDeepest(eventType), 'nCode:', cutils.jscGetDeepest(nCode), 'wParam:', cutils.jscGetDeepest(wParam), 'lParam:', cutils.jscGetDeepest(lParam), 'mhs.contents:', mhs.contents.toString());

					var rez_CallNext = ostypes.API('CallNextHookEx')(null, nCode, wParam, lParam);
					// console.info('rez_CallNext:', rez_CallNext, rez_CallNext.toString());
					return rez_CallNext;
				};
				OSStuff.myLLMouseHook_c = ostypes.TYPE.LowLevelMouseProc.ptr(OSStuff.myLLMouseHook_js);
				
				// OSStuff.myLLMouseHook_js = myLLMouseHook_js; // so it doesnt get gc'ed
				// OSStuff.myLLMouseHook_c = myLLMouseHook_c; // so it doesnt get gc'ed
				
				
				OSStuff.winHooked_aHhk = ostypes.API('SetWindowsHookEx')(ostypes.CONST.WH_MOUSE_LL, OSStuff.myLLMouseHook_c, null, 0);
				console.info('OSStuff.winHooked_aHhk:', OSStuff.winHooked_aHhk, OSStuff.winHooked_aHhk.toString());
				if (OSStuff.winHooked_aHhk.isNull()) {
					console.error('failed to set hook, winLastError:', ctypes.winLastError);
					delete OSStuff.winHooked_aHhk;
					delete OSStuff.myLLMouseHook_js;
					delete OSStuff.myLLMouseHook_c;
					throw new Error('failed to set hook');
				}
				*/
				
				// winStartMessageLoop(ostypes.CONST.WM_LBUTTONDOWN, ostypes.CONST.WM_MOUSEHWHEEL);
				winStartMessageLoop(0, 0);
				
			break
		case 'gtk':
			
				
			
			break;
		case 'darwin':
			
				
			
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}

function stopMonitor() {
	// cancels the monitoring if its in progress
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				if (OSStuff.winHooked_aHhk) {
					var rez_stopMon = ostypes.API('UnhookWindowsHookEx')(OSStuff.winHooked_aHhk);					
					console.info('rez_stopMon:', rez_stopMon.toString(), uneval(rez_stopMon), cutils.jscGetDeepest(rez_stopMon));
					if (rez_stopMon == false) {
						console.error('Failed rez_stopMon, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_stopMon, winLastError: "' + ctypes.winLastError + '" and rez_stopMon: "' + rez_stopMon.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					delete OSStuff.myLLMouseHook_c;
					delete OSStuff.myLLMouseHook_js;
					delete OSStuff.winHooked_aHhk;
				} // else its not hooked
				console.error('should have finished unhooking');
				
			break
		case 'gtk':
			
				
			
			break;
		case 'darwin':
			
				
			
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}
// End - Addon Functionality


// Start - Common Functions


// End - Common Functions