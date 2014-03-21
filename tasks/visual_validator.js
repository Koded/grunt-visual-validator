/*
 * visual-validator
 *
 *
 * Copyright (c) 2013 Jon Brace
 * Licensed under the MIT license.
 */

'use strict';

var phantom = require('node-phantom'),
    url = require('url'),
    Q = require('q'),
    fs = require('fs.extra'),
    gm = require('gm'),
    crypto = require('crypto'),
    async = require('async'),
    _ = require('lodash'),
    path = require('path'),
    handlebars = require('handlebars');

module.exports = function (grunt) {

  var screenshot = async.queue(function (task, callback) {

    grunt.log.writeln('Rendering: ' + task.pageUrl);

    try {

      phantom.create(function (err, ph) {
        if (err) throw err;

        var path;

        ph.createPage(function (err, page) {
          if (err) throw err;

          page.setViewport({width: 1280, height: 1024});

          page.open(task.host + task.pageUrl, function (err, status) {

            if ( status == 404 ) {
              Grunt.log.warn('Page not found: ' + task.host + task.pageUrl);
            }

            if (err) throw err;
            page.evaluate(function () {
              return document.getElementsByTagName('title')[0].innerText;
            }, function (err, result) {

              var urlParts = url.parse(task.host);
              if (err) throw err;

              var hash = crypto.createHash('md5').update(task.pageUrl).digest('hex').substring(0, 8);

              path = task.screenshotsDir + '/' + urlParts.hostname + '/' + result + '.' + hash + '.png';

              grunt.verbose.writeln("Writing to: " + path);

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
      grunt.log.error(err);
    }

  }, 4);

  var createDiff = async.queue(function(task, callback) {

    var data = task.data;
    var options = task.options;

    gm.compare(data.paths[0].path, data.paths[1].path, options.threshold, function (err, isEqual, equality, raw) {

      if (err) {
        grunt.log.error(err);
      }

      grunt.log.subhead("Testing: " + data.url)

      if (!isEqual) {
        grunt.log.warn('Changes found (' + equality + ')');
      }

      if ( !isEqual || options.includeMatching ) {

        var diffPath = options.screenshots + '/diffs/' + data.pagetitle + '.' + data.uid + '.png';

        gm.compare(data.paths[0].path, data.paths[1].path, {
          'file': diffPath
        });

        var jsonResults = {
          diff: diffPath,
          isEqual: isEqual,
          result: data
        };

      }
      else {
        fs.unlink(data.paths[0].path);
        fs.unlink(data.paths[1].path);
      }

      callback(jsonResults);
    });


  });


  grunt.registerMultiTask('visual_validator', 'Compare screenshots of a development site against a baseline site.', function () {

    var screenshots = [];
    var done = this.async();

    var options = this.options({
      screenshots: 'screenshots',
      threshold: 0.003,
      includeMatching: false
    });

    options.screenshots = grunt.option('screenshots') || options.screenshots;
    options.hosts.dev = grunt.option('host-dev') || options.hosts.dev;
    options.hosts.stable = grunt.option('host-stable') || options.hosts.stable;
    options.includeMatching = grunt.option('include-matching') || options.includeMatching;

    fs.rmrfSync(options.screenshots);
    fs.mkdirpSync(options.screenshots + '/diffs');

    if ( typeof options.urls === 'function' ) {
      var urls = options.urls();
    }
    else {
      var urls = options.urls;
    }

    /**
     * Can't seem to catch a phantom crash
     */
    var stayAlive = setInterval(function() {

      if ( screenshot.length() == 0 && screenshot.running() != 0 ) {
        // probably phantom has crashed so force a drain.
        grunt.verbose.warn("Workers finished but screenshots outstanding - PhantomJs has probably crashed.")
        screenshot.drain();
      }
    }, 2000);

    grunt.log.header("Generating Screenshots");

    urls.forEach(function (pageUrl) {

      [{label:'dev',host:options.hosts.dev}, {label:'stable',host:options.hosts.stable}].forEach(function (env) {

        screenshot.push({
          host: env.host,
          hostLabel: env.label,
          pageUrl: pageUrl,
          screenshotsDir: options.screenshots
        }, function (result, err) {
          if ( err ) {
            grunt.log.error(err);
          }
          screenshots.push(result);
          grunt.log.writeln('Rendered: ' + result.fullpath);
          grunt.verbose.writeln('Remaining: ' + screenshot.length());
        });
      });
    });

    screenshot.drain = function() {

      var matched = [];
      var match;

      grunt.log.header('Finished taking screenshots');

      screenshots.forEach(function(item) {

        var current = {
          paths: [],
          pagetitle: item.pagetitle,
          url: item.url,
          uid: item.uid
        };

        current.paths.push({
          host: item.host,
          hostLabel: item.hostLabel,
          path: item.fullpath
        });

        match = _.find(screenshots, function(current) {
          return ((this.url == current.url) && (current.host != this.host));
        }, item);

        if ( match ) {

          current.paths.push({
            host: match.host,
            hostLabel: match.hostLabel,
            path: match.fullpath
          });

          matched.push(current);
        }

        _.remove(screenshots, function(current) {
          return ((item.url == current.url) && (current.host != item.host));
        }, item);


      });

      grunt.log.header("Comparing Screenshots");
      clearInterval(stayAlive);

      var result = [];

      matched.forEach(function(item, index) {
        createDiff.push({
          data: item,
          options: options
        }, function(response) {
          if ( response ) {
            result.push(response);
          }
        });
      });

      createDiff.drain = function() {

        var cnt = 1;
        var galleryTemplate = fs.readFileSync(__dirname + '/../gallery.hbs', 'utf8');
        var template;

        handlebars.registerHelper('uid', function (context, options) {
          if (context) {
            cnt++;
          }
          return cnt;
        });

        template = handlebars.compile(galleryTemplate);

        fs.writeFileSync(options.screenshots + '/gallery.html', template({data: result}));

        fs.writeFile(options.screenshots + '/data.json', JSON.stringify(result), function (err) {
          done();
        });
      };
    };
  });
};
