/**
 * main.js
 * --------------------------------------------------------------------------
 * Global engine bootstrap for "Idle Tower: Merchant Guard".
 *
 * This file owns nothing about gameplay logic — its only job is to build the
 * Phaser.Game configuration object and instantiate the engine. All actual
 * behaviour lives inside the Scene classes (MenuScene, GameplayScene,
 * GameOverScene), which are loaded as global classes before this script runs
 * (see index.html load order).
 *
 * RESPONSIVE / CROSS-PLATFORM STRATEGY
 * --------------------------------------------------------------------------
 * - Phaser.Scale.RESIZE makes the internal game canvas resolution track the
 *   real size of #game-container on every resize event, which fires both on
 *   browser window resize (desktop) AND on orientation change (mobile).
 *   Because of this, every Scene must read camera bounds dynamically
 *   (this.cameras.main.width / height) rather than hard-coding pixel
 *   coordinates, so that UI and gameplay objects always re-flow correctly.
 * - Phaser.Scale.CENTER_BOTH guarantees the canvas remains centered inside
 *   its parent container regardless of aspect ratio mismatches.
 * - Arcade Physics is configured with zero gravity since this is a top-down
 *   tower-defense layout; nothing should ever fall under gravity.
 */

const config = {
  type: Phaser.AUTO, // let Phaser pick WebGL if available, else Canvas — best cross-platform compatibility
  parent: 'game-container',

  scale: {
    mode: Phaser.Scale.RESIZE,           // canvas internal size tracks parent container size live
    autoCenter: Phaser.Scale.CENTER_BOTH, // keep canvas centered through every resize/orientation event
    width: '100%',
    height: '100%',
  },

  backgroundColor: '#000000',

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }, // absolute zero gravity — top-down game, nothing should fall
      debug: false,
    },
  },

  // Scene registration order: Menu boots first by default (first entry in
  // the array is auto-started by Phaser unless told otherwise).
  scene: [MenuScene, GameplayScene, GameOverScene],
};

// Instantiate the engine. From this point forward, all control flow lives
// inside the registered Scene classes.
const game = new Phaser.Game(config);

/**
 * Safety net: keep the canvas properly sized any time the browser window
 * or device orientation changes, even on platforms where the 'resize'
 * scale event can be a little late to fire (some older mobile WebViews).
 */
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

window.addEventListener('orientationchange', () => {
  // Small timeout lets the browser finish reporting the new viewport
  // dimensions before Phaser tries to read them.
  setTimeout(() => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }, 100);
});
