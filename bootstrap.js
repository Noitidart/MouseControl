// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);
Cu.import('resource://gre/modules/AddonManager.jsm');
Cu.import('resource://gre/modules/Console.jsm');
const {TextDecoder, TextEncoder, OS} = Cu.import('resource://gre/modules/osfile.jsm', {});
Cu.import('resource://gre/modules/Promise.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Globals
const core = {
	addon: {
		name: 'MouseControl',
		id: 'MouseControl@neocodex.us',
		path: {
			name: 'mousecontrol',
			content: 'chrome://mousecontrol/content/',
			images: 'chrome://mousecontrol/content/resources/images/',
			locale: 'chrome://mousecontrol/locale/',
			modules: 'chrome://mousecontrol/content/modules/',
			resources: 'chrome://mousecontrol/content/resources/',
			scripts: 'chrome://mousecontrol/content/resources/scripts/',
			styles: 'chrome://mousecontrol/content/resources/styles/',
			workers: 'chrome://mousecontrol/content/modules/workers/'
		},
		cache_key: Math.random() // set to version on release
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase(),
		toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version
	}
};
core.os.mname = core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name; // mname stands for modified-name

const JETPACK_DIR_BASENAME = 'jetpack';
const OSPath_simpleStorage = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage');
const OSPath_config = OS.Path.join(OSPath_simpleStorage, 'config.json');
const myPrefBranch = 'extensions.' + core.addon.id + '.';

var ADDON_MANAGER_ENTRY;

// start - beutify stuff
var gBeautify = {};
(function() {
	var { require } = Cu.import('resource://devtools/shared/Loader.jsm', {});
	var { jsBeautify } = require('devtools/shared/jsbeautify/src/beautify-js');
	gBeautify.js = jsBeautify;
}());
// end - beutify stuff

// Global config stuff

var gConfigJson = [];
var gConfigJsonDefault = function() {
	// :todo: once setup server, ensure that these items get the id here. or whatever id they get there submit it here
	// because if id is negative, then that means it hasnt got a server id yet. but i need to keep decrementing the negative id, as i cant have multiple of the same ids
	// on share to server, then the negative id should be replaced with $insertId from server
	return [
		{
			id: 1,
			name: myServices.sb.GetStringFromName('config_name-jumptab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-jumptab'),
			config: core.os.mname == 'gtk' ? [{"std":"B3_DN","multi":1},{"std":"B1_CK","multi":1}] : [{"std":"B2_DN","multi":1},{"std":"B1_CK","multi":1}],
			func: gBeautify.js(uneval({
				__init__: function() {
					$MC_BS_.jumpStore = {};
					var js = $MC_BS_.jumpStore;

					js.tabHistory = [];
					js.onTabSelect = function(e) {
						var tab = e.target;
						if (js.scrollingThruTabs) {
							js.lastScrolledTab = tab;
							console.error('TAB SELECTED but storing as last scroll');
						} else {
							console.error('TAB SELECTED and pushing');
							js.addTabToHistory(tab);
						}
					};
					js.onWindowActivate = function(aTarget) {
						console.log('ok jumptab winactivated');
						if (aTarget.gBrowser) {
							console.log('ok jumptab winactivated HAS GBROWSER');
							var tab = aTarget.gBrowser.selectedTab;
							js.addTabToHistory(tab);
						}
					};

					js.initWin = function(aDOMWin) {
						var aGBrowser = aDOMWin.gBrowser;
						if (!aGBrowser) {
							// window not yet loaded, just return, because i attach the newwindow_ready listener, that will handle initing it
							return;
						}
						aGBrowser.tabContainer.addEventListener('TabSelect', js.onTabSelect, false);
					};
					js.uninitWin = function(aDOMWin) {
						var aGBrowser = aDOMWin.gBrowser;
						aGBrowser.tabContainer.removeEventListener('TabSelect', js.onTabSelect, false);
					};

					js.scrollingThruTabs = false; // for use by nexttab and prevtab
					js.doneScrollingThruTabs = function() {
						js.scrollingThruTabs = false;
						js.addTabToHistory(js.lastScrolledTab);
						$MC_removeEventListener('all_buttons_released', js.doneScrollingThruTabs);
					};

					js.addTabToHistory = function(aTab) {
						// aTab must be a tab not a tab weak!
						var prevTab;
						try {
							prevTab = js.tabHistory[js.tabHistory.length - 1].get();
						} catch(deadobj) {
							// prev tab is dead
							prevTab = null;
						}
						if (!js.tabHistory.length || prevTab != aTab) {
							js.tabHistory.push(Cu.getWeakReference(aTab));
						}
					};

					$MC_addEventListener('newwindow_ready', js.initWin);
					$MC_addEventListener('window_activated', js.onWindowActivate);

					var DOMWindows = Services.wm.getEnumerator('navigator:browser');
					while (DOMWindows.hasMoreElements()) {
						var aDOMWindow = DOMWindows.getNext();
						js.initWin(aDOMWindow);
						if (aDOMWindow == Services.focus.activeWindow) {
							js.tabHistory.push(Cu.getWeakReference(aDOMWindow.gBrowser.selectedTab));
						}
					}


				},
				__exec__: function() {
					var tHist = $MC_BS_.jumpStore.tabHistory;

					var debPrintArr = [];
					for (var i=tHist.length-1; i>=0; i--) {
						try {
							var cTab = tHist[i].get();
							if (cTab == null) {
								console.warn('tab is a dead obj');
								continue; // as its a deadobj
							}
							debPrintArr.push(cTab.linkedBrowser.currentURI.spec);
						} catch(deadobj) {}
					}
					console.log('tHist:', debPrintArr);

					for (var i=tHist.length-1; i>=0; i--) {
						try {
							var cTab = tHist[i].get();
							if (cTab == null) {
								console.warn('tab is a dead obj');
								tHist.splice(i, 1);
								continue; // as its a deadobj
							}
							if (!cTab.parentNode) {
								console.error('tab is no longer open');
								tHist.splice(i, 1);
								continue;
							}
							var cDOMWin = cTab.ownerDocument.defaultView;
							var rightNowWin = Services.wm.getMostRecentWindow(null);
							if (rightNowWin != cDOMWin || !rightNowWin.gBrowser || rightNowWin.gBrowser.selectedTab != cTab) {
								cDOMWin.focus();
								cDOMWin.gBrowser.selectedTab = cTab;
								break;
							}
						} catch(deadobj) {
							console.warn('ok cTab is a dead object remove it, err:', deadobj);
							tHist.splice(i, 1);
						}
					}
				},
				__uninit__: function() {
					$MC_removeEventListener('window_activated', $MC_BS_.jumpStore.onWindowActivate);
					$MC_removeEventListener('newwindow_ready', $MC_BS_.jumpStore.initWin);
					var DOMWindows = Services.wm.getEnumerator('navigator:browser');
					while (DOMWindows.hasMoreElements()) {
						var aDOMWindow = DOMWindows.getNext();
						$MC_BS_.jumpStore.uninitWin(aDOMWindow);
					}
					delete $MC_BS_.jumpStore;
				}
			}))
		},
		{
			id: 2,
			name: myServices.sb.GetStringFromName('config_name-duptab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-duptab'),
			config: core.os.mname == 'gtk' ? [{"std":"B3_CK","multi":1.5,"held":true}] : [{"std":"B2_CK","multi":1.5,"held":true}],
			func: gBeautify.js(uneval({
				__exec__: function() {
					var DOMWindow = Services.wm.getMostRecentWindow(null);
					var gBrowser = DOMWindow.gBrowser;
					if (DOMWindow.document.documentElement.getAttribute('windowtype') == 'navigator:browser') {
						var origsPos = gBrowser.selectedTab._tPos;
						if (prefs['dup-tab-pos'].value == 1) {
							var newPos = origsPos + 1;
						} else {
							var newPos = gBrowser.tabContainer.childNodes.length;
						}

						DOMWindow.duplicateTabIn(DOMWindow.gBrowser.selectedTab, 'tab', 1);

						if (gBrowser.selectedTab._tPos != newPos) {
							gBrowser.moveTabTo(gBrowser.selectedTab, newPos);
						}
					}

				}
			}))
		},
		{
			id: 3,
			name: myServices.sb.GetStringFromName('config_name-newtab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-newtab'),
			config: core.os.mname == 'gtk' ? [{"std":"B3_CK","multi":2}] : [{"std":"B2_CK","multi":2}],
			func: gBeautify.js(uneval({
				__exec__: function() {
					var DOMWindow = Services.wm.getMostRecentWindow(null);
					if (DOMWindow.document.documentElement.getAttribute('windowtype') == 'navigator:browser') {
						var gBrowser = DOMWindow.gBrowser;
						if (prefs['new-tab-pos'].value == 1) {
							var newIndex = gBrowser.selectedTab._tPos + 1;
							DOMWindow.BrowserOpenTab();
							gBrowser.moveTabTo(gBrowser.tabContainer.childNodes[gBrowser.tabContainer.childNodes.length-1], newIndex);
						} else {
							DOMWindow.BrowserOpenTab();
						}
					}
				}
			}))
		},
		{
			id: 4,
			name: myServices.sb.GetStringFromName('config_name-nexttab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-nexttab'),
			config: core.os.mname == 'gtk' ? [{"std":"B3_DN","multi":1},{"std":"WH_DN","multi":1}] : [{"std":"B2_DN","multi":1},{"std":"WH_DN","multi":1}],
			func: gBeautify.js(uneval({
				__exec__: function() {
					if ($MC_BS_.jumpStore) {
						$MC_BS_.jumpStore.scrollingThruTabs = true;
						$MC_addEventListener('all_buttons_released', $MC_BS_.jumpStore.doneScrollingThruTabs);
					}
					var DOMWindow = Services.wm.getMostRecentWindow(null);
					if (DOMWindow.document.documentElement.getAttribute('windowtype') == 'alert:alert') {
						DOMWindow = Services.wm.getMostRecentWindow('navigator:browser');
					}
					if (DOMWindow && DOMWindow.gBrowser && DOMWindow.gBrowser.mTabContainer) {
						DOMWindow.gBrowser.mTabContainer.advanceSelectedTab(1, true);
					}
				}
			}))
		},
		{
			id: 5,
			name: myServices.sb.GetStringFromName('config_name-prevtab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-prevtab'),
			config: core.os.mname == 'gtk' ? [{"std":"B3_DN","multi":1},{"std":"WH_UP","multi":1}] : [{"std":"B2_DN","multi":1},{"std":"WH_UP","multi":1}],
			func: gBeautify.js(uneval({
				__exec__: function() {
					if ($MC_BS_.jumpStore) {
						$MC_BS_.jumpStore.scrollingThruTabs = true;
						$MC_addEventListener('all_buttons_released', $MC_BS_.jumpStore.doneScrollingThruTabs);
					}
					var DOMWindow = Services.wm.getMostRecentWindow(null);
					if (DOMWindow.document.documentElement.getAttribute('windowtype') == 'alert:alert') {
						DOMWindow = Services.wm.getMostRecentWindow('navigator:browser');
					}
					if (DOMWindow && DOMWindow.gBrowser && DOMWindow.gBrowser.mTabContainer) {
						DOMWindow.gBrowser.mTabContainer.advanceSelectedTab(-1, true);
					}
				}
			}))
		},
		{
			id: 6,
			name: myServices.sb.GetStringFromName('config_name-closetab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-closetab'),
			config: core.os.mname == 'gtk' ? [{"std":"B3_DN","multi":1},{"std":"B2_CK","multi":1}] : [{"std":"B2_DN","multi":1},{"std":"B3_CK","multi":1}],
			func: gBeautify.js(uneval({
				__exec__: function() {

					if ($MC_BS_.undoStoreForClose && $MC_BS_.undoStoreForClose.justundid) {
						delete $MC_BS_.undoStoreForClose.justundid;
						return;
					}

					var closesitesConfigId = 15;
					if ($MC_overlaps(closesitesConfigId, this)) {
						$MC_BS_.closeTabStoreForSites = {};
					} else {
						delete $MC_BS_.closeTabStoreForSites;
					}

					var DOMWindow = Services.wm.getMostRecentWindow(null);
					if (!DOMWindow.gBrowser || DOMWindow.gBrowser.tabContainer.childNodes.length === 1) {
						if ($MC_BS_.closeTabStoreForSites) {
							$MC_BS_.closeTabStoreForSites.closesitetabsPreventDefault = true;
						}
						// just close the window
						DOMWindow.close();
						return;
					}

					if ($MC_BS_.closeTabStoreForSites) {
						$MC_BS_.closeTabStoreForSites.lasturi = DOMWindow.gBrowser.selectedBrowser.currentURI;
					}

					DOMWindow.BrowserCloseTabOrWindow();
				},
				__uninit__: function() {
					delete $MC_BS_.closeTabStoreForSites;
					delete $MC_BS_.closeTabStoreForUndo;
				}
			}))
		},
		{
			id: 7,
			name: myServices.sb.GetStringFromName('config_name-resetzoom'),
			group: myServices.sb.GetStringFromName('config_group-zoom'),
			desc: myServices.sb.GetStringFromName('config_desc-resetzoom'),
			config: core.os.mname == 'gtk' ? [{"std":"B1_DN","multi":1},{"std":"B2_CK","multi":1}] : [{"std":"B1_DN","multi":1},{"std":"B3_CK","multi":1}],
			func: gBeautify.js(uneval({
				__exec__: function() {
					var domWin = Services.wm.getMostRecentWindow('navigator:browser');
					domWin.FullZoom.reset();

					$MC_BS_.zoomStore.updateIndicator(domWin, domWin.ZoomManager.zoom);
				}
			}))
		},
		{
			id: 8,
			name: myServices.sb.GetStringFromName('config_name-zoomin'),
			group: myServices.sb.GetStringFromName('config_group-zoom'),
			desc: myServices.sb.GetStringFromName('config_desc-zoomin'),
			config: core.os.mname == 'gtk' ? [{"std":"B1_DN","multi":1},{"std":"WH_UP","multi":1}] : [{"std":"B1_DN","multi":1},{"std":"WH_UP","multi":1}],
			func: gBeautify.js(uneval({
				__init__: function() {

					$MC_BS_.zoomStore = {
						prefs: { // holds what the values of the prefs were on init
							context: prefs['zoom-context'].value,
							indicator: prefs['zoom-indicator'].value,
							style: prefs['zoom-style'].value
						}
					};
					var zs = $MC_BS_.zoomStore;

					Services.prefs.setBoolPref('browser.zoom.full', zs.prefs.context === 0 ? true : false);

					// if (styleChanged) {
						switch(zs.prefs.style) {
							case 0:

									// global
									Services.prefs.setBoolPref('browser.zoom.siteSpecific', true);

									zs.cps = Cc['@mozilla.org/content-pref/service;1'].getService(Ci.nsIContentPrefService2);
									zs.removeAllButGlobal = function() {
										var domainsToRemoveFor = [];
										zs.cps.getByName('browser.content.full-zoom', null, {
											handleResult: function(aPref) {
												console.log('in handle result, args:', arguments)
												if (aPref.domain) {
													domainsToRemoveFor.push(aPref.domain);
												} // else its null, so that means its the global value
											},
											handleCompletion: function() {
												console.log('ok complete, args:', arguments)

												for (var i=0; i<domainsToRemoveFor.length; i++) {
													console.log('removing for domain:', domainsToRemoveFor[i]);
													zs.cps.removeByDomainAndName(domainsToRemoveFor[i], 'browser.content.full-zoom', null);
												}
											}
										});
									};
									zs.applyZoomToAllDomains = function(aNewZoom, boolDontSetGlobal, boolRemoveAll) {
										// sets the zoom level of all currently open domains to aNewZoom
											// including global zoom value

										// get all currently open domains, and set site specific for each domain so they update in background, then remove all
										var allDomains = new Set();
										var domWins = Services.wm.getEnumerator('navigator:browser');
										while (domWins.hasMoreElements()) {
											var domWin = domWins.getNext();
											var gbrowser = domWin.gBrowser;
											var cntBrowsers = gbrowser.browsers.length;
											for (var i=0; i<cntBrowsers; i++) {
												// e10s safe way to check uri of all browsers
												console.log(i, gbrowser.browsers[i].currentURI.spec);
												allDomains.add(zs.cps.extractDomain(gbrowser.browsers[i].currentURI.spec));
											}
										}

										var promiseAllArr_siteSpecificSet = [];

										if (!boolDontSetGlobal) {
											var deferred_globalSet = new Deferred();
											promiseAllArr_siteSpecificSet.push(deferred_globalSet.promise);
											zs.cps.setGlobal('browser.content.full-zoom', aNewZoom, null, {
												handleCompletion: function() {
													console.log('ok complete, args:', arguments);
													// remove all site specific so each zoom goes to the global value of the one i just set
													deferred_globalSet.resolve(); // i put in the oncomplete, so it doesnt change it to what ever global is then bounce back to this new value
												}
											});
										}

										allDomains.forEach(function(domain) {
											var deferred_siteSpecificSet = new Deferred();
											promiseAllArr_siteSpecificSet.push(promiseAllArr_siteSpecificSet.promise);

											// set zoom for this domain
											zs.cps.set(domain, 'browser.content.full-zoom', aNewZoom, null, {
												handleCompletion: function() {
													console.log('ok set for domain', domain, 'args:', arguments[0].domain);
													deferred_siteSpecificSet.resolve();
												}
											});
										});

										var promiseAll_siteSpecificSet = Promise.all(promiseAllArr_siteSpecificSet);
										promiseAll_siteSpecificSet.then(
											function(aVal) {
												console.log('Fullfilled - promiseAll_siteSpecificSet - ', aVal);

												if (boolRemoveAll) {
													zs.cps.removeByName('browser.content.full-zoom', null);
												} else {
													// remove all site specific so each zoom goes to the global value of the one i just set
													zs.removeAllButGlobal(); // i put in the oncomplete, so it doesnt change it to what ever global is then bounce back to this new value
												}
											},
											genericReject.bind(null, 'promiseAll_siteSpecificSet', 0)
										).catch(genericCatch.bind(null, 'promiseAll_siteSpecificSet', 0));
									};
									zs.Observes = {
										observers: {
											'browser-fullZoom:zoomReset': function (aSubject, aTopic, aData) {
												console.log('zoom reset!', aSubject, aTopic, aData);

												// have to do this because see link99993
												// CPS2.setGlobal('browser.content.full-zoom', 1, null);

												zs.applyZoomToAllDomains(1);
											},
											'browser-fullZoom:zoomChange': function (aSubject, aTopic, aData) {
												console.log('zoom changed!', aSubject, aTopic, aData);

												var newZoom = Services.wm.getMostRecentWindow('navigator:browser').ZoomManager.zoom;
												console.log('newZoom:', newZoom);

												zs.applyZoomToAllDomains(newZoom);
											}
										},
										init: function() {
											console.error('this:', this);
											console.log('this.observers:', this.observers);
											for (var o in this.observers) {
												console.log('initing o:', o);

												// register it
												// make it an object so i can addObserver and removeObserver to it
												zs.Observes.observers[o] = {
													observe: this.observers[o]
												};
												Services.obs.addObserver(this.observers[o], o, false);
											}
										},
										uninit: function() {
											for (var o in this.observers) {
												// unregister it
												Services.obs.removeObserver(this.observers[o], o);

												// restore it as a function so it can be re-inited
												this.observers[o] = this.observers[o].observe;
											}
										}
									};

									// remove all currently site site specific stuff - this will instantly (because observers are setup by the FullZoom module) change zoom to the global value default of 1 per dxr - https://dxr.mozilla.org/mozilla-central/source/browser/base/content/browser-fullZoom.js#281 - `value === undefined ? 1 : value` because value there is the global default value // link99993
									zs.removeAllButGlobal();

									zs.Observes.init();

								break;
							default:

								Services.prefs.setBoolPref('browser.zoom.siteSpecific', zs.prefs.style === 1 ? true /*sitespec*/ : false /*tabspec*/);

						}
					// }

					var thisFuncObj = this;
					zs.prefChange = function(aTarget) {
						if (aTarget.name == 'zoom-context') {
							Services.prefs.setBoolPref('browser.zoom.full', aTarget.newval === 0 ? true : false);
						} else if (aTarget.name == 'zoom-style') {
							_cache_func[$MC_getConfig(thisFuncObj).id].__uninit__();
							_cache_func[$MC_getConfig(thisFuncObj).id].__init__();
						}
					};
					$MC_addEventListener('setpref_from_options', zs.prefChange);

					zs.hideAllIndicator = function() {
						if (prefs['zoom-indicator'].value) {
							var DOMWindows = Services.wm.getEnumerator('navigator:browser');
							while (DOMWindows.hasMoreElements()) {
								var aDOMWindow = DOMWindows.getNext();
								var domElIndic = aDOMWindow.document.getElementById('MC_zoomIndic');
								if (domElIndic) {
									domElIndic.hidePopup();
								}
							}
						}
					};

					zs.updateIndicator = function(aDOMWin, aZoomLevel) {
						if (prefs['zoom-indicator'].value) {
							var domElIndic = aDOMWin.document.getElementById('MC_zoomIndic');
							if (!domElIndic) {
								domElIndic = aDOMWin.document.createElement('panel');
								domElIndic.setAttribute('id', 'MC_zoomIndic');
								domElIndic.setAttribute('style','-moz-appearance:none;-moz-border-radius:10px;border-radius:20px;background-color:#f9f9f9;border:1px solid #AAA;opacity:.9;color:#336666;font-weight:bold;font-size:40px;padding:0px 15px 3px 15px;text-shadow:#AAA 2px 2px 4px;');
								domElIndic.setAttribute('noautohide',true);
								domElIndic.setAttribute('noautofocus',true);

								var domElLbl = aDOMWin.document.createElement('label');
								domElLbl.setAttribute('style','margin:0;padding:0;text-align:center;');
								domElIndic.appendChild(domElLbl);
								aDOMWin.document.getElementById('content').appendChild(domElIndic);

								domElIndic.addEventListener('popuphidden', function() {
									domElIndic.parentNode.removeChild(domElIndic);
								}, false);
							}

							domElIndic.childNodes[0].textContent = Math.round(aZoomLevel * 100) + '%';

							if (domElIndic.state != 'open') {
								domElIndic.openPopup(aDOMWin.gBrowser.mPanelContainer, 'overlap', 5, 5, false, false);
							}
						}
					};
					$MC_addEventListener('all_buttons_released', zs.hideAllIndicator);

				},
				__exec__: function() {

					var domWin = Services.wm.getMostRecentWindow('navigator:browser');
					domWin.FullZoom.enlarge();

					$MC_BS_.zoomStore.updateIndicator(domWin, domWin.ZoomManager.zoom);
				},
				__uninit__: function(aReason) {
					if ($MC_BS_.zoomStore.prefs.style === 0) {
						// it was global
						$MC_BS_.zoomStore.applyZoomToAllDomains(1, true, true);
						$MC_BS_.zoomStore.Observes.uninit();
					}

					$MC_removeEventListener('all_buttons_released', $MC_BS_.zoomStore.hideAllIndicator);
					$MC_removeEventListener('setpref_from_options', $MC_BS_.zoomStore.prefChange);

					delete $MC_BS_.zoomStore;
				}
			}))
		},
		{
			id: 9,
			name: myServices.sb.GetStringFromName('config_name-zoomout'),
			group: myServices.sb.GetStringFromName('config_group-zoom'),
			desc: myServices.sb.GetStringFromName('config_desc-zoomout'),
			config: core.os.mname == 'gtk' ? [{"std":"B1_DN","multi":1},{"std":"WH_DN","multi":1}] : [{"std":"B1_DN","multi":1},{"std":"WH_DN","multi":1}],
			func: gBeautify.js(uneval({
				__exec__: function() {
					var domWin = Services.wm.getMostRecentWindow('navigator:browser');
					domWin.FullZoom.reduce();

					$MC_BS_.zoomStore.updateIndicator(domWin, domWin.ZoomManager.zoom);
				}
			}))
		},
		{
			id: 10,
			name: myServices.sb.GetStringFromName('config_name-removeel'),
			group: myServices.sb.GetStringFromName('config_group-dom'),
			desc: myServices.sb.GetStringFromName('config_desc-removeel'),
			config: core.os.mname == 'gtk' ? [{"std":"B1_DN","multi":1},{"std":"B3_CK","multi":1}] : [{"std":"B1_DN","multi":1},{"std":"B2_CK","multi":1}],
			func: gBeautify.js(uneval({
				__init__: function() {
					$MC_BS_.RemElStore = {
						onFsCreated: function(aTarget) {
							// runs in bootstrap scope
							// aTarget is a messageManager
							$MC_execInTab($MC_BS_.RemElStore.fsInjectInit, null, {tab:aTarget});
						},
						onFsUninit: function(aTarget) {
							// runs in bootstrap scope
							// aTarget is a messageManager
							$MC_execInTab($MC_BS_.RemElStore.fsInjectUninit, null, {tab:aTarget});
						},
						fsInjectInit: function() {
							// runs in framescript scope
							$MC_FS_.RemElStore = {
								exec: function() {
									// executes the removal
									var el = $MC_FS_.RemElStore.el;
									console.error('ok execing on el:', el);
									if (el) {
										el.parentNode.removeChild(el);
										$MC_FS_.RemElStore.el = null;
										console.error('ok execd');
									}
								},
								ondown: function(e) {
									$MC_FS_.RemElStore.el = e.target;
									console.error('this.el:', $MC_FS_.RemElStore.el);
								},
								onover: function(e) {
									$MC_FS_.RemElStore.el = e.target;
									console.error('over this.el:', $MC_FS_.RemElStore.el);
								}
							};

							addEventListener('mousedown', $MC_FS_.RemElStore.ondown, false);
						},
						fsInjectUninit: function() {
							// runs in framescript scope
							removeEventListener('mousedown', $MC_FS_.RemElStore.ondown, false);
							delete $MC_FS_.RemElStore;
						},
						doneExec: function() {
							$MC_execInTab(
								function() {
									removeEventListener('mouseover', $MC_FS_.RemElStore.onover, false);
								}
							);
						}
					};

					console.log('$MC_BS_:', $MC_BS_);
					$MC_execInAllTabs($MC_BS_.RemElStore.fsInjectInit);
					$MC_addEventListener('framescript_created', $MC_BS_.RemElStore.onFsCreated);
					$MC_addEventListener('framescript_uninit', $MC_BS_.RemElStore.onFsUninit);
				},
				__uninit__: function() {
					$MC_removeEventListener('framescript_created', $MC_BS_.RemElStore.onFsCreated);
					$MC_removeEventListener('framescript_uninit', $MC_BS_.RemElStore.onFsUninit);

					$MC_execInAllTabs($MC_BS_.RemElStore.fsInjectUninit);
					delete $MC_BS_.RemElStore;
				},
				__exec__: function() {
					$MC_addEventListener('all_buttons_released', $MC_BS_.RemElStore.doneExec);
					$MC_execInTab(
						function() {
							addEventListener('mouseover', $MC_FS_.RemElStore.onover, false);
							$MC_FS_.RemElStore.exec();
						}
					);
				}
			}))
		},
		{
			id: 11,
			name: myServices.sb.GetStringFromName('config_name-memscrolltop'),
			group: myServices.sb.GetStringFromName('config_group-dom'),
			desc: myServices.sb.GetStringFromName('config_desc-memscrolltop'),
			config: [],
			func: gBeautify.js(uneval({
				__exec__: function() {
					$MC_execInTab(
						function() {
							var contentWithFocus = $MC_FS_getDeepestFocusedContentWindow(content);
							console.log('contentWithFocus:', contentWithFocus);

							var activeDomEl = contentWithFocus.document.activeElement;
							if (!activeDomEl || !activeDomEl.scrollTopMax) {
								activeDomEl = contentWithFocus.document.documentElement;
							}

							console.log('activeDomEl:', activeDomEl, activeDomEl.scrollTop, activeDomEl.scrollTopMin, activeDomEl.scrollTopMax);

							if (activeDomEl.scrollTop > 0 && activeDomEl.scrollTop < activeDomEl.scrollTopMax) {
								$MC_FS_.memScrollStore = {
									el: activeDomEl,
									top: activeDomEl.scrollTop
								};
							}

							activeDomEl.scrollTop = activeDomEl.scrollTopMin;
						}
					);
				},
				__uninit__: function() {
					$MC_execInAllTabs(
						function() {
							delete $MC_FS_.memScrollStore;
						}
					);
				}
			}))
		},
		{
			id: 12,
			name: myServices.sb.GetStringFromName('config_name-memscrollbot'),
			group: myServices.sb.GetStringFromName('config_group-dom'),
			desc: myServices.sb.GetStringFromName('config_desc-memscrollbot'),
			config: [],
			func: gBeautify.js(uneval({
				__exec__: function() {
					$MC_execInTab(
						function() {
							var contentWithFocus = $MC_FS_getDeepestFocusedContentWindow(content);
							console.log('contentWithFocus:', contentWithFocus);

							var activeDomEl = contentWithFocus.document.activeElement;
							if (!activeDomEl || !activeDomEl.scrollTopMax) {
								activeDomEl = contentWithFocus.document.documentElement;
							}

							console.log('activeDomEl:', activeDomEl, activeDomEl.scrollTop, activeDomEl.scrollTopMin, activeDomEl.scrollTopMax);

							if (activeDomEl.scrollTop > 0 && activeDomEl.scrollTop < activeDomEl.scrollTopMax) {
								$MC_FS_.memScrollStore = {
									el: activeDomEl,
									top: activeDomEl.scrollTop
								};
							}

							activeDomEl.scrollTop = activeDomEl.scrollTopMax;
						}
					);
				},
				__uninit__: function() {
					$MC_execInAllTabs(
						function() {
							delete $MC_FS_.memScrollStore;
						}
					);
				}
			}))
		},
		{
			id: 13,
			name: myServices.sb.GetStringFromName('config_name-memscrollmemy'),
			group: myServices.sb.GetStringFromName('config_group-dom'),
			desc: myServices.sb.GetStringFromName('config_desc-memscrollmemy'),
			config: [],
			func: gBeautify.js(uneval({
				__exec__: function() {
					$MC_execInTab(
						function() {
							if ($MC_FS_.memScrollStore) {
								var contentWithFocus = $MC_FS_getDeepestFocusedContentWindow(content);
								console.log('contentWithFocus:', contentWithFocus);

								var activeDomEl = contentWithFocus.document.activeElement;
								if (!activeDomEl || !activeDomEl.scrollTopMax) {
									activeDomEl = contentWithFocus.document.documentElement;
								}

								try {
									// make sure $MC_FS_.memScrollStore.el is not a dead object
									String($MC_FS_.memScrollStore.el);
								} catch(ignore) {
									// its a dead object, so obviusl its not === activeDomEl
									console.error('ITS A DEAD OBJECT WRAPPER, ex:', ignore);
									delete $MC_FS_.memScrollStore;
									return;
								}

								if (activeDomEl == $MC_FS_.memScrollStore.el) {
									activeDomEl.scrollTop = $MC_FS_.memScrollStore.top;
								} else {
									console.error('MISMATCH BETWEEEN activeDomEl and store el!', activeDomEl, $MC_FS_.memScrollStore.el);
								}
							}
						}
					);
				},
				__uninit__: function() {
					$MC_execInAllTabs(
						function() {
							delete $MC_FS_.memScrollStore;
						}
					);
				}
			}))
		},
		{
			id: 14,
			name: myServices.sb.GetStringFromName('config_name-undoclosetab'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-undoclosetab'),
			config: core.os.mname == 'gtk' ? [{"std":"B3_DN","multi":1},{"std":"B2_DN","multi":1,"held":true}] : [{"std":"B2_DN","multi":1},{"std":"B3_DN","multi":1,"held":true}],
			func: gBeautify.js(uneval({
				__exec__: function() {

					var closetabConfigId = 6;
					if ($MC_overlaps(closetabConfigId, this, true) == 0.6) {
						$MC_BS_.undoStoreForClose = {};
					} else {
						delete $MC_BS_.undoStoreForClose;
					}

					var DOMWindow = Services.wm.getMostRecentWindow('navigator:browser');
					// :todo: maybe add in here to undo the last closed window. if a window was closed last and not a tab.

					if (DOMWindow) {
						if ($MC_BS_.undoStoreForClose) {
							$MC_BS_.undoStoreForClose.justundid = true;
						}
						DOMWindow.undoCloseTab();
					}
				},
				__uninit__: function() {
					delete $MC_BS_.undoStoreForClose;
				}
			}))
		},
		{
			id: 15,
			name: myServices.sb.GetStringFromName('config_name-closesitetabs'),
			group: myServices.sb.GetStringFromName('config_group-tabs'),
			desc: myServices.sb.GetStringFromName('config_desc-closesitetabs'),
			config: core.os.mname == 'gtk' ? [{"std":"B3_DN","multi":1},{"std":"B2_CK","multi":2}] : [{"std":"B2_DN","multi":1},{"std":"B3_CK","multi":2}],
			func: gBeautify.js(uneval({
				__exec__: function() {
					var DOMWindow = Services.wm.getMostRecentWindow(null);
					if (!DOMWindow.gBrowser) {
						return;
					}

					if ($MC_BS_.closeTabStoreForSites) {
						if ($MC_BS_.closeTabStoreForSites.closesitetabsPreventDefault) {
							delete $MC_BS_.closeTabStoreForSites.closesitetabsPreventDefault;
							return;
						}
					}

					var extractHost = function(aURI) {
						try {
							if (aURI.host) {
								return aURI.host;
							}
						} catch(ignore) {}

						if (aURI.spec.toLowerCase().indexOf('about:') === 0) {
							return aURI.spec.toLowerCase().match(/about\:[a-z]*/i)[0];
						} else {
							return aURI.spec;
						}
					};

					var targetHost;
					if (!$MC_BS_.closeTabStoreForSites) {
						var selectedTab = DOMWindow.gBrowser.selectedTab;
						targetHost = extractHost(selectedTab.linkedBrowser.currentURI);

						DOMWindow.BrowserCloseTabOrWindow();
					} else {
						targetHost = extractHost($MC_BS_.closeTabStoreForSites.lasturi);
						delete $MC_BS_.closeTabStoreForSites.lasturi;
					}

					var tabsToClose = [];

					var cTabs = DOMWindow.gBrowser.tabContainer.childNodes;
					for (var i=0; i<cTabs.length; i++) {
						var cHost = extractHost(cTabs[i].linkedBrowser.currentURI);
						if (cHost == targetHost) {
							tabsToClose.push(cTabs[i]);
						}
					}

					for (var i=0; i<tabsToClose.length; i++) {
						DOMWindow.gBrowser.removeTab(tabsToClose[i]);
					}
				}
			}))
		},
	];
};

// Preferences
// custom - -1, must specify an getter and setter on value
// Ci.nsIPrefBranch.PREF_INVALID 0
// Ci.nsIPrefBranch.PREF_STRING 32
// Ci.nsIPrefBranch.PREF_INT 64
// Ci.nsIPrefBranch.PREF_BOOL 128
var prefs = {
	autoup: {
		default: true,
		type: -1, // -1 means custom
		values: [false, true],
		get value () { // false - disabled, true - enabled - uses the autoUpdateDefault value to convert default value

			var deferredMain_autoup = new Deferred();

			if (ADDON_MANAGER_ENTRY) {
				// block link16515151
				var autoupRaw = parseInt(ADDON_MANAGER_ENTRY.applyBackgroundUpdates); // have to parseInt because its string
				// addon.applyBackgroundUpdates = '0'; // off
				// addon.applyBackgroundUpdates = '1'; // default
				// addon.applyBackgroundUpdates = '2'; // on

				if (autoupRaw === 1) {
					AddonManager.autoUpdateDefault ? deferredMain_autoup.resolve(true) : deferredMain_autoup.resolve(false);
					// return AddonManager.autoUpdateDefault ? true : false;
				} else if (autoupRaw === 0) {
					deferredMain_autoup.resolve(false);
					// return false;
				} else if (autoupRaw === 2) {
					deferredMain_autoup.resolve(true);
					// return true;
				} else {
					console.error('should never ever get here');
				}
				// end block link16515151
			} else {
				AddonManager.getAddonByID(core.addon.id, function(addon_manager_entry) {
					// addon.applyBackgroundUpdates = '0'; //off
					// addon.applyBackgroundUpdates = '1'; //default
					// addon.applyBackgroundUpdates = '2'; //on
					ADDON_MANAGER_ENTRY = addon_manager_entry;

					// copy of block link16515151
					var autoupRaw = parseInt(ADDON_MANAGER_ENTRY.applyBackgroundUpdates); // have to parseInt because its string
					// addon.applyBackgroundUpdates = '0'; // off
					// addon.applyBackgroundUpdates = '1'; // default
					// addon.applyBackgroundUpdates = '2'; // on

					if (autoupRaw === 1) {
						AddonManager.autoUpdateDefault ? deferredMain_autoup.resolve(true) : deferredMain_autoup.resolve(false);
						// return AddonManager.autoUpdateDefault ? true : false;
					} else if (autoupRaw === 0) {
						deferredMain_autoup.resolve(false);
						// return false;
					} else if (autoupRaw === 2) {
						deferredMain_autoup.resolve(true);
						// return true;
					} else {
						console.error('should never ever get here');
					}
					// end copy of block link16515151
				});
			}

			return deferredMain_autoup.promise;
		},
		set value (aApplyBackgroundUpdates) {
				// addon.applyBackgroundUpdates = '0'; // off
				// addon.applyBackgroundUpdates = '1'; // default
				// addon.applyBackgroundUpdates = '2'; // on
				console.error('doing set on applyBackgroundUpdates, aApplyBackgroundUpdates is:', aApplyBackgroundUpdates);
				if ([0, 1, 2, '0', '1', '2', 'true', 'false', false, true].indexOf(aApplyBackgroundUpdates) == -1) {
					console.error('WARN will not set pref, prefName:', 'autoup', 'to val:', aApplyBackgroundUpdates, 'because it has a list of accepted values, and the aNewVal is not among them, the accepted values are:', [0, 1, 2, '0', '1', '2']);
				} else {
					aApplyBackgroundUpdates = ensureBool(aApplyBackgroundUpdates); // ok to use ensureBool here, as the if in the top did the === check
					if (aApplyBackgroundUpdates) {
						// user set to on
						if (AddonManager.autoUpdateDefault) {
							// meaning default setting is ON, so set it to DEFAULT
							aApplyBackgroundUpdates = 1;
						} else {
							// meaning default setting is OFF, so set it to ON
							aApplyBackgroundUpdates = 2;
						}
					} else {
						// user set to off
						if (AddonManager.autoUpdateDefault) {
							// meaning default setting is ON, so set it to OFF
							aApplyBackgroundUpdates = 0;
						} else {
							// meaning default setting is OFF, so set it to DEFAULT
							aApplyBackgroundUpdates = 1;
						}
					}
					if (ADDON_MANAGER_ENTRY) {
						ADDON_MANAGER_ENTRY.applyBackgroundUpdates = aApplyBackgroundUpdates;
					} else {
						AddonManager.getAddonByID(core.addon.id, function(addon_manager_entry) {
							ADDON_MANAGER_ENTRY = addon_manager_entry;
							ADDON_MANAGER_ENTRY.applyBackgroundUpdates = aApplyBackgroundUpdates;
						});
					}
				}
		}
	},
	'zoom-context': {
		default: 0,
		type: Ci.nsIPrefBranch.PREF_INT,
		values: [0, 1]
		// values
			// 0 - all content
			// 1 - text only
	},
	'zoom-indicator': {
		default: true,
		type: Ci.nsIPrefBranch.PREF_BOOL
		// values
			// true - show
			// false - hide
	},
	'zoom-style': {
		default: 1,
		type: Ci.nsIPrefBranch.PREF_INT,
		values: [0, 1, 2]
		// values
			// 0 - global
			// 1 - site specific
			// 2 - tab specific
	},
	'multi-speed': {
		default: 200,
		type: Ci.nsIPrefBranch.PREF_INT
	},
	'hold-duration': {
		default: 300,
		type: Ci.nsIPrefBranch.PREF_INT
	},
	/*
	'click-speed': {
		default: 200,
		type: Ci.nsIPrefBranch.PREF_INT
	},
	*/
	'ignore-autorepeat-duration': {
		default: 25,
		type: Ci.nsIPrefBranch.PREF_INT
	},
	'new-tab-pos': {
		default: 1,
		values: [0, 1],
		type: Ci.nsIPrefBranch.PREF_INT
		// values
			// 0 - end of tab bar
			// 1 - next to current tab
	},
	'dup-tab-pos': {
		default: 1,
		values: [0, 1],
		type: Ci.nsIPrefBranch.PREF_INT
		// values
			// 0 - end of tab bar
			// 1 - next to current tab
	}
};

// set up getters and setters on .value
function prefGetter(aPrefName) {
	var typeAsStr = prefTypeAsStr(prefs[aPrefName].type);

	try {
		var rez_pref_val = Services.prefs['get' + typeAsStr + 'Pref'](myPrefBranch + aPrefName);
	} catch (ex) {
		// probably the pref doesnt exist
		return prefs[aPrefName].default;
	}

	if (prefs[aPrefName].values && prefs[aPrefName].values.indexOf(rez_pref_val) === -1) {
		console.error('WARN will not return gotten pref from pref system, will return default. BECAUSE gotten pref from pref system is:', rez_pref_val, 'and this prefName has a list of accepted values, and the aNewVal is not among them, the accepted values are:', prefs[aPrefName].values);
		return prefs[aPrefName].default;
	} else {
		return rez_pref_val;
	}
}

function prefSetter(aPrefName, aNewVal) {
	if (prefs[aPrefName].values && prefs[aPrefName].values.indexOf(aNewVal) == -1) {
		console.error('WARN will not set pref, prefName:', aPrefName, 'to val:', aNewVal, 'because it has a list of accepted values, and the aNewVal is not among them, the accepted values are:', prefs[aPrefName].values);
		return false;
	} else if (prefs[aPrefName].type == Ci.nsIPrefBranch.PREF_INT && (isNaN(aNewVal) || aNewVal === '')) {
		console.error('WARN will not set pref, prefName:', aPrefName, 'to val:', aNewVal, 'because its type is PREF_INT and aNewVal isNaN or blank string');
		return false;
	}

	var typeAsStr = prefTypeAsStr(prefs[aPrefName].type);

	try {
		Services.prefs['set' + typeAsStr + 'Pref'](myPrefBranch + aPrefName, aNewVal);
		console.error('ok set aPrefName:', aPrefName, 'to aNewVal:', aNewVal);
		return true;
	} catch (ex) {
		console.error('error when setting pref, prefName:', aPrefName, 'to val:', aNewVal, 'ex:', ex);
	}
}
for (var aPrefName in prefs) {
	if (prefs[aPrefName].type != -1) {

		// set the values arr on bool type
		if (prefs[aPrefName].type == Ci.nsIPrefBranch.PREF_BOOL) {
			prefs[aPrefName].values = [0, 1, false, true]; // it seems firefox pref system stores them as 0 or 1, not as false or true
		}

		// set the setter and getter
		Object.defineProperty(prefs[aPrefName], 'value', {
			get: prefGetter.bind(null, aPrefName),
			set: prefSetter.bind(null, aPrefName)
		});
	}
}

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'hph', function () { return Cc['@mozilla.org/network/protocol;1?name=http'].getService(Ci.nsIHttpProtocolHandler); });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });


// START - Addon Functionalities
// start - about module
// start - about module
var aboutFactory_instance;
function AboutPage() {}

function initAndRegisterAbout() {
	// init it
	AboutPage.prototype = Object.freeze({
		classDescription: 'Preferences for MouseControl',
		contractID: '@mozilla.org/network/protocol/about;1?what=mousecontrol',
		classID: Components.ID('{56d1f290-5310-11e5-b970-0800200c9a66}'),
		QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

		getURIFlags: function(aURI) {
			return Ci.nsIAboutModule.ALLOW_SCRIPT;
		},

		newChannel: function(aURI, aSecurity_or_aLoadInfo) {
			var redirUrl = core.addon.path.content + 'ng-prefs.xhtml';

			var channel;
			if (Services.vc.compare(core.firefox.version, '47.*') > 0) {
				var redirURI = Services.io.newURI(redirUrl, null, null);
				channel = Services.io.newChannelFromURIWithLoadInfo(redirURI, aSecurity_or_aLoadInfo);
			} else {
				channel = Services.io.newChannel(redirUrl, null, null);
			}
			channel.originalURI = aURI;

			return channel;
		}
	});

	// register it
	aboutFactory_instance = new AboutFactory(AboutPage);

	console.log('aboutFactory_instance:', aboutFactory_instance);
}

function AboutFactory(component) {
	this.createInstance = function(outer, iid) {
		if (outer) {
			throw Cr.NS_ERROR_NO_AGGREGATION;
		}
		return new component();
	};
	this.register = function() {
		Cm.registerFactory(component.prototype.classID, component.prototype.classDescription, component.prototype.contractID, this);
	};
	this.unregister = function() {
		Cm.unregisterFactory(component.prototype.classID, this);
	}
	Object.freeze(this);
	this.register();
}
// end - about module

var OSStuff = {};
var infoObjForWorker = {};
var MMWorkerThreadId;
var MMWorkerFuncs = {
	init: function(aInitInfoObj) {
		console.log('ok Comm and MM workers are inited');

		// send init info obj of MMWorker to CommWorker, along with multiClickSpeed, holdDuration, and config
			// CommWorker will create a shareable int which will be dowhat int. and a 4th which will be shareable string of 40 characters. this will hold the address of the json that MMWorker should read then upate its json. then it should set dowhat saying its done.
			// also needs shareable int for length of string arr
		infoObjForWorker = {}; // this is a concise info obj for worker // this is what will be transfered to MMWorker, via shared string json, so it can read it even during js thread lock, while c callbacks are running

		// steup prefs for worker
		infoObjForWorker.prefs = {};
		infoObjForWorker.prefs['multi-speed'] = prefs['multi-speed'].value;
		infoObjForWorker.prefs['hold-duration'] = prefs['hold-duration'].value;
		// infoObjForWorker.prefs['click-speed'] = prefs['click-speed'].value;
		infoObjForWorker.prefs['ignore-autorepeat-duration'] = prefs['ignore-autorepeat-duration'].value;

		// setup config for worker
		infoObjForWorker.config = {};
		for (var i=0; i<gConfigJson.length; i++) {
			if (gConfigJson[i].config.length) { // will not tell worker about any config that has blank config arr
				infoObjForWorker.config[gConfigJson[i].id] = gConfigJson[i].config;
			}
		}

		// if (core.os.toolkit.indexOf('gtk') == 0) {
		//
		// 	infoObjForWorker.gtk_handles = [];
		//
		// 	var DOMWindows = Services.wm.getEnumerator('navigator:browser');
		// 	while (DOMWindows.hasMoreElements()) {
		// 		var aDOMWindow = DOMWindows.getNext();
		// 		var aBaseWindow = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
		// 									.getInterface(Ci.nsIWebNavigation)
		// 									.QueryInterface(Ci.nsIDocShellTreeItem)
		// 									.treeOwner
		// 									.QueryInterface(Ci.nsIInterfaceRequestor)
		// 									.getInterface(Ci.nsIBaseWindow);
		// 		var aGdkWindowPtr_str = aBaseWindow.nativeHandle;
		// 		infoObjForWorker.gtk_handles.push(aGdkWindowPtr_str);
		// 	}
		//
		// 	console.log('infoObjForWorker.gtk_handles:', infoObjForWorker.gtk_handles);
		//
		// }

		CommWorker.postMessageWithCallback(['createShareables_andSecondaryInit', aInitInfoObj, infoObjForWorker], function(aShareableAddiesObj) {
			// aShareableAddiesObj is what CommWorker sends to me, it is key holding ctypes.TYPE and value a string address
			// ill send these to MMWorker, who will then store them in global, and of course its secondary init so it reads them in
			MMWorker.postMessage(['initShareablesAndStartMM', aShareableAddiesObj]);
			// secondaryInit_forShareables will also start the mouse monitor
			// so now from this point, assume mouse monitor is in a infinite js loop
				// so to now communicate with MMWorker i have to CommWorker.postMessage to transferToMMWorker (for windows im in a lock for sure, linux im pretty sure, osx i might not, so for osx i should still send this same post message, but on callback of it, i should then send mmworker a message to read in from the shreables as they were updated)
				// the other reason to commToMMworker is to tell it to start or stop sending mouse events

			// if (core.os.name.indexOf('win') === 0) {
				if (!gShutdowned) {
					windowListener.register();
				}
			// }
		});

		// Services.wm.getMostRecentWindow('navigator:browser').setTimeout(function() {
			// console.error('stopping mouse monitor');
			// CommWorker.postMessage(['tellMmWorker', 'stop-mouse-monitor']);
		// }, 5000);
	},
	mouseEvent: function(aMouseEvent) {
		// this is triggered for every mouse event except mousemove, while mousemonitor is running
		console.log('bootstrap got mouseEvent:', aMouseEvent);
		if (bowserFsWantingMouseEvents) { // i decided to allow only one framescript getting mousevents at a time. as only time its needed is when mouse is over that record section
			bowserFsWantingMouseEvents.messageManager.sendAsyncMessage(core.addon.id, ['mouseEvent', aMouseEvent]);
		}
	},
	currentMouseEventCombo: function(aMECombo) {
		console.log('bootstrap got aMECombo:', aMECombo);
		if (bowserFsWantingMouseEvents) { // i decided to allow only one framescript getting mousevents at a time. as only time its needed is when mouse is over that record section
			bowserFsWantingMouseEvents.messageManager.sendAsyncMessage(core.addon.id, ['currentMouseEventCombo', aMECombo]);
		}
	},
	triggerConfigFunc: function(aConfigId) {
		_cache_func[aConfigId].__exec__();
	},
	// start - gtk mainthread technique functions
	gtkStartMonitor: function() {
		if (!OSStuff.ostypes_x11_imported) {
			Cu.import('resource://gre/modules/ctypes.jsm');
			Services.scriptloader.loadSubScript(core.addon.path.content + 'modules/ostypes/cutils.jsm', bootstrap);
			Services.scriptloader.loadSubScript(core.addon.path.content + 'modules/ostypes/ostypes_x11.jsm', bootstrap);
			OSStuff.ostypes_x11_imported = true;
		}

		OSStuff.mouse_filter_js = function(xeventPtr, eventPtr, data) {
			// console.log('in mouse_filter_js!! xeventPtr:', xeventPtr);

			var stdConst;
			var wheelRelease = false;
			if (cutils.jscEqual(xeventPtr.contents.xbutton.type, ostypes.CONST.ButtonPress)) {
				var button = cutils.jscGetDeepest(xeventPtr.contents.xbutton.button);
				if (button == '4') {
					stdConst = 'WH_UP';
				} else if (button == '5') {
					stdConst = 'WH_DN';
				} else if (button == '6') {
					stdConst = 'WH_LT'; // :todo: verify. for some reason ubuntu is not reading my sculpt horizontal wheel events
				} else if (button == '7') {
					stdConst = 'WH_RT'; // :todo: verify. for some reason ubuntu is not reading my sculpt horizontal wheel events
				} else {
					stdConst = 'B' + button + '_DN';
				}
			} else if (cutils.jscEqual(xeventPtr.contents.xbutton.type, ostypes.CONST.ButtonRelease)) {
				var button = cutils.jscGetDeepest(xeventPtr.contents.xbutton.button);
				if (['4', '5', '6', '7'].indexOf(button) > -1) {
					// wheel events send an immediate ButtonRelease, so we ignore this
					wheelRelease = true;
				} else {
					stdConst = 'B' + button + '_UP';
				}
			} else {
				// ignore as it is not a button press/release, probably mouse move or something like that
			}

			if (stdConst) {
				var cMEStdConst = stdConst;
				if (handleMouseEvent(cMEStdConst)) {
					// block it as it was handled
					return ostypes.CONST.GDK_FILTER_REMOVE;
				} else {
					return ostypes.CONST.GDK_FILTER_CONTINUE;
				}

				// MMWorker.postMessage(['gtkMainthreadMouseCallback', stdConst]);
				// if (bowserFsWantingMouseEvents) { // || mouseTracker found a match - need to devise how to detect this, because the mouseTracker is over in the worker
				// 	return ostypes.CONST.GDK_FILTER_REMOVE;
				// } else {
				// 	return ostypes.CONST.GDK_FILTER_CONTINUE;
				// }
			} else {
				return ostypes.CONST.GDK_FILTER_CONTINUE;
			}


		};
		OSStuff.mouse_filter_c = ostypes.TYPE.GdkFilterFunc(OSStuff.mouse_filter_js);

		// var tWin = ostypes.HELPER.xidToGdkWinPtr(ostypes.HELPER.cachedDefaultRootWindow())
		// console.log('tWin root x way:', tWin.toString());

		// var tWin = ostypes.API('gdk_get_default_root_window')()
		// console.log('tWin root default way:', tWin.toString());

		// var tWin = null;
		// var baseWindow = Services.wm.getMostRecentWindow('navigator:browser').QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        //                 .getInterface(Components.interfaces.nsIWebNavigation)
        //                 .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
        //                 .treeOwner
        //                 .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        //                 .getInterface(Components.interfaces.nsIBaseWindow);
		// var tWin = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(baseWindow.nativeHandle));
		// console.log('most rec tWin:', tWin.toString());
		//
		// var tScr = ostypes.API('gdk_screen_get_default')();
		// var tWin = ostypes.API('gdk_screen_get_root_window')(tScr);
		// console.log('tWin root:', tWin.toString());

		// var tWin = ostypes.API('gdk_screen_get_active_window')(tScr);
		// console.log('tWin active:', tWin.toString());
		// return;  // :debug:
		// ostypes.API('gdk_window_set_events')(tWin, ostypes.CONST.ALL_EVENTS_MASK);
		// console.log('ok set events');

		ostypes.API('gdk_window_add_filter')(null, OSStuff.mouse_filter_c, null);
		console.log('ok added filter');

	},
	gtkStopMonitor: function() {
		if (!OSStuff.mouse_filter_c) {
			throw new Error('nothing to stop');
		}

		ostypes.API('gdk_window_remove_filter')(null, OSStuff.mouse_filter_c, null);

		OSStuff.mouse_filter_js = null;
		OSStuff.mouse_filter_c = null;
		OSStuff.mouse_filter_c = null;

		console.log('ok gtk monitor stopped');
	},
	// end - gtk mainthread technique functions
	startHeldTimer: function(aMECombo, aFireTime) {
		gHeldTimer.cancel();
		xpcomSetTimeout(gHeldTimer, infoObjForWorker.prefs['hold-duration'], makeMouseEventHeld.bind(null, aMECombo, aFireTime));
	},
	cancelAnyPendingHeldTimer: function() {
		gHeldTimer.cancel();
	},
	triggerEvent: function(aEvent) {
		$MC_triggerEvent(aEvent, null);
	},
	prevTargets: [],
	prevMouseup: function() {
		var cDOMWin = Services.wm.getMostRecentWindow(null);

		MMWorkerFuncs.prevTargets.push(cDOMWin);
		cDOMWin.addEventListener('mouseup', prevMouseup, false);
		cDOMWin.addEventListener('click', prevMouseup, false);
		// cDOMWin.document.addEventListener('mousemove', prevMouseup, false);

		console.error('ok attached prevMouseup');

		if (cDOMWin.gBrowser) {
			var browsers = cDOMWin.gBrowser.browsers;
			for (var i=0; i<browsers.length; i++) {
				browsers[i].messageManager.sendAsyncMessage(core.addon.id + '-framescript', ['prevMouseup']);
			}

			cDOMWin.gBrowser._autoScrollPopup.hidePopup();
			cDOMWin.gBrowser.selectedBrowser.messageManager.sendAsyncMessage('Autoscroll:Cancel');
		}

		MMWorkerFuncs.closeOpenContextMenus();
	},
	closeOpenContextMenus: function() {
		console.error('closeOpenContextMenus');
		var iLen = gOpenContextMenus.length-1;
		for (var i=iLen; i>-1; i--) {
			console.error('hiding:', gOpenContextMenus[i]);
			gOpenContextMenus[i].hidePopup();
		}
	},
	unprevMouseup: function() {
		xpcomSetTimeout2(0, function() { // need this, otherwise it gets called to fast on ubuntu. and if i do this in windows on the mouseup/click event, then it is also too fast there. i tested this by left btn down on downoad icon in toolbar, then scroll wheel, then release. if too fast it opens the download popup panel
			var iLen = MMWorkerFuncs.prevTargets.length;
			for (var i=0; i<iLen; i++) {
				var cDOMWin = MMWorkerFuncs.prevTargets.pop();
				cDOMWin.removeEventListener('mouseup', prevMouseup, false);
				cDOMWin.removeEventListener('click', prevMouseup, false);
				// cDOMWin.document.removeEventListener('mousemove', prevMouseup, false);

				if (cDOMWin.gBrowser) {
					var browsers = cDOMWin.gBrowser.browsers;
					for (var i=0; i<browsers.length; i++) {
						browsers[i].messageManager.sendAsyncMessage(core.addon.id + '-framescript', ['unprevMouseup']);
					}
				}
			}
		});
	},
	synthMouseup: function(aJsConst, aOsConst, aOsData) {
		if (aOsConst) {
			CommWorker.postMessage(['synthMouseup', aOsConst, aOsData]);
		}
		return;

		if (!cDOMWin) {
			console.warn('no cDOMWin');
		}
		if (cDOMWin.gBrowser) {
			console.warn('synthing mouseup in fs');
			cDOMWin.gBrowser.selectedBrowser.messageManager.sendAsyncMessage(core.addon.id + '-framescript', ['synthMouseup', aJsConst]);
		} else {
			console.warn('no gBrowser on cDOMWin');
		}
	}
};

function prevMouseup(e) {
	console.error('prevMouseup, e:', e);
	// e.target.ownerDocument.defaultView.removeEventListener('mouseup', arguments.callee, false);
	// e.target.ownerDocument.defaultView.removeEventListener('click', arguments.callee, false);
	e.preventDefault();
	e.stopPropagation();
	// e.target.ownerDocument.defaultView.setTimeout(MMWorkerFuncs.unprevMouseup, 0); // comented this out but may want to put this back. i am currently relying on the chromeworker to send msg of "unprevMouseup" to remove the blocking
	return false;
}

var gHeldTimer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);

function tellMMWorkerPrefsAndConfig() {

	// will not tell worker about any config that has blank config arr

	// for use once mouse monitor is running

	infoObjForWorker = {}; // this is a concise info obj for worker // this is what will be transfered to MMWorker, via shared string json, so it can read it even during js thread lock, while c callbacks are running

	// steup prefs for worker
	infoObjForWorker.prefs = {};
	infoObjForWorker.prefs['multi-speed'] = prefs['multi-speed'].value;
	infoObjForWorker.prefs['hold-duration'] = prefs['hold-duration'].value;
	// infoObjForWorker.prefs['click-speed'] = prefs['click-speed'].value;
	infoObjForWorker.prefs['ignore-autorepeat-duration'] = prefs['ignore-autorepeat-duration'].value;

	// setup config for worker
	infoObjForWorker.config = {};
	for (var i=0; i<gConfigJson.length; i++) {
		if (gConfigJson[i].config.length) { // will not tell worker about any config that has blank config arr
			infoObjForWorker.config[gConfigJson[i].id] = gConfigJson[i].config;
		}
	}

	CommWorker.postMessage(['tellMmWorker', 'update-prefs-config', infoObjForWorker]);
}

function getConfigById(aId, aConfigJsonObj) {
	for (var i=0; i<aConfigJsonObj.length; i++) {
		if (aConfigJsonObj[i].id == aId) {
			return aConfigJsonObj[i];
		}
	}
	return null;
}

var _cache_func = {}; // key is id of config group. and value is eval of func
function updateConfigJson(aNewConfigJson) {
	// if finds any new/removed/changed func/config combination, it stores the new on in the _cache_func and runs __init__ or __uninit__ as necessary
	// it then updates gConfigJson

	// check to see if anything new was ADDED or if an EXISTING CHANGED, by id - if something found then eval its func and store it in _cache_func and run __init__
	for (var j=0; j<aNewConfigJson.length; j++) {
		var nEntry = aNewConfigJson[j];

		var gEntry = getConfigById(nEntry.id, gConfigJson);
		if (!gEntry) {
			// this one is new
			try {
				eval('_cache_func["' + nEntry.id + '"] = ' + nEntry.func);
			} catch (ignore) {
				console.error('Error on eval of "' + nEntry.name + '":', ignore);
				_cache_func[nEntry.id] = {};
			}

			// if it has a __init__ AND a config then run it
			if (nEntry.config.length && _cache_func[nEntry.id].__init__) {
				try {
					_cache_func[nEntry.id].__init__();
				} catch (ignore) {
					console.error('Error on __init__ of "' + nEntry.name + '":', ignore);
				}
			}
		} else {
			// it is not new
			// test if the func changed
			if (gEntry.func != nEntry.func) {
				// ok func changed so recache it

				// but first run __uninit__ if it had one AND it had a config
				if (gEntry.config.length && _cache_func[nEntry.id].__uninit__) {
					try {
						_cache_func[nEntry.id].__uninit__();
					} catch (ignore) {
						console.error('Error on __uninit__ of "' + nEntry.name + '":', ignore);
					}
				}

				// ok now recache it
				try {
					eval('_cache_func["' + nEntry.id + '"] = ' + nEntry.func);
				} catch (ignore) {
					console.error('Error on eval of "' + nEntry.name + '":', ignore);
					_cache_func[nEntry.id] = {};
				}

				// if it has a __init__ AND a config then run it
				if (nEntry.config.length && _cache_func[nEntry.id].__init__) {
					try {
						_cache_func[nEntry.id].__init__();
					} catch (ignore) {
						console.error('Error on __init__ of "' + nEntry.name + '":', ignore);
					}
				}
			} else {
				// the func is unchanged

				// lets see if config is now removed and it was there before
				if (gEntry.config.length) {
					// it HAD a config - so its __init__ was run

					// lets see if it does NOT have one anymore
					if (!nEntry.config.length) {
						// no longer does, so if it has an __uninit__ then run it
						if (_cache_func[nEntry.id].__uninit__) {
							try {
								_cache_func[nEntry.id].__uninit__();
							} catch (ignore) {
								console.error('Error on __uninit__ of "' + nEntry.name + '":', ignore);
							}
						}
					} // else it still has one
				} else {
					// it did NOT have a config so its __init__ had not run

					// lets see if it HAS one now
					if (nEntry.config.length) {
						// but now DOES have one so __init__ if it has one
						if (_cache_func[nEntry.id].__init__) {
							try {
								_cache_func[nEntry.id].__init__();
							} catch (ignore) {
								console.error('Error on __init__ of "' + nEntry.name + '":', ignore);
							}
						}
					} // else it still does not have one
				}
			}
		}
	}

	// check to see if anything was removed
	for (var j=0; j<gConfigJson.length; j++) {
		var gEntry = gConfigJson[j];
		var nEntry = getConfigById(gEntry.id, aNewConfigJson);
		if (!nEntry) {
			// it was removed

			// run __uninit__ if it had one AND if it had a config (if it had no config then the __init__ would never have ran)
			if (gEntry.config.length && _cache_func[gEntry.id].__uninit__) {
				try {
					_cache_func[gEntry.id].__uninit__();
				} catch (ignore) {
					console.error('Error on __uninit__ of "' + gEntry.name + '":', ignore);
				}
			}

			// remove it from cache
			delete _cache_func[gEntry.id];
		} // else it was not removed
	}

	gConfigJson = aNewConfigJson;
}

var CommWorkerFuncs = {
	init: function() {
		// init MMWorker
		var promise_getMMWorker = SICWorker('MMWorker', core.addon.path.workers + 'MMSyncWorker.js', MMWorkerFuncs);
		promise_getMMWorker.then(
			function(aVal) {
				console.log('Fullfilled - promise_getMMWorker - ', aVal);
				// start - do stuff here - promise_getMMWorker
				// nothing here, i do it in the MMWorkerFuncs init function
				// end - do stuff here - promise_getMMWorker
			},
			function(aReason) {
				var rejObj = {
					name: 'promise_getMMWorker',
					aReason: aReason
				};
				console.warn('Rejected - promise_getMMWorker - ', rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {
					name: 'promise_getMMWorker',
					aCaught: aCaught
				};
				console.error('Caught - promise_getMMWorker - ', rejObj);
			}
		);
	},
	// start - gtk mainthread technique functions
	gtkTellMmWorker: function() {
		MMWorker.postMessage(['actOnDoWhat']);
	}
	// end - gtk mainthread technique functions
};
function readConfigFromFile() {
	// reads file and sets global
	// resolves with array with single element being json. if file does not exist it gives gConfigJsonDefault
		// array because this function is used by fsFuncs

	var mainDeferred_readConfigFromFile = new Deferred();
	var promise_readConfig = OS.File.read(OSPath_config, {encoding:'utf-8'});
	promise_readConfig.then(
		function(aVal) {
			console.log('Fullfilled - promise_readConfig - ', aVal);
			// start - do stuff here - promise_readConfig
			updateConfigJson(JSON.parse(aVal));
			console.log('on readConfigFromFile file not found so retruning defaults');
			mainDeferred_readConfigFromFile.resolve([gConfigJson]); // aMsgEvent.target is the browser it came from, so send a message back to its frame manager
			// end - do stuff here - promise_readConfig
		},
		function(aReason) {
			if (aReasonMax(aReason).becauseNoSuchFile) {
				console.log('on readConfigFromFile file not found so retruning defaults');
				updateConfigJson(gConfigJsonDefault());
				mainDeferred_readConfigFromFile.resolve([gConfigJson]); // aMsgEvent.target is the browser it came from, so send a message back to its frame manager
				return;
			}
			var rejObj = {name:'promise_readConfig', aReason:aReason};
			console.error('Rejected - promise_readConfig - ', rejObj);
			mainDeferred_readConfigFromFile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readConfig', aCaught:aCaught};
			console.error('Caught - promise_readConfig - ', rejObj);
			mainDeferred_readConfigFromFile.reject(rejObj);
		}
	);

	return mainDeferred_readConfigFromFile.promise;
}

function windowActivated(e) {
	console.log('win activated time:', e.timeStamp, e);
	if (core.os.name.indexOf('win') === 0) {
		CommWorker.postMessage(['timeoutTellFocused', true, e.timeStamp]);
	}

	$MC_triggerEvent('window_activated', e.target);
}

function windowDeactivated(e) {
	console.log('win deactivated time:', e.timeStamp, e);
	if (core.os.name.indexOf('win') === 0) {
		CommWorker.postMessage(['timeoutTellFocused', false, e.timeStamp]);
	}
}
/*start - windowlistener*/
var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {

		// Load into any existing windows
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			var aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		var DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		/*
		for (var u in unloaders) {
			unloaders[u]();
		}
		*/
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

		aDOMWindow.addEventListener('activate', windowActivated, false);
		aDOMWindow.addEventListener('deactivate', windowDeactivated, false);

		aDOMWindow.addEventListener('popupshowing', openingContextMenus, false);

		$MC_triggerEvent('newwindow_ready', aDOMWindow);
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

		aDOMWindow.removeEventListener('activate', windowActivated, false);
		aDOMWindow.removeEventListener('deactivate', windowDeactivated, false);

		aDOMWindow.removeEventListener('popupshowing', openingContextMenus, false);
	}
};
/*end - windowlistener*/

var gOpenContextMenus = [];
function openingContextMenus(e) {
	console.error('context menu opening:', e.target);
	if (e.target.nodeName == 'menupopup') {
		gOpenContextMenus.push(e.target);
		e.target.addEventListener('popuphiding', closingContextMenu, false);
	}
}

function closingContextMenu(e) {
	console.error('context menu CLOSING:', e.target);
	e.target.removeEventListener('popuphiding', closingContextMenu, false);
	for (var i=0; i<gOpenContextMenus.length; i++) {
		if (gOpenContextMenus[i] == e.target) {
			console.error('found in gOpenContextMenus and spliced');
			gOpenContextMenus.splice(i, 1);
			return;
		}
	}
}

// start - functions for use in func of config
var $MC_BS_ = {}; // a storage area in bootstrap

var $MC_listeners = []; // storage of the currently added event listeners
function $MC_addEventListener(aEvent, aFunc) {
	// aEvent's currently supported (for target for the event see comment at start of $MC_triggerEvent function)
		// framescript_created
		// framescript_uninit

	for (var i=0; i<$MC_listeners.length; i++) {
		if ($MC_listeners[i].event == aEvent && $MC_listeners[i].func == aFunc) {
			console.warn('func is already added for this event, so not adding it again');
			return;
		}
	}

	$MC_listeners.push({
		event: aEvent,
		func: aFunc
	});
}

function $MC_removeEventListener(aEvent, aFunc) {

	for (var i=0; i<$MC_listeners.length; i++) {
		if ($MC_listeners[i].event == aEvent && $MC_listeners[i].func == aFunc) {
			$MC_listeners.splice(i, 1);
			return; // no need to continue, as i cant have multiple listeners for the same combination of aEvent and aFunc
		}
	}
}

function $MC_triggerEvent(aEvent, aTarget) {

	// aTarget's
		// framescript_created - messageManager
		// framescript_uninit - messageManager
		// setpref_from_options - {name:prefname, newval:newval, oldval:oldval, obj:prefs[aPrefName]}
		// all_buttons_released - null
		// newwindow_ready - aDOMWindow
		// window_activated - aDOMWindow

	for (var i=0; i<$MC_listeners.length; i++) {
		if ($MC_listeners[i].event == aEvent) {
			$MC_listeners[i].func(aTarget);
		}
	}
}

function $MC_overlaps(aThisConfigId_or_func, aTestConfigId_or_func, aIgnoreSoft) {
	// meaning if overlapped, then aTest will trigger on the way to execute aThis
	// returns
		// 0 - if aThis does not overlap aTest
		// a number (plus 0.1) indicating how much aTestConfigId is overlapped by aThisConfigId_or_func (minimum is 0.5)
		// if aIgnoreSoft is true - then value is always positive. if false, then value is negative if aTestConfigId_or_func contains a "HOLD". its considered soft because it MAY not have triggered
	// so this means it returns 0.1 if exactly the same

	var aThis = $MC_getConfig(aThisConfigId_or_func, gConfigJson).config;
	var aTest = $MC_getConfig(aTestConfigId_or_func, gConfigJson).config;

	if (aThis.length < aTest.length) {
		return 0;
	}

	if (!aThis.length || !aTest.length) {
		return 0;
	}

	// var underlapCnt = 0;
	// var overlapCnt = 0;
	for (var i=0; i<aTest.length - 1; i++) {
		if (aThis[i].std != aTest[i].std && aThis[i].multi !== aTest[i].multi && aThis[i].held != aTest[i].held) {
			return 0;
		} else {
			console.log('match i:', i);
		}
	}

	// if get here it means aTest perfectly overlaps the start of aThis

	// var i = aTest.length - 1;
	console.log('i:', i);
	var thisMEDir = aThis[i].std.substr(3);
	var thisMEBtn = aThis[i].std.substr(0, 2);
	var testMEDir = aTest[i].std.substr(3);
	var testMEBtn = aTest[i].std.substr(0, 2);

	// calc diff of multi as if both std were same
	var diffOfMulti;
	if (aThis[i].multi >= aTest[i].multi) {
		diffOfMulti = (aThis[i].multi - aTest[i].multi) + 0.1;
	} else {
		// aTest overlaps aThis as the multi of aTest is greater
		return 0;
	}

	// if (aThis[i].std != aTest[i].std && aThis[i].multi !== aTest[i].multi && aThis[i].held != aTest[i].held) {
	if (aThis[i].std != aTest[i].std) {
		// aTest is exactly the start of aThis
		if (thisMEBtn == testMEBtn) {
			if (thisMEDir == 'CK' && testMEDir == 'DN') {
				var rezBuild = 0.5 + (aThis[i].multi - 1) + 0.1;
				/* theorizing that held DOES add to count
				if (aThis[i].held) {
					rezBuild += 0.5;
				}
				if (aTest[i].held && rezBuild == 0.6) {
					rezBuild -= 0.5;
				}
				// */
				// theorizing that held does NOT add to count - do nothing special}

				if (!aIgnoreSoft) {
					if (aThis[i].held || aTest[i].held) {
						rezBuild *= -1;
					}
				}

				return rezBuild;
			} else if (thisMEDir == 'DN' && testMEDir == 'CK') {
				// aTest overlaps aThis
				return 0;
			}
		} else {
			return 0;
		}
	} else {
		// std of both are same
		if (aThis[i].held == aTest[i].held) {
			if (aThis[i].held) {
				if (aIgnoreSoft) {
					return diffOfMulti;
				} else {
					return diffOfMulti * -1;
				}
			} else {
				return diffOfMulti;
			}
		} else {
			// helds dont match
			// /* theorizing that held does NOT add to count
			if (aThis[i].held) {
				if (aIgnoreSoft) {
					return diffOfMulti;
				} else {
					return (diffOfMulti) * -1;
				}
			} else {
				// aTest is held so aTest overlaps aThis
				return 0;
			}
			// */
			/* theorizing that held DOES add to count
			if (aThis[i].held) {
				// add 0.5 for the held
				if (aIgnoreSoft) {
					return diffOfMulti + 0.5;
				} else {
					return (diffOfMulti  + 0.5) * -1;
				}
			} else {
				// aTest is held so aTest overlaps aThis
				// if i did return here i would substract 0.5 for the held
				return 0;
			}
			// */
		}
	}

}

function $MC_getConfig(aEvaledFunc_or_id) {
	// returns the entry in gConfigJson for by id where id is a number OR it is the object held in _cache_func (and this object is the subject of `this` in all __exec__ / __init__ / __uninit__)
	if (typeof(aEvaledFunc_or_id) == 'number') {
		return getConfigById(aEvaledFunc_or_id, gConfigJson);
	} else {
		for (var p in _cache_func) {
			if (_cache_func[p] == aEvaledFunc_or_id) {
				return getConfigById(p, gConfigJson);
			}
		}
	}
}

function $MC_execInAllTabs(aFunc, aCallback) {
	var cFuncAsStr = uneval(aFunc);

	var DOMWindows = Services.wm.getEnumerator('navigator:browser');
	while (DOMWindows.hasMoreElements()) {
		var aDOMWindow = DOMWindows.getNext();
		var aGBrowser = aDOMWindow.gBrowser;
		var aBrowsers = aGBrowser.browsers;
		for (var i=0; i<aBrowsers.length; i++) {
			if (aCallback) {
				sendAsyncMessageWithCallback(aBrowsers[i].messageManager, core.addon.id + '-framescript', ['eval', cFuncAsStr], evalFsMsgListener.funcScope, function(aReturn) {
					// console.log('ok back in bootstrap, aReturn:', aReturn);
					aCallback(aReturn);
				});
			} else {
				aBrowsers[i].messageManager.sendAsyncMessage(core.addon.id + '-framescript', ['eval', cFuncAsStr]);
			}
		}
	}
}

function $MC_execInTab(aFunc, aCallback, aOptions={}) {
	// aOptions:
		// tab - message manager of the linkedBrowser of the tab you want to exec in. if not set it is the current tab of the most recent window

	var cFuncAsStr = uneval(aFunc);

	if (!aOptions.tab) {
		// make it the current tab of the most recent window
		aOptions.tab = Services.wm.getMostRecentWindow('navigator:browser').gBrowser.selectedBrowser.messageManager;
	}

	if (aCallback) {
		sendAsyncMessageWithCallback(aOptions.tab, core.addon.id + '-framescript', ['eval', cFuncAsStr], evalFsMsgListener.funcScope, function(aReturn) {
			// console.log('ok back in bootstrap, aReturn:', aReturn);
			aCallback(aReturn);
		});
	} else {
		aOptions.tab.sendAsyncMessage(core.addon.id + '-framescript', ['eval', cFuncAsStr]);
	}
}

function $MC_getMostRecentNonAlertDOMWindow() {
	var DOMWindows = Services.wm.getZOrderDOMWindowEnumerator(null, true);
	var DOMWindow;
	while (DOMWindows.hasMoreElements()) {
		DOMWindow = DOMWindows.getNext();
		console.warn('windowtype:', DOMWindow.document.documentElement.getAttribute('windowtype'));
		if (DOMWindow.document.documentElement.getAttribute('windowtype') == 'alert:alert') {
			DOMWindow = null;
		} else {
			return DOMWindow;
		}
	}
}
// end - functions for use in func of config

/* examples of the $MC api
({
    __exec__: function() {
        $MC_execInTab(
            function() {
                return content.window.location.href;
            },
            function(aHref) {
                Services.prompt.alert(null, 'Got It', aHref);
            }
        );
    }
})

({
    __exec__: function() {
        $MC_execInAllTabs(
            function() {
                content.document.documentElement.style.backgroundColor = 'blue';
                return content.window.location.href;
            },
			function(aHref) {
                Services.prompt.alert(null, 'Made this site blue', aHref);
            }
        );
    }
})

({
	__init__: function() {
		$MC_BS_.cb = function(aTarget) {
			$MC_execInTab(function(){
				content.alert('hi - framescript created event fired');
			}, null, aTarget);
		};
		$MC_addEventListener('framescript_created', $MC_BS_.cb);
	},
	__uninit__: function() {
		$MC_removeEventListener('framescript_created', $MC_BS_.cb);
	}
})
*/

var evalFsMsgListener = {
	funcScope: {
		triggerEvent_framescript_created: function(aMsgEvent) {
			$MC_triggerEvent('framescript_created', aMsgEvent.target.messageManager);
		}
	},
	receiveMessage: function(aMsgEvent) {
		var aMsgEventData = aMsgEvent.data;
		console.log('fsMsgListener getting aMsgEventData:', aMsgEventData, 'aMsgEvent:', aMsgEvent);
		// aMsgEvent.data should be an array, with first item being the unfction name in bootstrapCallbacks

		var callbackPendingId;
		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
			callbackPendingId = aMsgEventData.pop();
		}

		aMsgEventData.push(aMsgEvent); // this is special for server side, so the function can do aMsgEvent.target.messageManager to send a response

		var funcName = aMsgEventData.shift();
		if (funcName in this.funcScope) {
			var rez_parentscript_call = this.funcScope[funcName].apply(null, aMsgEventData);

			if (callbackPendingId) {
				// rez_parentscript_call must be an array or promise that resolves with an array
				if (rez_parentscript_call.constructor.name == 'Promise') {
					rez_parentscript_call.then(
						function(aVal) {
							// aVal must be an array
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id + '-framescript', [callbackPendingId, aVal]);
						},
						function(aReason) {
							console.error('aReject:', aReason);
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id + '-framescript', [callbackPendingId, ['promise_rejected', aReason]]);
						}
					).catch(
						function(aCatch) {
							console.error('aCatch:', aCatch);
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id + '-framescript', [callbackPendingId, ['promise_rejected', aCatch]]);
						}
					);
				} else {
					// assume array
					console.warn('ok responding to callback id:', callbackPendingId, aMsgEvent.target);
					aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id + '-framescript', [callbackPendingId, rez_parentscript_call]);
				}
			}
		}
		else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out

	}
};

// END - Addon Functionalities

function install() {}

function uninstall(aData, aReason) {
	if (aReason == ADDON_UNINSTALL) {
		// delete prefs
		for (var aPrefName in prefs) {
			if (prefs[aPrefName].type == Ci.nsIPrefBranch.PREF_INT || prefs[aPrefName].type == Ci.nsIPrefBranch.PREF_BOOL || prefs[aPrefName].type == Ci.nsIPrefBranch.PREF_STRING) {
				Services.prefs.clearUserPref(myPrefBranch + aPrefName)
			} else if (prefs[aPrefName].type == -1) {
				// -1 is custom type
				if (prefs[aPrefName].clearUserPref) {
					// dev has to set this on the pref
					prefs[aPrefName].clearUserPref();
				}
			}
		}

		// delete storage
		OS.File.removeDir(OS.Path.dirname(OSPath_simpleStorage), {
			ignoreAbsent: true,
			ignorePermissions: true
		});
	}
}

function startup(aData, aReason) {
	// core.addon.aData = aData;
	core.addon.version = aData.version;
	extendCore();

	var postSetConfig = function() {
		// startup worker
		var promise_initCommWorker = SICWorker('CommWorker', core.addon.path.workers + 'CommWorker.js', CommWorkerFuncs);
		promise_initCommWorker.then(
			function(aVal) {
				console.log('Fullfilled - promise_initCommWorker - ', aVal);
				// i dont do anything here, i do it in the init function in CommWorkerFuncs
			},
			genericReject.bind(null, 'promise_initCommWorker', 0)
		).catch(genericCatch.bind(null, 'promise_initCommWorker', 0));

		// register about page
		initAndRegisterAbout();

		// register about pages listener
		Services.mm.addMessageListener(core.addon.id, fsMsgListener);
	};

	// read in config from file
	var promise_configInit = readConfigFromFile();
	promise_configInit.then(
		function(aVal) {
			console.log('Fullfilled - promise_configInit - ', aVal);
			postSetConfig();
		},
		genericReject.bind(null, 'promise_configInit', 0)
	).catch(genericCatch.bind(null, 'promise_configInit', 0));

	var aTimer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
	aTimer.initWithCallback({
		notify: function() {
			console.error('ok starting up adding');
			// register framescript listener
			Services.mm.addMessageListener(core.addon.id + '-framescript', evalFsMsgListener);

			// register framescript injector
			Services.mm.loadFrameScript(core.addon.path.scripts + 'EVALFramescript.js?' + core.addon.cache_key, true);
		}
	}, 1000, Ci.nsITimer.TYPE_ONE_SHOT);
}

var gShutdowned; // so in case user shuts down before i get to the point of windowLister.register()
function shutdown(aData, aReason) {
	// need to tell workers to stop or firefox wont close; if i just do terminate, MMWorker will crash as its in an infinite event loop
	if (MMWorker) {
		CommWorker.postMessageWithCallback(['tellMmWorker', 'stop-mouse-monitor'], function() {
			console.error('ok tellMmWorker done');
			MMWorker.postMessageWithCallback(['preTerminate'], function() {
				console.error('ok mmworker preterminate done');
				MMWorker.terminate();
				CommWorker.terminate();
				console.error('ok terminated from mainthread');
			})
		});
	}

	if (aReason == APP_SHUTDOWN) { return }

	// if (core.os.name.indexOf('win') === 0) {
		gShutdowned = true;
		windowListener.unregister();
	// }

	updateConfigJson([]); // if anything has a __uninit__ and a config then execute it

	// an issue with this unload is that framescripts are left over, i want to destory them eventually
	aboutFactory_instance.unregister();

	// unregister about pages listener
	Services.mm.removeMessageListener(core.addon.id, fsMsgListener);


	///// eval framescript stuff

	// unregister framescript injector
	Services.mm.removeDelayedFrameScript(core.addon.path.scripts + 'EVALFramescript.js?' + core.addon.cache_key);

	// kill framescripts
	Services.mm.broadcastAsyncMessage(core.addon.id + '-framescript', ['destroySelf']);

	// unregister framescript listener
	Services.mm.removeMessageListener(core.addon.id + '-framescript', evalFsMsgListener);

	// cancel timers for xpcomSetTimeout2
	for (var xpcomTimer in gXpcomTimers) {
		gXpcomTimers[xpcomTimer].cancel();
	}
}

// start - server/framescript comm layer
// functions for framescripts to call in main thread
var bowserFsWantingMouseEvents;
var fsFuncs = { // can use whatever, but by default its setup to use this
	fetchConfig: function(bootstrapCallbacks_name, aMsgEvent) {
		if (gConfigJson) {
			return [gConfigJson];
		} else {
			// i do start read as soon as startup happens. however if options page is open and it sends message to here, ill do double read to ensure it gets it, no biggie
			return readConfigFromFile();
		}
	},
	fetchCore: function() {
		return [core];
	},
	getPref: function(aPrefName) {

		var rezPrefVal = prefs[aPrefName].value;
		if (rezPrefVal.constructor.name == 'Promise') {
			var deferredMain_fsGetPref = new Deferred();

			rezPrefVal.then(
				function(aVal) {
					console.log('Fullfilled - rezPrefVal - ', aVal);
					// start - do stuff here - rezPrefVal
					deferredMain_fsGetPref.resolve([aVal]);
					// end - do stuff here - rezPrefVal
				},
				function(aReason) {
					var rejObj = {name:'rezPrefVal', aReason:aReason};
					console.warn('Rejected - rezPrefVal - ', rejObj);
					deferredMain_fsGetPref.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'rezPrefVal', aCaught:aCaught};
					console.error('Caught - rezPrefVal - ', rejObj);
					deferredMain_fsGetPref.reject(rejObj);
				}
			);
			return deferredMain_fsGetPref.promise;

		} else {
			return [rezPrefVal];
		}
	},
	setPref: function(aPrefName, aNewVal) {
		var oldval = prefs[aPrefName].value;
		prefs[aPrefName].value = aNewVal;

		// update worker:
		tellMMWorkerPrefsAndConfig();

		$MC_triggerEvent('setpref_from_options', {
			name: aPrefName,
			newval: aNewVal,
			oldval: oldval,
			obj: prefs[aPrefName]
		});
	},
	updateConfigsOnServer: function(aNewConfigJson) {
		// called when the following action done from ng-prefs.xhtml:
			// trash
			// add
			// edit
			// I MADE IT NOW route restore defaults to route through here
		// currently i think this is ONLY ever called, when framescript needs to send an updated config, so this is only sent when user makes change, so here i can test if there is a diff between the old and new script, and run the shutdown/init appropriately

		updateConfigJson(aNewConfigJson);

		// update worker:
		tellMMWorkerPrefsAndConfig();

		var promise_saveConfigs = tryOsFile_ifDirsNoExistMakeThenRetry('writeAtomic', [OSPath_config, JSON.stringify(aNewConfigJson), {
			tmpPath: OSPath_config + '.tmp',
			encoding: 'utf-8'
		}], OS.Constants.Path.profileDir);

		promise_saveConfigs.then(
			function(aVal) {
				console.log('Fullfilled - promise_saveConfigs - ', aVal);
				// start - do stuff here - promise_saveConfigs
				// end - do stuff here - promise_saveConfigs
			},
			function(aReason) {
				var rejObj = {name:'promise_saveConfigs', aReason:aReason};
				console.error('Rejected - promise_saveConfigs - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_saveConfigs', aCaught:aCaught};
				console.error('Caught - promise_saveConfigs - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);
	},
	restoreDefaults: function() {
		// :todo: in future add bool for just config restore, or all. (meaning prefs and config)

		// reset prefs
		for (var aPrefName in prefs) {
			prefs[aPrefName].value = prefs[aPrefName].default;
			// the setter on the value will update the Services.prefs system
		}

		// reset config
		// gConfigJson = gConfigJsonDefault(); // need to send it through fsFuncs.updateConfigsOnServer see note on next line
		// send it through the fsFuncs so it init's and uninit's the funcs as necessary
		fsFuncs.updateConfigsOnServer(gConfigJsonDefault());

		// no more need to do this as fsFuncs.updateConfigsOnServer handles it
		// // update worker:
		// tellMMWorkerPrefsAndConfig();

		var promise_delteConfig = OS.File.remove(OSPath_config);
		promise_delteConfig.then(
			function(aVal) {
				console.log('Fullfilled - promise_delteConfig - ', aVal);
				// start - do stuff here - promise_delteConfig
				// end - do stuff here - promise_delteConfig
			},
			function(aReason) {
				var rejObj = {name:'promise_delteConfig', aReason:aReason};
				console.error('Rejected - promise_delteConfig - ', rejObj);

				// if it fails, i really need to ensure it deletes, cuz if it exists on next addon startup or read it will get that instead of the defaults
				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_delteConfig', aCaught:aCaught};
				console.error('Caught - promise_delteConfig - ', rejObj);
				// deferred_createProfile.reject(rejObj);
			}
		);

		return [];
	},
	exportSettings: function() {
		var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
		fp.init(Services.wm.getMostRecentWindow('navigator:browser'), myServices.sb.GetStringFromName('exporttitle'), Ci.nsIFilePicker.modeSave);
		fp.appendFilter(myServices.sb.GetStringFromName('exportimportfilterlabel') + ' (*.mousecontrol.json)', '*.mousecontrol.json');

		var rv = fp.show();
		if (rv == Ci.nsIFilePicker.returnOK || rv == Ci.nsIFilePicker.returnReplace) {

			var exportFileContent = {
				config: gConfigJson,
				prefs: {}
			};

			var promiseAllArr_gotValues = [];

			for (var aPrefName in prefs) {
				var cPrefVal = prefs[aPrefName].value;
				if (cPrefVal.constructor.name == 'Promise') {
					var deferred_cPrefVal = new Deferred();
					promiseAllArr_gotValues.push(deferred_cPrefVal.promise);

					cPrefVal.then(
						function(aAPrefName, aVal) {
							console.log('Fullfilled - cPrefVal - ', aVal);
							// start - do stuff here - cPrefVal
							exportFileContent.prefs[aAPrefName] = cPrefVal;
							deferred_cPrefVal.resolve();
							// end - do stuff here - cPrefVal
						}.bind(null, aPrefName),
						function(aReason) {
							var rejObj = {name:'cPrefVal', aReason:aReason};
							console.error('Rejected - cPrefVal - ', rejObj);
							deferred_cPrefVal.reject(rejObj);
						}
					).catch(
						function(aCaught) {
							var rejObj = {name:'cPrefVal', aCaught:aCaught};
							console.error('Caught - cPrefVal - ', rejObj);
							deferred_cPrefVal.reject(rejObj);
						}
					);
				} else {
					exportFileContent.prefs[aPrefName] = cPrefVal;
				}
			}

			var promiseAll_gotValues = Promise.all(promiseAllArr_gotValues);
			promiseAll_gotValues.then(
				function(aVal) {
					console.log('Fullfilled - promiseAll_gotValues - ', aVal);
					// start - do stuff here - promiseAll_gotValues

					var fixedFilePath = fp.file.path;

					if (!/\.mousecontrol\.json/i.test(fixedFilePath)) {
						fixedFilePath += '.mousecontrol.json';
					}

					console.error('writing to:', fixedFilePath);
					var promise_export = OS.File.writeAtomic(fixedFilePath, JSON.stringify(exportFileContent), {
						encoding: 'utf-8',
						tmpPath: fixedFilePath + '.tmp'
					});
					promise_export.then(
						function(aVal) {
							console.log('Fullfilled - promise_export - ', aVal);
							// start - do stuff here - promise_export
							// end - do stuff here - promise_export
						},
						function(aReason) {
							var rejObj = {name:'promise_export', aReason:aReason};
							console.error('Rejected - promise_export - ', rejObj);
							// deferred_createProfile.reject(rejObj);
						}
					).catch(
						function(aCaught) {
							var rejObj = {name:'promise_export', aCaught:aCaught};
							console.error('Caught - promise_export - ', rejObj);
							// deferred_createProfile.reject(rejObj);
						}
					);

					// end - do stuff here - promiseAll_gotValues
				},
				function(aReason) {
					var rejObj = {name:'promiseAll_gotValues', aReason:aReason};
					console.error('Rejected - promiseAll_gotValues - ', rejObj);
					// deferred_createProfile.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promiseAll_gotValues', aCaught:aCaught};
					console.error('Caught - promiseAll_gotValues - ', rejObj);
					// deferred_createProfile.reject(rejObj);
				}
			);
		}// else { // cancelled	}
	},
	importSettings: function() {

		var mainDeferred_importSettings = new Deferred();

		var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
		fp.init(Services.wm.getMostRecentWindow('navigator:browser'), myServices.sb.GetStringFromName('importtitle'), Ci.nsIFilePicker.modeOpen);
		fp.appendFilter(myServices.sb.GetStringFromName('exportimportfilterlabel') + ' (*.mousecontrol.json)', '*.mousecontrol.json');

		var rv = fp.show();
		if (rv == Ci.nsIFilePicker.returnOK) {

			var promise_import = OS.File.read(fp.file.path, {
				encoding: 'utf-8'
			});
			promise_import.then(
				function(aVal) {
					console.log('Fullfilled - promise_import - ', aVal);
					// start - do stuff here - promise_import
					var importFileContents = JSON.parse(aVal);
					updateConfigJson(importFileContents.config);

					for (var aPrefName in importFileContents.prefs) {
						prefs[aPrefName].value = importFileContents.prefs[aPrefName];
					}
					console.log('ok resolving import');
					mainDeferred_importSettings.resolve([true])
					// end - do stuff here - promise_import
				},
				function(aReason) {
					var rejObj = {name:'promise_import', aReason:aReason};
					console.error('Rejected - promise_import - ', rejObj);
					// deferred_createProfile.reject(rejObj);
					mainDeferred_importSettings.reject(rejObj);
				}
			).catch(
				function(aCaught) {
					var rejObj = {name:'promise_import', aCaught:aCaught};
					console.error('Caught - promise_import - ', rejObj);
					mainDeferred_importSettings.reject(rejObj);
					// deferred_createProfile.reject(rejObj);
				}
			);
		} else {
			// cancelled
			mainDeferred_importSettings.resolve([false])
		}

		return mainDeferred_importSettings.promise;
	},
	requestingMouseEvents: function(aMsgEvent) {
		bowserFsWantingMouseEvents = aMsgEvent.target; // :note: possibly should use weak reference here to avoid zombie
		CommWorker.postMessage(['tellMmWorker', 'send-mouse-events']);
	},
	requestingWitholdMouseEvents: function(aMsgEvent) {
		bowserFsWantingMouseEvents = null;
		CommWorker.postMessage(['tellMmWorker', 'withold-mouse-events']);
	}
};
var fsMsgListener = {
	funcScope: fsFuncs,
	receiveMessage: function(aMsgEvent) {
		var aMsgEventData = aMsgEvent.data;
		console.log('fsMsgListener getting aMsgEventData:', aMsgEventData, 'aMsgEvent:', aMsgEvent);
		// aMsgEvent.data should be an array, with first item being the unfction name in bootstrapCallbacks

		var callbackPendingId;
		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
			callbackPendingId = aMsgEventData.pop();
		}

		aMsgEventData.push(aMsgEvent); // this is special for server side, so the function can do aMsgEvent.target.messageManager to send a response

		var funcName = aMsgEventData.shift();
		if (funcName in this.funcScope) {
			var rez_parentscript_call = this.funcScope[funcName].apply(null, aMsgEventData);

			if (callbackPendingId) {
				// rez_parentscript_call must be an array or promise that resolves with an array
				if (rez_parentscript_call.constructor.name == 'Promise') {
					rez_parentscript_call.then(
						function(aVal) {
							// aVal must be an array
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, aVal]);
						},
						function(aReason) {
							console.error('aReject:', aReason);
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aReason]]);
						}
					).catch(
						function(aCatch) {
							console.error('aCatch:', aCatch);
							aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, ['promise_rejected', aCatch]]);
						}
					);
				} else {
					// assume array
					aMsgEvent.target.messageManager.sendAsyncMessage(core.addon.id, [callbackPendingId, rez_parentscript_call]);
				}
			}
		}
		else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out

	}
};
// end - server/framescript comm layer

/* valid values for stdConst
B?_DN
B?_UP
WV_UP
WV_DN
WH_LT
WH_RT

// composited
B?_CK - click
B?_HD - hold


*/

// non-platform specific
// gMEDown helper funcs
function METracker() {}
METracker.prototype = Object.create(Array.prototype);
METracker.prototype.indexOfStd = function(aStd) {
	for (var i=0; i<this.length; i++) {
		if (this[i].std == aStd) {
			return i;
		}
	}
	return -1;
};
METracker.prototype.strOfStds = function() {
	// returns a string of the current std in order
	var rezstr = [];
	for (var i=0; i<this.length; i++) {
		rezstr.push(this[i].std);
		if (this[i].multi > 1) {
			rezstr[rezstr.length - 1] = this[i].multi + 'x ' + this[i].std;
		}
		if (this[i].held) {
			rezstr[rezstr.length - 1] += ' + HOLD'
		}
	}
	return rezstr.join(', ');
};
METracker.prototype.asArray = function() {
	return this.slice();
};

// var gMEHistory = new METracker();
var gMEDown = new METracker();
var g_lME; // the last mouse event

var gMEAllReasedBool = true; // set to true when all is realsed, or false when not
var gMEAllReasedTime = 0; // is set to the last time that all were released

var gMEEnteredMC = null;
function handleMouseEvent(aMEStdConst) {
	// return true if handled else false (handled means block it)

	// console.log('incoming aMEStdConst:', aMEStdConst, 'gFxInFocus:', gFxInFocus);

	// :todo: consider cancel the hold timer if there was one

	var cMECombo = new METracker();

	var cME = {
		std: aMEStdConst,
		time: (new Date()).getTime(),
		multi: 1
	};
	var cMEDir = cME.std.substr(3);
	var cMEBtn = cME.std.substr(0, 2);

	var lME = g_lME; // lastMouseEvent
	var lMEDir;
	var lMEBtn;

	if (lME) {
		lMEDir = lME.std.substr(3);
		lMEBtn = lME.std.substr(0, 2);

		// test should we ignore cME
		// if (lMEBtn == 'WH' && (lMEDir == 'LT' || lMEDir == 'RT')) {
		if (lMEBtn == 'WH' && lMEDir == cMEDir) {
			if (infoObjForWorker.prefs['ignore-autorepeat-duration'] > 0) {
				console.log('time between last event:', cME.time - lME.time, 'ignore-autorepeat-duration:', infoObjForWorker.prefs['ignore-autorepeat-duration']);
				if (cME.time - lME.time <= infoObjForWorker.prefs['ignore-autorepeat-duration']) {
					// discard this but update this event so its last time is now
					lME.time = cME.time;
					console.log('discarding event - meaning not pushing into history');
					// no need to test here for a current match, as we are ignoring it
					if (bowserFsWantingMouseEvents) {
						return true;
					} else {
						if (gMEDown.length) {
							return true; // block mouse event
						} else {
							return false;
						}
					}
				}
			}
		}

		// test should we maek cME a click?
	}

	g_lME = cME;
	console.log('lME:', lME);

	// set previous down mouse event
	var pMEDown;
	var pMEDir;
	var pMEBtn;
	if (gMEDown.length) {
		pMEDown = gMEDown[gMEDown.length - 1];
		pMEDir = pMEDown.std.substr(3);
		pMEBtn = pMEDown.std.substr(0, 2);
	}

	console.log('gMEDown:', gMEDown.strOfStds());
	var clearAll = false; // set to true, if no more triggers are held, used in clean up section
	// add to gMEDown that a trigger is held or no longer held && transform previous event to click if it was
	if (cMEBtn != 'WH') {
		if (cMEDir == 'UP') {
			var ixCk = gMEDown.indexOfStd(cMEBtn + '_CK');
			if (ixCk > -1) {
				gMEDown.splice(ixCk, 1);
			}
			var ixUp = gMEDown.indexOfStd(cMEBtn + '_DN');
			console.log('ixUp:', ixUp);
			if (ixUp > -1) {
				gMEDown.splice(ixUp, 1);
				if (!gMEDown.length) {
					// nothing is down anymore, so clear all after a settimeout, as there may be something on mouseup
					clearAll = true;
					gMEAllReasedTime = new Date().getTime();
					gMEAllReasedBool = true;
					MMWorkerFuncs.triggerEvent('all_buttons_released');
				}
			}

			// if the previous was the DN of this cMEBtn then transform cME to click
			// if (lME) {
				// console.log('cME.time - pMEDown.time:', cME.time - lME.time, 'click-speed:', infoObjForWorker.prefs['click-speed']);
			// }
			// if (pMEDown && pMEDown.std == cMEBtn + '_DN' /* && cME.time - pMEDown.time <= infoObjForWorker.prefs['click-speed'] */) { // gMEDown[gMEDown.length-1] == cMEBtn + '_DN'
			// if (lME && lMEBtn == cMEBtn && (lMEDir == 'DN' || lMEDir == 'CK')) {
			if (pMEDown && pMEBtn == cMEBtn && (pMEDir == 'DN' || pMEDir == 'CK')) {
				cME.std = cMEBtn + '_CK';
				cMEDir = 'CK';
			}
		} else {
			var ixC = gMEDown.indexOfStd(cME.std);
			if (ixC > -1) {
				console.error('should never happen, as every DN event should be followed by an UP event, cME.std:', cME.std);
			} else {
				// add it in
				gMEDown.push(cME); // link38389222
				console.log('gMEDown:', gMEDown.strOfStds());
			}
		}
	}

	if (lME) {
		// test if cME is a multi action
		if (cME.time - lME.time <= infoObjForWorker.prefs['multi-speed']) {
			console.log('cMEStd:', cME.std, 'lMEStd:', lME.std, 'time between:', cME.time - lME.time);
			if (cMEBtn == 'WH') {
				// disallowing wheel to have multi action
				// if (cME.std == lME.std) {
				// 	cME.multi = lME.multi + 1;
				// 	// console.log('ok incremented multi, g_lME.multi:', g_lME.multi);
				// }
			} else {
				if (lMEDir == 'CK' && cMEBtn == lMEBtn) {
					if (cMEDir == 'DN') {
						// then it was pushed link38389222 into gMEDown, lets take it out of there
						// if (gMEDown.length > 1) {
							// gMEDown.pop();
						// }
					}
					// if (cMEDir == 'CK') {
						// gMEDown.pop();
					// }
					// if (cMEDir == 'DN') {
						cME.multi = lME.multi + 0.5;
						cME.std = lME.std;
						cMEDir = 'CK';
					// }
				}
			}
		}
	}

	// clone gMEDown to cMECombo
	for (var i=0; i<gMEDown.length; i++) {
		cMECombo.push(gMEDown[i]);
	}

	// add to cMECombo
	if (cMEBtn != 'WH' && cMEDir == 'DN') {
		// if the cME is DN, then its already in cMECombo as gMEDown was cloned to cMECombo so dont add
	} else {
		if (cMEDir != 'CK' || cME.multi % 1 == 0) { // because if its a .5 on multi of a click, then its a DN so its already in gMEDown
			cMECombo.push(cME);
		}
	}

	// show cMECombo
	console.log('cMECombo:', cMECombo.strOfStds());
	// g_cMECombo = cMECombo;

	// test if cMECombo is a match to any config
	var rezHandleME; // need to hold return value here, as i need to pop out fro cMECombo before returning
	if (bowserFsWantingMouseEvents) {
		MMWorkerFuncs.currentMouseEventCombo(cMECombo.asArray());
		rezHandleME = true;
	} else {
		// if cMECombo matches then return true else return false
		var isConfig = comboIsConfig(cMECombo, true);
		// rezHandleME = false; // actually i dont set rezHandleME to comboIsConfig anymore so this is doesnt have to be here // important to be here, otherwise. on dbl right click, if comboIsConfig returns true, then on windows i get that lock in mousedown issue, or i can just NOT set rezHandleME = to comboIsConfig
		console.error('cME.std:', cME.std);
		if (gMEEnteredMC && (cME.std == gMEEnteredMC + '_CK' || cME.std == gMEEnteredMC + '_UP')) {
			gMEEnteredMC = 'ALLOWED';
			console.error('allowing first downed');
			rezHandleME = false;
		} else {
			if (gMEEnteredMC || cMECombo.length > 1) {
				if (!gMEEnteredMC) {
					gMEEnteredMC = gMEDown[0].std.substr(0, 2);
					MMWorkerFuncs.prevMouseup();
				}
				rezHandleME = true;
				console.error('BLOCK MEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE');
			}
		}
		if (isConfig && !gMEEnteredMC) {
			MMWorkerFuncs.closeOpenContextMenus();
		}
	}

	// // clean up
	if (clearAll) {
		if (gMEEnteredMC) {
			gMEEnteredMC = null;
			MMWorkerFuncs.unprevMouseup();
		}
	}
	// if (clearAll) {
	// 	// gMEHistory = new METracker();
	// 	// cMECombo = new METracker();
	// } else {
	// 	// remove from cMECombo if its not a held button
	// 	if (cMEBtn == 'WH' || cMEDir != 'DN') {
	// 		cMECombo.pop(); // remove it
	// 	}
	// }

	if (infoObjForWorker.prefs['hold-duration'] > 0) {
		// is cMECombo holdable
		if (cMEBtn != 'WH' && cMEDir == 'DN' || (cMEDir == 'CK' && cME.multi % 1 == 0.5)) {
			console.log('ok holdable');

			MMWorkerFuncs.startHeldTimer(cMECombo.asArray(), (new Date()).getTime() + infoObjForWorker.prefs['hold-duration']);
		} else {
			MMWorkerFuncs.cancelAnyPendingHeldTimer();
		}
	}

	return rezHandleME;
}

function comboIsConfig(aMECombo, boolTriggerFunc) {
	// tests if aMECombo is a button combo (config) for any of the users prefs.
	// if boolTriggerConfig is true, if it finds it is a config, then it will trigger the respective func
	// returns bool
	if (bowserFsWantingMouseEvents) {
		MMWorkerFuncs.currentMouseEventCombo(cMECombo.asArray());
		return true;
	} else {
		// if aMECombo matches then return true else return false
		for (var p in infoObjForWorker.config) {
			if (aMECombo.length == infoObjForWorker.config[p].length) {
					for (var i=0; i<infoObjForWorker.config[p].length; i++) {
						if (infoObjForWorker.config[p][i].std != aMECombo[i].std || infoObjForWorker.config[p][i].multi !== aMECombo[i].multi || infoObjForWorker.config[p][i].held != aMECombo[i].held) {
							break;
						}
						if (i == infoObjForWorker.config[p].length - 1) {
							// ok the whole thing matched trigger it
							// dont break out of p loop as maybe user set another thing to have the same combo
							if (boolTriggerFunc) {
								MMWorkerFuncs.triggerConfigFunc(p);
							}
							return true;
						}
					}
			} // not same length as aMECombo so no way it can match
		}
		return false; // no matching config found for this combo
	}
}

var g_cMECombo;
function makeMouseEventHeld(a_cMECombo, zeFireTime) {

	// // test if g_cMECombo matches a_cMECombo, if it doesn't then it means things changed
	// if (g_cMECombo.strOfStds() != a_cMECombo.strOfStds()) {
	// 	console.warn('a_cMECombo no longer matches the global one so dont make it held', 'g_cMECombo:', g_cMECombo.strOfStds(), 'a_cMECombo:', a_cMECombo.strOfStds());
	// 	return;
	// }


	// make a referenced copy so i can push to it a final element that wont affect the global
	var cMECombo = new METracker();
	for (var i=0; i<a_cMECombo.length-1; i++) {
		cMECombo.push(a_cMECombo[i]);
	}

	// add in the last one as a copy so when i add to .held it wont affect the lME in handleMouseEvent
	var last_cMEComboEntry = a_cMECombo[a_cMECombo.length - 1];
	cMECombo.push(
		{
			std: last_cMEComboEntry.std,
			time: last_cMEComboEntry.time,
			multi: last_cMEComboEntry.multi,
			held: true
		}
	);

	var actualFireTime = (new Date()).getTime();

	console.error('diff between actual fire and should have fired is:', actualFireTime - zeFireTime, 'actualFireTime:', actualFireTime, 'zeFireTime:', zeFireTime);
	// send to mainthread
	if (bowserFsWantingMouseEvents) {
		console.log('sending held to prefs page');
		MMWorkerFuncs.currentMouseEventCombo(cMECombo.asArray());
	} else {
		console.log('testing if should trigger a config on mainthread');
		// if cMECombo matches then return true else return false
		var isConfig = comboIsConfig(cMECombo, true);
		if (isConfig) {
			MMWorkerFuncs.closeOpenContextMenus();
		}
	}
}
// start - common helper functions
// rev3 - https://gist.github.com/Noitidart/326f1282c780e3cb7390
function Deferred() {
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

var bootstrap = this; // needed for SIPWorker and SICWorker - rev8
const SIC_CB_PREFIX = '_a_gen_cb_';
const SIC_TRANS_WORD = '_a_gen_trans_';
var sic_last_cb_id = -1;
function SICWorker(workerScopeName, aPath, aFuncExecScope=bootstrap, aCore=core) {
	// creates a global variable in bootstrap named workerScopeName which will hold worker, do not set up a global for it like var Blah; as then this will think something exists there
	// aScope is the scope in which the functions are to be executed
	// ChromeWorker must listen to a message of 'init' and on success of it, it should sendMessage back saying aMsgEvent.data == {aTopic:'init', aReturn:true}
	// "Start and Initialize ChromeWorker" // based on SIPWorker
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`
	var deferredMain_SICWorker = new Deferred();

	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new ChromeWorker(aPath);

		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}

		var afterInitListener = function(aMsgEvent) {
			// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
			var aMsgEventData = aMsgEvent.data;
			console.log('mainthread receiving message:', aMsgEventData);

			// postMessageWithCallback from worker to mt. so worker can setup callbacks after having mt do some work
			var callbackPendingId;
			if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SIC_CB_PREFIX) == 0) {
				callbackPendingId = aMsgEventData.pop();
			}

			var funcName = aMsgEventData.shift();

			if (funcName in aFuncExecScope) {
				var rez_mainthread_call = aFuncExecScope[funcName].apply(null, aMsgEventData);

				if (callbackPendingId) {
					if (rez_mainthread_call.constructor.name == 'Promise') {
						rez_mainthread_call.then(
							function(aVal) {
								if (aVal.length >= 2 && aVal[aVal.length-1] == SIC_TRANS_WORD && Array.isArray(aVal[aVal.length-2])) {
									// to transfer in callback, set last element in arr to SIC_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
									console.error('doing transferrrrr');
									aVal.pop();
									bootstrap[workerScopeName].postMessage([callbackPendingId, aVal], aVal.pop());
								} else {
									bootstrap[workerScopeName].postMessage([callbackPendingId, aVal]);
								}
							},
							function(aReason) {
								console.error('aReject:', aReason);
								bootstrap[workerScopeName].postMessage([callbackPendingId, ['promise_rejected', aReason]]);
							}
						).catch(
							function(aCatch) {
								console.error('aCatch:', aCatch);
								bootstrap[workerScopeName].postMessage([callbackPendingId, ['promise_rejected', aCatch]]);
							}
						);
					} else {
						// assume array
						if (rez_mainthread_call.length > 2 && rez_mainthread_call[rez_mainthread_call.length-1] == SIC_TRANS_WORD && Array.isArray(rez_mainthread_call[rez_mainthread_call.length-2])) {
							// to transfer in callback, set last element in arr to SIC_TRANS_WORD and 2nd to last element an array of the transferables									// cannot transfer on promise reject, well can, but i didnt set it up as probably makes sense not to
							rez_mainthread_call.pop();
							bootstrap[workerScopeName].postMessage([callbackPendingId, rez_mainthread_call], rez_mainthread_call.pop());
						} else {
							bootstrap[workerScopeName].postMessage([callbackPendingId, rez_mainthread_call]);
						}
					}
				}
			}
			else { console.warn('funcName', funcName, 'not in scope of aFuncExecScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out

		};

		var beforeInitListener = function(aMsgEvent) {
			// note:all msgs from bootstrap must be postMessage([nameOfFuncInWorker, arg1, ...])
			var aMsgEventData = aMsgEvent.data;
			if (aMsgEventData[0] == 'init') {
				bootstrap[workerScopeName].removeEventListener('message', beforeInitListener);
				bootstrap[workerScopeName].addEventListener('message', afterInitListener);
				deferredMain_SICWorker.resolve(true);
				if ('init' in aFuncExecScope) {
					aFuncExecScope[aMsgEventData.shift()].apply(null, aMsgEventData);
				}
			}
		};

		// var lastCallbackId = -1; // dont do this, in case multi SICWorker's are sharing the same aFuncExecScope so now using new Date().getTime() in its place // link8888881
		bootstrap[workerScopeName].postMessageWithCallback = function(aPostMessageArr, aCB, aPostMessageTransferList) {
			// lastCallbackId++; // link8888881
			sic_last_cb_id++;
			var thisCallbackId = SIC_CB_PREFIX + sic_last_cb_id; // + lastCallbackId; // link8888881
			aFuncExecScope[thisCallbackId] = function() {
				delete aFuncExecScope[thisCallbackId];
				// console.log('in mainthread callback trigger wrap, will apply aCB with these arguments:', arguments, 'turned into array:', Array.prototype.slice.call(arguments));
				aCB.apply(null, arguments[0]);
			};
			aPostMessageArr.push(thisCallbackId);
			// console.log('aPostMessageArr:', aPostMessageArr);
			bootstrap[workerScopeName].postMessage(aPostMessageArr, aPostMessageTransferList);
		};

		bootstrap[workerScopeName].addEventListener('message', beforeInitListener);
		bootstrap[workerScopeName].postMessage(['init', aCore]);

	} else {
		deferredMain_SICWorker.reject('Something is loaded into bootstrap[workerScopeName] already');
	}

	return deferredMain_SICWorker.promise;

}

function SIPWorker(workerScopeName, aPath, aCore=core) {
	// "Start and Initialize PromiseWorker"
	// returns promise
		// resolve value: jsBool true
	// aCore is what you want aCore to be populated with
	// aPath is something like `core.addon.path.content + 'modules/workers/blah-blah.js'`

	// :todo: add support and detection for regular ChromeWorker // maybe? cuz if i do then ill need to do ChromeWorker with callback

	var deferredMain_SIPWorker = new Deferred();

	if (!(workerScopeName in bootstrap)) {
		bootstrap[workerScopeName] = new PromiseWorker(aPath);

		if ('addon' in aCore && 'aData' in aCore.addon) {
			delete aCore.addon.aData; // we delete this because it has nsIFile and other crap it, but maybe in future if I need this I can try JSON.stringify'ing it
		}

		var promise_initWorker = bootstrap[workerScopeName].post('init', [aCore]);
		promise_initWorker.then(
			function(aVal) {
				console.log('Fullfilled - promise_initWorker - ', aVal);
				// start - do stuff here - promise_initWorker
				deferredMain_SIPWorker.resolve(true);
				// end - do stuff here - promise_initWorker
			},
			function(aReason) {
				var rejObj = {name:'promise_initWorker', aReason:aReason};
				console.warn('Rejected - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initWorker', aCaught:aCaught};
				console.error('Caught - promise_initWorker - ', rejObj);
				deferredMain_SIPWorker.reject(rejObj);
			}
		);

	} else {
		deferredMain_SIPWorker.reject('Something is loaded into bootstrap[workerScopeName] already');
	}

	return deferredMain_SIPWorker.promise;

}

function aReasonMax(aReason) {
	var deepestReason = aReason;
	while (deepestReason.hasOwnProperty('aReason') || deepestReason.hasOwnProperty()) {
		if (deepestReason.hasOwnProperty('aReason')) {
			deepestReason = deepestReason.aReason;
		} else if (deepestReason.hasOwnProperty('aCaught')) {
			deepestReason = deepestReason.aCaught;
		}
	}
	return deepestReason;
}

// sendAsyncMessageWithCallback - rev3
const SAM_CB_PREFIX = '_sam_gen_cb_';
var sam_last_cb_id = -1;
function sendAsyncMessageWithCallback(aMessageManager, aGroupId, aMessageArr, aCallbackScope, aCallback) {
	sam_last_cb_id++;
	var thisCallbackId = SAM_CB_PREFIX + sam_last_cb_id;
	aCallbackScope = aCallbackScope ? aCallbackScope : bootstrap;
	aCallbackScope[thisCallbackId] = function(aMessageReceivedArr) {
		delete aCallbackScope[thisCallbackId];
		aCallback.apply(null, aMessageReceivedArr);
	}
	aMessageArr.push(thisCallbackId);
	aMessageManager.sendAsyncMessage(aGroupId, aMessageArr);
}


function extendCore() {
	// adds some properties i use to core based on the current operating system, it needs a switch, thats why i couldnt put it into the core obj at top
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			core.os.version = parseFloat(Services.sysinfo.getProperty('version'));
			// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
			if (core.os.version == 6.0) {
				core.os.version_name = 'vista';
			}
			if (core.os.version >= 6.1) {
				core.os.version_name = '7+';
			}
			if (core.os.version == 5.1 || core.os.version == 5.2) { // 5.2 is 64bit xp
				core.os.version_name = 'xp';
			}
			break;

		case 'darwin':
			var userAgent = myServices.hph.userAgent;

			var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);


			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {
				var version_osx_str = version_osx[1];
				var ints_split = version_osx[1].split('.');
				if (ints_split.length == 1) {
					core.os.version = parseInt(ints_split[0]);
				} else if (ints_split.length >= 2) {
					core.os.version = ints_split[0] + '.' + ints_split[1];
					if (ints_split.length > 2) {
						core.os.version += ints_split.slice(2).join('');
					}
					core.os.version = parseFloat(core.os.version);
				}
				// this makes it so that 10.10.0 becomes 10.100
				// 10.10.1 => 10.101
				// so can compare numerically, as 10.100 is less then 10.101

				//core.os.version = 6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
			}
			break;
		default:
			// nothing special
	}


}

function prefTypeAsStr(aTypeAsInt) {
	// Ci.nsIPrefBranch.PREF_INVALID 0
	// Ci.nsIPrefBranch.PREF_STRING 32
	// Ci.nsIPrefBranch.PREF_INT 64
	// Ci.nsIPrefBranch.PREF_BOOL 128
	switch (prefs[aPrefName].type) {
		case Ci.nsIPrefBranch.PREF_BOOL:

				return 'Bool';

			break;
		case Ci.nsIPrefBranch.PREF_INT:

				return 'Int';

			break;
		case Ci.nsIPrefBranch.PREF_STRING:

				return 'Char';

			break;
		default:
			console.error('got invalid aTypeAsInt:', aTypeAsInt);
			throw new Error('got invalid aTypeAsInt');
	}
}

function ensureBool(aVal) {
	if (aVal === 'false' || aVal === false || !aVal) { // !aVal covers blank string '', null, undefined
		return false;
	} else {
		return true;
	}
}

function makeDir_Bug934283(path, options) {
	// pre FF31, using the `from` option would not work, so this fixes that so users on FF 29 and 30 can still use my addon
	// the `from` option should be a string of a folder that you know exists for sure. then the dirs after that, in path will be created
	// for example: path should be: `OS.Path.join('C:', 'thisDirExistsForSure', 'may exist', 'may exist2')`, and `from` should be `OS.Path.join('C:', 'thisDirExistsForSure')`
	// options of like ignoreExisting is exercised on final dir

	if (!options || !('from' in options)) {
		console.error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
		throw new Error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
	}

	if (path.toLowerCase().indexOf(options.from.toLowerCase()) == -1) {
		console.error('The `from` string was not found in `path` string');
		throw new Error('The `from` string was not found in `path` string');
	}

	var options_from = options.from;
	delete options.from;

	var dirsToMake = OS.Path.split(path).components.slice(OS.Path.split(options_from).components.length);
	console.log('dirsToMake:', dirsToMake);

	var deferred_makeDir_Bug934283 = new Deferred();
	var promise_makeDir_Bug934283 = deferred_makeDir_Bug934283.promise;

	var pathExistsForCertain = options_from;
	var makeDirRecurse = function() {
		pathExistsForCertain = OS.Path.join(pathExistsForCertain, dirsToMake[0]);
		dirsToMake.splice(0, 1);
		var promise_makeDir = OS.File.makeDir(pathExistsForCertain, options);
		promise_makeDir.then(
			function(aVal) {
				console.log('Fullfilled - promise_makeDir - ', 'ensured/just made:', pathExistsForCertain, aVal);
				if (dirsToMake.length > 0) {
					makeDirRecurse();
				} else {
					deferred_makeDir_Bug934283.resolve('this path now exists for sure: "' + pathExistsForCertain + '"');
				}
			},
			function(aReason) {
				var rejObj = {
					promiseName: 'promise_makeDir',
					aReason: aReason,
					curPath: pathExistsForCertain
				};
				console.error('Rejected - ' + rejObj.promiseName + ' - ', rejObj);
				deferred_makeDir_Bug934283.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDir', aCaught:aCaught};
				console.error('Caught - promise_makeDir - ', rejObj);
				deferred_makeDir_Bug934283.reject(rejObj); // throw aCaught;
			}
		);
	};
	makeDirRecurse();

	return promise_makeDir_Bug934283;
}
function tryOsFile_ifDirsNoExistMakeThenRetry(nameOfOsFileFunc, argsOfOsFileFunc, fromDir, aOptions={}) {
	//last update: 061215 0303p - verified worker version didnt have the fix i needed to land here ALSO FIXED so it handles neutering of Fx37 for writeAtomic and I HAD TO implement this fix to worker version, fix was to introduce aOptions.causesNeutering
	// aOptions:
		// causesNeutering - default is false, if you use writeAtomic or another function and use an ArrayBuffer then set this to true, it will ensure directory exists first before trying. if it tries then fails the ArrayBuffer gets neutered and the retry will fail with "invalid arguments"

	// i use this with writeAtomic, copy, i havent tested with other things
	// argsOfOsFileFunc is array of args
	// will execute nameOfOsFileFunc with argsOfOsFileFunc, if rejected and reason is directories dont exist, then dirs are made then rexecute the nameOfOsFileFunc
	// i added makeDir as i may want to create a dir with ignoreExisting on final dir as was the case in pickerIconset()
	// returns promise

	var deferred_tryOsFile_ifDirsNoExistMakeThenRetry = new Deferred();

	if (['writeAtomic', 'copy', 'makeDir'].indexOf(nameOfOsFileFunc) == -1) {
		deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
		// not supported because i need to know the source path so i can get the toDir for makeDir on it
		return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise; //just to exit further execution
	}

	// setup retry
	var retryIt = function() {
		console.info('tryosFile_ retryIt', 'nameOfOsFileFunc:', nameOfOsFileFunc, 'argsOfOsFileFunc:', argsOfOsFileFunc);
		var promise_retryAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		promise_retryAttempt.then(
			function(aVal) {
				console.log('Fullfilled - promise_retryAttempt - ', aVal);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('retryAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_retryAttempt', aReason:aReason};
				console.error('Rejected - promise_retryAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_retryAttempt', aCaught:aCaught};
				console.error('Caught - promise_retryAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	// popToDir
	var toDir;
	var popToDir = function() {
		switch (nameOfOsFileFunc) {
			case 'writeAtomic':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;

			case 'copy':
				toDir = OS.Path.dirname(argsOfOsFileFunc[1]);
				break;

			case 'makeDir':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;

			default:
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
				return; // to prevent futher execution
		}
	};

	// setup recurse make dirs
	var makeDirs = function() {
		if (!toDir) {
			popToDir();
		}
		var promise_makeDirsRecurse = makeDir_Bug934283(toDir, {from: fromDir});
		promise_makeDirsRecurse.then(
			function(aVal) {
				console.log('Fullfilled - promise_makeDirsRecurse - ', aVal);
				retryIt();
			},
			function(aReason) {
				var rejObj = {name:'promise_makeDirsRecurse', aReason:aReason};
				console.error('Rejected - promise_makeDirsRecurse - ', rejObj);
				/*
				if (aReason.becauseNoSuchFile) {
					console.log('make dirs then do retryAttempt');
					makeDirs();
				} else {
					// did not get becauseNoSuchFile, which means the dirs exist (from my testing), so reject with this error
				*/
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				/*
				}
				*/
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDirsRecurse', aCaught:aCaught};
				console.error('Caught - promise_makeDirsRecurse - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	var doInitialAttempt = function() {
		var promise_initialAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		console.info('tryosFile_ initial', 'nameOfOsFileFunc:', nameOfOsFileFunc, 'argsOfOsFileFunc:', argsOfOsFileFunc);
		promise_initialAttempt.then(
			function(aVal) {
				console.log('Fullfilled - promise_initialAttempt - ', aVal);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('initialAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_initialAttempt', aReason:aReason};
				console.error('Rejected - promise_initialAttempt - ', rejObj);
				if (aReason.becauseNoSuchFile) { // this is the flag that gets set to true if parent dir(s) dont exist, i saw this from experience
					console.log('make dirs then do secondAttempt');
					makeDirs();
				} else {
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				}
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initialAttempt', aCaught:aCaught};
				console.error('Caught - promise_initialAttempt - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	if (!aOptions.causesNeutering) {
		doInitialAttempt();
	} else {
		// ensure dir exists, if it doesnt then go to makeDirs
		popToDir();
		var promise_checkDirExistsFirstAsCausesNeutering = OS.File.exists(toDir);
		promise_checkDirExistsFirstAsCausesNeutering.then(
			function(aVal) {
				console.log('Fullfilled - promise_checkDirExistsFirstAsCausesNeutering - ', aVal);
				// start - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
				if (!aVal) {
					makeDirs();
				} else {
					doInitialAttempt(); // this will never fail as we verified this folder exists
				}
				// end - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
			},
			function(aReason) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aReason:aReason};
				console.warn('Rejected - promise_checkDirExistsFirstAsCausesNeutering - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aCaught:aCaught};
				console.error('Caught - promise_checkDirExistsFirstAsCausesNeutering - ', rejObj);
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		);
	}


	return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise;
}
function xpcomSetTimeout(aNsiTimer, aDelayTimerMS, aTimerCallback) {
	aNsiTimer.initWithCallback({
		notify: function() {
			aTimerCallback();
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}

var gXpcomTimers = {};
var gXpcomTimerId = 0;
function xpcomSetTimeout2(aDelayTimerMS, aTimerCallback) {
	gXpcomTimerId++;
	var cXpcomTimerId = gXpcomTimerId;
	gXpcomTimers[cXpcomTimerId] = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
	gXpcomTimers[cXpcomTimerId].initWithCallback({
		notify: function() {
			delete gXpcomTimers[cXpcomTimerId];
			aTimerCallback();
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}
// end - common helper functions
