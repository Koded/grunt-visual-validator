var phantom = require('node-phantom');
var url = require('url');
var crypto = require('crypto');

var phantomjs = {};

phantomjs.render = function(task, logger, callback) {

  logger.log.writeln('Rendering: ' + task.pageUrl);

  try {
    phantom.create(function (err, ph) {
      if (err) throw err;

      var path;

      ph.createPage(function (err, page) {
        if (err) throw err;

        page.setViewport({width: 1280, height: 1024});

        page.open(task.host + task.pageUrl, function (err, status) {

          if ( status == 404 ) {
            logger.log.warn('Page not found: ' + task.host + task.pageUrl);
          }

          if (err) throw err;
          page.evaluate(function () {
            return document.getElementsByTagName('title')[0].innerText;
          }, function (err, result) {

            var urlParts = url.parse(task.host);
            if (err) throw err;

            var hash = crypto.createHash('md5').update(task.pageUrl).digest('hex').substring(0, 8);

            path = task.screenshotsDir + '/' + urlParts.hostname + '/' + result + '.' + hash + '.png';

            logger.verbose.writeln("Writing to: " + path);

            /* Need to delay for font rendering. Need to find a more elegant solution */
            setTimeout(function() {

              page.render(path, function (err) {
                if (err) throw err;

                ph.exit();
                //ph._phantom.kill('SIGTERM');
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
    }, {parameters:{
      'ignore-ssl-errors':'yes'
    }});
  } catch ( err ) {
    logger.log.error(err);
  }
};

module.exports = phantomjs;