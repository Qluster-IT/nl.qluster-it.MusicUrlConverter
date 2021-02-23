'use strict';

const Homey = require('homey');
const { Defer } = require('./lib/proto');
const fetch = require('node-fetch');
const mp3splitter = require('./lib/mp3splitter');
const NodeID3 = require('node-id3')

const musicMeta = require('music-metadata');

class UrlSoundConverterApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('UrlSoundConverterApp has been initialized');

    const play_url = this.homey.flow.getActionCard('play_url');
    play_url.registerRunListener(( ( args, state ) => { //async
      try {
        var defer = new Defer();
          if(!args.url) return Promise.resolve(false);
          console.log('play_url.registerRunListener args.url: ' + args.url);
          this.playUrl(args.url)
          .then((res)=>{
            if(res===true) defer.resolve(res);
            else defer.reject(res);
          })
          .catch((err)=>{
            defer.reject(err);
          });
      } catch (error) { 
        console.log('Error: ' + error);
        defer.reject('Something went wrong with the url.');
      }
      return defer.promise;
    }).bind(this));

  }

  async playUrl(url) {
    this.ClearTimer();
    // console.log(this.homey);
    // console.log(Object.keys(this.homey));
    var response = await fetch(url);
    if (!response.ok) {
      throw new Error('Invalid Response');
    }
    var contentType = response.headers.get('content-type');
    console.log('contentType');
    console.log(contentType);

    var contentLength = response.headers.get('content-length');
    console.log('contentLength');
    console.log(contentLength);


    //return;

    //if(len>900000) return false;
    var played = false;
    switch (contentType) {
      case 'audio/wav':
      case 'audio/x-wav':
        if(contentLength<=900000) {
          var buf = await response.buffer();    
          var len = Buffer.byteLength(buf);
          if(len<=900000) {
            console.log('playing wav length: ' + len); //            
            await this.homey.audio.playWav('nl.qluster-it.UrlSoundEater', buf);
            await this.homey.audio.removeWav('nl.qluster-it.UrlSoundEater');
            played = true;
          }          
          buf = null;
        } 
        response = null;
        global.gc();
      case 'audio/mpeg':
      case 'audio/mp3':
        console.log('playing mp3'); //              
        if(contentLength<=15 * 1000000) {
            var buf = await response.buffer();    
            var len = Buffer.byteLength(buf);
            await this.playMp3(buf, len);
            played = true;
            buf = null;
            response = null;
            global.gc();
        }
    }
    return played;
  }

  async playMp3(buf, len) {
    
    var info = await musicMeta.parseBuffer(buf, 'audio/mpeg', { duration: true });
    var duration = Number.parseInt(info.format.duration * 1000);

    var tags = { chapter:[]};
    var counts = Number.parseInt(len / 750000) + 1;
    var durationParts = duration / counts;
    for (let count = 0; count < counts; count++) {
      tags.chapter.push( {
        elementID: "id" + count, // THIS MUST BE UNIQUE!
        startTimeMs: Number.parseInt(0 + ((durationParts * count) || 0 )),
        endTimeMs: Number.parseInt(durationParts + ((durationParts * count) || 0 ))
      });
    }
    
    console.log('tags');
    console.log(tags);
    
    //var len = Buffer.byteLength(buf);
    

    // const tags = {
    //   chapter: [{
    //     elementID: "Hey!", // THIS MUST BE UNIQUE!
    //     startTimeMs: 0,
    //     endTimeMs: 30000,
    //     startOffsetBytes: 0, // OPTIONAL!
    //     endOffsetBytes: 900000//,   // OPTIONAL!
    //     // tags: {                // OPTIONAL
    //     //   title: "Homey",
    //     //   artist: "Homey"
    //     // }
    //   }],
    // }
    
    var success = NodeID3.update(tags, buf) // Returns Buffer
    
    // var filename = '/userdata/urlSoundEater.mp3';
    // var response = await fs.writeFileSync(filename, success );
    
    // var mp3split1 = new mp3splitter({filename:filename});
    // mp3split1.go();

    var mp3split = new mp3splitter({buffer:success});
    var segments = mp3split.go();
    success = null;
    mp3split = null;    
    console.log('segments');
    console.log(segments==null);
    this.segments = segments;
    this.currentSegmentIndex = 0;

    if(this.segments && this.segments.length>0) {
      //console.log('segments');
      //console.log(this.segments[0]);
      this.playMp3Segment(this.segments[this.currentSegmentIndex]);
      if(this.segments.length>1)  {this.currentSegmentIndex++; this.SetTimeout(durationParts);}
    }
    
    
    //global.gc();
    
    
  }
  SetTimeout(time) {
    this.ClearTimer();
    this.timeout = setTimeout(()=> {
      this.segments[this.currentSegmentIndex - 1] = null;      
      console.log('timeoutRunned: ' + this.currentSegmentIndex);
      this.playMp3Segment(this.segments[this.currentSegmentIndex]);
      global.gc();

      if(this.segments && this.segments.length >this.currentSegmentIndex+1) {
        this.currentSegmentIndex++;
        this.SetTimeout(time);
      } else {
        this.segments = null;
        global.gc();
        //console.log('timeoutRunned done');
      }
    }, time) ;
  }
  ClearTimer() {
    if(this.timeout) clearTimeout(this.timeout);
  }


  async playMp3Segment(segment) {
    //console.log('playMp3Segment ' + this.currentSegmentIndex);
    await this.homey.audio.playMp3('nl.qluster-it.UrlSoundEater', segment);
    await this.homey.audio.removeMp3('nl.qluster-it.UrlSoundEater');
  }
  
}

module.exports = UrlSoundConverterApp;