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

function asyncMonitorMouse() {
	// this will get copy eve mouse events and deliver it to main thread
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				var rid_js = new Array(1);
				rid_js[0] = ostypes.TYPE.RAWINPUTDEVICE(1, 2, 0, null); // mouse
				
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