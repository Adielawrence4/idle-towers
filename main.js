/**
 * main.js
 * --------------------------------------------------------------------------
 * Global engine bootstrap for "Idle Tower: Merchant Guard".
 *
 * Owns Phaser configuration, YouTube Playables system hooks, and a shared
 * cloud-save bridge used by gameplay / menu / game-over scenes.
 */

const getDpr = () => Math.min(window.devicePixelRatio || 1, 2);

/**
 * Shared persistence bridge — YouTube cloud save in playables, localStorage
 * fallback for local development when ytgame is unavailable.
 */
const CityDefenseSave = {
  isPlayableEnv() {
    return typeof window.ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV;
  },

  _parsePayload(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  },

  loadData() {
    if (this.isPlayableEnv()) {
      return ytgame.game.loadData()
        .then((raw) => {
          const data = this._parsePayload(raw);
          return {
            gold: parseInt(data.gold, 10) || 0,
            bestWave: parseInt(data.bestWave, 10) || 0,
            bestTime: parseInt(data.bestTime, 10) || 0,
          };
        })
        .catch(() => ({ gold: 0, bestWave: 0, bestTime: 0 }));
    }

    return Promise.resolve({
      gold: parseInt(localStorage.getItem('guard_city_gold'), 10) || 0,
      bestWave: parseInt(localStorage.getItem('guard_city_best_wave'), 10) || 0,
      bestTime: parseInt(localStorage.getItem('guard_city_best_time'), 10) || 0,
    });
  },

  saveData(state) {
    const payload = {
      gold: state.gold || 0,
      bestWave: state.bestWave || 0,
      bestTime: state.bestTime || 0,
    };

    if (this.isPlayableEnv()) {
      return ytgame.game.saveData(JSON.stringify(payload));
    }

    localStorage.setItem('guard_city_gold', payload.gold);
    localStorage.setItem('guard_city_best_wave', payload.bestWave);
    localStorage.setItem('guard_city_best_time', payload.bestTime);
    return Promise.resolve();
  },
};

window.CityDefenseSave = CityDefenseSave;

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  resolution: getDpr(),

  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
    autoRound: true,
  },

  render: {
    antialias: true,
    roundPixels: true,
    powerPreference: 'high-performance',
  },

  backgroundColor: '#000000',

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },

  scene: [MenuScene, GameplayScene, GameOverScene],
};

const game = new Phaser.Game(config);

function initYouTubePlayablesSDK() {
  if (typeof window.ytgame === 'undefined' || !ytgame.IN_PLAYABLES_ENV) {
    return;
  }

  if (ytgame.system.isAudioEnabled && !ytgame.system.isAudioEnabled()) {
    game.sound.mute = true;
  }

  ytgame.system.onAudioEnabledChange((isEnabled) => {
    game.sound.mute = !isEnabled;
  });

  ytgame.system.onPause(() => {
    game.loop.sleep();
    game.sound.mute = true;
  });

  ytgame.system.onResume(() => {
    game.loop.wake();
    if (ytgame.system.isAudioEnabled()) {
      game.sound.mute = false;
    }
  });
}

game.events.once('ready', initYouTubePlayablesSDK);

function resizeGame() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (game.scale) {
    game.scale.setParentSize(w, h);
    game.scale.resize(w, h);
  }
}

window.addEventListener('resize', resizeGame);

window.addEventListener('orientationchange', () => {
  setTimeout(resizeGame, 100);
});

resizeGame();
