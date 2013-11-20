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
    gm = require('gm');


module.exports = function (grunt) {

  var screenshot = function (host, pageUrl, dir, callback) {

    var path;

    phantom.create(function (err, ph) {
      if (err) throw err;

      ph.createPage(function (err, page) {
        if (err) throw err;

        page.open(host + pageUrl, function (err, status) {
          if (err) throw err;

          page.evaluate(function () {
            return document.getElementsByTagName('title')[0].innerText;
          }, function (err, result) {
            var urlParts = url.parse(host);
            if (err) throw err;

            path = dir + '/' + urlParts.hostname + '/' + result + '.png';
            page.render(path, function (err) {
              if (err) throw err;
              ph.exit();
              callback({
                host: host,
                url: pageUrl,
                fullpath: path,
                pagetitle: result
              });
            });
          });
        });
      });
    });
  };

  grunt.registerMultiTask('visual_validator', 'Compare screenshots of a development site against a baseline site.', function () {

    var options = this.options({
      screenshots: 'screenshots',
      threshold: 0.03
    });

    var done = this.async();

    fs.rmrfSync(options.screenshots);
    fs.unlinkSync('./gallery/data.js')
    fs.mkdirpSync(options.screenshots + '/diffs');

    fs.appendFile('./gallery/data.js', 'var data = [];');

    options.urls.forEach(function (pageUrl) {

      var promises = [];

      [options.hosts.dev, options.hosts.baseline].forEach(function (host) {

        var deferred = Q.defer();

        try {
          screenshot(host, pageUrl, options.screenshots, function (result) {
            grunt.log.writeln('Rendered: ' + result.host + ' "' + result.pagetitle + '"');
            deferred.resolve(result);
          });
        }
        catch (err) {
          deferred.reject(new Error(err));
        }

        promises.push(deferred.promise);
      });


      Q.allSettled(promises).then(function (results) {

        grunt.log.writeln('Checking: ' + pageUrl);

        var file1 = results[0].value.fullpath,
            file2 = results[1].value.fullpath;

        gm.compare(file1, file2, options.threshold, function (err, isEqual, equality, raw) {
          if (err) done(err);

          if (!isEqual) {
            grunt.log.warn('Changes found in: ' + results[0].value.url);
          }

          var diffPath = options.screenshots + '/diffs/' + results[0].value.pagetitle + '.png';

          gm.compare(file1, file2, {
            'file': diffPath
          });

          var jsonResults = {
            diff: diffPath,
            isEqual: isEqual,
            results: results
          };

          fs.appendFile('./gallery/data.js', 'data.push(' + JSON.stringify(jsonResults) + ');', function (err) {});
        });
      });
    });
  });
};
