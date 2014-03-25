var slimerjs = {};
var url = require('url');
var spawn = require('child_process').exec;

slimerjs.render = function(task, logger, callback) {

  logger.log.writeln('Rendering: ' + task.pageUrl);

  var urlParts = url.parse(task.host);

  //var hash = crypto.createHash('md5').update(task.pageUrl).digest('hex').substring(0, 8);
  var path = task.screenshotsDir + '/' + urlParts.hostname + '/' + task.pageUrl.substr(1).replace('/', '--').replace('.html', '') + '.png';

  logger.verbose.writeln("Writing to: " + path);

  var runner = spawn('xvfb-run --auto-servernum --server-num=1 --server-args="-noreset" /opt/slimerjs-0.9.1/slimerjs ./lib/scripts/screenshot.js ' + task.host + task.pageUrl + ' ' + path, [], {
    cwd: __dirname,
    env: '/bin/bash'
  });

  var filename;

  runner.stdout.on('data', function (data) {
    logger.log.writeln(data);
    filename = data;
  });

  runner.stderr.on('data', function (data) {
    logger.log.error(data);
  });

  runner.on('close', function (code) {

    callback({
      host: task.host,
      hostLabel: task.hostLabel,
      url: task.pageUrl,
      fullpath: path,
      pagetitle: filename,
      //uid: hash
      uid: task.pageUrl.substr(1).replace('/', '--').replace('.html', '')
    });

  });
};

module.exports = slimerjs;