const {classes:Cc, interfaces:Ci} = Components;
// console.log('FHRFrameScript loaded, this:', Components.stack, Components.stack.filename);
// var gFhrFsMsgListenerId = Components.stack.filename.match(/fhrFsMsgListenerId=([^&]+)/)[1]; // Components.stack.filename == "chrome://nativeshot/content/resources/scripts/FHRFrameScript.js?fhrFsMsgListenerId=NativeShot@jetpack-fhr_1&v=0.2623310905363082"
// console.log('in framescript, this:', this);
// console.log('this.addMessageListener:', this.addMessageListener);

//////////////////////////////////////////////////////// start - boilerplate
// start - rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
var core = {
	addon: {
		id: 'MouseControl@jetpack' + '-framescript' // heeded for rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
	}
}

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

var gCFMM;
function contentMMFromContentWindow_Method2(aContentWindow) {
	if (!gCFMM) {
		if (this.addMessageListener) {
			gCFMM = this;
		} else {
			throw new Error('i dont want to do it this way anymore');
			// gCFMM = aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
			// 					  .getInterface(Ci.nsIDocShell)
			// 					  .QueryInterface(Ci.nsIInterfaceRequestor)
			// 					  .getInterface(Ci.nsIContentFrameMessageManager);
		}
	}
	return gCFMM;

}
// end - rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5



// start - common helpers
function Deferred() { // rev3 - https://gist.github.com/Noitidart/326f1282c780e3cb7390
	// update 062115 for typeof
	if (typeof(Promise) != 'undefined' && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (typeof(PromiseUtils) != 'undefined'  && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else {
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
	}
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
// end - common helpers
//////////////////////////////////////////////////////// end - boilerplate

// START - framescript functionality
bootstrapCallbacks.destroySelf = function() {
	contentMMFromContentWindow_Method2(content).removeMessageListener(core.addon.id, bootstrapMsgListener);
	// console.log('ok destroyed self frmamescript');
	
	contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, ['triggerEvent_framescript_uninit']); // framescript_uninit is NOT when tab is closed, that is natural destroy. it is for when say user changes function, so uninit's the old function. or addon is disabled. so its for shutting down the tab when its not TAB_SHUTDOWN (in terms of APP_SHUTDOWN for aReason of shtudown)
};

bootstrapCallbacks.eval = function(aFuncAsStr) {
	// console.log('in eval, aFuncAsStr:', aFuncAsStr);
	try {
		eval('var func = ' + aFuncAsStr);
	} catch (ignore) {
		console.error('Error on eval in framescript:', ignore);
	}
	if (func) {
		var rez;
		try {
			rez = func();
		} catch (ignore) {
			console.error('Error on executing func in framescript:', ignore);
			return [undefined];
		}
		console.error('rez:', rez);
		if (rez && rez.constructor.name == 'Promise') {
			return rez;
		} else {
			return [rez];
		}
	} else {
		return [undefined];
	}
};

bootstrapCallbacks.synthMouseup = function(aJsConst) {
	console.log('content.frames:', content.frames);
	var utils = content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
	console.error('FS synthesizing mouseup of btn:', aJsConst, 'utils:', utils);
	utils.sendMouseEvent('mouseup', 1, 1, aJsConst, 1, 0);
}

bootstrapCallbacks.prevMouseup = function() {
	addEventListener('mouseup', prevMouseup, false);
	addEventListener('click', prevMouseup, false);
};

bootstrapCallbacks.unprevMouseup = function() {
	removeEventListener('mouseup', prevMouseup, false);
	removeEventListener('click', prevMouseup, false);
};

function prevMouseup(e) {
	console.error('FS prevented mouseup');
	e.stopPropagation();
	e.preventDefault();
	return false;
}

contentMMFromContentWindow_Method2(content).sendAsyncMessage(core.addon.id, ['triggerEvent_framescript_created']);

var $MC_FS_ = {}; // a storage area in framescript

function $MC_FS_getFocusedContentWindow(aContentWindow) {
	var contentFrames = aContentWindow.frames;
	for (var i=0; i<contentFrames.length; i++) {
		if (contentFrames[i].document.hasFocus()) {
			return contentFrames[i];
		}
	}
};

function $MC_FS_getDeepestFocusedContentWindow(aContentWindow) {
	var cFocusedWin = aContentWindow;
	var maxTry = 30;
	var cTry = 0;
	while(cTry < maxTry) {
		cTry++;
		var thisFocusedWin = $MC_FS_getFocusedContentWindow(cFocusedWin);
		if (thisFocusedWin) {
			cFocusedWin = thisFocusedWin;
		} else {
			break;
		}
	}
	return cFocusedWin;
};
// END - framescript functionality