var MouseControl = {
	down: false,
	inscroll: false,
	itab: null, //initial tab for use during scroll
	itabHistory: [],
	//notifier: Components.classes["@mozilla.org/alerts-service;1"].getService(Components.interfaces.nsIAlertsService),
	closedTabUndid: false, //for undo close tab
	undoClosedTabTimeout: 0, //for undo close tab
	ss: Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore),
	register: function (event) {
		gBrowser.addEventListener("DOMMouseScroll", MouseControl.scrollHandler, false);
		gBrowser.addEventListener("mousedown", MouseControl.downHandler, false);
		gBrowser.addEventListener("mouseup", MouseControl.upHandler, false);
		gBrowser.tabContainer.addEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.addEventListener("TabOpen", MouseControl.tabOpened, false);
	},
	unregister: function (event) {
		gBrowser.removeEventListener("DOMMouseScroll", MouseControl.scrollHandler, false);
		gBrowser.removeEventListener("mousedown", MouseControl.downHandler, false);
		gBrowser.removeEventListener("mouseup", MouseControl.upHandler, false);
		gBrowser.tabContainer.addEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.addEventListener("TabOpen", MouseControl.tabOpened, false);
	},
	disableMousedown: function (event) {
		this.blur();
		event.preventDefault();
		event.stopPropagation();
		if (event.button == 1) {
			MouseControl.addPrev();
			//MouseControl.notifier.showAlertNotification('chrome://MouseControl/skin/icon.png','Middle Detected','Setting time out for undoing close');
			clearTimeout(MouseControl.undoClosedTabTimeout);
			MouseControl.closedTabUndid = false;
			MouseControl.undoClosedTabTimeout = setTimeout(MouseControl.undoCloseTab, 300);
		} else	{
			//MouseControl.notifier.showAlertNotification('chrome://MouseControl/skin/icon.png','NonMiddle Detected','Click ID:'+event.button);
		}
	},
	undoCloseTab: function () {
		MouseControl.closedTabUndid = true;
		var undid = MouseControl.ss.undoCloseTab(window, 0);
		//gBrowser.selectedTab = undid;
	},
	disableClick: function (event) {
		this.blur();
		if (event.button == 1 && MouseControl.down) {
			MouseControl.addPrev();
			if (!MouseControl.closedTabUndid) {
				//close the tab
				clearTimeout(MouseControl.undoClosedTabTimeout);
				if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length - 1] == gBrowser.selectedTab) {
					MouseControl.itabHistory.splice(MouseControl.itabHistory.length - 1, 1);
				}
				MouseControl.inscroll = true;
				gBrowser.removeCurrentTab();
				
			} else {
				MouseControl.closedTabUndid = false;
			}
		}
		if (event.button == 0 && MouseControl.down) {
			MouseControl.inscroll = true;
			MouseControl.addPrev();
			if (MouseControl.itabHistory.length > 0)	{
				if (gBrowser.selectedTab != MouseControl.itabHistory[MouseControl.itabHistory.length-1]) {
					//alert('focusing last used tab');
					if (MouseControl.itabHistory[MouseControl.itabHistory.length-1].parentNode)	{
						gBrowser.selectedTab = MouseControl.itabHistory[MouseControl.itabHistory.length-1];
						//MouseControl.down = false; //noit: might have to put this back
					} else	{
						alert('Error: You closed the initial tab');
					}
					MouseControl.cleanHistory();
				} else {
					MouseControl.cleanHistory();
					if (MouseControl.itabHistory.length > 1) {
						for (var i=MouseControl.itabHistory.length-1; i>=0; i--)	{
							if (gBrowser.selectedTab != MouseControl.itabHistory[i])	{
								gBrowser.selectedTab = MouseControl.itabHistory[i];
								break;
							}
						}
						//alert('Error: No other tab exists');
					} else {
						//alert('Error: No tabs in history');
					}
				}
			}
		}
		event.preventDefault();
		event.stopPropagation();
		return false;
	},
	scrollHandler: function (event) {
		if (MouseControl.down) {
			MouseControl.inscroll = true;
			MouseControl.addPrev();
			var direction = event.detail > 0 ? 1 : -1;
			gBrowser.mTabContainer.advanceSelectedTab(direction, true);
			event.preventDefault();
		}
	},
	cleanHistory: function () {
		for (var i = 0; i < MouseControl.itabHistory.length; i++) {
			if (!MouseControl.itabHistory[i].parentNode) {
				MouseControl.itabHistory.splice(i, 1);
				i--;
				continue;
			}
			if (i < MouseControl.itabHistory.length-1)	{
				if (MouseControl.itabHistory[i] == MouseControl.itabHistory[i+1])	{
					MouseControl.itabHistory.splice(i, 1);
				}
			}
		}
	},
	downHandler: function (event) {
		if (event.button == 2) {
			//gBrowser.removeEventListener("contextmenu", MouseControl.checkContext, true);
			MouseControl.down = true;
			gBrowser.addEventListener("click", MouseControl.disableClick, true);
			gBrowser.addEventListener("mousedown", MouseControl.disableMousedown, true);
			if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length-1] != gBrowser.selectedTab)	{
				MouseControl.itabHistory.push(gBrowser.selectedTab);
			}
			event.preventDefault();
		}
	},
	upHandler: function (event) {
		if (event.button == 2)	{
			MouseControl.offscroll();
		}
	},
	addPrev: function()	{
		if (!this.prevAdded)	{
			window.addEventListener('popupshowing', MouseControl.prevC, true);
		}
	},
	prevC: function (event) {
		window.removeEventListener('popupshowing', MouseControl.prevC, true);
		this.prevAdded = false;
		event.preventDefault();
	},
	offscroll: function () {
		MouseControl.down = false;
		MouseControl.inscroll = false;
		gBrowser.removeEventListener("click", MouseControl.disableClick, true);
		gBrowser.removeEventListener("mousedown", MouseControl.disableMousedown, true);
		if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length-1] != gBrowser.selectedTab)	{
			MouseControl.itabHistory.push(gBrowser.selectedTab);
		}
	},
	tabSeld: function () {
		if (!MouseControl.inscroll) {
			if (MouseControl.itabHistory.length > 0)	{
				if (MouseControl.itabHistory[MouseControl.itabHistory.length-1] != gBrowser.selectedTab)	{
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
			} else	{
				MouseControl.itabHistory.push(gBrowser.selectedTab);
			}
		}
	},
	tabOpened: function()	{
		MouseControl.itabHistory.push(gBrowser.selectedTab);
	},
};
window.addEventListener("load", MouseControl.register, false);
window.addEventListener("unload", MouseControl.unregister, false);