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

var OSStuff = {}; // global vars populated by init, based on OS

var multiClickSpeed = 300;
var holdDuration = 300;

var configs = {
	'funcNameToCallInMainThread': [
		{
			stdConst: 'B2_DN',
			hold: false,
			multi: 1
		}
	]
};

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
// imported scripts have access to global vars on MainWorker.js
importScripts(core.addon.path.content + 'modules/cutils.jsm');
importScripts(core.addon.path.content + 'modules/ctypes_math.jsm');

// Setup SICWorker - rev8
// instructions on using SICWorker
	// to call a function in the main thread function scope (which was determiend on SICWorker call from mainthread) from worker, so self.postMessage with array, with first element being the name of the function to call in mainthread, and the reamining being the arguments
	// the return value of the functions here, will be sent to the callback, IF, worker did worker.postWithCallback
var WORKER = this;
const SIC_CB_PREFIX = '_a_gen_cb_';
const SIC_TRANS_WORD = '_a_gen_trans_';
var sic_last_cb_id = -1;
self.onmessage = function(aMsgEvent) {
	// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
	var aMsgEventData = aMsgEvent.data;
	
	console.log('worker receiving msg:', aMsgEventData);
	
	var callbackPendingId;
	if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SIC_CB_PREFIX) == 0) {
		callbackPendingId = aMsgEventData.pop();
	}
	
	var funcName = aMsgEventData.shift();
	
	if (funcName in WORKER) {
		var rez_worker_call = WORKER[funcName].apply(null, aMsgEventData);
		
		if (callbackPendingId) {
			if (rez_worker_call.constructor.name == 'Promise') {
				rez_worker_call.then(
					function(aVal) {
						// aVal must be array
						if (aVal.length >= 2 && aVal[aVal.length-1] == SIC_TRANS_WORD && Array.isArray(aVal[aVal.length-2])) {
							// to transfer in callback, set last element in arr to SIC_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
							aVal.pop();
							self.postMessage([callbackPendingId, aVal], aVal.pop());
						} else {
							self.postMessage([callbackPendingId, aVal]);
						}
					},
					function(aReason) {
						console.error('aReject:', aReason);
						self.postMessage([callbackPendingId, ['promise_rejected', aReason]]);
					}
				).catch(
					function(aCatch) {
						console.error('aCatch:', aCatch);
						self.postMessage([callbackPendingId, ['promise_rejected', aCatch]]);
					}
				);
			} else {
				// assume array
				if (rez_worker_call.length > 2 && rez_worker_call[rez_worker_call.length-1] == SIC_TRANS_WORD && Array.isArray(rez_worker_call[rez_worker_call.length-2])) {
					// to transfer in callback, set last element in arr to SIC_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
					rez_worker_call.pop();
					self.postMessage([callbackPendingId, rez_worker_call], rez_worker_call.pop());
				} else {
					self.postMessage([callbackPendingId, rez_worker_call]);
				}
				
			}
		}
	}
	else { console.warn('funcName', funcName, 'not in scope of WORKER') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out

};

// set up postMessageWithCallback so chromeworker can send msg to mainthread to do something then return here. must return an array, thta array is arguments applied to callback
self.postMessageWithCallback = function(aPostMessageArr, aCB, aPostMessageTransferList) {
	var aFuncExecScope = WORKER;
	
	sic_last_cb_id++;
	var thisCallbackId = SIC_CB_PREFIX + sic_last_cb_id;
	aFuncExecScope[thisCallbackId] = function() {
		delete aFuncExecScope[thisCallbackId];
		console.log('in worker callback trigger wrap, will apply aCB with these arguments:', uneval(arguments));
		aCB.apply(null, arguments[0]);
	};
	aPostMessageArr.push(thisCallbackId);
	self.postMessage(aPostMessageArr, aPostMessageTransferList);
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

// function winRunMessageLoopOLDER(wMsgFilterMin, wMsgFilterMax) {
// 	// as setting hooks requires a message loop, have to do that from a thread. from main thread, we have window message loop so dont need this. but here i do.
// 	// based on http://stackoverflow.com/questions/6901063/how-to-create-a-pure-winapi-window
// 	
// 	// great thing about handling my own message loop is that i can make it not respond to mouse move by setting minFilter to one above WM_MOUSEMOVE, thankfully WM_MOUSEMOVE is the lowest at 0x200
// 	
// 	// this sets up the thread message loop
// 	var LMessage = ostypes.TYPE.MSG();
// 	var rez_PeekMessage = ostypes.API('PeekMessage')(LMessage.address(), OSStuff.msgWinHwnd, wMsgFilterMin, wMsgFilterMax, ostypes.CONST.PM_NOREMOVE);
// 	console.info('rez_PeekMessage:', rez_PeekMessage);
// 	
// 	var nowTime = new Date().getTime();
// 	// your main loop
// 	// while (new Date().getTime() - nowTime < 10000) { // run it for 10 sec
// 		// look for messages in the threads message queue and process them in turn.
// 		// You can use GetMessage here instead and it will block waiting for messages
// 		// which is good if you don't have anything else to do in your thread.
// 		var checkForMessage = function() {
// 			var rez_PeekMessage = ostypes.API('PeekMessage')(LMessage.address(), OSStuff.msgWinHwnd, wMsgFilterMin, wMsgFilterMax, ostypes.CONST.PM_REMOVE);
// 			if (rez_PeekMessage) {
// 				console.log('message found:', LMessage);
// 			} else {
// 				console.log('no message found:', rez_PeekMessage);
// 			}
// 			
// 			/*
// 			if (cutils.jscEqual(LMessage.message, ostypes.CONST.WM_INPUT)) {
// 				// console.info('LMessage.lParam:', LMessage.lParam, LMessage.lParam.toString());
// 				var hrawinput = ostypes.TYPE.HRAWINPUT(LMessage.lParam); // ctypes.cast(LMEssage.lParam, ostypes.TYPE.HRAWINPUT) doesnt work here as the Message.lParam is not really ostypes.TYPE.LPARAM it gets unwrapped so its primiated js type, its just a number. thats why i can just wrap it with a ostypes.TYPE.HRAWINPUT
// 				var rez_getRawInputData = ostypes.API('GetRawInputData')(hrawinput, ostypes.CONST.RID_INPUT, OSStuff.getRawInputDataBuffer.address(), OSStuff.rawInputDataBufferSize.address(), ostypes.TYPE.RAWINPUTHEADER.size);
// 				console.log('rez_getRawInputData:', rez_getRawInputData, rez_getRawInputData.toString());
// 				console.info('OSStuff.getRawInputDataBuffer', OSStuff.getRawInputDataBuffer.mouse);
// 			}
// 			*/
// 			
// 			if (new Date().getTime() - nowTime < 10000) { // run it for 10 sec
// 				setTimeout(checkForMessage, 10);
// 			} else {
// 				console.log('message loop ended');
// 			}
// 		};
// 		checkForMessage();
// 	// }
// 	
// 	// console.log('message loop ended');
// }

function winRunMessageLoop(wMsgFilterMin, wMsgFilterMax) {
	// as setting hooks requires a message loop, have to do that from a thread. from main thread, we have window message loop so dont need this. but here i do.
	// based on http://stackoverflow.com/questions/6901063/how-to-create-a-pure-winapi-window
	
	// great thing about handling my own message loop is that i can make it not respond to mouse move by setting minFilter to one above WM_MOUSEMOVE, thankfully WM_MOUSEMOVE is the lowest at 0x200
	
	// this sets up the thread message loop
	var LMessage = ostypes.TYPE.MSG();
	// var rez_PeekMessage = ostypes.API('PeekMessage')(LMessage.address(), null, wMsgFilterMin, wMsgFilterMax, ostypes.CONST.PM_NOREMOVE);
	// console.info('rez_PeekMessage:', rez_PeekMessage);
	
	console.log('starting loop');
	
	var nowTime = new Date().getTime();
	// your main loop
	
	labelSoSwitchCanBreakWhile:
	while (true) { // run it for 10 sec

		var rez_GetMessage = ostypes.API('GetMessage')(LMessage.address(), null, wMsgFilterMin, wMsgFilterMax);
		console.log('rez_GetMessage:', rez_GetMessage);

		console.log('LMessage.message:', LMessage.toString());
		
		var rez_DispatchMessage = ostypes.API('DispatchMessage')(LMessage.address());
		console.log('rez_DispatchMessage:', rez_DispatchMessage);

		console.log('LMessage.message:', LMessage.toString());		
		
		// i set the wParam to custom things to signal my thread. to either just break from GetMessage to repeat loop, or quit
		var wParam = parseInt(cutils.jscGetDeepest(LMessage.wParam));
		switch (wParam) {
			case 3:
					
					// i sent this code so it gets out of getmessage so i can update config/prefs into worker
					
				break;
			case 4:
					
					// break loop
					break labelSoSwitchCanBreakWhile;
					
				break;
			default:
				// continue loop
		}
	}
	// console.log('message loop ended');
	stopMonitor(); // must stop monitor when stop loop otherwise mouse will freeze up for like 5sec, well thats what happens to me on win81
}

// function winCreateHiddenWindowForMessageLoop() {
// 	// as setting hooks requires a message loop, have to do that from a thread. from main thread, we have window message loop so dont need this. but here i do.
// 	
// 	// based on http://ochameau.github.io/2010/08/24/jsctypes-unleashed/
// 	if (OSStuff.msgWinHwnd) {
// 		throw new Error('already registered class window, this message loop thing can only be called once');
// 	}
// 	
// 	var windowProc = function(hwnd, uMsg, wParam, lParam) {
// 		
// 		var eventType;
// 		for (var p in OSStuff.mouseConsts) {
// 			if (cutils.jscEqual(OSStuff.mouseConsts[p], lParam)) {
// 				eventType = p;
// 				break;
// 			}
// 		}
// 		
// 		console.info('windowProc | ', 'eventType:', eventType, 'uMsg:', uMsg, 'wParam:', wParam, 'lParam:', lParam);
// 		// 0 means that we handle this event
// 		// return 0; 
// 		
// 		// Mandatory use default win32 procedure!
// 		var rez_DefWindowProc = ostypes.API('DefWindowProc')(hwnd, uMsg, wParam, lParam);
// 		console.log('rez_DefWindowProc:', rez_DefWindowProc, rez_DefWindowProc.toString());
// 		
// 		return rez_DefWindowProc;
// 	};
// 	OSStuff.windowProc = windowProc; // so it doesnt get gc'ed
// 	
// 	// Define a custom Window Class in order to bind our custom Window Proc
// 	var wndclass = ostypes.TYPE.WNDCLASS();
// 	wndclass.lpszClassName = ostypes.TYPE.LPCTSTR.targetType.array()('class-mozilla-firefox-addon-mousecontrol');
// 	wndclass.lpfnWndProc = ostypes.TYPE.WNDPROC.ptr(windowProc);
// 	var rez_registerClass = ostypes.API('RegisterClass')(wndclass.address());
// 	console.info('rez_registerClass:', rez_registerClass, rez_registerClass.toString());
// 	if (cutils.jscEqual(rez_registerClass, 0)) {
// 		console.warn('failed to register class, last error:', ctypes.winLastError);
// 		// throw new Error('failed to register class');
// 	}
// 	
// 	// Create a Message event only Window using this custom class
// 	var msgWinHwnd = ostypes.API('CreateWindowEx')(0, wndclass.lpszClassName, ostypes.TYPE.LPCTSTR.targetType.array()('window-mozilla-firefox-addon-mousecontrol'), 0, 0, 0, 0, 0,  ostypes.TYPE.HWND(ostypes.CONST.HWND_MESSAGE), null, null, null);
// 	console.info('msgWinHwnd:', msgWinHwnd, msgWinHwnd.toString());
// 	
// 	if (msgWinHwnd.isNull()) {
// 		console.error('failed to create window, last error:', ctypes.winLastError);
// 		throw new Error('failed to create window');
// 	}
// 	
// 	OSStuff.msgWinHwnd = msgWinHwnd; // so it doesnt get gc'ed
// 	
// 	terminators.push(function() {
// 		// var rez_destroyWindow = ostypes.API('DestroyWindow')(OSStuff.msgWinHwnd);
// 		// console.log('rez_destroyWindow:', rez_destroyWindow);
// 		
// 		// var rez_UnregisterClass = ostypes.API('UnregisterClass')(ostypes.TYPE.LPCTSTR.targetType.array()('class-mozilla-firefox-addon-mousecontrol'), null);
// 		// console.log('rez_UnregisterClass:', rez_UnregisterClass);
// 	});
// }

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
						// WM_NCXBUTTONDOWN: 0x00AB, // im not sure if these ncx things will trigger // i actually think the abovbe dblclicks wont trigger either
						// WM_NCXBUTTONUP: 0x00AC,
						// WM_NCXBUTTONDBLCLK: 0x00AD
					};
					
					// because all the os'es have different constants, i "standardize" them
					OSStuff.mouseConstToStdConst = {
						WM_LBUTTONDOWN: 'B1_DN',
						WM_LBUTTONUP: 'B1_UP',
						WM_RBUTTONDOWN: 'B2_DN',
						WM_RBUTTONUP: 'B2_UP',
						WM_MBUTTONDOWN: 'B3_DN',
						WM_MBUTTONUP: 'B3_UP',
						WM_MOUSEWHEEL: ['WV_DN', 'WV_UP'],
						WM_XBUTTONDOWN: ['B4_DN', 'B5_DN'],
						WM_XBUTTONUP: ['B4_UP', 'B5_UP'],
						WM_MOUSEHWHEEL: ['WH_LT', 'WH_RT']
					};
				};
				
				// winCreateHiddenWindowForMessageLoop();
				// winStartMessageLoopOLDER(ostypes.CONST.WM_LBUTTONDOWN, ostypes.CONST.WM_MOUSEHWHEEL);
				// winStartMessageLoopOLDER(ostypes.CONST.WM_INPUT, ostypes.CONST.WM_INPUT);
				// winRunMessageLoop(ostypes.CONST.WM_INPUT, ostypes.CONST.WM_INPUT); // for async
				// winRunMessageLoop(ostypes.CONST.WM_MOUSEMOVE, ostypes.CONST.WM_MOUSEHWHEEL); // for sync
				
				
				OSStuff.hookStartTime = new Date().getTime();
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

					var mouseDataLowordUnsigned = parseInt(cutils.jscGetDeepest(mhs.contents.mouseData)) & 0xffff;
					var mouseDataLowordSigned = mouseDataLowordUnsigned >= 32768 ? mouseDataLowordUnsigned - 65536 : mouseDataLowordUnsigned;
					
					var mouseDataHiwordUnsigned = (parseInt(cutils.jscGetDeepest(mhs.contents.mouseData)) >> 16) & 0xffff;
					var mouseDataHiwordSigned = mouseDataHiwordUnsigned >= 32768 ? mouseDataHiwordUnsigned - 65536 : mouseDataHiwordUnsigned;
					
					console.info('myLLMouseHook | ', eventType, 'nCode:', cutils.jscGetDeepest(nCode), 'wParam:', cutils.jscGetDeepest(wParam), 'lParam:', cutils.jscGetDeepest(lParam), 'mouseDataLoword:', mouseDataLowordSigned, 'mouseDataHiword:', mouseDataHiwordSigned, 'mhs.contents:', mhs.contents.toString());
					
					/*
					/////
					var usButtonFlagStrs = {}; // key value. key is aRawMouseConstStr value is 0 unless its wheel, in which case it is either 1 up/right or -1 for for left/down
					for (var aMouseConstStr in OSStuff.rawMouseConsts) {
						if (usButtonFlags & OSStuff.rawMouseConsts[aMouseConstStr]) {
							switch (aMouseConstStr) {
								case 'WM_MOUSEWHEEL':
								case 'WM_MOUSEHWHEEL':
									usButtonFlagStrs[aMouseConstStr] = parseInt(cutils.jscGetDeepest(ctypes.cast(ostypes.TYPE.USHORT(OSStuff.getRawInputDataBuffer.mouse.usButtonData), ostypes.TYPE.SHORT))) > 0 ? 1 : -1;
									break;
								default:
									usButtonFlagStrs[aMouseConstStr] = 0;
							}
						}
					}
					var pth = OS.Path.join(OS.Constants.Path.desktopDir, 'RawInputMouse.txt');
					var valOpen = OS.File.open(pth, {write: true, append: true});
					var txtToAppend = JSON.stringify(usButtonFlagStrs) + '\n';
					var txtEncoded = TextEncoder().encode(txtToAppend);
					valOpen.write(txtEncoded);
					valOpen.close();
					console.log('usButtonFlagStrs:', usButtonFlagStrs);
					/////
					*/

					
					if (new Date().getTime() - OSStuff.hookStartTime > 10000) {
						// its been 10sec, lets post message to make GetMessage return, because it seems my GetMessage is blocking forever as its not getting any messages posted to it
						var rez_PostMessage = ostypes.API('PostMessage')(null, ostypes.CONST.WM_INPUT, 4, 0);
						console.log('rez_PostMessage:', rez_PostMessage, rez_PostMessage.toString());
					} else {
						console.log('time not up yet');
					}
					
					/*
					if (!OSStuff.timerSet) {
						console.log('will now set timer');
						OSStuff.timerSet = true;
						OSStuff.timerIdHold = 1337;
						OSStuff.timerIdMulti = 10;
						var thisTimerId = OSStuff.timerLastId
						OSStuff.timerFunc_js = function(hwnd, uMsg, idEvent, dwTime) {
							console.error('triggered timerFunc_js', 'hwnd:', hwnd.toString(), 'uMsg:', uMsg.toString(), 'idEvent:', idEvent.toString(), 'dwTime:', dwTime.toString());
							var rez_KillTimer = ostypes.API('KillTimer')(OSStuff.timerIdHold);
							console.log('rez_KillTimer:', rez_KillTimer);
						};
						OSStuff.timerFunc_c = ostypes.TYPE.TIMERPROC.ptr(OSStuff.timerFunc_js);
						
						var rez_SetTimer = ostypes.API('SetTimer')(null, OSStuff.timerIdHold, 1000, OSStuff.timerFunc_c);
						console.log('rez_SetTimer:', rez_SetTimer, 'winLastError:', ctypes.winLastError);
							
					}
					*/
					
					if (parseInt(cutils.jscGetDeepest(nCode)) < 0) {
						// have to return rez callback because nCode is negative, this is per the docs			
						// start - block link4841115
						var rez_CallNext = ostypes.API('CallNextHookEx')(null, nCode, wParam, lParam);
						// console.info('rez_CallNext:', rez_CallNext, rez_CallNext.toString());
						return rez_CallNext;
						// end - block link4841115
					} else {
						if (eventType != 'WM_MOUSEMOVE') {
							// lets block it!
							return -1;
						} else {
							// start - copy of block link4841115
							var rez_CallNext = ostypes.API('CallNextHookEx')(null, nCode, wParam, lParam);
							// console.info('rez_CallNext:', rez_CallNext, rez_CallNext.toString());
							return rez_CallNext;
							// end - copy of block link4841115
						}
					}
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
				

				// winRunMessageLoop(ostypes.CONST.WM_INPUT, ostypes.CONST.WM_INPUT); // for sync
				winRunMessageLoop(0, 0); // for sync

				
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