//require.paths.push('/home/vagrant/slimerjs-0.9.1/');

var args = require('system').args;
var page = require('webpage').create();
var path = require('path');

page.onConsoleMessage = function (msg) {
  console.log(msg);
};
page.open(args[1], function (status) {
  var mainTitle = page.evaluate(function () {
    return document.querySelector("title").textContent;
  });

  page.viewportSize = { width:1024, height:768 };

  console.log(mainTitle);
  page.render(args[2], {onlyViewport:false});
  slimer.exit();
});
