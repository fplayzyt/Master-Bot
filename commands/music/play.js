const { Command } = require('discord.js-commando');
const { MessageEmbed } = require('discord.js');
const Youtube = require('simple-youtube-api');
const ytdl = require('ytdl-core');
const { youtubeAPI } = require('../../config.json');
const youtube = new Youtube(youtubeAPI);

module.exports = class PlayCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'play',
      aliases: ['play-song', 'add'],
      memberName: 'play',
      group: 'music',
      description: 'Reproduce cualquier cancion o lista de reproduccion de YouTube.',
      guildOnly: true,
      clientPermissions: ['SPEAK', 'CONNECT'],
      throttling: {
        usages: 2,
        duration: 5
      },
      args: [
        {
          key: 'query',
          prompt: 'What song or playlist would you like to listen to?',
          type: 'string',
          validate: function(query) {
            return query.length > 0 && query.length < 200;
          }
        }
      ]
    });
  }

  async run(message, { query }) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      message.say('Por favor, unete a un canal de voz primero antes de poner musica');
      return;
    }

    if (message.guild.triviaData.isTriviaRunning == true) {
      message.say('Please try after the trivia has ended');
      return;
    }

    if (
      // if the user entered a youtube playlist url
      query.match(
        /^(?!.*\?.*\bv=)https:\/\/www\.youtube\.com\/.*\?.*\blist=.*$/
      )
    ) {
      const playlist = await youtube.getPlaylist(query).catch(function() {
        message.say('La lista de reproduccion dada es privada o no la puedo encontrar.');
        return;
      });
      // add 10 as an argument in getVideos() if you choose to limit the queue
      const videosArr = await playlist.getVideos().catch(function() {
        message.say(
          'Hubo un problema al obtener uno de los videos en la lista de reproduccion!'
        );
        return;
      });

      // this for loop can be uncommented if you want to shuffle the playlist

      /*for (let i = videosArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [videosArr[i], videosArr[j]] = [videosArr[j], videosArr[i]];
      }
      */

      for (let i = 0; i < videosArr.length; i++) {
        if (videosArr[i].raw.status.privacyStatus == 'private') {
          continue;
        } else {
          try {
            const video = await videosArr[i].fetch();
            // this can be uncommented if you choose to limit the queue
            // if (message.guild.musicData.queue.length < 10) {
            //
            message.guild.musicData.queue.push(
              PlayCommand.constructSongObj(
                video,
                voiceChannel,
                message.member.user
              )
            );
            // } else {
            //   return message.say(
            //     `I can't play the full playlist because there will be more than 10 songs in queue`
            //   );
            // }
          } catch (err) {
            return console.error(err);
          }
        }
      }
      if (message.guild.musicData.isPlaying == false) {
        message.guild.musicData.isPlaying = true;
        return PlayCommand.playSong(message.guild.musicData.queue, message);
      } else if (message.guild.musicData.isPlaying == true) {
        message.say(
          `Playlist - :musical_note:  ${playlist.title} :musical_note: has been added to queue`
        );
        return;
      }
    }

    // This if statement checks if the user entered a youtube url, it can be any kind of youtube url
    if (query.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/)) {
      query = query
        .replace(/(>|<)/gi, '')
        .split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
      const id = query[2].split(/[^0-9a-z_\-]/i)[0];
      const video = await youtube.getVideoByID(id).catch(function() {
        message.say('Hubo un problema al obtener el video solicitado!');
        return;
      });
      // // can be uncommented if you don't want the bot to play live streams
      // if (video.raw.snippet.liveBroadcastContent === 'live') {
      //   return message.say("I don't support live streams!");
      // }
      // // can be uncommented if you don't want the bot to play videos longer than 1 hour
      // if (video.duration.hours !== 0) {
      //   return message.say('I cannot play videos longer than 1 hour');
      // }
      // // can be uncommented if you want to limit the queue
      // if (message.guild.musicData.queue.length > 10) {
      //   return message.say(
      //     'There are too many songs in the queue already, skip or wait a bit'
      //   );
      // }
      message.guild.musicData.queue.push(
        PlayCommand.constructSongObj(video, voiceChannel, message.member.user)
      );
      if (
        message.guild.musicData.isPlaying == false ||
        typeof message.guild.musicData.isPlaying == 'undefined'
      ) {
        message.guild.musicData.isPlaying = true;
        return PlayCommand.playSong(message.guild.musicData.queue, message);
      } else if (message.guild.musicData.isPlaying == true) {
        message.say(`> :warning: La cancion ${video.title} fue agregada a la lista.`);
        return;
      }
    }

    // if user provided a song/video name
    const videos = await youtube.searchVideos(query, 5).catch(async function() {
      await message.say(
        'Hubo un problema intentando buscar el video que mencionabas.'
      );
      return;
    });
    if (videos.length < 5 || !videos) {
      message.say(
        `I had some trouble finding what you were looking for, please try again or be more specific`
      );
      return;
    }
    const vidNameArr = [];
    for (let i = 0; i < videos.length; i++) {
      vidNameArr.push(`${i + 1}: ${videos[i].title}`);
    }
    vidNameArr.push('exit');
    const embed = new MessageEmbed()
      .setColor('#e9f931')
      .setTitle('Elige una cancion, respondiendo con un numero del 1 al 5.')
      .addField('Cancion 1', vidNameArr[0])
      .addField('Cancion 2', vidNameArr[1])
      .addField('Cancion 3', vidNameArr[2])
      .addField('Cancion 4', vidNameArr[3])
      .addField('Cancion 5', vidNameArr[4])
      .addField('Cancelar', 'Di "exit".');
    var songEmbed = await message.channel.send({ embed });
    message.channel
      .awaitMessages(
        function(msg) {
          return (msg.content > 0 && msg.content < 6) || msg.content === 'exit';
        },
        {
          max: 1,
          time: 60000,
          errors: ['time']
        }
      )
      .then(function(response) {
        const videoIndex = parseInt(response.first().content);
        if (response.first().content === 'exit') {
          songEmbed.delete();
          return;
        }
        youtube
          .getVideoByID(videos[videoIndex - 1].id)
          .then(function(video) {
            // // can be uncommented if you don't want the bot to play live streams
            // if (video.raw.snippet.liveBroadcastContent === 'live') {
            //   songEmbed.delete();
            //   return message.say("I don't support live streams!");
            // }

            // // can be uncommented if you don't want the bot to play videos longer than 1 hour
            // if (video.duration.hours !== 0) {
            //   songEmbed.delete();
            //   return message.say('I cannot play videos longer than 1 hour');
            // }

            // // can be uncommented if you don't want to limit the queue
            // if (message.guild.musicData.queue.length > 10) {
            //   songEmbed.delete();
            //   return message.say(
            //     'There are too many songs in the queue already, skip or wait a bit'
            //   );
            // }
            message.guild.musicData.queue.push(
              PlayCommand.constructSongObj(
                video,
                voiceChannel,
                message.member.user
              )
            );
            if (message.guild.musicData.isPlaying == false) {
              message.guild.musicData.isPlaying = true;
              if (songEmbed) {
                songEmbed.delete();
              }
              PlayCommand.playSong(message.guild.musicData.queue, message);
            } else if (message.guild.musicData.isPlaying == true) {
              if (songEmbed) {
                songEmbed.delete();
              }
              message.say(`${video.title} added to queue`);
              return;
            }
          })
          .catch(function() {
            if (songEmbed) {
              songEmbed.delete();
            }
            message.say(
              'An error has occured when trying to get the video ID from youtube'
            );
            return;
          });
      })
      .catch(function() {
        if (songEmbed) {
          songEmbed.delete();
        }
        message.say(
          'Por favor intenta de nuevo, di un numero del 1 al 5 o di exit.'
        );
        return;
      });
  }
  static playSong(queue, message) {
    const classThis = this; // use classThis instead of 'this' because of lexical scope below
    queue[0].voiceChannel
      .join()
      .then(function(connection) {
        const dispatcher = connection
          .play(
            ytdl(queue[0].url, {
              quality: 'highestaudio',
              highWaterMark: 1 << 25
            })
          )
          .on('start', function() {
            message.guild.musicData.songDispatcher = dispatcher;
            dispatcher.setVolume(message.guild.musicData.volume);
            const videoEmbed = new MessageEmbed()
              .setThumbnail(queue[0].thumbnail)
              .setColor('#e9f931')
              .setTitle(':musical_note: Cancion agregada.')
              .addField('Ahora escuchas:', queue[0].title)
              .addField('Duracion:', queue[0].duration)
              .setFooter(
                `Cancion pedida por ${queue[0].memberDisplayName}`,
                queue[0].memberAvatar
              );

            if (queue[1] && !message.guild.musicData.loopSong)
              videoEmbed.addField('Proxima cancion:', queue[1].title);
            message.say(videoEmbed);
            message.guild.musicData.nowPlaying = queue[0];
            queue.shift();
            return;
          })
          .on('finish', function() {
            queue = message.guild.musicData.queue;
            if (message.guild.musicData.loopSong) {
              queue.unshift(message.guild.musicData.nowPlaying);
            } else if (message.guild.musicData.loopQueue) {
              queue.push(message.guild.musicData.nowPlaying);
            }
            if (queue.length >= 1) {
              classThis.playSong(queue, message);
              return;
            } else {
              message.guild.musicData.isPlaying = false;
              message.guild.musicData.nowPlaying = null;
              message.guild.musicData.songDispatcher = null;
              if (
                // when the leave command is called
                message.guild.me.voice.channel &&
                message.guild.musicData.skipTimer
              ) {
                message.guild.me.voice.channel.leave();
                message.guild.musicData.skipTimer = false;
                return;
              }
              if (message.guild.me.voice.channel) {
                setTimeout(function onTimeOut() {
                  if (
                    message.guild.musicData.isPlaying == false &&
                    message.guild.me.voice.channel
                  ) {
                    message.guild.me.voice.channel.leave();
                    message.channel.send('He dejado el canal de voz por inactividad.');
                  }
                }, 90000);
              }
            }
          })
          .on('error', function(e) {
            message.say('No se puede reproducir la cancion.');
            console.error(e);
            message.guild.musicData.queue.length = 0;
            message.guild.musicData.isPlaying = false;
            message.guild.musicData.nowPlaying = null;
            message.guild.musicData.loopSong = false;
            message.guild.musicData.songDispatcher = null;
            message.guild.me.voice.channel.leave();
            return;
          });
      })
      .catch(function() {
        message.say('No tengo los permisos necesarios para unirme a tu canal.');
        message.guild.musicData.queue.length = 0;
        message.guild.musicData.isPlaying = false;
        message.guild.musicData.nowPlaying = null;
        message.guild.musicData.loopSong = false;
        message.guild.musicData.songDispatcher = null;
        if (message.guild.me.voice.channel) {
          message.guild.me.voice.channel.leave();
        }
        return;
      });
  }
  static constructSongObj(video, voiceChannel, user) {
    let duration = this.formatDuration(video.duration);
    if (duration == '00:00') duration = 'Live Stream';
    return {
      url: `https://www.youtube.com/watch?v=${video.raw.id}`,
      title: video.title,
      rawDuration: video.duration,
      duration,
      thumbnail: video.thumbnails.high.url,
      voiceChannel,
      memberDisplayName: user.username,
      memberAvatar: user.avatarURL('webp', false, 16)
    };
  }
  // prettier-ignore
  static formatDuration(durationObj) {
    const duration = `${durationObj.hours ? (durationObj.hours + ':') : ''}${
      durationObj.minutes ? durationObj.minutes : '00'
    }:${
      (durationObj.seconds < 10)
        ? ('0' + durationObj.seconds)
        : (durationObj.seconds
        ? durationObj.seconds
        : '00')
    }`;
    return duration;
  }
};
