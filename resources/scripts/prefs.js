/*start - chrome stuff*/
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/addons/XPIProvider.jsm');
Cu.import('resource://gre/modules/Promise.jsm');

var MouseControl = XPIProvider.bootstrapScopes['MouseControl@jetpack'];
const installPath = MouseControl.self.aData.installPath.path; //platform specific so no need to normalize
const funcsFilePath = OS.Path.join(installPath, 'funcs.json');
const TDecoder = new TextDecoder();

var funcsFileContents; //holds contents after reading funcsFilePath, should unprased json
var funcsFileObj; //parsed json

document.addEventListener('DOMContentLoaded', init, false);
console.log('JSON:', JSON);
function init() {
	try {
		var promise = readFuncs();
		promise.then(
			function(aVal) {
				console.info('Promise Success: `readFuncs()`', 'aVal:', aVal);
				console.info('funcsFileContents:', funcsFileContents);
				refreshConfigWrap();
			},
			function(aReason) {
				console.error('Promise Rejected: `readFuncs()`', 'aReason:', aReason);
				alert('Failed to read functions file. See console for more detail. Please reload the page to try again.');
				document.body.textContent = 'Failed to read functions file. See console for more detail. Please reload the page to try again.';
			}
		);
	} catch (ex) {
		console.error('ex=', ex);
	}
}

function refreshConfigWrap() {
	//removes all elements in configWrap and then re-appends them based on domJson object
	var domJson = [];
/*
<div class="configSubhead">TABS<hr></div>
<span class="opt" group="tabs">
	<div class="pseudo-config trash-function"></div>
	<div class="pseudo-config configure-function"></div>
	<div class="pseudo-config share-function"></div>
	<span>
		Select Tab to Right
		<small>Focuses tab to right of current tab</small>
	</span>
	<span><img src="mouse-left.png" /> + <img src="mouse-left.png"/></span>
</span>
<hr>
*/
	console.log('funcsFileObj=', funcsFileObj);
	
	funcsFileObj.sort(function(a, b) {
		if (a.group == b.group) {
			return 0;
		} else {
			return a.group > b.group;
		}
	});
	
	var lastGroup = '';
	Array.prototype.forEach.call(funcsFileObj, function(config) {
		if (lastGroup != config.group) {
			//put in header
			domJson.push(
				['div', {class: 'configSubhead'}, 
					config.group.toUpperCase(),
					['hr', {}
						
					]
				]
			);
		}
		lastGroup = config.group;
		
		domJson.push(
			['span', {class:'opt', group:config.group},
				['div', {class:'pseudo-config trash-function', onclick:'showMsg(".msg-trash")'}
					
				],
				['div', {class:'pseudo-config configure-function', onclick:'showMsg(".msg-customize")'}
					
				],
				['div', {class:'pseudo-config share-function', onclick:'showMsg(".msg-share")'}
					
				],
				['span', {},
					config.name,
					['small', {},
						config.desc
					]
				],
				['span', {},
					config.combo
				]
			]
		);
		domJson.push(
			['hr', {}
				
			]
		);
	});

	var configWrap = document.querySelector('#configWrap');
	while (configWrap.hasChildNodes()) {
		configWrap.removeChild(configWrap.lastChild);
	}
	
	configWrap.appendChild(jsonToDOM(domJson, document, {}));
	
}

function readFuncs() {
	try {
		var promise = OS.File.read(funcsFilePath);
		return promise.then(
		  function onSuc(array) {
			funcsFileContents = TDecoder.decode(array);
			funcsFileObj = JSON.parse(funcsFileContents); //if it cant parse the try-catch will catch it
			return Promise.resolve('read');
		  },
		  function onRej(aReason) {
			var __proto__all = Object.getOwnPropertyNames(aReason.__proto__);
			var __proto__enum = Object.keys(aReason.__proto__);
			var __proto__nonenum = __proto__all.filter(function (k) { //the nonenum are the error reasons, like `becauseClosed` `becauseExists` `becauseNoSuchFile` etc
				return __proto__enum.indexOf(k) == -1; //if not found in enum, return true so we keep it
			});

			var aReasonStr = [];
			Array.prototype.forEach.call(__proto__nonenum, function (k) {
				if (aReason[k]) {
					aReasonStr.push(k);
				}
			});
			
			if (aReasonStr.indexOf('becauseNoSuchFile') > -1) {
				console.warn('Promise Rejected: `OS.File.read(funcsFilePath)`', 'aReasonStr:', aReasonStr.join(','), 'aReason:', aReason, 'will now write new file with default functions');
				//create file with default json
				funcsFileContents = JSON.stringify(MouseControl.funcsFileObjDefault);
				funcsFileObj = JSON.parse(funcsFileContents);
				var promise2 = OS.File.writeAtomic(funcsFilePath, funcsFileContents, {tmpPath: funcsFilePath + '.tmp', encoding:'utf-8'});
				return promise2.then(
					function(aVal) {
						return Promise.resolve('wrote');
					},
					function(aReason) {
						console.log('Promise2 Rejected: `OS.File.writeAtomic`', 'aReason:', aReason, 'will now throw this back to the main promise of `readFuncs()`, so this will be logged twice');
						return Promise.reject(aReason);
					}
				);
			} else {
				console.error('Promise Rejected: `OS.File.read(funcsFilePath)`', 'aReasonStr:', aReasonStr.join(','), 'aReason:', aReason, 'dont know how to handle this so return this rejection to main promise of `readFuncs()`');
				return Promise.reject(aReason);
			}
		  }
		);
	} catch (ex) {
		console.warn('readFuncs Ex Occured:', ex);
		return Promise.reject(ex);
	}
}

/*end - chrome stuff*/

/*DOM Building and HTML Insertion*/
/*dom insertion library function from MDN - https://developer.mozilla.org/en-US/docs/XUL_School/DOM_Building_and_HTML_Insertion*/
jsonToDOM.namespaces = {
	html: 'http://www.w3.org/1999/xhtml',
	xul: 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
};
jsonToDOM.defaultNamespace = jsonToDOM.namespaces.html;
function jsonToDOM(xml, doc, nodes) {
	function namespace(name) {
		var m = /^(?:(.*):)?(.*)$/.exec(name);        
		return [jsonToDOM.namespaces[m[1]], m[2]];
	}

	function tag(name, attr) {
		if (Array.isArray(name)) {
			var frag = doc.createDocumentFragment();
			Array.forEach(arguments, function (arg) {
				if (!Array.isArray(arg[0]))
					frag.appendChild(tag.apply(null, arg));
				else
					arg.forEach(function (arg) {
						frag.appendChild(tag.apply(null, arg));
					});
			});
			return frag;
		}

		var args = Array.slice(arguments, 2);
		var vals = namespace(name);
		var elem = doc.createElementNS(vals[0] || jsonToDOM.defaultNamespace, vals[1]);

		for (var key in attr) {
			var val = attr[key];
			if (nodes && key == 'key')
				nodes[val] = elem;

			vals = namespace(key);
			if (typeof val == 'function')
				elem.addEventListener(key.replace(/^on/, ''), val, false);
			else
				elem.setAttributeNS(vals[0] || '', vals[1], val);
		}
		args.forEach(function(e) {
			try {
				elem.appendChild(
									Object.prototype.toString.call(e) == '[object Array]'
									?
										tag.apply(null, e)
									:
										e instanceof doc.defaultView.Node
										?
											e
										:
											doc.createTextNode(e)
								);
			} catch (ex) {
				elem.appendChild(doc.createTextNode(ex));
			}
		});
		return elem;
	}
	return tag.apply(null, xml);
}
/*end - dom insertion library function from MDN*/

/*start - non jquery dom stuff*/
function showMsg(selector) {
	var container = document.querySelector(selector);
	/* i thought if i did this than scroll would not work while over this div but its not true
	container.style.width = window.innerWidth + 'px';
	container.style.height = window.innerHeight + 'px';
	*/
	var msgWrap = container.querySelector('.msg-wrap');
	if (!msgWrap) {
		alert('Error: Message wrap not found');
		return;
	}
	
	container.style.pointerEvents = 'auto';
	container.style.opacity = 1;
	msgWrap.style.opacity = 1;
	msgWrap.style.marginTop = 0;
	msgWrap.style.pointerEvents = 'auto';
}
function hideMsg(selector) {
	var container = document.querySelector(selector);
	
	var msgWrap = container.querySelector('.msg-wrap');
	if (!msgWrap) {
		alert('Error: Message wrap not found');
		return;
	}
	
	container.style.transitionDelay = '40ms';
	msgWrap.style.transitionDelay = '0';
	container.style.opacity = ''; //:learned: setting to blank removes the inline style property
	msgWrap.style.marginTop = '';
	msgWrap.style.pointerEvents = '';
	msgWrap.style.transition = 'opacity 150ms ease-in, margin-top 150ms ease-in';
	msgWrap.style.opacity = '';
	
	container.addEventListener('transitionend', function() {
		container.removeEventListener('transitionend', arguments.callee, false);
		container.style.pointerEvents = '';
		container.style.transitionDelay = '';
		msgWrap.style.transitionDelay = '';
		msgWrap.style.transition = '';
	}, false);
}
/*end - non jquery dom stuff*/

/*start - jquery stuff*/
$(function () {
	$("select").selectbox({
		effect: 'fade'
	});
	
});
function addSubheads() {
	//to the config div it adds a subhead over every group of opts
	
}