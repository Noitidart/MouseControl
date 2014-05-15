var MouseControl = {
	prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch('extensions.MouseControl@neocodex.us.'),
	ss: Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore),
	fm: Components.classes["@mozilla.org/focus-manager;1"].getService(Components.interfaces.nsIFocusManager),
	wm: Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator),
	itabHistory: [],
	lastUp: 0,
	register: function(event) {
		window.addEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		window.addEventListener("mousedown", MouseControl.downHandler, true);
		window.addEventListener("mouseup", MouseControl.upHandler, true); //the stopPropogation in upHandler is what messes up FireGestures
		window.addEventListener("mousemove", MouseControl.moveHandler, true);
		window.addEventListener("click", MouseControl.clickHandler, true);
		window.addEventListener("dblclick", MouseControl.dblHandler, true);
		gBrowser.tabContainer.addEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.addEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.addEventListener("TabClose", MouseControl.tabClosed, false);
		window.addEventListener('popupshowing', MouseControl.noConsume, true);
		window.addEventListener('popupshowing', MouseControl.prevC, true);
		window.addEventListener('dragstart',MouseControl.dragstartHandler,true);

		MouseControl.initPrefs();

		FullZoom._applySettingToPref = function FullZoom__applySettingToPref(){MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom>0){var zoomLevel=ZoomManager.zoom;MouseControl.globalZoom=zoomLevel;MouseControl.prefs.setCharPref('globalZoom',zoomLevel);var browserWindows=MouseControl.wm.getEnumerator("navigator:browser");while(browserWindows.hasMoreElements()){var browserWindow=browserWindows.getNext();if(browserWindow.gBrowser!=gBrowser){browserWindow.ZoomManager.zoom=zoomLevel}}}if(!this.siteSpecific||gInPrintPreviewMode||content.document instanceof Ci.nsIImageDocument){return}var zoomLevel=ZoomManager.zoom;Services.contentPrefs.setPref(gBrowser.currentURI,this.name,zoomLevel)};
		FullZoom.reset = function FullZoom_reset(){if(typeof this.globalValue!="undefined"){ZoomManager.zoom=this.globalValue}else{ZoomManager.reset()}MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom>0){var zoomLevel=ZoomManager.zoom;MouseControl.globalZoom=zoomLevel;MouseControl.prefs.setCharPref('globalZoom',zoomLevel);var browserWindows=MouseControl.wm.getEnumerator("navigator:browser");while(browserWindows.hasMoreElements()){var browserWindow=browserWindows.getNext();if(browserWindow.gBrowser!=gBrowser){browserWindow.ZoomManager.reset()}}}this._removePref()};
		FullZoom.onLocationChange = function FullZoom_onLocationChange(aURI,aIsTabSwitch,aBrowser){MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom>0){if(ZoomManager.zoom!=MouseControl.globalZoom){ZoomManager.setZoomForBrowser(aBrowser||gBrowser.selectedBrowser,MouseControl.globalZoom)}return}if(!aURI||aIsTabSwitch&&!this.siteSpecific){return}if(aURI.spec=="about:blank"){this._applyPrefToSetting(undefined,aBrowser);return}var self=this;Services.contentPrefs.getPref(aURI,this.name,function(aResult){var browser=aBrowser||gBrowser.selectedBrowser;if(aURI.equals(browser.currentURI)){self._applyPrefToSetting(aResult,browser)}})};
		FullScreen._collapseCallback = function(){if(!MouseControl.down){FullScreen.mouseoverToggle(false)}};

		//insert zoom indicator
		var disp = document.createElement('panel');
		disp.setAttribute('style','-moz-appearance:none;-moz-border-radius:10px;border-radius:20px;background-color:#f9f9f9;border:1px solid #AAA;opacity:.9;color:#336666;font-weight:bold;font-size:40px;padding:0px 15px 3px 15px;text-shadow:#AAA 2px 2px 4px;');
		disp.setAttribute('noautohide',true);
		disp.setAttribute('noautofocus',true);
		
		var dispLbl = document.createElement('label');
		dispLbl.setAttribute('style','margin:0;padding:0;');
		disp.appendChild(dispLbl);
		document.getElementById('content').appendChild(disp);
		MouseControl.ZoomDisp = disp;
	},
	unregister: function(event) {
		window.removeEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		window.removeEventListener("mousedown", MouseControl.downHandler, true);
		window.removeEventListener("mouseup", MouseControl.upHandler, true);
		window.removeEventListener("mousemove", MouseControl.moveHandler, true);
		window.removeEventListener("click", MouseControl.clickHandler, true);
		window.removeEventListener("dblclick", MouseControl.dblHandler, true);
		gBrowser.tabContainer.removeEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.removeEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.removeEventListener("TabClose", MouseControl.tabClosed, false);
		window.removeEventListener('popupshowing', MouseControl.noConsume, true);
		window.removeEventListener('popupshowing', MouseControl.prevC, true);
		window.removeEventListener('dragstart',MouseControl.dragstartHandler,true);

		FullZoom._applySettingToPref = function FullZoom__applySettingToPref(){if(!this.siteSpecific||gInPrintPreviewMode||content.document instanceof Ci.nsIImageDocument){return}var zoomLevel=ZoomManager.zoom;Services.contentPrefs.setPref(gBrowser.currentURI,this.name,zoomLevel)};
		FullZoom.reset = function FullZoom_reset(){if(typeof this.globalValue!="undefined"){ZoomManager.zoom=this.globalValue}else{ZoomManager.reset()}this._removePref()};
		FullZoom.onLocationChange = function FullZoom_onLocationChange(aURI,aIsTabSwitch,aBrowser){if(!aURI||aIsTabSwitch&&!this.siteSpecific){return}if(aURI.spec=="about:blank"){this._applyPrefToSetting(undefined,aBrowser);return}var browser=aBrowser||gBrowser.selectedBrowser;if(Services.contentPrefs.hasCachedPref(aURI,this.name)){let zoomValue=Services.contentPrefs.getPref(aURI,this.name);this._applyPrefToSetting(zoomValue,browser)}else{var self=this;Services.contentPrefs.getPref(aURI,this.name,function(aResult){if(aURI.equals(browser.currentURI)){self._applyPrefToSetting(aResult,browser)}})}};
		FullScreen._collapseCallback = function(){FullScreen.mouseoverToggle(false)};

		//remove zoom indicator
		document.getElementById('content').removeChild(MouseControl.ZoomDisp);
	},
	initPrefs: function() {

		MouseControl.PrimaryFeat = MouseControl.prefs.getBoolPref('PrimaryFeat');
		MouseControl.PrimaryDblFeat = MouseControl.prefs.getBoolPref('PrimaryDblFeat');
		MouseControl.PrimTrig = MouseControl.prefs.getIntPref('PrimTrig');
		MouseControl.PrimAlt2Trig = MouseControl.prefs.getIntPref('PrimAlt2Trig');
		MouseControl.PrimAltTrig = MouseControl.prefs.getIntPref('PrimAltTrig');

		MouseControl.SecondaryFeat = MouseControl.prefs.getBoolPref('SecondaryFeat');
		MouseControl.SecTrig = MouseControl.prefs.getIntPref('SecTrig');
		MouseControl.SecAltTrig = MouseControl.prefs.getIntPref('SecAltTrig');

		MouseControl.HoldDelay = MouseControl.prefs.getIntPref('HoldDelay')
		MouseControl.DblClickSpeed = MouseControl.prefs.getIntPref('DblClickSpeed');
		MouseControl.scrollUpMoveRight = MouseControl.prefs.getBoolPref('scrollUpMoveRight');
		MouseControl.relativeToCurrent = MouseControl.prefs.getBoolPref('newTabRelativeToCurrent');

		MouseControl.ZoomDisplay = MouseControl.prefs.getBoolPref('ZoomDisplay');
		MouseControl.globalZoom = MouseControl.prefs.getCharPref('globalZoom');

		var zoomStyle = MouseControl.prefs.getIntPref('zoomStyle');
		if (MouseControl.zoomStyle != zoomStyle)	{
			MouseControl.zoomStyle = zoomStyle;
			if (zoomStyle == 2)	{
				//changed zoom style to global
				//set zoom to globalZoom on selectedtab of this browser
				FullZoom.onLocationChange(gBrowser.currentURI,true,gBrowser);
			} else if (zoomStyle == 1)	{
				//changed zoom style to site specific
				//run FullZoom.onLocationChange on selectedtab of this browser
				FullZoom.onLocationChange(gBrowser.currentURI,true,gBrowser);
			}
		}
		//make sure settings are proper, mousecontrol pref is dominating. meaning if discrepancy found in settings it will be adjust to be in accordance with users mousecontrol settings
		if (zoomStyle == 2)	{
			if (MouseControl.globalZoom <= ZoomManager.MIN) {
				//should never happen
				//alert('MouseControl Exception 34');
				MouseControl.globalZoom = ZoomManager.MIN;
			}
			if (gPrefService.getBoolPref('browser.zoom.siteSpecific'))	{
				//can happen if user change browser.zoom.siteSpecific from 3rd party source
				//alert('MouseControl Exception 35');
				gPrefService.setBoolPref('browser.zoom.siteSpecific',false);
			}
		} else if (zoomStyle == 1) {
			//can happen if user change browser.zoom.siteSpecific from 3rd party source
			if (!gPrefService.getBoolPref('browser.zoom.siteSpecific'))	{
				//alert('MouseControl Exception 36');
				gPrefService.setBoolPref('browser.zoom.siteSpecific',true);
			}
		} else if (zoomStyle == 0) {
			//can happen if user change browser.zoom.siteSpecific from 3rd party source
			if (gPrefService.getBoolPref('browser.zoom.siteSpecific'))	{
				//alert('MouseControl Exception 37');
				gPrefService.setBoolPref('browser.zoom.siteSpecific',false);
			}
		}
	},
	setInscroll: function() {
		if ((!MouseControl.inscroll && MouseControl.down) || MouseControl.dblDown) {
			MouseControl.hideC();
			if (window.fullScreen) {
				FullScreen.mouseoverToggle(true);
			}
			var setInScroll = true; //will go on, if the first block of mozuserselect doesnt happen then it will still set it inscroll
			//MouseControl.inscroll = true;
			//MouseControl.restoreFocus();
		}
		if (!MouseControl.inscroll && MouseControl.PrimTrig == 1 && gBrowser.mCurrentBrowser._autoScrollPopup.state != 'closed')	{
			//gBrowser.mCurrentBrowser.stopScroll(); //no need because onpopuphidden this func gets called
			gBrowser.mCurrentBrowser._autoScrollPopup.hidePopup();
		}
		if (!MouseControl.inscroll && ((MouseControl.down && MouseControl.PrimTrig == 0) || (MouseControl.dblDown && MouseControl.PrimTrig == 0)) ) {
			MouseControl.inscroll = true;
			MouseControl.restoreFocus();
			if (gBrowser.contentDocument.body)	{
				MouseControl.mozNoned = gBrowser.getBrowserForTab(gBrowser.selectedTab);
				MouseControl.mozNoned.contentDocument.body.style.MozUserSelect = '-moz-none';
			}
		} else if (setInScroll)	{
			MouseControl.inscroll = true;
			MouseControl.restoreFocus();
		}
	},
	setInzoom: function() {
		if (!MouseControl.inzoom && MouseControl.sdown)	{
			MouseControl.hideC();
			if (MouseControl.SecTrig == 0)	{
				if (gBrowser.contentDocument.body)	{
					MouseControl.mozNoned = gBrowser.getBrowserForTab(gBrowser.selectedTab);
					MouseControl.mozNoned.contentDocument.body.style.MozUserSelect = '-moz-none';
				}
			}
			if (MouseControl.SecTrig == 1 && gBrowser.mCurrentBrowser._autoScrollPopup.state != 'closed')	{
				//gBrowser.mCurrentBrowser.stopScroll(); //no need because onpopuphidden this func gets called
				gBrowser.mCurrentBrowser._autoScrollPopup.hidePopup();
			}
			MouseControl.inzoom = true;
			MouseControl.restoreFocus();
		}
	},
	restoreFocus: function() {
			if (MouseControl.focPreDown != MouseControl.fm.focusedElement) {
				if (MouseControl.focPreDown) {
					var dontFocusTags = ['EMBED','APPLET'];
					if (dontFocusTags.indexOf(MouseControl.focPreDown.tagName) == -1) {
						MouseControl.fm.setFocus(MouseControl.focPreDown, MouseControl.fm.FLAG_NOSCROLL);
					}
				} else {
					MouseControl.fm.clearFocus(gBrowser.selectedTab.ownerDocument.defaultView);
				}
			}	
	},
	dragstartHandler: function(event) {
		if (MouseControl.inscroll || MouseControl.inzoom || MouseControl.dblDown)	{
			//already in func so dont start the drag
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
			return;
		}
		//not in func but button is down so continue the dragging and cancel MouseControl functionality
		//MouseControl.dragEvent = event;
		if (MouseControl.sdown)	{
			MouseControl.offzoom();
			
		}
		if (MouseControl.down || MouseControl.dblDown)	{
			MouseControl.offscroll();
		}
	},
	moveHandler: function(event) {
		if ((MouseControl.sdown && MouseControl.inzoom && MouseControl.SecTrig == 0) || (MouseControl.down && MouseControl.inscroll && MouseControl.PrimTrig == 0))	{
			//to prevent further highlighting
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation(); //to prevent the non-html5 drag stuff like for gmail
		}
		var box = gBrowser.mPanelContainer.boxObject;

		var cX = event.screenX;
		var cY = event.screenY;

		var minX = box.screenX;
		var maxX = box.screenX + box.width - 1;
		var minY = box.screenY + 1;
		var maxY = box.screenY + box.height - 1;

		if (cX >= minX && cX <= maxX && cY >= minY && cY <= maxY)	{
			MouseControl.inzone = true;
		} else {
			MouseControl.inzone = false;
		}
	},
	scrollHandler: function(event) {
//MouseControl.dump('.',1);
		if (!MouseControl.inzone) { return }
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
		} else if (MouseControl.sdown) {
			MouseControl.setInzoom();
			if (event.detail > 0)	{
				FullZoom.reduce();
			} else	{
				FullZoom.enlarge();
			}
			MouseControl.showZoom();
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
	showZoom: function()
	{
		if (!MouseControl.ZoomDisplay) { return; }
		MouseControl.ZoomDisp.childNodes[0].textContent = Math.round(ZoomManager.zoom*100)+'%';
		//MouseControl.ZoomDisp.popupBoxObject.setConsumeRollupEvent(Components.interfaces.nsIPopupBoxObject.ROLLUP_NO_CONSUME); //dont need this cuz adding no_consome to all popups via listener
		if (MouseControl.ZoomDisp.state != 'open')	{
			MouseControl.ZoomDisp.openPopup(gBrowser.mPanelContainer, 'overlap', 5, 5, false, false);
		}
	},
	downHandler: function(event) {
		if (!MouseControl.inzone) {
			if (MouseControl.sdown)	{
				MouseControl.offzoom();
			}
			if (MouseControl.down || MouseControl.dblDown)	{
				MouseControl.offscroll();
			}
			return;
		}
		if (MouseControl.down) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
			if (event.button == MouseControl.PrimAltTrig) {
				MouseControl.setInscroll();
				clearTimeout(MouseControl.undoCloseTO);
				MouseControl.closedTabUndid = false;
				MouseControl.undoCloseTO = setTimeout(MouseControl.undoCloseTab, MouseControl.HoldDelay); //used to be HoldDelay - 100
			}
		} else if (MouseControl.sdown) {
			if (event.button == MouseControl.SecAltTrig) {
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
				MouseControl.setInzoom();
				FullZoom.reset();
				MouseControl.showZoom();
				if (MouseControl.zoomStyle == 2)	{
					MouseControl.globalZoom = 1;
				}
			} else {
				if (MouseControl.inzoom)	{
					event.preventDefault();
					event.returnValue = false;
					event.stopPropagation();
				}
			}
		} else {
			var dontInitTags = ['EMBED','APPLET']; //to avoid lock in situations
			if (event.button == MouseControl.PrimTrig && !MouseControl.down && !MouseControl.sdown) {
				if (MouseControl.PrimTrig == 2 && event.target && dontInitTags.indexOf(event.target.tagName) >= 0) { return }
				if (MouseControl.PrimaryFeat)	{
					MouseControl.down = true;
				}
				if (MouseControl.PrimaryDblFeat && new Date().getTime() - MouseControl.lastDown <= MouseControl.DblClickSpeed)	{
					//trigger dbl on mouse up
					MouseControl.dblDown = true;
					MouseControl.setInscroll();
					MouseControl.duped = false;
					MouseControl.dupeTO = setTimeout(MouseControl.dupeTab,MouseControl.HoldDelay);
					event.preventDefault();
					event.returnValue = false;
					event.stopPropagation();
					return false;
				}
				MouseControl.dblDown = false;
				MouseControl.lastDown = new Date().getTime();
				//document.getElementById('contentAreaContextMenu').popupBoxObject.setConsumeRollupEvent(Components.interfaces.nsIPopupBoxObject.ROLLUP_NO_CONSUME);
				MouseControl.focPreDown = MouseControl.fm.focusedElement;
				if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
			}
			if (MouseControl.SecondaryFeat && event.button == MouseControl.SecTrig && !MouseControl.down && !MouseControl.sdown) {
				if (MouseControl.SecTrig == 2 && event.target && dontInitTags.indexOf(event.target.tagName) >= 0) { return }
				MouseControl.focPreDown = MouseControl.fm.focusedElement;
				MouseControl.sdown = true;
			}
		}
	},
	upHandler: function(event) {
		if (!MouseControl.inzone) {
			if (MouseControl.sdown)	{
				MouseControl.offzoom();
			}
			if (MouseControl.down || MouseControl.dblDown)	{
				MouseControl.offscroll();
			}
			return;
		}
		
		if (MouseControl.dblDown)	{
 			if (event.button == MouseControl.PrimTrig)	{
				MouseControl.lastUp = new Date().getTime();
				if (MouseControl.inscroll) {
					event.preventDefault();
					event.returnValue = false;
					//event.stopPropagation(); //commented out so FireGestures works
				}
				if (!MouseControl.duped)	{
					clearTimeout(MouseControl.dupeTO);
					MouseControl.setInscroll();
					MouseControl.newTab();
				}
				if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
				MouseControl.offscroll();
			}
		}
		if (MouseControl.down)	{
			if (event.button == MouseControl.PrimAltTrig) {
				//the above never happend, well unless PrimAltTrig and sectrig were not same
					event.preventDefault();
					event.returnValue = false;
					//event.stopPropagation(); //commented out so FireGestures works
				//the above never happend, well unless PrimAltTrig and sectrig were not same
				if (!MouseControl.closedTabUndid) {
					clearTimeout(MouseControl.undoCloseTO);
					if (new Date().getTime() < MouseControl.domainCloseLimit)	{
						MouseControl.closeDomain();
					} else {
						if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length - 1] == gBrowser.selectedTab) {
							MouseControl.itabHistory.splice(MouseControl.itabHistory.length - 1, 1);
						}
						MouseControl.setInscroll();
						MouseControl.targetDomain = gBrowser.currentURI;
						gBrowser.removeCurrentTab();
						MouseControl.domainCloseLimit = new Date().getTime() + MouseControl.DblClickSpeed;
					}
				} else {
					MouseControl.closedTabUndid = false;
				}
			} else if (event.button == MouseControl.PrimAlt2Trig) {
				MouseControl.setInscroll();
				MouseControl.lastUp = new Date().getTime();
				MouseControl.jumpTab();
			} else if (event.button == MouseControl.PrimTrig)	{
				if (MouseControl.inscroll) {
					MouseControl.lastUp = new Date().getTime();
					event.preventDefault();
					event.returnValue = false;
					//event.stopPropagation(); //commented out so FireGestures works
				}
				if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
				MouseControl.offscroll();
			}
		} else if (MouseControl.sdown)	{
			if (MouseControl.inzoom)	{
				event.preventDefault();
				event.returnValue = false;
				//event.stopPropagation(); //commented out so FireGestures works
				MouseControl.lastUp = new Date().getTime();
			}
			if (event.button == MouseControl.SecTrig)	{
				//MouseControl.offscroll();
				MouseControl.offzoom()
			}
		}

	},
	clickHandler: function(event) {
		if (!MouseControl.inzone) {
			if (MouseControl.sdown)	{
				MouseControl.offzoom();
			}
			if (MouseControl.down || MouseControl.dblDown)	{
				MouseControl.offscroll();
			}
			return;
		}
		if (MouseControl.down || MouseControl.dblDown) {
			if (MouseControl.inscroll || MouseControl.dblDown)	{ //dblDown above and below lines is on purpose
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
		} else if (MouseControl.sdown)	{
			if (MouseControl.inzoom)	{
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
		} else {
			if (new Date().getTime() - MouseControl.lastUp <= 100) {
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
			}
		}
	},
	dblHandler: function(event)	{
		if (MouseControl.sdown || new Date().getTime() - MouseControl.lastUp <= 100)	{
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		}
	},
	undoCloseTab: function() {
		MouseControl.closedTabUndid = true;
		try	{
			MouseControl.ss.undoCloseTab(window, 0);
		} catch(e)	{
			MouseControl.notify('Cannot undo, no closed tab was found in session history')
		}
	},
	closeDomain: function() {
		var closeThese = [];
		var tabbrowser = MouseControl.wm.getMostRecentWindow('navigator:browser').gBrowser;
		for (var index = 0; index < tabbrowser.tabContainer.childNodes.length; index++) {
			// Get the next tab
			var currentTab = tabbrowser.tabContainer.childNodes[index];
			if (!currentTab.pinned)	{
				if (gBrowser.getBrowserForTab(currentTab).currentURI.prePath == 'about:')	{
					if (gBrowser.getBrowserForTab(currentTab).currentURI.path == MouseControl.targetDomain.path)	{
						closeThese.push(currentTab);
					}
				} else if (gBrowser.getBrowserForTab(currentTab).currentURI.prePath == MouseControl.targetDomain.prePath) {
					closeThese.push(currentTab);
				}
			}
		}
		for (var i=0; i<closeThese.length; i++)	{
			tabbrowser.removeTab(closeThese[i]);
		}
	},
	dupeTab: function() {
		MouseControl.hideC(); //find better solution
		MouseControl.duped = true;
		var newIndex = gBrowser.tabContainer.childNodes.length;
		var tab = MouseControl.ss.duplicateTab(window, gBrowser.selectedTab);
		if (!MouseControl.relativeToCurrent)	{
			gBrowser.moveTabTo(tab, newIndex);
		}
		gBrowser.selectedTab = tab;
	},
	newTab: function() {
		MouseControl.hideC(); //find better solution
		if (MouseControl.relativeToCurrent) {
			if (uneval(BrowserOpenTab).indexOf('inBackground') > -1)	{
				eval('('+uneval(BrowserOpenTab).replace('inBackground:','relatedToCurrent:true,inBackground:')+')')();
			} else {
				var newIndex = gBrowser.selectedTab._tPos + 1;
				BrowserOpenTab();
				gBrowser.moveTabTo(gBrowser.tabContainer.childNodes[gBrowser.tabContainer.childNodes.length-1], newIndex);
			}
		} else {
			BrowserOpenTab();
		}
	},
	jumpTab: function() {
		var jumped = false;
		if (MouseControl.itabHistory.length > 0) {
			for (var i = MouseControl.itabHistory.length - 1; i >= 0; i--) {
				if (!MouseControl.itabHistory[i].parentNode)	{
					MouseControl.cleanHistory();
					MouseControl.jumpTab();
					return;
				}
				if (gBrowser.selectedTab != MouseControl.itabHistory[i]) {
					gBrowser.selectedTab = MouseControl.itabHistory[i];
					jumped = true;
					break;
				}
			}
			if (!jumped) {
				MouseControl.notify('Cannot jump, no previously focused tab found.');
			}
		} else {
			MouseControl.notify('Cannot jump, no tabs found in tab focus history.');
		}
	},
	prevC: function(event) {
		if (event.target != document.getElementById('contentAreaContextMenu')) { return } //used to be: if (event.target == MouseControl.ZoomDisp) { return }
		if (MouseControl.inzoom || MouseControl.inscroll || new Date().getTime() - MouseControl.lastUp <= 100) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		}
	},
	noConsume: function(event)	{
		if (event.target != document.getElementById('contentAreaContextMenu')) { return }
		if (event.target.popupBoxObject)	{
			event.target.popupBoxObject.setConsumeRollupEvent(Components.interfaces.nsIPopupBoxObject.ROLLUP_NO_CONSUME);
		}
	},
	hideC: function() {
			var menu = document.getElementById('contentAreaContextMenu');
			if (menu.state == 'open') {
				menu.hidePopup();
			}
	},
	offscroll: function() {
		if (MouseControl.down || MouseControl.dblDown)	{
			clearTimeout(MouseControl.dupeTO);
			clearTimeout(MouseControl.undoCloseTO);
			if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
				MouseControl.itabHistory.push(gBrowser.selectedTab);
			}
			if (window.fullScreen) {
				FullScreen.mouseoverToggle(false);
			}
		}
		if ((MouseControl.down && MouseControl.PrimTrig == 0) || (MouseControl.dblDown && MouseControl.PrimTrig == 0)) {
			if (MouseControl.mozNoned && MouseControl.mozNoned.contentDocument && MouseControl.mozNoned.contentDocument.body)	{
				MouseControl.mozNoned.contentDocument.body.style.MozUserSelect = '';
			}
		}
		MouseControl.down = false;
		MouseControl.dblDown = false;
		MouseControl.inscroll = false;
	},
	offzoom: function() {
		if (MouseControl.inzoom && MouseControl.SecTrig == 0) {
			if (MouseControl.mozNoned && MouseControl.mozNoned.contentDocument && MouseControl.mozNoned.contentDocument.body)	{
				MouseControl.mozNoned.contentDocument.body.style.MozUserSelect = '';
			}
		}
		MouseControl.sdown = false;
		MouseControl.inzoom = false;
		if (MouseControl.ZoomDisplay && MouseControl.ZoomDisp.state != 'closed') {
			MouseControl.ZoomDisp.hidePopup();
		}
	},
	tabSeld: function() {
		if (!MouseControl.inscroll) {
			if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab)	{
				MouseControl.itabHistory.push(gBrowser.selectedTab);
			}
		}
		if (MouseControl.inzoom)	{
			MouseControl.offzoom();
		}
	},
	tabOpened: function() {
		MouseControl.itabHistory.push(gBrowser.selectedTab);
	},
	tabClosed: function() {
		MouseControl.cleanHistory();
	},
	dump: function(msg,append,where) {
		where = !where ? 'searchbar' : 'urlbar';
		if (append)	{
			document.getElementById(where).value += msg;
		} else {
			document.getElementById(where).value = msg;
		}
	},
	notify: function(body,title)	{
		if (MouseControl.ns == 2) { return }
		if (!MouseControl.ns)	{
			try {
				MouseControl.ns = Components.classes["@mozilla.org/alerts-service;1"].getService(Components.interfaces.nsIAlertsService);
			} catch(e) {
				MouseControl.ns = 2
			}
		}
		if (!title) { title = 'MouseControl Notification' }
		MouseControl.ns.showAlertNotification('chrome://MouseControl/skin/icon.png', title, body);
	}
};
window.addEventListener("load", MouseControl.register, false);
window.addEventListener("unload", MouseControl.unregister, false);