/*
 * visual-validator
 *
 *
 * Copyright (c) 2013 Jon Brace
 * Licensed under the MIT license.
 */

'use strict';

var Q = require('q'),
    fs = require('fs.extra'),
    gm = require('gm'),
    async = require('async'),
    _ = require('lodash'),
    path = require('path'),
    handlebars = require('handlebars'),
    tmp = require('temporary');

module.exports = function (grunt) {

  /**
   * Take a screenshot
   * @type {Array}
   */
  var screenshot = async.queue(function (task, callback) {

    task.browser.render(task, grunt, function(response) {
      callback(response);
    });

  }, 4);

  /**
   * Create a diff file from two images.
   * @type {Array}
   */
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

        data.url.substr(1).replace('/', '--').replace('.html', '');

        var diffPath = options.screenshots + '/diffs/' + data.url.substr(1).replace(/\//g, "--").replace('.html', '') + '.png';

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
    var browser;

    var options = this.options({
      screenshots: 'screenshots',
      threshold: 0.003,
      includeMatching: false,
      browser: 'slimerjs'
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

    grunt.log.header("Generating Screenshots");

    urls.forEach(function (pageUrl) {

      [{label:'dev',host:options.hosts.dev}, {label:'stable',host:options.hosts.stable}].forEach(function (env) {

        screenshot.push({
          host: env.host,
          hostLabel: env.label,
          pageUrl: pageUrl,
          screenshotsDir: options.screenshots,
          browser: require('../lib/browsers/browser-' + options.browser  + '.js')
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
