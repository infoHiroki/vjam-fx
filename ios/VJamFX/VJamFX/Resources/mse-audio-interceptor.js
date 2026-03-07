(function() {
    'use strict';

    if (typeof MediaSource === 'undefined') return;

    var _appendBuffer = SourceBuffer.prototype.appendBuffer;
    var _addSourceBuffer = MediaSource.prototype.addSourceBuffer;
    var _removeSourceBuffer = MediaSource.prototype.removeSourceBuffer;

    var audioTrackers = new WeakMap();
    var pipelineSetup = false;

    MediaSource.prototype.addSourceBuffer = function(mimeType) {
        try {
            var sb = _addSourceBuffer.call(this, mimeType);
            if (typeof mimeType === 'string' && mimeType.includes('audio')) {
                audioTrackers.set(sb, {
                    mimeType: mimeType,
                    initSegment: null,
                    pipeline: null
                });
            }
            return sb;
        } catch (e) {
            throw e;
        }
    };

    SourceBuffer.prototype.appendBuffer = function(data) {
        var tracker = audioTrackers.get(this);
        if (tracker) {
            try {
                var copy;
                if (data instanceof ArrayBuffer) {
                    copy = data.slice(0);
                } else {
                    copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
                }
                if (!tracker.initSegment) {
                    tracker.initSegment = copy;
                    if (!pipelineSetup) {
                        pipelineSetup = true;
                        setupAudioPipeline(tracker);
                    }
                } else if (tracker.pipeline) {
                    tracker.pipeline.feed(copy);
                }
            } catch (e) {
                // Silently ignore to avoid breaking host page
            }
        }
        return _appendBuffer.call(this, data);
    };

    function setupAudioPipeline(tracker) {
        try {
            var audio = document.createElement('audio');
            audio.style.position = 'fixed';
            audio.style.top = '-9999px';
            audio.style.left = '-9999px';
            audio.style.width = '1px';
            audio.style.height = '1px';
            audio.style.opacity = '0';
            audio.style.pointerEvents = 'none';
            document.documentElement.appendChild(audio);

            var shadowMS = new MediaSource();
            audio.src = URL.createObjectURL(shadowMS);

            shadowMS.addEventListener('sourceopen', function() {
                try {
                    var shadowSB = _addSourceBuffer.call(shadowMS, tracker.mimeType);
                    var queue = [];
                    var feeding = false;

                    // Append the init segment to the shadow SourceBuffer
                    _appendBuffer.call(shadowSB, tracker.initSegment);
                    feeding = true;

                    shadowSB.addEventListener('updateend', function() {
                        feeding = false;

                        // Buffer management: remove old data to prevent memory growth
                        try {
                            if (shadowSB.buffered.length > 0 && !shadowSB.updating) {
                                var currentTime = audio.currentTime;
                                var bufferedStart = shadowSB.buffered.start(0);
                                if (currentTime - bufferedStart > 30) {
                                    var removeEnd = currentTime - 10;
                                    if (removeEnd > bufferedStart) {
                                        shadowSB.remove(bufferedStart, removeEnd);
                                        return; // Will get another updateend after remove
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore buffer management errors
                        }

                        // Process queued data
                        if (queue.length > 0 && !shadowSB.updating) {
                            var next = queue.shift();
                            try {
                                _appendBuffer.call(shadowSB, next);
                                feeding = true;
                            } catch (e) {
                                // If append fails, skip this chunk
                            }
                        }
                    });

                    // Set up AudioContext and AnalyserNode
                    var ctx = new (window.AudioContext || window.webkitAudioContext)();
                    var source = ctx.createMediaElementSource(audio);
                    var analyser = ctx.createAnalyser();
                    analyser.fftSize = 2048;
                    analyser.smoothingTimeConstant = 0;
                    source.connect(analyser);
                    // Do NOT connect to destination to avoid double playback

                    audio.play().catch(function() {
                        // Autoplay may be blocked; will retry on user interaction
                    });

                    window._vjamMSEAnalyser = analyser;
                    window._vjamMSEAudioContext = ctx;

                    tracker.pipeline = {
                        feed: function(data) {
                            if (!shadowSB.updating && !feeding) {
                                try {
                                    _appendBuffer.call(shadowSB, data);
                                    feeding = true;
                                } catch (e) {
                                    // Skip this chunk on error
                                }
                            } else {
                                queue.push(data);
                                // Limit queue size to prevent memory issues
                                if (queue.length > 100) {
                                    queue.shift();
                                }
                            }
                        }
                    };
                } catch (e) {
                    window._vjamMSEAnalyser = null;
                }
            });

            audio.addEventListener('error', function() {
                window._vjamMSEAnalyser = null;
                try {
                    if (audio.parentNode) {
                        audio.parentNode.removeChild(audio);
                    }
                } catch (e) {
                    // Ignore cleanup errors
                }
            });
        } catch (e) {
            window._vjamMSEAnalyser = null;
        }
    }
})();
