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

var terminators = [];
self.onclose = function() {
	console.log('MMSyncWorker.js terminating');
	
	// stopMonitor();
	
	for (var i=0; i<terminators.length; i++) {
		terminators[i]();
	}
}

function winStartMessageLoopOLDER(wMsgFilterMin, wMsgFilterMax) {
	// as setting hooks requires a message loop, have to do that from a thread. from main thread, we have window message loop so dont need this. but here i do.
	// based on http://stackoverflow.com/questions/6901063/how-to-create-a-pure-winapi-window
	
	// great thing about handling my own message loop is that i can make it not respond to mouse move by setting minFilter to one above WM_MOUSEMOVE, thankfully WM_MOUSEMOVE is the lowest at 0x200
	
	// this sets up the thread message loop
	var LMessage = ostypes.TYPE.MSG();
	var rez_PeekMessage = ostypes.API('PeekMessage')(LMessage.address(), null, wMsgFilterMin, wMsgFilterMax, ostypes.CONST.PM_NOREMOVE);
	// console.info('rez_PeekMessage:', rez_PeekMessage);
	
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
			
			if (cutils.jscEqual(LMessage.message, ostypes.CONST.WM_INPUT)) {
				// console.info('LMessage.lParam:', LMessage.lParam, LMessage.lParam.toString());
				var hrawinput = ostypes.TYPE.HRAWINPUT(LMessage.lParam); // ctypes.cast(LMEssage.lParam, ostypes.TYPE.HRAWINPUT) doesnt work here as the Message.lParam is not really ostypes.TYPE.LPARAM it gets unwrapped so its primiated js type, its just a number. thats why i can just wrap it with a ostypes.TYPE.HRAWINPUT
				var rez_getRawInputData = ostypes.API('GetRawInputData')(hrawinput, ostypes.CONST.RID_INPUT, OSStuff.getRawInputDataBuffer.address(), OSStuff.rawInputDataBufferSize.address(), ostypes.TYPE.RAWINPUTHEADER.size);
				console.log('rez_getRawInputData:', rez_getRawInputData, rez_getRawInputData.toString());
				console.info('OSStuff.getRawInputDataBuffer', OSStuff.getRawInputDataBuffer.mouse);
			}
			
			if (new Date().getTime() - nowTime < 10000) { // run it for 10 sec
				setTimeout(checkForMessage, 10);
			} else {
				console.log('message loop ended');
			}
		};
		checkForMessage();
	// }
	
	// console.log('message loop ended');
}

function winStartMessageLoopOLD(wMsgFilterMin, wMsgFilterMax) {
	// as setting hooks requires a message loop, have to do that from a thread. from main thread, we have window message loop so dont need this. but here i do.
	// based on http://stackoverflow.com/questions/6901063/how-to-create-a-pure-winapi-window
	
	// great thing about handling my own message loop is that i can make it not respond to mouse move by setting minFilter to one above WM_MOUSEMOVE, thankfully WM_MOUSEMOVE is the lowest at 0x200
	
	// this sets up the thread message loop
	var LMessage = ostypes.TYPE.MSG();
	var rez_PeekMessage = ostypes.API('PeekMessage')(LMessage.address(), null, wMsgFilterMin, wMsgFilterMax, ostypes.CONST.PM_NOREMOVE);
	console.info('rez_PeekMessage:', rez_PeekMessage);
	
	console.log('starting loop');
	
	var nowTime = new Date().getTime();
	// your main loop
	// while (new Date().getTime() - nowTime < 10000) { // run it for 10 sec
		var rez_GetMessage = ostypes.API('GetMessage')(LMessage.address(), null, wMsgFilterMin, wMsgFilterMax);
		console.log('rez_GetMessage:', rez_GetMessage);
	// }
	
	console.log('message loop ended');
}

function winStartMessageLoop() {
	// as setting hooks requires a message loop, have to do that from a thread. from main thread, we have window message loop so dont need this. but here i do.
	
	// based on http://ochameau.github.io/2010/08/24/jsctypes-unleashed/
	if (OSStuff.msgWinHwnd) {
		throw new Error('already registered class window, this message loop thing can only be called once');
	}
	
	var windowProc = function(hwnd, uMsg, wParam, lParam) {
		
		var eventType;
		for (var p in OSStuff.mouseConsts) {
			if (cutils.jscEqual(OSStuff.mouseConsts[p], lParam)) {
				eventType = p;
				break;
			}
		}
		
		console.info('windowProc | ', 'eventType:', eventType, 'uMsg:', uMsg, 'wParam:', wParam, 'lParam:', lParam);
		// 0 means that we handle this event
		// return 0; 
		
		// Mandatory use default win32 procedure!
		var rez_DefWindowProc = ostypes.API('DefWindowProc')(hwnd, uMsg, wParam, lParam);
		console.log('rez_DefWindowProc:', rez_DefWindowProc, rez_DefWindowProc.toString());
		
		return rez_DefWindowProc;
	};
	OSStuff.windowProc = windowProc; // so it doesnt get gc'ed
	
	// Define a custom Window Class in order to bind our custom Window Proc
	var wndclass = ostypes.TYPE.WNDCLASS();
	wndclass.lpszClassName = ostypes.TYPE.LPCTSTR.targetType.array()('class-mozilla-firefox-addon-mousecontrol');
	wndclass.lpfnWndProc = ostypes.TYPE.WNDPROC.ptr(windowProc);
	var rez_registerClass = ostypes.API('RegisterClass')(wndclass.address());
	console.info('rez_registerClass:', rez_registerClass, rez_registerClass.toString());
	if (cutils.jscEqual(rez_registerClass, 0)) {
		console.warn('failed to register class, last error:', ctypes.winLastError);
		// throw new Error('failed to register class');
	}
	
	// Create a Message event only Window using this custom class
	var msgWinHwnd = ostypes.API('CreateWindowEx')(0, wndclass.lpszClassName, ostypes.TYPE.LPCTSTR.targetType.array()('window-mozilla-firefox-addon-mousecontrol'), 0, 0, 0, 0, 0,  ostypes.TYPE.HWND(ostypes.CONST.HWND_MESSAGE), null, null, null);
	console.info('msgWinHwnd:', msgWinHwnd, msgWinHwnd.toString());
	
	if (msgWinHwnd.isNull()) {
		console.error('failed to create window, last error:', ctypes.winLastError);
		throw new Error('failed to create window');
	}
	
	OSStuff.msgWinHwnd = msgWinHwnd; // so it doesnt get gc'ed
	
	terminators.push(function() {
		// var rez_destroyWindow = ostypes.API('DestroyWindow')(OSStuff.msgWinHwnd);
		// console.log('rez_destroyWindow:', rez_destroyWindow);
		
		// var rez_UnregisterClass = ostypes.API('UnregisterClass')(ostypes.TYPE.LPCTSTR.targetType.array()('class-mozilla-firefox-addon-mousecontrol'), null);
		// console.log('rez_UnregisterClass:', rez_UnregisterClass);
	});
	
	// rawinput stuff from tutorial: http://www.toymaker.info/Games/html/raw_input.html#tables
	
				var rid_js = new Array(1);
				rid_js[0] = ostypes.TYPE.RAWINPUTDEVICE(1, 2, ostypes.CONST.RIDEV_INPUTSINK, msgWinHwnd); // mouse
				// ostypes.CONST.RIDEV_INPUTSINK because this tells it to get events even when not focused
				
				/*
				usUsagePage
				1 for generic desktop controls
				2 for simulation controls
				3 for vr
				4 for sport
				5 for game
				6 for generic device
				7 for keyboard
				8 for leds
				9 button
				*/
				
				/*
				usUsage values when usUsagePage is 1
				0 - undefined
				1 - pointer
				2 - mouse
				3 - reserved
				4 - joystick
				5 - game pad
				6 - keyboard
				7 - keypad
				8 - multi-axis controller
				9 - Tablet PC controls
				*/
				
				// lets preallocate the buffer so we dont have to allocate everytime a wm_input message is found:
				OSStuff.getRawInputDataBuffer = ostypes.TYPE.RAWINPUT();
				OSStuff.rawInputDataBufferSize = ostypes.TYPE.UINT(ostypes.TYPE.RAWINPUT.size);
				
				var rid_c = ostypes.TYPE.RAWINPUTDEVICE.array(rid_js.length)(rid_js);
				var rez_registerDevices = ostypes.API('RegisterRawInputDevices')(rid_c, rid_js.length, ostypes.TYPE.RAWINPUTDEVICE.size);
				console.info('rez_registerDevices:', rez_registerDevices.toString(), uneval(rez_registerDevices), cutils.jscGetDeepest(rez_registerDevices));
				if (rez_registerDevices == false) {
					console.error('Failed rez_registerDevices, winLastError:', ctypes.winLastError);
					throw new Error({
						name: 'os-api-error',
						message: 'Failed rez_registerDevices, winLastError: "' + ctypes.winLastError + '" and rez_registerDevices: "' + rez_registerDevices.toString(),
						winLastError: ctypes.winLastError
					});
				}
	

	
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
				
				winStartMessageLoop();
				// winStartMessageLoopOLDER(ostypes.CONST.WM_LBUTTONDOWN, ostypes.CONST.WM_MOUSEHWHEEL);
				winStartMessageLoopOLDER(ostypes.CONST.WM_INPUT, ostypes.CONST.WM_INPUT);
				// winStartMessageLoopOLD(0, 0);
				
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