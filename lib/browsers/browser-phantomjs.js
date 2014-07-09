var phantom = require('phantom');
var url = require('url');
var crypto = require('crypto');

var phantomjs = {};

phantomjs.render = function(task, logger, callback) {

  phantom.create(function(ph) {

    var path;

    ph.createPage(function(page) {
      page.set('viewportSize', {width:1280,height:1024})
      page.open(task.host + task.pageUrl,
        function(status) {
          page.evaluate(function () {
            return document.getElementsByTagName('title')[0].innerText;
          }, function (result) {
            setTimeout(function() {

              var urlParts = url.parse(task.host);

              var hash = crypto.createHash('md5').update(task.pageUrl).digest('hex').substring(0, 8);

              path = task.screenshotsDir + '/' + urlParts.hostname + '/' + result + '.' + hash + '.png';

              logger.verbose.writeln("Writing to: " + path);

              page.render(path, {}, function () {

                ph.exit();
                callback({
                  host: task.host,
                  hostLabel: task.hostLabel,
                  url: task.pageUrl,
                  fullpath: path,
                  pagetitle: result,
                  uid: hash
                });
              });
            }, 5000);
          });
        });
    });
  });
};

module.exports = phantomjs;