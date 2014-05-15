var MouseControl = {
	prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch('extensions.MouseControl@neocodex.us.'),
	ss: Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore),
	fm: Components.classes["@mozilla.org/focus-manager;1"].getService(Components.interfaces.nsIFocusManager),
	itabHistory: [],
	lastUp: 0,
	register: function(event) {
		gBrowser.addEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		gBrowser.addEventListener("mousedown", MouseControl.downHandler, true);
		gBrowser.addEventListener("mouseup", MouseControl.upHandler, true);
		gBrowser.tabContainer.addEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.addEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.addEventListener("TabClose", MouseControl.tabClosed, false);
		window.addEventListener('popupshowing', MouseControl.prevC, true);
		gBrowser.addEventListener("click", MouseControl.clickHandler, true);
		gBrowser.addEventListener("dblclick", MouseControl.dblHandler, true);
		try {
			MouseControl.notifier = Components.classes["@mozilla.org/alerts-service;1"].getService(Components.interfaces.nsIAlertsService);
		} catch(e) { }
	},
	unregister: function(event) {
		gBrowser.removeEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		gBrowser.removeEventListener("mousedown", MouseControl.downHandler, true);
		gBrowser.removeEventListener("mouseup", MouseControl.upHandler, true);
		gBrowser.tabContainer.removeEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.removeEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.removeEventListener("TabClose", MouseControl.tabClosed, false);
		window.removeEventListener('popupshowing', MouseControl.prevC, true);
		gBrowser.removeEventListener("click", MouseControl.clickHandler, true);
		gBrowser.removeEventListener("dblclick", MouseControl.dblHandler, true);
	},
	undoCloseTab: function() {
		MouseControl.closedTabUndid = true;
		MouseControl.ss.undoCloseTab(window, 0);
	},
	setInscroll: function() {
		if (!MouseControl.inscroll) {
			if (window.fullScreen) {
				FullScreen.mouseoverToggle(true);
				gBrowser.mPanelContainer.removeEventListener("mousemove", FullScreen._collapseCallback, false);
			}
			var menu = document.getElementById('contentAreaContextMenu');
			if (menu.state == 'open') {
				menu.hidePopup();
			}
			MouseControl.inscroll = true;
			if (MouseControl.focPreDown != MouseControl.fm.focusedElement) {
				if (MouseControl.focPreDown) {
					var dontFocusTags = ['EMBED', 'APPLET'];
					if (dontFocusTags.indexOf(MouseControl.focPreDown.tagName.toUpperCase()) == -1) {
						MouseControl.fm.setFocus(MouseControl.focPreDown, MouseControl.fm.FLAG_NOSCROLL);
					}
				} else {
					MouseControl.fm.clearFocus(gBrowser.selectedTab.ownerDocument.defaultView);
				}
			}
		}
	},
	scrollHandler: function(event) {
		if (MouseControl.down) {
			MouseControl.setInscroll();
			if (MouseControl.scrollUpMoveRight) {
				var direction = event.detail > 0 ? -1 : 1;
			} else {
				var direction = event.detail > 0 ? 1 : -1;
			}
			gBrowser.mTabContainer.advanceSelectedTab(direction, true);
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		}
	},
	dblHandler: function(event) {
		if (event.button == 2) {
			document.getElementById('contentAreaContextMenu').hidePopup();
			var relativeToCurrent = MouseControl.prefs.getBoolPref('newTabRelativeToCurrent');
			if (relativeToCurrent) {
				try {
					gBrowser.loadOneTab(null, {inBackground: false, relatedToCurrent: true});
				} catch (e) {
					var newIndex = gBrowser.selectedTab._tPos + 1;
					var newTab = gBrowser.addTab();
					gBrowser.selectedTab = newTab;
					gBrowser.moveTabTo(newTab, newIndex);
				}
			} else {
				try {
					gBrowser.loadOneTab(null, {inBackground: false, relatedToCurrent: false});
				} catch (e) {
					var newTab = gBrowser.addTab();
					gBrowser.selectedTab = newTab;
				}
			}
			focusAndSelectUrlBar();
			MouseControl.lastUp = new Date().getTime();
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		}
	},
	cleanHistory: function() {
		for (var i = 0; i < MouseControl.itabHistory.length; i++) {
			if (!MouseControl.itabHistory[i].parentNode) {
				MouseControl.itabHistory.splice(i, 1);
				i--;
				continue;
			}
			if (i < MouseControl.itabHistory.length - 1) {
				if (MouseControl.itabHistory[i] == MouseControl.itabHistory[i + 1]) {
					MouseControl.itabHistory.splice(i, 1);
				}
			}
		}
	},
	downHandler: function(event) {
		if (MouseControl.down) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
			if (event.button == 1) {
				MouseControl.setInscroll();
				clearTimeout(MouseControl.undoClosedTabTimeout);
				MouseControl.closedTabUndid = false;
				MouseControl.undoClosedTabTimeout = setTimeout(MouseControl.undoCloseTab, 200);
			}
		} else {
			if (event.button == 2 && !MouseControl.down) {
				document.getElementById('contentAreaContextMenu').popupBoxObject.setConsumeRollupEvent(Components.interfaces.nsIPopupBoxObject.ROLLUP_NO_CONSUME);
				MouseControl.focPreDown = MouseControl.fm.focusedElement;
				MouseControl.scrollUpMoveRight = MouseControl.prefs.getBoolPref('scrollUpMoveRight');
				MouseControl.down = true;
				if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
			}
		}
	},
	upHandler: function(event) {
		if (event.button == 0 || event.button == 1) {
			if (MouseControl.down) {
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
		} else if (event.button == 2) {
			if (MouseControl.inscroll) {
				MouseControl.lastUp = new Date().getTime();
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
			if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
				MouseControl.itabHistory.push(gBrowser.selectedTab);
			}
			MouseControl.offscroll();
		}
	},
	clickHandler: function(event) {
		if (MouseControl.down) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
			if (event.button == 1) {
				if (!MouseControl.closedTabUndid) {
					clearTimeout(MouseControl.undoClosedTabTimeout);
					if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length - 1] == gBrowser.selectedTab) {
						MouseControl.itabHistory.splice(MouseControl.itabHistory.length - 1, 1);
					}
					MouseControl.setInscroll();
					gBrowser.removeCurrentTab();
				} else {
					MouseControl.closedTabUndid = false;
				}
			}
			if (event.button == 0) {
				MouseControl.setInscroll();
				if (MouseControl.itabHistory.length > 0) {
					if (gBrowser.selectedTab != MouseControl.itabHistory[MouseControl.itabHistory.length - 1]) {
						if (MouseControl.itabHistory[MouseControl.itabHistory.length - 1].parentNode) {
							gBrowser.selectedTab = MouseControl.itabHistory[MouseControl.itabHistory.length - 1];
						} else {
							MouseControl.jumpTab();
						}
					} else {
						MouseControl.jumpTab();
					}
				}
			}
		} else {
			if (new Date().getTime() - MouseControl.lastUp <= 100) {
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
		}
	},
	jumpTab: function() {
		var jumped = false;
		if (MouseControl.itabHistory.length > 1) {
			for (var i = MouseControl.itabHistory.length - 1; i >= 0; i--) {
				if (gBrowser.selectedTab != MouseControl.itabHistory[i]) {
					gBrowser.selectedTab = MouseControl.itabHistory[i];
					jumped = true;
					break;
				}
			}
			if (!jumped) {
				if (MouseControl.notifier)	{
					MouseControl.notifier.showAlertNotification('chrome://MouseControl/skin/icon.png', 'MouseControl Notification', 'Cannot jump, no previously selected tab was found.');
				}
			}
		} else {
			if (MouseControl.notifier)	{
				MouseControl.notifier.showAlertNotification('chrome://MouseControl/skin/icon.png', 'MouseControl Notification', 'Cannot jump, no tabs found in tab selection history.');
			}
		}
	},
	prevC: function(event) {
		if (MouseControl.inscroll) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		} else if (new Date().getTime() - MouseControl.lastUp <= 100) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		}
	},
	offscroll: function() {
		MouseControl.down = false;
		MouseControl.inscroll = false;
		clearTimeout(MouseControl.undoClosedTabTimeout);
		if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
			MouseControl.itabHistory.push(gBrowser.selectedTab);
		}
		if (window.fullScreen) {
			FullScreen.mouseoverToggle(false);
		}
	},
	tabSeld: function() {
		if (!MouseControl.inscroll) {
			if (MouseControl.itabHistory.length > 0) {
				if (MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
			} else {
				MouseControl.itabHistory.push(gBrowser.selectedTab);
			}
		}
	},
	tabOpened: function() {
		MouseControl.itabHistory.push(gBrowser.selectedTab);
	},
	tabClosed: function() {
		MouseControl.cleanHistory();
	}
};
window.addEventListener("load", MouseControl.register, false);
window.addEventListener("unload", MouseControl.unregister, false);