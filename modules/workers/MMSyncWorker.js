// Imports
importScripts('resource://gre/modules/osfile.jsm');

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

var mouseTracker = [];
var sendMouseEventsToMT = false;

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
	var aInitInfoObj = {};
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				var thisThreadId = ostypes.API('GetCurrentThreadId')();
				aInitInfoObj.winMmWorkerThreadId = parseInt(cutils.jscGetDeepest(thisThreadId));
				
			break;
		default:
			// do nothing special
	}
	
	console.log('init worker done');
	
	self.postMessage(['init', aInitInfoObj]);
}

// Start - Addon Functionality

self.onclose = function() {
	console.error('MMSyncWorker.js TERMINATED');
}

var terminators = [];
function preTerminate() {
	console.log('MMSyncWorker.js pre-terminating');
	
	// stopMonitor();
	
	for (var i=0; i<terminators.length; i++) {
		terminators[i]();
	}
	
	return [];
}

var jsMmJsonParsed;

var cCharArr_addieOfMmJson;
var cInt_doWhat;
var cInt_MmJsonLen;

function initShareablesAndStartMM(addieOf) {
	cInt_doWhat = ctypes.int.ptr(ctypes.UInt64(addieOf.cInt_doWhat));
	cInt_MmJsonLen = ctypes.int.ptr(ctypes.UInt64(addieOf.cInt_MmJsonLen));
	cCharArr_addieOfMmJson = ctypes.char.array(41).ptr(ctypes.UInt64(addieOf.cCharArr_addieOfMmJson));
	
	if (cInt_doWhat.contents != 1) {
		console.error('whaaa VERY BAD ERROR. im in initShareables, CommWorker createShareables_andSecondaryInit SHOULD HAVE set cInt_doWhat to 1 but it is:', cInt_doWhat.contents);
	}
	
	actOnDoWhat();
	
	syncMonitorMouse();
	
	
}

function actOnDoWhat() {	
	// after acting on doWhat i set it to the negative
	
	switch (cInt_doWhat.contents) {
		case 1:
			
				// read in MmJson
				cInt_doWhat.contents = -1;
				
				console.log('actOnDoWhat :: read in MmJson');
				
				var jsStr_addieOfMmJson = cCharArr_addieOfMmJson.contents.readString();
				console.log('jsStr_addieOfMmJson:', jsStr_addieOfMmJson);
				
				var jsInt_MmJsonLen = cInt_MmJsonLen.contents;
				console.log('jsInt_MmJsonLen:', jsInt_MmJsonLen);
				
				var jsMmJsonStringified = ctypes.char.array(jsInt_MmJsonLen).ptr(ctypes.UInt64(jsStr_addieOfMmJson)).contents.readString();
				console.log('jsMmJsonStringified:', jsMmJsonStringified);
				
				jsMmJsonParsed = JSON.parse(jsMmJsonStringified);
				
			
			break;
		case 2:
			
				// sendMouseEventsToMT to true
				console.log('MMWorker ok enabling mouse sending');
				cInt_doWhat.contents = -2;
				
				sendMouseEventsToMT = true;
			
			break;
		case 3:
			
				// sendMouseEventsToMT to false
				cInt_doWhat.contents = -3;
				
				console.log('MMWorker ok DISALBING mouse sending');
				
				sendMouseEventsToMT = false;
				
			
			break;
		case 4:
			
				// stop mouse monitor
				cInt_doWhat.contents = -4;
				
				console.log('MMWorker ok STOPPING MOUSE MON');
				
				return -4;
			
			break;
		default:
			console.error('unrecognized cInt_doWhat.contents of "', cInt_doWhat.contents, '"');
	}
}

function checkMouseTracker() {
	// goes through mouseTracker, and decides if it should call a function back in mainthread because mouse config matched AND/OR clear mouseTracker
	
	// check if mouseTracker matches anything exactly, if it does then call that function
	// if current mouseTracker is not subset/substring_of_array of any config then clear mouseTracker
	var mouseTrackerIsSubsetOfIds = {}; // holds ids that mouseTracker is a subset of. if its a fullset of, its not in this object as i will call it
	labelSoIForCanContinueThePFor:
	for (var p in jsMmJsonParsed.config) {
		for (var i=0; i<jsMmJsonParsed.config[p].length; i++) {
			if (i == mouseTracker.length) {
				// mouseTracker length is shorter then that of jsMmJsonParsed.config[p] so its impossible for mouseTracker to be a fullset match
				// console.info('mouseTracker length is shorter then that of jsMmJsonParsed.config[p] so its impossible for mouseTracker to be a fullset match');
				continue labelSoIForCanContinueThePFor;
			}
			if (mouseTracker[i].stdConst != jsMmJsonParsed.config[p][i].stdConst) {
				delete mouseTrackerIsSubsetOfIds[p];
				continue labelSoIForCanContinueThePFor;
			}
			mouseTrackerIsSubsetOfIds[p] = true;
		}
		// got here so mouseTracker matches
		// console.info('got here so mouseTracker matches');
		delete mouseTrackerIsSubsetOfIds[p];
		if (mouseTracker.length == jsMmJsonParsed.config[p].length) {
			// mouseTracker and config length are same, so call this in mainthread. mouseTracker is fullset of config.
			// :todo: call in mainthread this function
			console.error('call mainthread func for id:', p, 'as its config was fullset matched to mouseTracker:', jsMmJsonParsed.config[p]);
			self.postMessage(['triggerConfigFunc', p]);
			// dont return, continue as user may have set the same config for multiple
		} else {
			// mouseTracker is superset of config (meaning config is subset of mouseTracker)
			// mouseTracker.length > config length so this config was already called. but mouseTracker is dirty with this in there now because there is another config that mouseTracker is still a subset of
		}
	}
	
	for (var p in mouseTrackerIsSubsetOfIds) {
		// mouseTracker is subset of a config, so keep it dirty, as user might complete that config (in which case he does then ill need to call the mainthread func)
		// console.info('mouseTracker is subset of a config, so keep it dirty, as user might complete that config (in which case he does then ill need to call the mainthread func)');
		return;
	}
	// mouseTracker is not subset of any config
	// console.info('mouseTracker is not subset of any config');
	mouseTracker = [];
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
		switch (actOnDoWhat()) {
			case -4:
					
					// stop mouse monitor
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
	
	console.log('in syncMonitorMouse jsMmJsonParsed.prefs.holdDuration:', jsMmJsonParsed.prefs.holdDuration, 'jsMmJsonParsed.prefs.multiClickSpeed:', jsMmJsonParsed.prefs.multiClickSpeed, 'jsMmJsonParsed.config:', jsMmJsonParsed.config);
	
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
						WM_MOUSEWHEEL: ['WV_UP', 'WV_DN'],
						WM_XBUTTONDOWN: ['B4_DN', 'B5_DN'],
						WM_XBUTTONUP: ['B4_UP', 'B5_UP'],
						WM_MOUSEHWHEEL: ['WH_RT', 'WH_LT']
					};
				};
				
				// winCreateHiddenWindowForMessageLoop();
				// winStartMessageLoopOLDER(ostypes.CONST.WM_LBUTTONDOWN, ostypes.CONST.WM_MOUSEHWHEEL);
				// winStartMessageLoopOLDER(ostypes.CONST.WM_INPUT, ostypes.CONST.WM_INPUT);
				// winRunMessageLoop(ostypes.CONST.WM_INPUT, ostypes.CONST.WM_INPUT); // for async
				// winRunMessageLoop(ostypes.CONST.WM_MOUSEMOVE, ostypes.CONST.WM_MOUSEHWHEEL); // for sync
				
				
				OSStuff.hookStartTime = new Date().getTime();
				OSStuff.myLLMouseHook_js = function(nCode, wParam, lParam) {

					// console.error('in hook callback!!');
					
					// if (new Date().getTime() - OSStuff.hookStartTime > 10000) {
						// // its been 10sec, lets post message to make GetMessage return, because it seems my GetMessage is blocking forever as its not getting any messages posted to it
						// var rez_PostMessage = ostypes.API('PostMessage')(null, ostypes.CONST.WM_INPUT, 4, 0);
						// console.log('rez_PostMessage:', rez_PostMessage, rez_PostMessage.toString());
					// }
					
					var eventType;
					for (var p in OSStuff.mouseConsts) {
						if (cutils.jscEqual(OSStuff.mouseConsts[p], wParam)) {
							eventType = p;
							break;
						}
					}
                
					var rezCallNextEx = function() {
						var rez_CallNext = ostypes.API('CallNextHookEx')(null, nCode, wParam, lParam);
						// console.info('rez_CallNext:', rez_CallNext, rez_CallNext.toString());
						return rez_CallNext;
					};
				
					if (parseInt(cutils.jscGetDeepest(nCode)) < 0) {
						// have to return rez callback because nCode is negative, this is per the docs			
						return rezCallNextEx();
					} else {
						if (eventType != 'WM_MOUSEMOVE') {
							// lets add it to our global
							switch (eventType) {
								case 'WM_MOUSEWHEEL':
								case 'WM_MOUSEHWHEEL':
									
										var mhs = ostypes.TYPE.MSLLHOOKSTRUCT.ptr(ctypes.UInt64(lParam));
										
										var mouseDataHiwordUnsigned = (parseInt(cutils.jscGetDeepest(mhs.contents.mouseData)) >> 16) & 0xffff;
										var mouseDataHiwordSigned = mouseDataHiwordUnsigned >= 32768 ? mouseDataHiwordUnsigned - 65536 : mouseDataHiwordUnsigned;
										var wheelDelta = mouseDataHiwordSigned;
										
										mouseTracker.push({
											stdConst: wheelDelta > 0 ? OSStuff.mouseConstToStdConst[eventType][0] : OSStuff.mouseConstToStdConst[eventType][1],
											multi: 1,
											hold: false
										});
									
									break;
								case 'WM_XBUTTONDOWN':
								case 'WM_XBUTTONUP':
									
										var mhs = ostypes.TYPE.MSLLHOOKSTRUCT.ptr(ctypes.UInt64(lParam));
										
										var mouseDataHiwordUnsigned = (parseInt(cutils.jscGetDeepest(mhs.contents.mouseData)) >> 16) & 0xffff;
										// var mouseDataHiwordSigned = mouseDataHiwordUnsigned >= 32768 ? mouseDataHiwordUnsigned - 65536 : mouseDataHiwordUnsigned;
										var xButtonNum = mouseDataHiwordUnsigned;
										if (xButtonNum != ostypes.CONST.XBUTTON1 && xButtonNum != ostypes.CONST.XBUTTON2) {
											console.error('VERY WEIRD, its not 1 or 2, so maybe 3+ for supporting more then just button 4 and button 5? it is:', xButtonNum);
										}
										mouseTracker.push({
											stdConst: OSStuff.mouseConstToStdConst[eventType][xButtonNum-1],
											multi: 1,
											hold: false
										});
									
									break;
								default:
										mouseTracker.push({
											stdConst: OSStuff.mouseConstToStdConst[eventType],
											multi: 1,
											hold: false
										});
							}
							
							// console.info('mouseTracker:', mouseTracker);
							
							if (sendMouseEventsToMT) {
								self.postMessage(['mouseEvent', mouseTracker[mouseTracker.length-1]]);
								mouseTracker = []; // clear mouseTracker, as only time i send mouse events to mainthread is when recording, so after they leave recording mouseTracker needs to be clean. but not if they just hovered in and hovered out. only if they get in and do a recording
								return -1;
							} else {
								checkMouseTracker();
								return rezCallNextEx(); // return -1;
							}
						} else {
							return rezCallNextEx();
						}
					}
					

				
				
				/////////// old stuff
				//	console.error('in hook callback!!');
				//	var eventType;
				//	for (var p in OSStuff.mouseConsts) {
				//		if (cutils.jscEqual(OSStuff.mouseConsts[p], wParam)) {
				//			eventType = p;
				//			break;
				//		}
				//	}
                //
				//	var mhs = ostypes.TYPE.MSLLHOOKSTRUCT.ptr(ctypes.UInt64(lParam));
                //
				//	var mouseDataLowordUnsigned = parseInt(cutils.jscGetDeepest(mhs.contents.mouseData)) & 0xffff;
				//	var mouseDataLowordSigned = mouseDataLowordUnsigned >= 32768 ? mouseDataLowordUnsigned - 65536 : mouseDataLowordUnsigned;
				//	
				//	var mouseDataHiwordUnsigned = (parseInt(cutils.jscGetDeepest(mhs.contents.mouseData)) >> 16) & 0xffff;
				//	var mouseDataHiwordSigned = mouseDataHiwordUnsigned >= 32768 ? mouseDataHiwordUnsigned - 65536 : mouseDataHiwordUnsigned;
				//	
				//	console.info('myLLMouseHook | ', eventType, 'nCode:', cutils.jscGetDeepest(nCode), 'wParam:', cutils.jscGetDeepest(wParam), 'lParam:', cutils.jscGetDeepest(lParam), 'mouseDataLoword:', mouseDataLowordSigned, 'mouseDataHiword:', mouseDataHiwordSigned, 'mhs.contents:', mhs.contents.toString());
				//	
				//	/*
				//	/////
				//	var usButtonFlagStrs = {}; // key value. key is aRawMouseConstStr value is 0 unless its wheel, in which case it is either 1 up/right or -1 for for left/down
				//	for (var aMouseConstStr in OSStuff.rawMouseConsts) {
				//		if (usButtonFlags & OSStuff.rawMouseConsts[aMouseConstStr]) {
				//			switch (aMouseConstStr) {
				//				case 'WM_MOUSEWHEEL':
				//				case 'WM_MOUSEHWHEEL':
				//					usButtonFlagStrs[aMouseConstStr] = parseInt(cutils.jscGetDeepest(ctypes.cast(ostypes.TYPE.USHORT(OSStuff.getRawInputDataBuffer.mouse.usButtonData), ostypes.TYPE.SHORT))) > 0 ? 1 : -1;
				//					break;
				//				default:
				//					usButtonFlagStrs[aMouseConstStr] = 0;
				//			}
				//		}
				//	}
				//	var pth = OS.Path.join(OS.Constants.Path.desktopDir, 'RawInputMouse.txt');
				//	var valOpen = OS.File.open(pth, {write: true, append: true});
				//	var txtToAppend = JSON.stringify(usButtonFlagStrs) + '\n';
				//	var txtEncoded = TextEncoder().encode(txtToAppend);
				//	valOpen.write(txtEncoded);
				//	valOpen.close();
				//	console.log('usButtonFlagStrs:', usButtonFlagStrs);
				//	/////
				//	*/
                //
				//	
				//	if (new Date().getTime() - OSStuff.hookStartTime > 10000) {
				//		// its been 10sec, lets post message to make GetMessage return, because it seems my GetMessage is blocking forever as its not getting any messages posted to it
				//		var rez_PostMessage = ostypes.API('PostMessage')(null, ostypes.CONST.WM_INPUT, 4, 0);
				//		console.log('rez_PostMessage:', rez_PostMessage, rez_PostMessage.toString());
				//	} else {
				//		console.log('time not up yet');
				//	}
				//	
				//	/*
				//	if (!OSStuff.timerSet) {
				//		console.log('will now set timer');
				//		OSStuff.timerSet = true;
				//		OSStuff.timerIdHold = 1337;
				//		OSStuff.timerIdMulti = 10;
				//		var thisTimerId = OSStuff.timerLastId
				//		OSStuff.timerFunc_js = function(hwnd, uMsg, idEvent, dwTime) {
				//			console.error('triggered timerFunc_js', 'hwnd:', hwnd.toString(), 'uMsg:', uMsg.toString(), 'idEvent:', idEvent.toString(), 'dwTime:', dwTime.toString());
				//			var rez_KillTimer = ostypes.API('KillTimer')(OSStuff.timerIdHold);
				//			console.log('rez_KillTimer:', rez_KillTimer);
				//		};
				//		OSStuff.timerFunc_c = ostypes.TYPE.TIMERPROC.ptr(OSStuff.timerFunc_js);
				//		
				//		var rez_SetTimer = ostypes.API('SetTimer')(null, OSStuff.timerIdHold, 1000, OSStuff.timerFunc_c);
				//		console.log('rez_SetTimer:', rez_SetTimer, 'winLastError:', ctypes.winLastError);
				//			
				//	}
				//	*/
				//	
				//	if (parseInt(cutils.jscGetDeepest(nCode)) < 0) {
				//		// have to return rez callback because nCode is negative, this is per the docs			
				//		// start - block link4841115
				//		var rez_CallNext = ostypes.API('CallNextHookEx')(null, nCode, wParam, lParam);
				//		// console.info('rez_CallNext:', rez_CallNext, rez_CallNext.toString());
				//		return rez_CallNext;
				//		// end - block link4841115
				//	} else {
				//		if (eventType != 'WM_MOUSEMOVE') {
				//			// lets block it!
				//			return -1;
				//		} else {
				//			// start - copy of block link4841115
				//			var rez_CallNext = ostypes.API('CallNextHookEx')(null, nCode, wParam, lParam);
				//			// console.info('rez_CallNext:', rez_CallNext, rez_CallNext.toString());
				//			return rez_CallNext;
				//			// end - copy of block link4841115
				//		}
				//	}
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
			
				/* // this wont work from off mainthread - im switching to CGEventTap as that works on threads per @KenThomases
				if (OSStuff.rez_add) {
					throw new Error('already monitoring');
				}

				OSStuff.myHandler_js = function(c_arg1__self, objc_arg1__aNSEventPtr) {
					console.log('in myHandler', objc_arg1__aNSEventPtr.toString());
					
					var cType = ostypes.API('objc_msgSend')(objc_arg1__aNSEventPtr, ostypes.HELPER.sel('type'));
					console.info('cType:', cType, cType.toString());
					
					cType = ctypes.cast(cType, ostypes.TYPE.NSEventType);
					console.info('cType:', cType, cType.toString());
					
					
					return objc_arg1__aNSEventPtr; // return null to block
				};
				OSStuff.myHandler_c = ostypes.TYPE.IMP_for_EventMonitorCallback.ptr(OSStuff.myHandler_js);
				OSStuff.myBlock_c = ostypes.HELPER.createBlock(OSStuff.myHandler_c);
				
				console.info('myBlock_c:', OSStuff.myBlock_c, OSStuff.myBlock_c.toString());
				console.info('myBlock_c.address():', OSStuff.myBlock_c.address(), OSStuff.myBlock_c.address().toString());
				
				var rez_add = ostypes.API('objc_msgSend')(ostypes.HELPER.class('NSEvent'), ostypes.HELPER.sel('addLocalMonitorForEventsMatchingMask:handler:'), ostypes.TYPE.NSEventMask(ostypes.CONST.NSKeyDownMask), OSStuff.myBlock_c.address());
				console.log('rez_add:', rez_add, rez_add.toString());
				*/
				// start the run loop
				if (OSStuff.aRLS) {
					throw new Error('already monitoring');
				}
				
				if (!OSStuff.mouseConsts) {
					OSStuff.mouseConsts = {
						kCGEventLeftMouseDown: 1,
						kCGEventLeftMouseUp: 2,
						kCGEventRightMouseDown: 3,
						kCGEventRightMouseUp: 4,
						kCGEventOtherMouseDown: 25,
						kCGEventOtherMouseUp: 26,
						kCGEventScrollWheel: 22
					};
					
					// because all the os'es have different constants, i "standardize" them
					OSStuff.mouseConstToStdConst = {
						kCGEventLeftMouseDown: 'B1_DN',
						kCGEventLeftMouseUp: 'B1_UP',
						kCGEventRightMouseDown: 'B2_DN',
						kCGEventRightMouseUp: 'B2_UP',
						kCGEventOtherMouseDown: 'B?_DN',
						kCGEventOtherMouseUp: 'B?_UP',
						kCGEventScrollWheel: 'W?_??'
						// WM_XBUTTONUP: ['B4_UP', 'B5_UP'],
						// WM_MOUSEHWHEEL: ['WH_RT', 'WH_LT']
					};
				};
				
				var MouseTracker_js = function(proxy, type, event, refcon) {
					console.error('in MouseTracker_js!!!!');
					return event; // ostypes.TYPE.CGEventRef
				};
				OSStuff.MouseTracker = ostypes.TYPE.CGEventTapCallBack(MouseTracker_js);
				
				var mask =  ostypes.API('CGEventMaskBit')(ostypes.CONST.kCGEventLeftMouseDown) | 
							ostypes.API('CGEventMaskBit')(ostypes.CONST.kCGEventLeftMouseUp) |	
							ostypes.API('CGEventMaskBit')(ostypes.CONST.kCGEventRightMouseDown) |
							ostypes.API('CGEventMaskBit')(ostypes.CONST.kCGEventRightMouseUp) |
							ostypes.API('CGEventMaskBit')(ostypes.CONST.kCGEventOtherMouseDown) |
							ostypes.API('CGEventMaskBit')(ostypes.CONST.kCGEventOtherMouseUp) |
							ostypes.API('CGEventMaskBit')(ostypes.CONST.kCGEventScrollWheel);
				
				// var mask = ostypes.CONST.kCGEventMaskForAllEvents;
				
				var psn = ostypes.TYPE.ProcessSerialNumber();
				var rez_GetCurrentProcess = ostypes.API('GetCurrentProcess')(psn.address());
				console.log('rez_GetCurrentProcess:', rez_GetCurrentProcess, rez_GetCurrentProcess.toString());
				
				console.log('psn:', psn, psn.toString());
				
				var mouseEventTap = ostypes.API('CGEventTapCreateForPSN')(psn.address(), ostypes.CONST.kCGHeadInsertEventTap, ostypes.CONST.kCGEventTapOptionDefault, mask, OSStuff.MouseTracker, null);
				console.log('mouseEventTap:', mouseEventTap, mouseEventTap.toString());
				
				if (!mouseEventTap.isNull()) {
					OSStuff.aRLS = ostypes.API('CFMachPortCreateRunLoopSource')(ostypes.CONST.kCFAllocatorDefault, mouseEventTap, 0);
					console.log('OSStuff.aRLS:', OSStuff.aRLS, OSStuff.aRLS.toString());
					
					ostypes.API('CFRelease')(mouseEventTap);
					console.log('cfreleased mouseEventTap');
					
					if (!OSStuff.aRLS.isNull()) {
						var aLoop = ostypes.API('CFRunLoopGetCurrent')();
						console.log('aLoop:', aLoop, aLoop.toString());
						
						ostypes.API('CFRunLoopAddSource')(aLoop, OSStuff.aRLS, ostypes.CONST.kCFRunLoopCommonModes); // returns void
						console.log('did CFRunLoopAddSource');
						
						// ostypes.API('CGEventTapEnable')(mouseEventTap, true);
						// console.log('did tap enable');
						
						// ostypes.API('CFRelease')(OSStuff.aRLS);
						// console.log('cfreleased OSStuff.aRLS');
						
						ostypes.API('CFRelease')(aLoop);
						console.log('cfreleased aLoop');
						
						var rez_CFRunLoopRunInMode = ostypes.API('CFRunLoopRunInMode')(ostypes.CONST.kCFRunLoopCommonModes, 10, false);
						console.log('rez_CFRunLoopRunInMode:', rez_CFRunLoopRunInMode, rez_CFRunLoopRunInMode.toString());
						
					} else {
						console.error('OSStuff.aRLS is null!');
					}
					
					
				} else {
					console.error('failed to create mouse tap');
				}
			
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
			
				/*
				if (OSStuff.rez_add) {
					var rez_remove = ostypes.API('objc_msgSend')(ostypes.HELPER.class('NSEvent'), ostypes.HELPER.sel('removeMonitor:'), OSStuff.rez_add);
					console.log('rez_remove:', rez_remove, rez_remove.toString());
					
					OSStuff.myHandler_js = null;
					OSStuff.myHandler_c = null;
					OSStuff.myBlock_c = null;
				}
				*/
				if (OSStuff.aRLS) {
					
					ostypes.API('CFRunLoopSourceInvalidate')(OSStuff.aRLS);
					console.log('invalidated loop source OSStuff.aRLS');
					
					ostypes.API('CFRelease')(OSStuff.aRLS);
					console.log('cfreleased OSStuff.aRLS');
					
					OSStuff.aRLS = null;
					OSStuff.MouseTracker = null;
				}
			
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