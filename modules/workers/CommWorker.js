// Imports

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
importScripts(core.addon.path.content + 'modules/ostypes/cutils.jsm');

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
			importScripts(core.addon.path.content + 'modules/ostypes/ostypes_win.jsm');
			break;
		case 'gtk':
			// importScripts(core.addon.path.content + 'modules/ostypes/ostypes_x11.jsm');
			break;
		case 'darwin':
			importScripts(core.addon.path.content + 'modules/ostypes/ostypes_mac.jsm');
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

self.onclose = function() {
	console.error('CommWorker.js TERMINATED');
}

// Start - Addon Functionality

var MmJson; // global so it doesnt get gc'ed, it will be the stringified of infoObjForWorker // is cCharArr with length of cInt_MmJsonLen

// these 3 vars are always constant, i only modify their contents, as they are shared // always keep alive never GC in either thread
var cCharArr_addieOfMmJson = ctypes.char.array(41)(); // 40 chars with null term // i update this to address of MMJson everytype i update it
var cInt_doWhat = ctypes.int();
var cInt_MmJsonLen = ctypes.int();

function createShareables_andSecondaryInit(aInitInfoObj, infoObjForWorker) {
	console.log('in CommWorker createShareables_andSecondaryInit:', 'aInitInfoObj:', aInitInfoObj, 'infoObjForWorker:', infoObjForWorker);

	var addieOf = {};
	addieOf.cInt_doWhat = cutils.strOfPtr(cInt_doWhat.address());
	addieOf.cInt_MmJsonLen = cutils.strOfPtr(cInt_MmJsonLen.address());
	addieOf.cCharArr_addieOfMmJson = cutils.strOfPtr(cCharArr_addieOfMmJson.address());
	
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
		
				OSStuff.winMmWorkerThreadId = aInitInfoObj.winMmWorkerThreadId;
				
			break;
		case 'darwin':
		
				OSStuff.macMmWorkerThread_CFRunLoopRef = ostypes.TYPE.CFRunLoopRef(ctypes.UInt64(aInitInfoObj.macMmWorkerThread_CFRunLoopRef_ptrStr));
				
			break;
		default:
			// do nothing
	}
	
	putInfoObjForWorker_intoShareables(infoObjForWorker);
	cInt_doWhat.value = 1; // tells MMWorker actOnDoWhat to read in
	
	return [addieOf];
}

function putInfoObjForWorker_intoShareables(infoObjForWorker) {
	var stringified = JSON.stringify(infoObjForWorker);
	MmJson = ctypes.char.array()(stringified);
	cInt_MmJsonLen.value = MmJson.length; // stringified.length + 1 for null terminator
	console.log('set cInt_MmJsonLen.value to:', MmJson.length, 'cInt_MmJsonLen.value:', cInt_MmJsonLen.value);
	cutils.modifyCStr(cCharArr_addieOfMmJson, cutils.strOfPtr(MmJson.address())); // if i want to modify this str from MMWorker i have to do cutils.modifyCStr(cCharArr_addieOfMmJson.contents, 'new string')
}

var gFxInFocus = true; // start it at true cross-file-link391919999999
var gTellFocusedTimeout;
var gLastActivatedTime = 0;
var gLastDeactivatedTime = 0;
function timeoutTellFocused(boolFocused, aTimestamp) {
	// boolFocused false for if unfocused, true for if focused
	
	if (!boolFocused) {
		/*
		if (aTimestamp > gLastDeactivatedTime) {
			gLastDeactivatedTime = aTimestamp;
		} else {
			return;
		}
		
		// clear time out in case
		if (gTellFocusedTimeout) { // i have no idea when this block will trigger. i dont know how i can get a back to back unfocus. but its here just in case.
			clearTimeout(gTellFocusedTimeout);
		}
		
		if (!gFxInFocus) {
			// already knows its NOT in focus
			return;
		}
		*/

		gTellFocusedTimeout = setTimeout(function() {
			gFxInFocus = false;
			tellMmWorker('firefox-unfocused');
		}, 50); // allow 50ms. cuz if user unfocused one window and focused another fx window. then that will come in and cancel this message. fx was really NOT unfocused in this situation, just a window change happend
	} else {
		/*
		if (aTimestamp > gLastActivatedTime) {
			gLastActivatedTime = aTimestamp;
		} else {
			return;
		}
		
		// clear time out in case
		if (gTellFocusedTimeout) { // i have no idea when this block will trigger. i dont know how i can get a back to back unfocus. but its here just in case.
			clearTimeout(gTellFocusedTimeout);
		}
		
		if (gFxInFocus) {
			// already knows its in focus
			return;
		}
		*/
		// in case a timer for unfocused was set up
		if (gTellFocusedTimeout) {
			clearTimeout(gTellFocusedTimeout);
			gTellFocusedTimeout = undefined;
		}
		
		// test if already knows
		if (gFxInFocus) {
			return;
		}
		
		// ok it wasnt already focused and it doesnt know so tell it
		gFxInFocus = true;
		tellMmWorker('firefox-focused');
	}
}

function tellMmWorker(aWhat, infoObjForWorker) {
	switch (aWhat) {
		case 'stop-mouse-monitor':
			
				cInt_doWhat.value = 4;
			
			break;
		case 'update-prefs-config':
			
				putInfoObjForWorker_intoShareables(infoObjForWorker);
				cInt_doWhat.value = 1;
			
			break;
		case 'send-mouse-events':
			
				cInt_doWhat.value = 2;
			
			break;
		case 'withold-mouse-events':
			
				cInt_doWhat.value = 3;
			
			break;
		case 'firefox-unfocused':
			
				cInt_doWhat.value = 5;
			
			break;
		case 'firefox-focused':
			
				cInt_doWhat.value = 6;
			
			break;
		default:
			console.error('unrecognized aWhat: "', aWhat, '"');
			return;
	}
	
	switch (core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			
				// make GetMessage in the MMWorker loop unblock
				
				console.error('CommWorker sending stop msg to MMWorker now');
				// var rez_PostMessage = ostypes.API('PostThreadMessage')(OSStuff.winMmWorkerThreadId, ostypes.CONST.WM_INPUT, 2, 0); // i send wparam of 2, because for wm_input wmparam should be either 0 or 1, so i send invalid of 2, doesnt do anything if it was 0 or 1 though, but whatever
				var rez_PostMessage = ostypes.API('PostThreadMessage')(OSStuff.winMmWorkerThreadId, 0x8000, 0, 0); // i send 0x8000 cross-file-link191119191383 as that is one greater then WM_USER and im guessing WM_USER is the last system thing used per https://msdn.microsoft.com/en-us/library/windows/desktop/ms644946%28v=vs.85%29.aspx it says "The system only does marshalling for system messages (those in the range 0 to (WM_USER-1)). To send other messages (those >= WM_USER) to another process, you must do custom marshalling." i ahve no idea what marshalling is but im pretty sure i dont need it so i use something greather ten WM_USER to avoid getting any extra overhead. // see https://msdn.microsoft.com/en-us/library/windows/desktop/ms644931%28v=vs.85%29.aspx for explanation on the ranges of message numbers this is why i picked 0x8000 because it doesnt conflict with any other system messages as explained on this page
				console.error('ok should have stopped. CommWorker rez_PostMessage:', rez_PostMessage, rez_PostMessage.toString()); // in windows, it (MMWorker loop) stops before it gets to this message
			
			break;
		case 'gtk':
			
				self.postMessage(['gtkTellMmWorker']);
			
			break;
		case 'darwin':
			
				console.error('CommWorker sending stop msg to MMWorker now');
				ostypes.API('CFRunLoopStop')(OSStuff.macMmWorkerThread_CFRunLoopRef);
				console.error('ok should have stopped.'); // in osx it (MMWorker loop) stops sometime after this message, i tried a loop of numbers and it got up to 50 and mmworker still didnt stop
				
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
	return [];
}
 
// End - Addon Functionality


// Start - Common Functions


// End - Common Functions