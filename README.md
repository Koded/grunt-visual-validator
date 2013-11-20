# visual-validator

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install visual-validator --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('visual-validator');
```

## The "visual_validator" task

Visually compare the same webpage from two different hosts - one represents a baseline (stable) environment and the other a development environment.

### Usage Examples

```
grunt.initConfig({
  visual_validator: {
    options: {
      urls: [
        '/page1',
        '/page2',
      ]
    },
    dev: {
      options: {
        screenshots: 'screenshots',
        hosts: {
          'dev': 'http://mysite.local',
          'baseline':'http://mysite.com'
        }
      }
  },
})
```


