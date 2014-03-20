/* ==========================================================
 * load_couch.js    v0.0.1
 * Author:          Daniel J. Stroot
 * Date:            02.13.2013
 *
 * Updating CouchDB design docs and test data is as easy
 * as modifying the file system/file contents and then
 * running $node load_couch
 * ========================================================== */
var fs        = require("fs")
  , path      = require('path')
  , config    = require('../config')
  , db        = require('nano')(config.couchdb.url);

var docPath   = path.join(__dirname, 'JSON/');

var files = fs.readdirSync(docPath).filter(function(file) {
  return file.charAt(0) !== ".";          // Ensure no dotfiles
}).map(function(file) {
  return docPath + file;                  // Full path to each doc
}).forEach(function(file) {
  db.insert(fs.readFileSync(file), function(err, body, header) {
    if (err) {
      console.log('Error: ', err.message);
    } else {
      console.log('Doc inserted: ' + JSON.stringify(body));
    }    
  });
});