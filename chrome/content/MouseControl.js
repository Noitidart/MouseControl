var MouseControl = {
	itabHistory: [],
	lastUp: 0,
	covers: ['APPLET','EMBED','OBJECT'],
	v: '1.5.1',
	register: function(event) {
		window.addEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		window.addEventListener("mousedown", MouseControl.downHandler, true);
		window.addEventListener("mouseup", MouseControl.upHandler, true); //the stopPropogation in upHandler is what messes up FireGestures
		window.addEventListener("click", MouseControl.clickHandler, true);
		window.addEventListener("dblclick", MouseControl.dblHandler, true);
		gBrowser.tabContainer.addEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.addEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.addEventListener("TabClose", MouseControl.tabClosed, false);
		window.addEventListener('popupshowing', MouseControl.noConsume, true);
		//window.addEventListener('contextmenu', MouseControl.reqC, true);
		window.addEventListener('popupshowing', MouseControl.prevC, true);
		//window.addEventListener('popupshown', MouseControl.popShown, true);
		window.addEventListener('drag',MouseControl.dragHandler,true);
		window.addEventListener('dragend',MouseControl.dragendHandler,true);
		window.addEventListener('dragstart',MouseControl.dragstartHandler,true);
		window.addEventListener('deactivate',MouseControl.deactivateHandler,true);

		MouseControl.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch('extensions.MouseControl@neocodex.us.');
		MouseControl.initPrefs();

		MouseControl.wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);

		MouseControl.onLocationChange = FullZoom.onLocationChange.toSource();
		if (ZoomManager.setZoomForBrowser)	{
			var setZoomCode = 'ZoomManager.setZoomForBrowser(aBrowser||gBrowser.selectedBrowser,MouseControl.globalZoom)';
		} else {
			var setZoomCode = 'ZoomManager.zoom=MouseControl.globalZoom';
		}
		FullZoom.onLocationChange = eval(MouseControl.onLocationChange.replace('{',"{MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom>0){if(ZoomManager.zoom!=MouseControl.globalZoom){"+setZoomCode+"}return}"));

		MouseControl._applySettingToPref = FullZoom._applySettingToPref.toSource();
		FullZoom._applySettingToPref = eval(MouseControl._applySettingToPref.replace("{","{MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom>0){var zoomLevel=ZoomManager.zoom;MouseControl.globalZoom=zoomLevel;MouseControl.prefs.setCharPref('globalZoom',zoomLevel);var browserWindows=MouseControl.wm.getEnumerator('navigator:browser');while(browserWindows.hasMoreElements()){var browserWindow=browserWindows.getNext();if(browserWindow.gBrowser!=gBrowser){browserWindow.ZoomManager.zoom=zoomLevel}}}"));
		FullZoom.reset = function FullZoom_reset(){if(typeof this.globalValue!="undefined"){ZoomManager.zoom=this.globalValue}else{ZoomManager.reset()}MouseControl.globalZoom=MouseControl.prefs.getCharPref('globalZoom');MouseControl.zoomStyle=MouseControl.prefs.getIntPref('zoomStyle');if(!this.siteSpecfic&&MouseControl.zoomStyle==2&&MouseControl.globalZoom>0){var zoomLevel=ZoomManager.zoom;MouseControl.globalZoom=zoomLevel;MouseControl.prefs.setCharPref('globalZoom',zoomLevel);var browserWindows=MouseControl.wm.getEnumerator("navigator:browser");while(browserWindows.hasMoreElements()){var browserWindow=browserWindows.getNext();if(browserWindow.gBrowser!=gBrowser){browserWindow.ZoomManager.reset()}}}this._removePref()};
		FullScreen._collapseCallback = function(){if(!MouseControl.down){FullScreen.mouseoverToggle(false)}};

		var Cover = document.createElement('panel');
		Cover.setAttribute('style','-moz-window-shadow:none;-moz-appearance:none;background-color:steelblue;border:1px solid #AAA;opacity:.4');
		Cover.setAttribute('noautohide',true);
		Cover.setAttribute('noautofocus',true);
		Cover.setAttribute('id','MCCover');
		var cLbl = document.createElement('label');
		cLbl.setAttribute('style','margin:0;padding:0;text-align:center;font-size:300px;');
		cLbl.textContent = '|';
		Cover.appendChild(cLbl);
		Cover.addEventListener('mouseup',function(){MouseControl.Cover.hidePopup()},true);
		document.getElementById('content').appendChild(Cover);
		MouseControl.Cover = Cover;

		//insert zoom indicator
		var disp = document.createElement('panel');
		disp.setAttribute('style','-moz-appearance:none;-moz-border-radius:10px;border-radius:20px;background-color:#f9f9f9;border:1px solid #AAA;opacity:.9;color:#336666;font-weight:bold;font-size:40px;padding:0px 15px 3px 15px;text-shadow:#AAA 2px 2px 4px;');
		disp.setAttribute('noautohide',true);
		disp.setAttribute('noautofocus',true);
		var dispLbl = document.createElement('label');
		dispLbl.setAttribute('style','margin:0;padding:0;text-align:center;');
		disp.appendChild(dispLbl);
		document.getElementById('content').appendChild(disp);
		MouseControl.ZoomDisp = disp;

		setTimeout(function () {
			var parseVersionString = function (str) {
				var x = str.split('.');
				var maj = parseInt(x[0]) || 0;
				var min = parseInt(x[1]) || 0;
				var pat = parseInt(x[2]) || 0;
				return {
					major: maj,
					minor: min,
					patch: pat
				}
			}
			try {
				var v = MouseControl.prefs.getCharPref('v');
			} catch (e) {
				var v = '0.0.0';
			}
			MouseControl.prefs.setCharPref('v', MouseControl.v);
			var running_version = parseVersionString(MouseControl.v);
			var last_version = parseVersionString(v);
			var grade;
			if (running_version.minor > last_version.minor) {
				grade = 1;
			} else if (running_version.minor < last_version.minor) {
				//this is a major downgrade
				grade = -1;
			} else if (running_version.patch > last_version.patch) {
				grade = 1;
			} else if (running_version.patch < last_version.patch) {
				grade = -1;
			} else {
				// We are running the latest version! No need to update.
			}
			if (grade) {
				var title = grade > 0 ? 'MouseControl Upgraded' : 'MouseControl Downgraded';
				var body = 'Now running v' + MouseControl.v + ' - View Release Notes';
				MouseControl.notify(body, title);
			}
		}, 1000);
	},
	unregister: function(event) {
		window.removeEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		window.removeEventListener("mousedown", MouseControl.downHandler, true);
		window.removeEventListener("mouseup", MouseControl.upHandler, true);
		window.removeEventListener("click", MouseControl.clickHandler, true);
		window.removeEventListener("dblclick", MouseControl.dblHandler, true);
		gBrowser.tabContainer.removeEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.removeEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.removeEventListener("TabClose", MouseControl.tabClosed, false);
		window.removeEventListener('popupshowing', MouseControl.noConsume, true);
		window.removeEventListener('popupshowing', MouseControl.prevC, true);
		window.removeEventListener('dragstart',MouseControl.dragstartHandler,true);


		window.removeEventListener("DOMMouseScroll", MouseControl.scrollHandler, true);
		window.removeEventListener("mousedown", MouseControl.downHandler, true);
		window.removeEventListener("mouseup", MouseControl.upHandler, true); //the stopPropogation in upHandler is what messes up FireGestures
		window.removeEventListener("click", MouseControl.clickHandler, true);
		window.removeEventListener("dblclick", MouseControl.dblHandler, true);
		gBrowser.tabContainer.removeEventListener("TabSelect", MouseControl.tabSeld, false);
		gBrowser.tabContainer.removeEventListener("TabOpen", MouseControl.tabOpened, false);
		gBrowser.tabContainer.removeEventListener("TabClose", MouseControl.tabClosed, false);
		window.removeEventListener('popupshowing', MouseControl.noConsume, true);
		//window.removeEventListener('contextmenu', MouseControl.reqC, true);
		window.removeEventListener('popupshowing', MouseControl.prevC, true);
		//window.removeEventListener('popupshown', MouseControl.popShown, true);
		window.removeEventListener('drag',MouseControl.dragHandler,true);
		window.removeEventListener('dragend',MouseControl.dragendHandler,true);
		window.removeEventListener('dragstart',MouseControl.dragstartHandler,true);
		window.removeEventListener('deactivate',MouseControl.deactivateHandler,true);

		

		FullZoom._applySettingToPref = eval(MouseControl._applySettingToPref);
		FullZoom.onLocationChange = eval(MouseControl.onLocationChange);
		FullZoom.reset = function FullZoom_reset(){if(typeof this.globalValue!="undefined"){ZoomManager.zoom=this.globalValue}else{ZoomManager.reset()}this._removePref()};
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

		MouseControl.postGPrefService();

	},
	postAtt: 0, //NOIT remove this, its just in ff3 MouseControl loads before gPrefService, i am testing how many ms after MouseControl gPrefService loads with this var
	postGPrefService: function() {
		if (!gPrefService) {
			setTimeout(function(){MouseControl.postAtt++;MouseControl.postGPrefService()},1);
			return;
		}
		var zoomStyle = MouseControl.prefs.getIntPref('zoomStyle');
		if (MouseControl.zoomStyle === undefined) {
			MouseControl.zoomStyle = zoomStyle; //only run on start up of window, the if MC.zoomSty != zoomSty is meant for after coming out of preferences panel
		}
		if (MouseControl.zoomStyle != zoomStyle)	{
			MouseControl.zoomStyle = zoomStyle;
			if (zoomStyle == 1 || zoomStyle == 2)	{
				if (MouseControl.onLocationChange.indexOf('(aURI, aIsTabSwitch, aBrowser)') >= 0)	{
					FullZoom.onLocationChange(gBrowser.currentURI,true,gBrowser);
				} else if (MouseControl.onLocationChange.indexOf('(aURI, aBrowser)') >= 0) {
					FullZoom.onLocationChange(gBrowser.currentURI,gBrowser);
				} else {
					FullZoom.onLocationChange(gBrowser.currentURI);
				}
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
	deactivateHandler: function(event) {
		if (MouseControl.sdown)	{
			MouseControl.offzoom(event);
		}
		if (MouseControl.down || MouseControl.dblDown)	{
			MouseControl.offscroll(event);
		}
	},
	setInscroll: function(event) {
		if (!MouseControl.inscroll && (MouseControl.down || MouseControl.dblDown)) { //noit: added !inscroll to the dbldown part of if too on 5/23/11 BEFORE: if ((!MouseControl.inscroll && MouseControl.down) || MouseControl.dblDown) {
			MouseControl.hideC();
			if (window.fullScreen) {
				FullScreen.mouseoverToggle(true);
			}

			MouseControl.inscroll = true;

			var utils = gBrowser.contentDocument.childNodes[0].ownerDocument.defaultView.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
			MouseControl.ScriptCnt = {up:0,click:0,dbl:0};
			MouseControl.ScriptUp = new Date().getTime();
			utils.sendMouseEvent('mouseup',event.pageX,event.pageY,MouseControl.PrimTrig,1,0);

			if (gBrowser.mCurrentBrowser._autoScrollPopup && gBrowser.mCurrentBrowser._autoScrollPopup.state != 'closed')	{
				gBrowser.mCurrentBrowser._autoScrollPopup.hidePopup();
			}
			MouseControl.restoreFocus();

		}
	},
	setInzoom: function(event) {
		if (!MouseControl.inzoom && MouseControl.sdown)	{
			MouseControl.hideC();

			MouseControl.inzoom = true;
			var utils = gBrowser.contentDocument.childNodes[0].ownerDocument.defaultView.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
			MouseControl.ScriptCnt = {up:0,click:0,dbl:0};
			MouseControl.ScriptUp = new Date().getTime();
			utils.sendMouseEvent('mouseup',event.pageX,event.pageY,MouseControl.SecTrig,1,0);

			if (gBrowser.mCurrentBrowser._autoScrollPopup && gBrowser.mCurrentBrowser._autoScrollPopup.state != 'closed')	{
				gBrowser.mCurrentBrowser._autoScrollPopup.hidePopup();
			}
			MouseControl.restoreFocus();

		}
	},
	getFocus: function() {
		if (MouseControl.fm === undefined) {
			try {
				MouseControl.fm = Components.classes["@mozilla.org/focus-manager;1"].getService(Components.interfaces.nsIFocusManager);
			} catch (e) {
				MouseControl.fm = false;
			}
		}
		if (MouseControl.fm === false)	{
			MouseControl.focPreDown = document.commandDispatcher.focusedElement;
		} else {
			MouseControl.focPreDown = MouseControl.fm.focusedElement;
		}
	},
	restoreFocus: function() {
		if (MouseControl.fm)	{
			if (MouseControl.focPreDown != MouseControl.fm.focusedElement) {
				if (MouseControl.focPreDown) {
					if (MouseControl.covers.indexOf(MouseControl.focPreDown.tagName) == -1) {
						MouseControl.fm.setFocus(MouseControl.focPreDown, MouseControl.fm.FLAG_NOSCROLL);
					}
				} else {
					MouseControl.fm.clearFocus(gBrowser.selectedTab.ownerDocument.defaultView);
				}
			}	
		} else {
			if (MouseControl.focPreDown != document.commandDispatcher.focusedElement) {
				if (MouseControl.focPreDown) {
					if (MouseControl.covers.indexOf(MouseControl.focPreDown.tagName) == -1) {
						MouseControl.focPreDown.focus();
					}
				}
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
		if (MouseControl.sdown)	{
			MouseControl.offzoom(event);
			
		}
		if (MouseControl.down || MouseControl.dblDown)	{
			MouseControl.offscroll(event);
		}
	},
	dragHandler: function(event) {
		window.removeEventListener('drag',MouseControl.dragHandler,true);
		if (MouseControl.inscroll || MouseControl.inzoom || MouseControl.dblDown)	{
			//already in func so dont start the drag
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
			return;
		}
		//not in func but button is down so continue the dragging and cancel MouseControl functionality
		if (MouseControl.sdown)	{
			MouseControl.offzoom(event);
			
		}
		if (MouseControl.down || MouseControl.dblDown)	{
			MouseControl.offscroll(event);
		}
	},
	dragendHandler: function(event) {
		window.addEventListener('drag',MouseControl.dragHandler,true);
	},
	moveHandler: function(event) {
		if ((MouseControl.sdown && MouseControl.inzoom && MouseControl.SecTrig == 0) || (MouseControl.down && MouseControl.inscroll && MouseControl.PrimTrig == 0))	{
			//to prevent further highlighting
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation(); //to prevent the non-html5 drag stuff like for gmail
		}
	},
	inzone: function(event)	{
		var box = gBrowser.mPanelContainer.boxObject;

		var cX = event.screenX;
		var cY = event.screenY;

		var minX = box.screenX;
		var maxX = box.screenX + box.width - 1;
		var minY = box.screenY + 1;
		var maxY = box.screenY + box.height - 1;

		if (cX >= minX && cX <= maxX && cY >= minY && cY <= maxY)	{
			return true;
		} else {
			return false;
		}
	},
	scrollHandler: function(event) {
		if (!MouseControl.inzone(event)) { return }
		if (MouseControl.down) {
			MouseControl.setInscroll(event);
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
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
			MouseControl.setInzoom(event);
			if (event.detail > 0)	{
				FullZoom.reduce();
			} else	{
				FullZoom.enlarge();
			}
			MouseControl.showZoom();
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
		if (new Date().getTime() - MouseControl.ScriptUp < 5) {
			//event.preventDefault();
			//event.returnValue = false;
			//event.stopPropagation();
			return;
		}
		if (!MouseControl.inzone(event)) {
			if (MouseControl.sdown)	{
				MouseControl.offzoom(event);
			}
			if (MouseControl.down || MouseControl.dblDown)	{
				MouseControl.offscroll(event);
			}
			return;
		}
		if (MouseControl.down) {
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
			if (event.button == MouseControl.PrimAltTrig) {
				MouseControl.setInscroll(event);
				clearTimeout(MouseControl.undoCloseTO);
				MouseControl.closedTabUndid = false;
				MouseControl.undoCloseTO = setTimeout(MouseControl.undoCloseTab, MouseControl.HoldDelay); //used to be HoldDelay - 100
			}
		} else if (MouseControl.sdown) {
			if (event.button == MouseControl.SecAltTrig) {
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation();
				MouseControl.setInzoom(event);
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
			if (event.button == MouseControl.PrimTrig && !MouseControl.down && !MouseControl.sdown) {
				if (MouseControl.PrimTrig == 2 && event.target && MouseControl.covers.indexOf(event.target.tagName) >= 0) { return }
				MouseControl.downTime = new Date().getTime();
				/*if (MouseControl.resetPOnNextDown)	{
					MouseControl.P = MouseControl.P == '+' ? '$' : '+';
					MouseControl.resetPOnNextDown = false;
				}*/
				//Components.utils.reportError(MouseControl.P + ' - downTime: ' + MouseControl.downTime)
				if (MouseControl.PrimaryFeat)	{
					MouseControl.down = true;
					//window.addEventListener("mousemove", MouseControl.moveHandler, true);
				}
				if (MouseControl.PrimaryDblFeat && new Date().getTime() - MouseControl.lastDown <= MouseControl.DblClickSpeed)	{
					//trigger dbl on mouse up
					MouseControl.dblDown = true;
					MouseControl.dblDownTime = new Date().getTime();
					//Components.utils.reportError(MouseControl.P + ' - dblDownTime: ' + MouseControl.dblDownTime)
					//MouseControl.resetPOnNextDown = true;
					MouseControl.setInscroll(event);
					MouseControl.duped = false;
					MouseControl.dupeTO = setTimeout(MouseControl.dupeTab,MouseControl.HoldDelay);
					event.preventDefault();
					event.returnValue = false;
					event.stopPropagation();
					return false;
				}
				MouseControl.dblDown = false;
				MouseControl.newTabbed = false;
				MouseControl.lastDown = new Date().getTime();
				//document.getElementById('contentAreaContextMenu').popupBoxObject.setConsumeRollupEvent(Components.interfaces.nsIPopupBoxObject.ROLLUP_NO_CONSUME);
				MouseControl.getFocus(); //MouseControl.focPreDown = MouseControl.fm.focusedElement;
				if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
			}
			if (MouseControl.SecondaryFeat && event.button == MouseControl.SecTrig && !MouseControl.down && !MouseControl.sdown) {
				if (MouseControl.SecTrig == 2 && event.target && MouseControl.covers.indexOf(event.target.tagName) >= 0) { return }
				MouseControl.getFocus(); //MouseControl.focPreDown = MouseControl.fm.focusedElement;
				MouseControl.sdown = true;
				//window.addEventListener("mousemove", MouseControl.moveHandler, true);
			}
		}
	},
	upHandler: function(event) {
		if (new Date().getTime() - MouseControl.ScriptUp < 5 && MouseControl.ScriptCnt.up == 0) {
			MouseControl.ScriptCnt.up++;
			return;
		}
		if (!MouseControl.inzone(event)) {
			if (MouseControl.sdown)	{
				MouseControl.offzoom(event);
			}
			if (MouseControl.down || MouseControl.dblDown)	{
				MouseControl.offscroll(event);
			}
			return;
		}
		
		if (MouseControl.dblDown)	{
 			if (event.button == MouseControl.PrimTrig)	{
				MouseControl.lastUp = new Date().getTime();
				if (MouseControl.inscroll) {
					event.preventDefault();
					event.returnValue = false;
					event.stopPropagation(); //commented out so FireGestures works
				}
				if (!MouseControl.duped)	{
					clearTimeout(MouseControl.dupeTO);
					MouseControl.setInscroll(event);
					MouseControl.newTab();
				}
				if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
				MouseControl.offscroll(event);
			}
		}
		if (MouseControl.down)	{
			if (event.button == MouseControl.PrimAltTrig) {
				//the above never happend, well unless PrimAltTrig and sectrig were not same
					event.preventDefault();
					event.returnValue = false;
					event.stopPropagation(); //commented out so FireGestures works
				//the above never happend, well unless PrimAltTrig and sectrig were not same
				if (!MouseControl.closedTabUndid) {
					clearTimeout(MouseControl.undoCloseTO);
					if (new Date().getTime() < MouseControl.domainCloseLimit)	{
						MouseControl.closeDomain();
					} else {
						if (MouseControl.itabHistory.length > 0 && MouseControl.itabHistory[MouseControl.itabHistory.length - 1] == gBrowser.selectedTab) {
							MouseControl.itabHistory.splice(MouseControl.itabHistory.length - 1, 1);
						}
						MouseControl.setInscroll(event);
						MouseControl.targetDomain = gBrowser.currentURI;
						gBrowser.removeCurrentTab();
						MouseControl.domainCloseLimit = new Date().getTime() + MouseControl.DblClickSpeed;
					}
				} else {
					MouseControl.closedTabUndid = false;
				}
			} else if (event.button == MouseControl.PrimAlt2Trig) {
				MouseControl.setInscroll(event);
				MouseControl.lastUp = new Date().getTime();
				MouseControl.jumpTab();
			} else if (event.button == MouseControl.PrimTrig)	{
				if (MouseControl.inscroll) {
					MouseControl.lastUp = new Date().getTime();
					event.preventDefault();
					event.returnValue = false;
					event.stopPropagation(); //commented out so FireGestures works
				}
				if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab) {
					MouseControl.itabHistory.push(gBrowser.selectedTab);
				}
				MouseControl.offscroll(event);
			}
		} else if (MouseControl.sdown)	{
			if (MouseControl.inzoom)	{
				event.preventDefault();
				event.returnValue = false;
				event.stopPropagation(); //commented out so FireGestures works
				MouseControl.lastUp = new Date().getTime();
			}
			if (event.button == MouseControl.SecTrig)	{
				//MouseControl.offscroll(event);
				MouseControl.offzoom(event)
			}
		}

	},
	clickHandler: function(event) {
		if (new Date().getTime() - MouseControl.ScriptUp < 5 && MouseControl.ScriptCnt.click == 0) {
			MouseControl.ScriptCnt.click++;
			event.preventDefault();
			//event.stopPropagation(); //NOIT: 6/1 i have to uncomment this because sometimes it fires the event like link open on yahoo news logo. HOwever i commented it because the FF 3.5 blinking cursor came back.
			return;
		}
		if (!MouseControl.inzone(event)) {
			if (MouseControl.sdown)	{
				MouseControl.offzoom(event);
			}
			if (MouseControl.down || MouseControl.dblDown)	{
				MouseControl.offscroll(event);
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
		/*
		if (new Date().getTime() - MouseControl.ScriptUp < 5 && MouseControl.ScriptCnt.dbl != 0){
			alert('ScrptCnt dbl not 0!');
		}
		*/
		if (new Date().getTime() - MouseControl.ScriptUp < 5 && MouseControl.ScriptCnt.dbl == 0) {
			MouseControl.ScriptCnt.dbl++;
			event.preventDefault();
			return;
		}
		if (MouseControl.sdown || new Date().getTime() - MouseControl.lastUp <= 100)	{
			event.preventDefault();
			event.returnValue = false;
			event.stopPropagation();
		}
	},
	undoCloseTab: function() {
		MouseControl.closedTabUndid = true;
		try	{
			MouseControl.ssCall(0);
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
	ssCall: function(d) {
		if (MouseControl.ss === undefined)	{
			MouseControl.ss = Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore);
		}
		if (d == 0)	{
			//undo close
			MouseControl.ss.undoCloseTab(window, 0);
		} else if (d == 1) {
			//duplicate tab
			return MouseControl.ss.duplicateTab(window, gBrowser.selectedTab);
		}
	},
	dupeTab: function() {
		MouseControl.duped = true;
		var origsPos = gBrowser.selectedTab._tPos;
		if (MouseControl.relativeToCurrent) {
			var newPos = origsPos + 1;
		} else {
			var newPos = gBrowser.tabContainer.childNodes.length;
		}
		
		var tab = MouseControl.ssCall(1);
		if (tab._tPos != newPos) {
			gBrowser.moveTabTo(tab, newPos);
		}
		gBrowser.selectedTab = tab; //do this only if the setting of focus new tab on creation is true ACTUALLY never mind, BrowserOpenTab always focuses newly created tab
	},
	newTab: function() {
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
		MouseControl.newTabTime = new Date().getTime();
		MouseControl.newTabbed = true;
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
	reqC: function(event) {
		MouseControl.reqTime = new Date().getTime();
		//Components.utils.reportError(MouseControl.P + ' - reqTime: ' + MouseControl.reqTime)
	},

	popShown: function() {
		MouseControl.shownTime = new Date().getTime();
		//Components.utils.reportError(MouseControl.P + ' - shownTime: ' + MouseControl.reqTime)
	},
	P: '+',
	prevC: function(event) {
		if (event.target != document.getElementById('contentAreaContextMenu')) { return }
		MouseControl.showTime = new Date().getTime();
		//Components.utils.reportError(MouseControl.P + ' - showTime: ' + MouseControl.showTime)
		

		if (MouseControl.inzoom || MouseControl.inscroll || new Date().getTime() - MouseControl.lastUp <= 100) {
			event.preventDefault();
			//event.returnValue = false;
			//event.stopPropagation();
			//Components.utils.reportError(MouseControl.P + ' - Context BLOCKED - ' + (new Date().getTime() - MouseControl.lastUp) + ' lastUp:'+MouseControl.lastUp + ' NOW:'+new Date().getTime())
		} else {
			//Components.utils.reportError(MouseControl.P + ' - Context ALLOWED - ' + (new Date().getTime() - MouseControl.lastUp) + ' lastUp:'+MouseControl.lastUp + ' NOW:'+new Date().getTime())
		}

		if (MouseControl.PrimTrig == 2 && MouseControl.downTime <= MouseControl.dblDownTime & !MouseControl.disableNewBlock) { //only if the dbl click trigger is the one that pops the context menu
			event.preventDefault();
			//Components.utils.reportError(MouseControl.P + ' - Context BLOCKED because there was no down after the last dbldown')
			if (MouseControl.newTabbed) {
				var f = document.commandDispatcher.focusedElement;
				if (f && f.parentNode && f.parentNode.parentNode && f.parentNode.parentNode.parentNode && f.parentNode.parentNode.parentNode == gURLBar) {
					//gurl bar is selected
					//Components.utils.reportError('focus IS gURLBar');
				} else {
					//Components.utils.reportError('focus is NOT gURLBar will focus it now');
					focusAndSelectUrlBar();
				}
			}
			//Components.utils.reportError(MouseControl.P + ' - newTabTime - ' + MouseControl.newTabTime + ' - time since: ' + (new Date().getTime() - MouseControl.newTabTime))
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
			MouseControl.hideCTime = new Date().getTime();
			if (menu.state != 'closed' || menu.open) {
				//Components.utils.reportError(MouseControl.P + ' - hideC called YES to hide - ' + MouseControl.hideCTime)
				menu.hidePopup();
			} else {
				//Components.utils.reportError(MouseControl.P + ' - hideC called NOTHING to hide - ' + MouseControl.hideCTime)
			}
	},
	offscroll: function(event) {
		if (new Date().getTime() - MouseControl.ScriptUp < 5) {
			return;
		}
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
		MouseControl.down = false;
		MouseControl.dblDown = false;
		MouseControl.inscroll = false;
		//window.removeEventListener("mousemove", MouseControl.moveHandler, true);
	},
	offzoom: function(event) {
		if (new Date().getTime() - MouseControl.ScriptUp < 5) {
			return;
		}
		MouseControl.sdown = false;
		MouseControl.inzoom = false;
		if (MouseControl.ZoomDisplay && MouseControl.ZoomDisp.state != 'closed') {
			MouseControl.ZoomDisp.hidePopup();
		}
		//window.removeEventListener("mousemove", MouseControl.moveHandler, true);
	},
	tabSeld: function() {
		if (!MouseControl.inscroll) {
			if (MouseControl.itabHistory.length == 0 || MouseControl.itabHistory[MouseControl.itabHistory.length - 1] != gBrowser.selectedTab)	{
				MouseControl.itabHistory.push(gBrowser.selectedTab);
			}
		}
		if (MouseControl.inzoom)	{
			MouseControl.offzoom(event);
		}
	},
	tabOpened: function() {
		MouseControl.itabHistory.push(gBrowser.selectedTab);
	},
	tabClosed: function() {
		MouseControl.cleanHistory();
	},
	notify: function(body,title)	{
		if (MouseControl.ns === false) { return }
		if (MouseControl.ns === undefined)	{
			try {
				MouseControl.ns = Components.classes["@mozilla.org/alerts-service;1"].getService(Components.interfaces.nsIAlertsService);
			} catch(e) {
				MouseControl.ns = false; //means doesnt exist
				return false;
			}
		}
		if (!title) { title = 'MouseControl Notification' }
		if (title.indexOf('grade') == -1) {
			MouseControl.ns.showAlertNotification('chrome://MouseControl/skin/icon.png', title, body);
		} else {
			var listener = {
				observe: function(subject, topic, data) {
					if (topic == 'alertclickcallback')	{
						gBrowser.loadOneTab('https://addons.mozilla.org/en-US/firefox/addon/mousecontrol/versions/',null,null,null,false);
					}
				}
			};
			MouseControl.ns.showAlertNotification('chrome://MouseControl/skin/icon.png', title, body, true, null, listener);
		}
	},
	showCover: function() {
return;
		var w = gBrowser.mPanelContainer.boxObject.width;
		var h = gBrowser.mPanelContainer.boxObject.height;
var utils = gBrowser.contentDocument.childNodes[0].ownerDocument.defaultView.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
//utils.suppressEventHandling(true);
		MouseControl.Cover.childNodes[0].style.height = h+'px';
		MouseControl.Cover.childNodes[0].style.width = w+'px';
MouseControl.Cover.childNodes[0].textContent = '||||||||||||||||||||||||';
MouseControl.Cover.popupBoxObject.setConsumeRollupEvent(Components.interfaces.nsIPopupBoxObject.ROLLUP_NO_CONSUME); //dont need this cuz adding no_consome to all popups via listener
		MouseControl.Cover.openPopup(gBrowser.mPanelContainer, 'overlap', 0, 0, false, false);
	},
	hideCover: function() {
		return;
		if (MouseControl.Cover.state == 'open') {
			MouseControl.Cover.hidePopup();
		}
var utils = gBrowser.contentDocument.childNodes[0].ownerDocument.defaultView.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
utils.suppressEventHandling(false);
	},
	coverFUNC: function() {
		for (var i=0; i<MouseControl.covers.length; i++)	{
			var coll = gBrowser.contentDocument.getElementsByTagName(MouseControl.covers[i]);
			for (j=0; j<coll.length; j++)	{
				if (coll[j].offsetWidth > 0)	{
					//test if it is visible
					//cover it
				}
			}
		}
	},
	dump: function(msg,append,where) {
		where = !where ? 'searchbar' : 'urlbar';
		if (append)	{
			document.getElementById(where).value += msg;
		} else {
			document.getElementById(where).value = msg;
		}
	}
};
window.addEventListener("load", MouseControl.register, false);
window.addEventListener("unload", MouseControl.unregister, false);