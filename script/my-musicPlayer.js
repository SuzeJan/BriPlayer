/**
 * Created by xiaoxu on 2016/12/7.
 */
;
(function($) {
    var MyPlayer = (function() {
        // 构造函数+原型
        function MyPlayer(element, options) {
            this.settings = $.extend(true, $.fn.MyPlayer.defaults, options || {});
            this.element = element;
            var _this = this;

            // 获取歌单数据
            $.ajax({
                type: "get",
                url: "http://music.163.com/api/playlist/detail",
				data: {id: '376470850'},
                dataType: "json",
                success: function(data) {
                    _this.init(data);
                }
            });


        }

        /**
         * 具体功能：
         *
         **/

        MyPlayer.prototype = {
            // 初始化页面DOM和调用其他功能
            init: function(data) {
                var _this = this;
                this.player_musicData = data;

                // 保存移动设备信息
                this.isMobile = navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i);
                //部分手机不支持auto标签自动播放，判断手机用户则禁止自动播放，达到一致性
                (!!this.isMobile) && (this.autoplay = false);

                // 保存音乐功能
                this.m_autoplay = this.settings.m_autoplay;
                this.m_showLrc = this.settings.m_showLrc;
                this.m_loop = this.settings.m_loop;
                this.m_random = this.settings.m_random;
                this.isPlaying = 1;
                this.m_rotate_step = 0;
                this.m_rorate_timer = null;
                this.m_song_timer = null;
                this.m_progress_pace = null;
                this.defaultVolume = 0.6;

                // 保存当前音乐的索引
                this.player_musicIndex = 0;
                // 保存音乐数据,前缀player_表示
                this.player_music = this.player_musicData.music;
                this.player_url = this.player_music[this.player_musicIndex].m_source;
                this.player_songName = this.player_music[this.player_musicIndex].m_songName;
                this.player_singer = this.player_music[this.player_musicIndex].m_singer;
                this.player_desc = this.player_music[this.player_musicIndex].m_desc;
                this.player_avatar = this.player_music[this.player_musicIndex].m_avatar;

                // 保存DOM节点,前缀d_表示
                this.d_imgPic = this.element.find(".music-cover img");
                this.d_songName = this.element.find(".songName");
                this.d_songAuthor = this.element.find(".singer");
                this.d_songDesc = this.element.find(".music-head .desc marquee");
                this.d_sTimer = this.element.find(".timer");
                this.d_prevBtn = this.element.find(".change-btn .prev");
                this.d_playPauseBtn = this.element.find(".change-btn .play-pause");
                this.d_nextBtn = this.element.find(".change-btn .next");
                this.d_playList = this.element.find("#jPlayList");
                this.d_playListItem = this.element.find("#jPlayList .list-item");
                this.d_progressSlider = this.element.find(".progress .slider");
                this.d_progressLineSlider = this.element.find(".progress .slider .line-slider");
                this.d_progressPace = this.element.find(".progress .pace");
                this.d_volumeIconBtn = this.element.find(".volume-btn .suona-icon");
                this.d_volumeSlider = this.element.find(".volume-btn .slider");
                this.d_volumeLineSlider = this.element.find(".volume-btn .slider .line-slider");
                this.d_volumePace = this.element.find(".volume-btn .slider .pace");
                this.d_repeat = this.element.find(".progress .play-type .repeat");
                this.d_shuffle = this.element.find(".progress .play-type .shuffle");

                // 判断音乐数据是否存在
                if (("music" in this.player_musicData)) {
                    $.each(this.player_music, function() {
                        if (!("m_source" in this)) {
                            throw "音乐链接缺失或错误";
                        }
                    })
                } else {
                    throw "没找到音乐数据";
                }

                this._update_music();

                // 调用loadedmetadata事件，当音频的元数据(时长、尺寸大小、文本轨道)被加载，去渲染一些播放器信息
                this.d_audio.on("loadedmetadata", function() {
                    // 渲染播放器信息
                    // 渲染播放器列表
                    var playListItem = '';
                    $.each(_this.player_music, function(index, data) {
                        var music_title = data.m_songName + '-' + data.m_singer;
                        playListItem += '<p class="list-item"><span class="icon"></span>' + music_title + '</p>';
                        _this.d_playList.html(playListItem);
                    });
                    _this.d_playList.find(".list-item").removeClass("active").eq(_this.player_musicIndex).addClass("active");

                    /**
                     * 调用其他功能
                     **/
                    // 调用播放功能
                    _this.d_playPauseBtn.click(function() {
                        _this.isPlaying ? _this.playSong() : _this.pauseSong();
                    });
                    // 调用下一首功能
                    _this.d_nextBtn.click(function() {
                        _this.player_musicIndex++;
                        (_this.player_musicIndex >= _this.player_music.length) && (_this.player_musicIndex = 0);
                        _this.nextSong();
                    });
                    // 调用上一首功能
                    _this.d_prevBtn.click(function() {
                        _this.player_musicIndex--;
                        (_this.player_musicIndex < 0) && (_this.player_musicIndex = _this.player_music.length - 1);
                        _this.prevSong();
                    });
                    // 调整音量
                    _this.volume_ctrl();
                    // 列表联动
                    _this.songListLinkage();

                });

            },

            // 上一曲控制
            prevSong: function() {
                // 移除audio，_update_music方法会创建audio，为了防止添加多个音频
                this.d_audio.remove();
                this._update_music();
                // 切换新的歌曲时旋转初始0
                this.m_rotate_step = 0;
                // 为了连续点击时，防止旋转速度累加，会调用clearInterval
                this.pauseSong();
                this.playSong();
            },

            // 下一曲控制
            nextSong: function() {
                // 移除audio，_update_music方法会创建audio，为了防止添加多个音频
                this.d_audio.remove();
                this._update_music();
                // 切换新的歌曲时旋转初始0
                this.m_rotate_step = 0;
                // 为了连续点击时，防止旋转速度累加，会调用clearInterval
                this.pauseSong();
                this.playSong();
            },

            // play播放控制
            playSong: function() {
                this.d_audio.get(0).play();
                this.d_playPauseBtn.removeClass("icon-player-play").addClass("icon-player-pausecircle");
                this.d_playList.find(".active").children("span").css({
                    "backgroundImage": "url(./images/spectrum.gif)"
                });
                this.pic_rotate();
                this.showSongDate();
                this.progressBar();
                this.isPlaying = 0;
            },

            // pause暂停控制
            pauseSong: function() {
                this.d_audio.get(0).pause();
                this.d_playPauseBtn.removeClass("icon-player-pausecircle").addClass("icon-player-play");
                this.d_playList.find(".active").children("span").css({
                    "backgroundImage": "url(./images/spectrum-static.png)"
                });
                clearInterval(this.m_rorate_timer);
                clearInterval(this.m_song_timer);
                clearInterval(this.m_progress_pace);
                this.isPlaying = 1;
            },

            // 音乐图片转动
            pic_rotate: function() {
                var _this = this;
                _this.m_rorate_timer = setInterval(function() {
                    _this.m_rotate_step += 1;
                    (_this.m_rotate_step >= 360) && (_this.m_rotate_step = 0);
                    _this.d_imgPic.css({
                        "transform": 'rotate(' + _this.m_rotate_step + 'deg' + ')'
                    });
                }, 50);
            },

            // 歌曲时间动态显示
            showSongDate: function() {
                var _this = this;
                this.m_song_timer = setInterval(function() {
                    // 整除后向下取整获取分钟
                    var min = Math.floor(_this.d_audio.get(0).currentTime / 60);
                    // 利用除模获取秒数
                    var sec = Math.floor(_this.d_audio.get(0).currentTime % 60);
                    if (min < 10) {
                        min = '0' + min;
                    }
                    if (sec < 10) {
                        sec = '0' + sec;
                    }
                    _this.d_sTimer.text(min + ':' + sec);
                    var currentT = parseInt(_this.d_audio.get(0).currentTime);
                    var durationT = parseInt(_this.d_audio.get(0).duration);
                    // 循环播放
                    (currentT == durationT) && _this.loopPlayBack();
                }, 500);
            },

            // 进度条控制
            progressBar: function() {
                var _this = this;
                var sought_progressW = null;
                var setTime = 0;
                var progressWidth = 0;
                var progressPageX = 0;
                var progressOfLeft = 0;
                var progressSliderWidth = 0;
                var flag = false;
                var i = 0;


                _this.d_progressSlider.on("mousedown", function(event) {
                    event.stopPropagation();
                    flag = true;
                    progressSliderWidth = $(this).width();
                    // 获取点击的坐标位置
                    progressPageX = event.pageX;
                    progressOfLeft = $(this).offset().left;
                    sought_progressW = (progressPageX - progressOfLeft) / progressSliderWidth * 100;
                    setTime = _this.d_audio.get(0).duration / 100 * sought_progressW;
                    _this.d_audio.get(0).currentTime = setTime;
                    progressWidth = _this.d_audio.get(0).currentTime / _this.d_audio.get(0).duration * 100;
                    _this.d_progressPace.css("width", progressWidth + '%');
                    _this.d_progressLineSlider.css("left", progressWidth + '%')
                    return false;
                }).mousemove(function(event) {
                    event.stopPropagation();
                    if (flag) {
                        progressSliderWidth = $(this).width();
                        // 获取点击的坐标位置
                        progressPageX = event.pageX;
                        progressOfLeft = $(this).offset().left;
                        sought_progressW = (progressPageX - progressOfLeft) / progressSliderWidth * 100;
                        setTime = _this.d_audio.get(0).duration / 100 * sought_progressW;
                        _this.d_audio.get(0).currentTime = setTime;
                        var b = setInterval(function() {
                            clearInterval(_this.m_progress_pacea);
                            clearInterval(b);
                            progressWidth = _this.d_audio.get(0).currentTime / _this.d_audio.get(0).duration * 100;
                            _this.d_progressPace.css("width", progressWidth + '%');
                            _this.d_progressLineSlider.css("left", progressWidth + '%')
                            console.log(i + 1)
                        }, 500);
                    }
                }).mouseup(function() {
                    flag = false;
                });
                $(document).mouseup(function() {
                    flag = false;
                });
                var j = 0;
                // 未拖拽时的初始设置
                _this.m_progress_pace = setInterval(function() {
                    progressWidth = _this.d_audio.get(0).currentTime / _this.d_audio.get(0).duration * 100;
                    _this.d_progressPace.css("width", progressWidth + '%');
                    _this.d_progressLineSlider.css("left", progressWidth + '%')
                    console.log(j + 1)
                }, 500);

            },

            // 音量控制
            volume_ctrl: function() {
                var _this = this;
                var volumePageX = 0;
                var volumeOfLeft = 0;
                var volumeWidth = 0;
                // 静音设置
                this.d_volumeIconBtn.click(function() {
                    if (_this.d_audio.get(0).volume) {
                        $(this).removeClass("icon-player-volume-medium").addClass("icon-player-volume-mute2");
                        _this.d_audio.get(0).volume = 0;
                        _this.d_volumePace.css("width", 0);
                        _this.d_volumeLineSlider.css("left", 0);
                    } else {
                        $(this).removeClass("icon-player-volume-mute2").addClass("icon-player-volume-medium");
                        _this.d_audio.get(0).volume = _this.defaultVolume;
                        _this.d_volumePace.css("width", _this.defaultVolume * 100 + '%');
                        _this.d_volumeLineSlider.css("left", _this.defaultVolume * 100 - _this.d_volumeLineSlider.width() / 2 + '%');
                    }
                });
                // 方案一：可点击设置音量
                /*this.d_volumeSlider.click(function (event) {
                 volumePageX = event.pageX;
                 volumeOfLeft = $(this).offset().left;
                 volumeWidth = $(this).width();
                 _this.defaultVolume = (volumePageX - volumeOfLeft) / volumeWidth;
                 ((volumePageX - volumeOfLeft) <= 0) && (_this.defaultVolume = 0);
                 ((volumePageX - volumeOfLeft) >= 100) && (_this.defaultVolume = 1);
                 _this.d_audio.get(0).volume = _this.defaultVolume;
                 _this.d_volumeLineSlider.css("left", _this.defaultVolume * 100 - _this.d_volumeLineSlider.width() / 2 + '%');
                 _this.d_volumePace.css("width", _this.defaultVolume * 100 + '%');
                 if (_this.defaultVolume > 0) {
                 _this.d_volumeIconBtn.removeClass("icon-player-volume-mute2").addClass("icon-player-volume-medium");
                 } else {
                 _this.d_volumeIconBtn.removeClass("icon-player-volume-medium").addClass("icon-player-volume-mute2");
                 }
                 });*/
                // 方案二：可滑块跟随设置音量
                var flag = false;
                this.d_volumeSlider.bind("mousedown", function(event) {
                    event.stopPropagation();
                    flag = true;
                    return false;
                }).mousemove(function(event) {
                    event.stopPropagation();
                    if (flag) {
                        var x = event.pageX;
                        var sliderContainerOfL = $(".slider").offset().left;
                        // sliderX：计算音量条被点击位置到自身自左边的一个距离
                        var sliderX = (x - sliderContainerOfL) / $(".slider").width() * 100;
                        // 为了防止拖拽小于0或大于100，在此情况下就置0或置100
                        (sliderX <= 0) && (sliderX = 0);
                        (sliderX >= 100) && (sliderX = 100);
                        // 设置音量
                        _this.d_audio.get(0).volume = _this.defaultVolume = sliderX / 100;
                        // 设置进度条
                        _this.d_volumePace.css("width", sliderX + '%');
                        // 设置滑动块跟随
                        _this.d_volumeLineSlider.css("left", sliderX - _this.d_volumeLineSlider.width() / 2 + '%');
                        console.log(sliderX);
                    }
                    // if (flag) {
                    //     (sliderX >= 100) && (sliderX = 100);
                    //     _this.defaultVolume = sliderX / 100;
                    //     _this.d_audio.get(0).volume = sliderX / 100;
                    //     _this.d_volumePace.css("width", sliderX + '%');
                    //     _this.d_volumeLineSlider.css("left", sliderX - _this.d_volumeLineSlider.width() / 2 + '%');
                    //     _this.d_volumeIconBtn.removeClass("icon-player-volume-mute2").addClass("icon-player-volume-medium");
                    // }

                }).mouseup(function() {
                    flag = false;
                });
                $(document).mouseup(function() {
                    flag = false;
                });
            },

            // 列表联动
            songListLinkage: function() {
                var _this = this;
                // 由于列表是动态渲染的，所以要把事件委托到父元素上
                this.d_playList.on("click", _this.d_playListItem, function(event) {
                    if ($(event.target).prop("tagName") === "P") {
                        var oldIndex = $(this).find(".active").index();
                        var nowIndex = $(event.target).index();
                        // 检测是否点击的同一首歌，如果是则不做任何事，节省用户流量，如果不是则会重新更新歌曲
                        if (oldIndex != nowIndex) {
                            _this.player_musicIndex = nowIndex;
                            _this.d_audio.remove();
                            _this._update_music();
                            _this.pauseSong();
                            _this.m_rotate_step = 0;
                            _this.playSong();
                        }
                    }
                });

            },

            // 当前歌曲播放结束
            loopPlayBack: function() {
                var _this = this;
                if (this.m_loop) {
                    _this.d_repeat.css("color", "#23d69b");
                    _this.d_shuffle.css("color", "");
                    _this.d_nextBtn.click();
                }
                if (this.m_random) {
                    _this.d_repeat.css("color", "");
                    _this.d_shuffle.css("color", "#23d69b");
                }

            },

            // 初始和调用更新音乐信息
            _update_music: function() {
                this.d_audio = $("<audio>").appendTo(this.element);
                this.d_audio.attr({
                    "src": this.player_url,
                    "loop": false,
                    "preload": 'metadata'
                });

                this.player_url = this.player_music[this.player_musicIndex].m_source;
                this.player_songName = this.player_music[this.player_musicIndex].m_songName;
                this.player_singer = this.player_music[this.player_musicIndex].m_singer;
                this.player_desc = this.player_music[this.player_musicIndex].m_desc;
                this.player_avatar = this.player_music[this.player_musicIndex].m_avatar;
                this.d_imgPic.attr("src", this.player_avatar);

                this.d_songName.text(this.player_songName);
                this.d_songAuthor.text(this.player_singer);
                this.d_songDesc.text(this.player_desc);
                this.d_playList.find(".list-item").removeClass("active").eq(this.player_musicIndex).addClass("active");
                this.d_audio.attr("src", this.player_url);
                this.d_audio.get(0).volume = this.defaultVolume;
                this.d_volumePace.css("width", this.defaultVolume * 100 + '%');
                this.d_volumeLineSlider.css("left", this.defaultVolume * 100 - this.d_volumeLineSlider.width() / 2 + '%');
                this.d_progressPace.css("width", 0);
                this.m_loop && this.d_repeat.css("color", "#23d69b");
            }
        };
        return MyPlayer;
    })();

    // 挂载到jQuery下
    $.fn.MyPlayer = function(options) {
        //实现单例模式
        this.each(function() {
            var _this = $(this),
                instance = _this.data('MyPlayer');
            /*如果没有实例，则创建*/
            if (!instance) {
                instance = new MyPlayer(_this, options);
                _this.data('MyPlayer', instance);
            }

            if ($.type(options) === 'string') {
                return instance[options]();
            }
        })
    };

    // 默认参数
    $.fn.MyPlayer.defaults = {
        "m_loop": true,
        "m_random": false,
        "m_autoplay": true,
        "m_showLrc": true
    }
})(jQuery);