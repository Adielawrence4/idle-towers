/**
 * menuScene.js
 * --------------------------------------------------------------------------
 * Home screen for "Idle Tower: Merchant Guard".
 *
 * City-skyline aesthetic with responsive layout and a single entry point
 * into the action-defense gameplay scene.
 */
class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  preload() {
    if (!this.textures.exists('city_bg')) {
      const skyline = this.make.graphics({ x: 0, y: 0, add: false });
      skyline.fillGradientStyle(0x0a1628, 0x0a1628, 0x1a2744, 0x1a2744, 1);
      skyline.fillRect(0, 0, 512, 320);
      skyline.fillStyle(0x060d18, 1);
      skyline.fillRect(0, 260, 512, 60);
      const buildingColors = [0x111827, 0x1f2937, 0x152033, 0x0f172a, 0x1e293b];
      for (let i = 0; i < 18; i++) {
        const bw = Phaser.Math.Between(18, 46);
        const bh = Phaser.Math.Between(40, 160);
        const bx = i * 28 + Phaser.Math.Between(-6, 6);
        skyline.fillStyle(buildingColors[i % buildingColors.length], 1);
        skyline.fillRect(bx, 260 - bh, bw, bh);
      }
      skyline.generateTexture('city_bg', 512, 320);
    }
  }

  create() {
    const { width, height } = this.cameras.main;

    this.cityBg = this.add.tileSprite(0, 0, width, height, 'city_bg')
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.vignette = this.add.rectangle(width / 2, height / 2, width, height, 0x05080f, 0.55);

    this.titleText = this.add.text(width / 2, 0, 'IDLE TOWER', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: `${Math.max(36, Math.round(width * 0.09))}px`,
      fontStyle: 'bold',
      color: '#f4e4c1',
      stroke: '#3a2e1a',
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 12, fill: true },
    }).setOrigin(0.5);

    this.goldHint = this.add.text(width / 2, 0, 'VAULT GOLD: 0', {
      fontFamily: 'Consolas, monospace',
      fontSize: `${Math.max(14, Math.round(width * 0.022))}px`,
      color: '#ffd700',
    }).setOrigin(0.5);

    this.subtitleText = this.add.text(width / 2, 0, 'MERCHANT GUARD', {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(14, Math.round(width * 0.025))}px`,
      letterSpacing: 4,
      color: '#a89a78',
    }).setOrigin(0.5);

    this._layoutMenuText(width, height);

    CityDefenseSave.loadData().then((data) => {
      this._savedGold = data.gold || 0;
      this.goldHint.setText(`VAULT GOLD: ${this._savedGold}`);
    });

    this.createEnterButton(width, height);
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  _layoutMenuText(width, height) {
    const centerX = width / 2;
    const titleSize = Math.max(36, Math.round(width * 0.09));
    const goldSize = Math.max(14, Math.round(width * 0.022));
    const subtitleSize = Math.max(14, Math.round(width * 0.025));
    const gap = Math.max(14, Math.round(height * 0.022));
    const subtitleGap = Math.max(18, Math.round(height * 0.028));

    this.titleText.setFontSize(titleSize);
    this.goldHint.setFontSize(goldSize);
    this.subtitleText.setFontSize(subtitleSize);
    this.goldHint.setText(`VAULT GOLD: ${this._savedGold || 0}`);

    let y = height * 0.22;

    this.titleText.setPosition(centerX, y);
    y += this.titleText.displayHeight / 2 + gap;

    this.goldHint.setPosition(centerX, y + this.goldHint.displayHeight / 2);
    y += this.goldHint.displayHeight + subtitleGap;

    this.subtitleText.setPosition(centerX, y + this.subtitleText.displayHeight / 2);
  }

  createEnterButton(width, height) {
    const btnY = height * 0.55;
    const btnWidth = Math.max(240, width * 0.34);
    const btnHeight = Math.max(56, height * 0.08);

    this.enterButtonBg = this.add.rectangle(width / 2, btnY, btnWidth, btnHeight, 0x2a2110, 1)
      .setStrokeStyle(3, 0xffd700, 1)
      .setInteractive({ useHandCursor: true });

    this.enterButtonText = this.add.text(width / 2, btnY, 'ENTER DEFENSE', {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(18, Math.round(btnWidth * 0.09))}px`,
      fontStyle: 'bold',
      color: '#ffd700',
      shadow: { offsetX: 0, offsetY: 0, color: '#ffd700', blur: 10, fill: true },
    }).setOrigin(0.5);

    this.tweens.add({
      targets: [this.enterButtonBg],
      alpha: { from: 1, to: 0.78 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.enterButtonBg.on('pointerover', () => this.enterButtonBg.setFillStyle(0x3a2c10, 1));
    this.enterButtonBg.on('pointerout', () => this.enterButtonBg.setFillStyle(0x2a2110, 1));
    this.enterButtonBg.on('pointerdown', () => this.enterButtonBg.setScale(0.96));
    this.enterButtonBg.on('pointerup', () => {
      this.enterButtonBg.setScale(1);
      this.scene.start('GameplayScene');
    });
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.cityBg.setSize(width, height);
    this.vignette.setPosition(width / 2, height / 2).setSize(width, height);

    this.titleText.setFontSize(Math.max(36, Math.round(width * 0.09)));
    this._layoutMenuText(width, height);

    const btnY = height * 0.55;
    const btnWidth = Math.max(240, width * 0.34);
    const btnHeight = Math.max(56, height * 0.08);

    this.enterButtonBg.setPosition(width / 2, btnY).setSize(btnWidth, btnHeight);
    this.enterButtonText.setPosition(width / 2, btnY);
    this.enterButtonText.setFontSize(Math.max(18, Math.round(btnWidth * 0.09)));
  }
}
