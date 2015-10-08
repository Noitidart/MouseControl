
sortConfigOpts();
configHeadify()
function configHeadify() {
    var heads = $('#configWrap .configSubhead');
    var opts = $('#configWrap .opt');
    var hr = $('#configWrap hr');
    hr.each(function(i, el) {
        el.parentNode.removeChild(el);
    });
    heads.each(function(i, el) {
        el.parentNode.removeChild(el);
    });
   
    var optsWithOrder = []; //holds each opt element and 2nd param is style.order, because we cant simply go through dom because order attribute actually repositions the els in the dom
    //[order, el, config_group]
   
    opts.each(function(i, el) {
        optsWithOrder.push([el.style.order ? parseInt(el.style.order) : 0, el, el.getAttribute('group')]);
        //el.removeClass('nohr');
    });
   
    //alert(optsWithOrder.join('\n\n'));
   
    optsWithOrder.sort(function(a,b){
        return a[0] > b[0];
    });
   
    //alert(optsWithOrder.join('\n\n'));
   
    $(optsWithOrder).each(function(i, val) {
        if (i == 0) {
            //var div = document.createElement('div')
            //div.innerHTML = val[2].toUpperCase() + '<hr>';
            //val[1].parentNode.insertBefore(div, val[1]);
            var thisOpt = $(val[1]);
            thisOpt.before('<div class="configSubhead" style="order:' + (val[0]-1) + '">' + val[2].toUpperCase() + '<hr></div>');
        } else {
            //alert('this=' + $(optsWithOrder[i][1]).html() + '\nprev:' + $(optsWithOrder[i-1][1]).html())
            if (optsWithOrder[i-1][2] != val[2]) {
                var prevOpt = $(optsWithOrder[i-1][1]);
                var thisOpt = $(val[1]);
                //prevOpt.addClass('nohr');
                thisOpt.before('<div class="configSubhead" style="order:' + (val[0]-1) + '">' + val[2].toUpperCase() + '<hr></div>');
                //alert(prevOpt.get(0).classList)
            } else {
                var prevOpt = $(optsWithOrder[i-1][1]);
                var thisOpt = $(val[1]);
                thisOpt.before('<hr style="order:' + (val[0]-2) + '">');
            }
        }
    });
}
function sortConfigOpts(by) {
//by vals:
//null = restore default
//0 = alpha
//1 = group
//2 = mouse combo
    var opts = $('#configWrap .opt');
    //alert(opts.length);
    var optsArr = [];
    $.each(opts, function(i, el) {
        el = $(el);
        var byVal = 0;
        switch (by) {
            case 0:
                byVal = el.html().match(/<span>([\s\S]*?)</i)[1].trim();
                break;
            case 1:
                byVal = el.attr('group');
                break;
            case 2:
                byVal = el.html().match(/[\s\S]*<span>([\s\S]*?)</i)[1].trim();
                break;
            default:
                //do nothing
        }
        optsArr.push([byVal, el]);
    });
   
    alert(optsArr.join('\n\n'));
   
    optsArr.sort(function(a,b){
        return a[0] > b[0];
    });
   
    //alert(optsArr.join('\n\n'));
    $.each(optsArr, function(i, row) {
        row[1].attr('style', 'order:' + (1 + ((3*i) - 3)));
    });
}