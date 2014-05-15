var MouseControl = {
	prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch('extensions.MouseControl@neocodex.us.'),
	ss: Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore),
	fm: Components.classes["@mozilla.org/focus-manager;1"].getService(Components.interfaces.nsIFocusManager),
	wm: Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator),
	itabHistory: [],
	lastUp: 0,
	register: function(event) {
		gBrowser.mPanelContainer.addEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		gBrowser.mPanelContainer.addEventListener("mousedown", MouseControl.downHandler, true);
		gBrowser.mPanelContainer.addEventListener("mouseup", MouseControl.upHandler, true);
		gBrowser.mPanelContainer.addEventListener("mousemove", MouseControl.moveHandler, true);
		gBrowser.tabContainer.addEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.addEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.addEventListener("TabClose", MouseControl.tabClosed, false);
		gBrowser.mPanelContainer.addEventListener('popupshowing', MouseControl.prevC, true);
		gBrowser.mPanelContainer.addEventListener("click", MouseControl.clickHandler, true);
		gBrowser.mPanelContainer.addEventListener("dblclick", MouseControl.dblHandler, true);
		try {
			MouseControl.notifier = Components.classes["@mozilla.org/alerts-service;1"].getService(Components.interfaces.nsIAlertsService);
		} catch(e) { }
		MouseControl.zoomStyle = MouseControl.prefs.getIntPref('zoomStyle');
		//detect and set zoomStyle
		MouseControl.globalZoom = MouseControl.prefs.getCharPref('globalZoom');
		if (MouseControl.globalZoom > 0)	{
			MouseControl.zoomStyle = 2;
		} else {
			if (gPrefService.getBoolPref('browser.zoom.siteSpecific'))	{
				MouseControl.zoomStyle = 1;
			} else {
				MouseControl.zoomStyle = 0;
			}
		}
		MouseControl.prefs.setIntPref('zoomStyle',MouseControl.zoomStyle);
		FullZoom.onLocationChange=function FullZoom_onLocationChange(aURI,aIsTabSwitch,aBrowser){MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom>0){if(ZoomManager.zoom!=MouseControl.globalZoom){ZoomManager.setZoomForBrowser(aBrowser||gBrowser.selectedBrowser,MouseControl.globalZoom)}return}if(!aURI||aIsTabSwitch&&!this.siteSpecific){return}if(aURI.spec=="about:blank"){this._applyPrefToSetting(undefined,aBrowser);return}var self=this;Services.contentPrefs.getPref(aURI,this.name,function(aResult){var browser=aBrowser||gBrowser.selectedBrowser;if(aURI.equals(browser.currentURI)){self._applyPrefToSetting(aResult,browser)}})};
		FullZoom._applySettingToPref=function FullZoom__applySettingToPref(){MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom>0){var zoomLevel=ZoomManager.zoom;MouseControl.globalZoom=zoomLevel;MouseControl.prefs.setCharPref('globalZoom',zoomLevel)}if(!this.siteSpecific||gInPrintPreviewMode||content.document instanceof Ci.nsIImageDocument){return}var zoomLevel=ZoomManager.zoom;Services.contentPrefs.setPref(gBrowser.currentURI,this.name,zoomLevel)};
		FullZoom.reset=function FullZoom_reset(){if(typeof this.globalValue!="undefined"){ZoomManager.zoom=this.globalValue}else{ZoomManager.reset()}MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom){var zoomLevel=ZoomManager.zoom;MouseControl.globalZoom=zoomLevel;MouseControl.prefs.setCharPref('globalZoom',zoomLevel)}this._removePref();};
	},
	unregister: function(event) {
		gBrowser.mPanelContainer.removeEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		gBrowser.mPanelContainer.removeEventListener("mousedown", MouseControl.downHandler, true);
		gBrowser.mPanelContainer.removeEventListener("mouseup", MouseControl.upHandler, true);
		gBrowser.tabContainer.removeEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.removeEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.removeEventListener("TabClose", MouseControl.tabClosed, false);
		gBrowser.mPanelContainer.removeEventListener('popupshowing', MouseControl.prevC, true);
		gBrowser.mPanelContainer.removeEventListener("click", MouseControl.clickHandler, true);
		gBrowser.mPanelContainer.removeEventListener("dblclick", MouseControl.dblHandler, true);
	},
	setInscroll: function() {
		if ((!MouseControl.inscroll && MouseControl.down) || MouseControl.dblDown) {
			if (window.fullScreen) {
				FullScreen.mouseoverToggle(true);
				if (MouseControl.dblDown && !MouseControl.duped)	{
				} else {
					gBrowser.mPanelContainer.removeEventListener("mousemove", FullScreen._collapseCallback, false);
				}
			}
			var menu = document.getElementById('contentAreaContextMenu');
			if (menu.state == 'open') {
				menu.hidePopup();
			}
			MouseControl.inscroll = true;
			MouseControl.restoreFocus();
		}
		if (!MouseControl.inscroll && MouseControl.pdown) {
			MouseControl.inscroll = true;
			MouseControl.restoreFocus();
			if (gBrowser.contentDocument.body)	{
				gBrowser.contentDocument.body.style.MozUserSelect = '-moz-none';
			}
		}
	},
	restoreFocus: function() {
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
	},
	moveHandler: function(event) {
		if (MouseControl.pdown && MouseControl.inscroll)	{
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
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
		} else if (MouseControl.pdown) {
			MouseControl.setInscroll();
			if (event.detail > 0)	{
				FullZoom.reduce();
			} else	{
				FullZoom.enlarge();
			}
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
		} else if (MouseControl.pdown) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
			if (event.button == 1) {
				MouseControl.restoreFocus();
				MouseControl.inscroll = true;
				FullZoom.reset();
				if (MouseControl.zoomStyle == 2)	{
					MouseControl.globalZoom = 1;
				}
			}
		} else {
			if (event.button == 2 && !MouseControl.down && !MouseControl.pdown) {
				var secDblClickAble = MouseControl.prefs.getBoolPref('secDblClickAble');
				if (secDblClickAble && new Date().getTime() - MouseControl.lastDown <= 200)	{
					//trigger dbl on mouse up
					MouseControl.down = true;
					MouseControl.dblDown = true;
					MouseControl.setInscroll();
					MouseControl.duped = false;
					MouseControl.dupeTO = setTimeout(MouseControl.dupeTab,300);
					event.preventDefault();
					event.returnValue = false;
					event.stopPropagation();
					return false;
				}
				MouseControl.down = true;
				MouseControl.dblDown = false;
				MouseControl.lastDown = new Date().getTime();
				document.getElementById('contentAreaContextMenu').popupBoxObject.setConsumeRollupEvent(Components.interfaces.nsIPopupBoxObject.ROLLUP_NO_CONSUME);
				MouseControl.focPreDown = MouseControl.fm.focusedElement;
				MouseControl.scrollUpMoveRight = MouseControl.prefs.getBoolPref('scrollUpMoveRight');
				if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
			}
			var primClickAble = MouseControl.prefs.getBoolPref('primClickAble');
			if (primClickAble && event.button == 0 && !MouseControl.down && !MouseControl.pdown) {
				MouseControl.focPreDown = MouseControl.fm.focusedElement;
				MouseControl.pdown = true;
			}
		}
	},
	upHandler: function(event) {
		if (event.button == 0 || event.button == 1) {
			if (MouseControl.down || (MouseControl.pdown && MouseControl.inscroll)) {
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
			if (MouseControl.pdown)	{
				if (event.button == 0)	{
					MouseControl.offscroll();
				}
			}
		} else if (event.button == 2) {
			if (MouseControl.inscroll || MouseControl.dblDown) {
				MouseControl.lastUp = new Date().getTime();
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
			if (MouseControl.dblDown && !MouseControl.duped)	{
				clearTimeout(MouseControl.dupeTO);
				MouseControl.newTab();
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
					if (new Date().getTime() < MouseControl.domainCloseLimit)	{
						MouseControl.closeDomain();
					} else {
						if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length - 1] == gBrowser.selectedTab) {
							MouseControl.itabHistory.splice(MouseControl.itabHistory.length - 1, 1);
						}
						MouseControl.setInscroll();
						MouseControl.targetHostname = gBrowser.currentURI.asciiHost;
						gBrowser.removeCurrentTab();
						MouseControl.domainCloseLimit = new Date().getTime() + 200;
					}
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
		} else if (MouseControl.pdown)	{
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		} else {
			if (new Date().getTime() - MouseControl.lastUp <= 100) {
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
		}
	},
	dblHandler: function(event)	{
		if (new Date().getTime() - MouseControl.lastUp <= 100)	{
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		}
	},
	undoCloseTab: function() {
		MouseControl.closedTabUndid = true;
		MouseControl.ss.undoCloseTab(window, 0);
	},
	closeDomain: function() {
		var closeThese = [];
		var tabbrowser = MouseControl.wm.getMostRecentWindow('navigator:browser').gBrowser;
		for (var index = 0; index < tabbrowser.tabContainer.childNodes.length; index++) {
			// Get the next tab
			var currentTab = tabbrowser.tabContainer.childNodes[index];
			if (!currentTab.pinned && gBrowser.getBrowserForTab(currentTab).currentURI.asciiHost == MouseControl.targetHostname)	{
				closeThese.push(currentTab);
			}
		}
		for (var i=0; i<closeThese.length; i++)	{
			tabbrowser.removeTab(closeThese[i]);
		}
	},
	dupeTab: function() {
		MouseControl.duped = true;
		var newIndex = gBrowser.tabContainer.childNodes.length;
		var tab = MouseControl.ss.duplicateTab(window, gBrowser.selectedTab);
		var relativeToCurrent = MouseControl.prefs.getBoolPref('newTabRelativeToCurrent');
		if (!relativeToCurrent)	{
			gBrowser.moveTabTo(tab, newIndex);
		}
		gBrowser.selectedTab = tab;
	},
	newTab: function() {
		//document.getElementById('contentAreaContextMenu').hidePopup();
		var relativeToCurrent = MouseControl.prefs.getBoolPref('newTabRelativeToCurrent');
		if (relativeToCurrent) {
			//var newIndex = gBrowser.selectedTab._tPos + 1;
			eval('('+uneval(BrowserOpenTab).replace('inBackground:','relatedToCurrent:true,inBackground:')+')')();
			//gBrowser.moveTabTo(gBrowser.tabContainer.childNodes[gBrowser.tabContainer.childNodes.length-1], newIndex);
		} else {
			BrowserOpenTab()
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
		if (MouseControl.inscroll || (new Date().getTime() - MouseControl.lastUp <= 100)) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		}
	},
	offscroll: function() {
		if (MouseControl.down || MouseControl.dblDown)	{
			clearTimeout(MouseControl.undoClosedTabTimeout);
			if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
				MouseControl.itabHistory.push(gBrowser.selectedTab);
			}
			if (window.fullScreen) {
				FullScreen.mouseoverToggle(false);
			}
		} else if (MouseControl.inscroll && MouseControl.pdown)	{
			if (gBrowser.contentDocument.body)	{
				gBrowser.contentDocument.body.style.MozUserSelect = '';
			}
		}
		MouseControl.down = false;
		MouseControl.pdown = false;
		MouseControl.inscroll = false;
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