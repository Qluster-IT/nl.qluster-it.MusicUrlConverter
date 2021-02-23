'use strict';

const Homey = require('homey');
const { Defer } = require('./lib/proto');
const fetch = require('node-fetch');

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
            defer.resolve(true);
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
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Invalid Response');
    }
    var contentType = response.headers.get('content-type');
    console.log('contentType');
    console.log(contentType);
    console.log(contentType);
    var buf = await response.buffer();
    
    var len = Buffer.byteLength(buf);
    console.log(len);
    if(len>900000) return false;

    switch (contentType) {
      case 'audio/wav':
      case 'audio/x-wav':
          console.log('playing wav'); //
        return true;
        await this.homey.audio.playWav('nl.qluster-it.UrlSoundEater', buf);
        await this.homey.audio.removeWav('nl.qluster-it.UrlSoundEater');
        return true;
      case 'audio/mpeg':
      case 'audio/mp3':
          console.log('playing mp3'); //
        return true;
        await this.homey.audio.playMp3('nl.qluster-it.UrlSoundEater', buf);
        await this.homey.audio.removeMp3('nl.qluster-it.UrlSoundEater');
        return true;
      default:
        return false;
    }
  }
  
}

module.exports = UrlSoundConverterApp;