#!/usr/bin/node

var request = require('request');
var Reply = require('./reply');

function range(a,b,c) {
  if (arguments.length == 1) {
    return range(0,a,1);
  } else if (arguments.length == 2) {
    return range(a,b,1);
  } else if (arguments.length == 3) {
    var res = [];
    for (var i=a;i<b;i=i+c) {
      res.push(i);
    }
    return res;
  }
  throw "range needs one or two or three arguments";
}

function work(opts) {
  console.log('working,',opts.items.length,'items left');
  if (opts.items.length > 0) {
    var item = opts.items.shift();
    console.log('item:',JSON.stringify(item));
    if (item == null) {
      console.log('work error, opts:',JSON.stringify(opts));
      return;
    }
    opts.worker(item, opts, function () {
      setTimeout(function () {
        return work(opts);
      }, Math.round((Math.random() + 0.5) * opts.delay)); /* 0.5..1.5 delay */
    });
  } else {
    console.log('work done');
    opts.done(opts);
  }
}

function commentWorker(url, opts, cb) {
  request({url:url},function(err,resp,body){

    if (err) {
      console.log(err);
      return cb();
    }

    JSON.parse(body).replies.forEach( rep => {

      Reply.find({id:rep.id}, (err,docs) => {
        if (err) {
          console.log(err);
        }
        if (docs.length > 0) {
          console.log('skiping', rep.id);
        } else {
          console.log('saving', rep.id);
          var reply = new Reply(rep);
          reply.save(function (e) {
            if (e) console.log(e);
          });
        }
      });

    });
    cb();
  });
}

function getComments(messageIds) {
  var opts = {
    delay: 3000,
    items: messageIds.map( id => 'https://bnw.im/api/show?replies=1&message=' + id ),
    worker: commentWorker,
    done: (opts) => {
      console.log('done');
      process.exit();
    }
  };
  work(opts);
}

function pageWorker(url, opts, cb) {
  request({url:url},function(err,resp,body) {

    if (err) {
      console.log(err);
      return cb();
    }

    var ids = JSON.parse(body).messages.map(msg => msg.id);
    ids.forEach( id => opts.messageIds.push(id) );
    //console.log('ids',ids);
    cb();
  });
}

function getPages(page1,page2) {
  var opts = {
    messageIds: [],
    delay: 3000,
    items: range(page1,page2+1).map( i => 'https://bnw.im/api/show?page=' + i ),
    worker: pageWorker,
    done: (opts) => {
      getComments(opts.messageIds);
    }
  };
  work(opts);
}

var argv = process.argv;
if (argv.length < 4 || (argv[2] == '--help')) {
  console.log('usage:',argv[0],argv[1],'startPage endPage');
  process.exit();
} else {
  var page1 = parseInt(argv[2],10);
  var page2 = parseInt(argv[3],10);
  getPages(page1,page2);
}
