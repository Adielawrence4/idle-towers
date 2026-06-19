/**
 * gameplayScene.js
 * --------------------------------------------------------------------------
 * Core action-defense loop for "Idle Tower: Merchant Guard".
 *
 * Compound citadel + perimeter fence layout, pooled arcade physics groups,
 * cursor-targeted player fire, automated guard matrix, escalating enemy
 * waves, shop economy, and YouTube cloud-backed gold persistence.
 */
class GameplayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameplayScene' });
  }

  preload() {
    this.load.image('enemy_unit', 'https://labs.phaser.io/assets/sprites/slime.png');
    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');
    this._generateTextures();
  }

  _generateTextures() {
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
        skyline.fillStyle(0xfbbf24, 0.35);
        for (let w = 0; w < Math.floor(bh / 22); w++) {
          for (let h = 0; h < Math.floor(bw / 12); h++) {
            if (Math.random() > 0.45) {
              skyline.fillRect(bx + 4 + h * 10, 260 - bh + 8 + w * 18, 4, 6);
            }
          }
        }
      }
      skyline.fillStyle(0x334155, 0.6);
      skyline.fillRect(0, 248, 512, 12);
      skyline.generateTexture('city_bg', 512, 320);
    }

    if (!this.textures.exists('citadel')) {
      const citadel = this.make.graphics({ x: 0, y: 0, add: false });
      citadel.fillStyle(0x4b5563, 1);
      citadel.fillRect(20, 40, 88, 72);
      citadel.fillStyle(0x6b7280, 1);
      citadel.fillRect(28, 20, 24, 28);
      citadel.fillRect(76, 20, 24, 28);
      citadel.fillRect(52, 8, 24, 36);
      citadel.fillStyle(0x374151, 1);
      for (let i = 0; i < 5; i++) {
        citadel.fillRect(22 + i * 18, 36, 10, 8);
        citadel.fillRect(28 + i * 16, 12, 8, 6);
      }
      citadel.fillStyle(0x1f2937, 1);
      citadel.fillRect(46, 72, 36, 40);
      citadel.fillStyle(0xfbbf24, 1);
      citadel.fillRect(58, 88, 12, 24);
      citadel.lineStyle(3, 0x9ca3af, 1);
      citadel.strokeRect(20, 40, 88, 72);
      citadel.strokeRect(28, 20, 24, 28);
      citadel.strokeRect(76, 20, 24, 28);
      citadel.strokeRect(52, 8, 24, 36);
      citadel.generateTexture('citadel', 128, 128);
    }

    if (!this.textures.exists('fence_wall')) {
      const fence = this.make.graphics({ x: 0, y: 0, add: false });
      fence.lineStyle(6, 0xc4a35a, 1);
      fence.strokeCircle(64, 64, 58);
      fence.lineStyle(3, 0x8b6914, 0.85);
      fence.strokeCircle(64, 64, 52);
      for (let a = 0; a < 16; a++) {
        const rad = (a / 16) * Math.PI * 2;
        const x1 = 64 + Math.cos(rad) * 46;
        const y1 = 64 + Math.sin(rad) * 46;
        const x2 = 64 + Math.cos(rad) * 60;
        const y2 = 64 + Math.sin(rad) * 60;
        fence.lineStyle(4, 0xd4b483, 1);
        fence.lineBetween(x1, y1, x2, y2);
      }
      fence.generateTexture('fence_wall', 128, 128);
    }
  }

  create() {
    const { width, height } = this.cameras.main;

    this.FENCE_RADIUS = this._getFenceRadius(width, height);
    this.gameOver = false;
    this.waveNumber = 1;
    this.spawnDelay = 3000;
    this.sessionGoldEarned = 0;

    this.gold = 0;
    this.bestWave = 0;
    this.bestTime = 0;
    this.citadelHP = 100;
    this.citadelMaxHP = 100;
    this.hpUpgradeCost = 30;
    this.weaponLevel = 0;
    this.clickCost = 5;
    this.guardCount = 0;
    this.guardCost = 15;
    this.enemyBaseSpeed = 28;
    this.elapsedTime = 0;

    this.centerX = width / 2;
    this.centerY = height / 2;

    this._buildBackground(width, height);
    this._notifyFirstFrameReady();

    this._playerDataPromise = this._loadPlayerProgress();

    this._buildDefenseLayout();
    this._buildHUD(width, height);
    this._buildShop(width, height);
    this._initPhysicsPools();
    this._bindInput();
    this._startLoops();

    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this._shutdown, this);

    this._playerDataPromise.then(() => {
      if (this.goldText) this.syncGoldDisplay();
      if (this.shopButtons) this.refreshShopAffordability();
    });

    this._notifyGameReady();

    this.time.delayedCall(100, () => this.spawnInitialWave());
  }

  _notifyFirstFrameReady() {
    if (typeof window.ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
      ytgame.game.firstFrameReady();
    }
  }

  _notifyGameReady() {
    if (typeof window.ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
      ytgame.game.gameReady();
    }
  }

  _loadPlayerProgress() {
    if (typeof window.ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
      return ytgame.game.loadData()
        .then((raw) => {
          let data = {};
          if (typeof raw === 'string') {
            try {
              data = JSON.parse(raw || '{}');
            } catch {
              data = {};
            }
          } else {
            data = raw || {};
          }
          this.gold = data.gold || 0;
          this.bestWave = parseInt(data.bestWave, 10) || 0;
          this.bestTime = parseInt(data.bestTime, 10) || 0;
        })
        .catch(() => {
          this.gold = 0;
          this.bestWave = 0;
          this.bestTime = 0;
        });
    }

    return CityDefenseSave.loadData().then((data) => {
      this.gold = data.gold || 0;
      this.bestWave = data.bestWave || 0;
      this.bestTime = data.bestTime || 0;
    });
  }

  _persistProgress() {
    if (this.waveNumber > this.bestWave) {
      this.bestWave = this.waveNumber;
    }
    const elapsed = Math.floor(this.elapsedTime);
    if (elapsed > this.bestTime) {
      this.bestTime = elapsed;
    }

    const payload = { gold: this.gold, bestWave: this.bestWave, bestTime: this.bestTime };

    if (typeof window.ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
      ytgame.game.saveData(JSON.stringify(payload));
      return;
    }

    CityDefenseSave.saveData(payload);
  }

  spawnInitialWave() {
    const slowFactor = 0.7;
    for (let i = 0; i < 5; i++) {
      this.spawnEnemy(this.enemyBaseSpeed * slowFactor);
    }
  }

  _buildBackground(width, height) {
    this.cityBg = this.add.tileSprite(0, 0, width, height, 'city_bg')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-20);

    this.battleTint = this.add.rectangle(width / 2, height / 2, width, height, 0x0b1220, 0.35)
      .setScrollFactor(0)
      .setDepth(-19);
  }

  _isMobileView(width, height) {
    return width < 768 || (width < height && width < 520);
  }

  _getFenceRadius(width, height) {
    const minDim = Math.min(width, height);
    if (this._isMobileView(width, height)) {
      return Math.max(88, Math.round(minDim * 0.21));
    }
    return 185;
  }

  _getDefenseScale(width, height) {
    const minDim = Math.min(width, height);
    let scale = Math.max(0.38, minDim / 520);
    if (this._isMobileView(width, height)) {
      scale *= 0.48;
      return Math.max(0.24, scale);
    }
    return Math.min(scale, 0.72);
  }

  _buildDefenseLayout() {
    const { width, height } = this.cameras.main;
    const scale = this._getDefenseScale(width, height);

    this.fenceSprite = this.add.image(this.centerX, this.centerY, 'fence_wall')
      .setScale((this.FENCE_RADIUS * 2) / 128)
      .setDepth(2)
      .setAlpha(0.92);

    this.fenceRing = this.add.graphics().setDepth(1);
    this._drawFenceRing();

    this.citadel = this.add.image(this.centerX, this.centerY, 'citadel')
      .setScale(scale)
      .setDepth(5);

    this.citadelFlash = this.add.image(this.centerX, this.centerY, 'citadel')
      .setScale(scale)
      .setDepth(6)
      .setAlpha(0)
      .setTint(0xffffff);
  }

  _drawFenceRing() {
    this.fenceRing.clear();
    this.fenceRing.lineStyle(2, 0xffd700, 0.25);
    this.fenceRing.strokeCircle(this.centerX, this.centerY, this.FENCE_RADIUS);
  }

  _buildHUD(width, height) {
    this.goldText = this.add.text(0, 0, `GOLD: ${this.gold}`, {
      fontFamily: 'Consolas, monospace',
      color: '#ffd700',
      stroke: '#000000',
    }).setScrollFactor(0).setDepth(100);

    this.waveText = this.add.text(0, 0, `WAVE: ${this.waveNumber}`, {
      fontFamily: 'Consolas, monospace',
      color: '#7dd3fc',
      stroke: '#000000',
    }).setScrollFactor(0).setDepth(100);

    this.timeText = this.add.text(0, 0, 'TIME: 0s', {
      fontFamily: 'Consolas, monospace',
      color: '#cbd5e1',
      stroke: '#000000',
    }).setScrollFactor(0).setDepth(100);

    this.hpText = this.add.text(0, 0, this._hpLabel(), {
      fontFamily: 'Consolas, monospace',
      color: '#86efac',
      stroke: '#000000',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    this.guardText = this.add.text(0, 0, `GUARDS: ${this.guardCount}`, {
      fontFamily: 'Consolas, monospace',
      color: '#c4b5fd',
      stroke: '#000000',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this._layoutHUD(width, height);
    this._createRewardedAdButton(width, height);
  }

  _layoutHUD(width, height) {
    const mobile = this._isMobileView(width, height);
    const pad = mobile ? 10 : 14;
    const safeTop = mobile ? 10 : 12;
    const uiSize = mobile
      ? Math.max(11, Math.round(width * 0.029))
      : Math.max(13, Math.round(Math.min(width, height) * 0.022));
    const lineGap = uiSize + 7;
    const stroke = mobile ? 2 : 3;
    const hpSize = mobile ? uiSize : Math.max(14, uiSize + 1);

    this.goldText.setFontSize(uiSize).setStroke('#000000', stroke);
    this.waveText.setFontSize(uiSize).setStroke('#000000', stroke);
    this.timeText.setFontSize(uiSize).setStroke('#000000', stroke);
    this.guardText.setFontSize(uiSize).setStroke('#000000', stroke);
    this.hpText.setFontSize(hpSize).setStroke('#000000', stroke + 1);
    this.hpText.setText(this._hpLabel());

    if (mobile) {
      this.goldText.setOrigin(0, 0).setPosition(pad, safeTop);
      this.guardText.setOrigin(1, 0).setPosition(width - pad, safeTop);
      this.hpText.setOrigin(0.5, 0).setPosition(width / 2, safeTop + lineGap + 2);
      this.waveText.setOrigin(0, 0).setPosition(pad, safeTop + lineGap * 2 + 4);
      this.timeText.setOrigin(0, 0).setPosition(pad, safeTop + lineGap * 3 + 4);
    } else {
      this.goldText.setOrigin(0, 0).setPosition(pad, safeTop);
      this.waveText.setOrigin(0, 0).setPosition(pad, safeTop + lineGap);
      this.timeText.setOrigin(0, 0).setPosition(pad, safeTop + lineGap * 2);
      this.hpText.setOrigin(0.5, 0).setPosition(width / 2, safeTop);
      this.guardText.setOrigin(1, 0).setPosition(width - pad, safeTop);
    }
  }

  async _requestInterstitialAd() {
    try {
      if (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
        await ytgame.ads.requestInterstitialAd();
      }
    } catch (error) {
      console.warn('Interstitial ad failed or was skipped:', error);
    }
  }

  async _requestRewardedAd(rewardId) {
    try {
      if (typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV) {
        return await ytgame.ads.requestRewardedAd(rewardId);
      }
    } catch (error) {
      console.warn('Rewarded ad failed or was skipped:', error);
    }
    return false;
  }

  _createRewardedAdButton(width, height) {
    if (!this.rewardedAdBg) {
      this.rewardedAdBg = this.add.rectangle(0, 0, 100, 30, 0x2a1f3d, 0.9)
        .setStrokeStyle(2, 0xc084fc)
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive({ useHandCursor: true });

      this.rewardedAdText = this.add.text(0, 0, 'AD +10G', {
        fontFamily: 'Consolas, monospace',
        color: '#e9d5ff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

      this.rewardedAdBg.on('pointerup', () => {
        this._watchRewardedAdForGold();
      });

      this._rewardedAdPending = false;
    }

    this._layoutRewardedAdButton(width, height);
  }

  _layoutRewardedAdButton(width, height) {
    if (!this.rewardedAdBg) return;

    const mobile = this._isMobileView(width, height);
    const btnW = mobile ? 108 : 132;
    const btnH = mobile ? 26 : 30;
    const pad = mobile ? 10 : 14;
    const uiSize = mobile
      ? Math.max(11, Math.round(width * 0.029))
      : Math.max(13, Math.round(Math.min(width, height) * 0.022));
    const lineGap = uiSize + 7;
    const safeTop = mobile ? 10 : 12;
    const x = width - pad - btnW / 2;
    const y = mobile ? safeTop + lineGap * 4 + 18 : safeTop + lineGap * 3 + 8;

    this.rewardedAdBg.setPosition(x, y).setSize(btnW, btnH);
    this.rewardedAdText.setPosition(x, y).setFontSize(mobile ? 10 : 11);
  }

  async _watchRewardedAdForGold() {
    if (this._rewardedAdPending || this.gameOver) return;

    this._rewardedAdPending = true;
    const rewardEarned = await this._requestRewardedAd('merchant-guard-bonus-gold-10');

    if (rewardEarned) {
      this.gold += 10;
      this.syncGoldDisplay();
      this.refreshShopAffordability();
    }

    this._rewardedAdPending = false;
  }

  _hpLabel() {
    const hp = `${Math.max(0, Math.ceil(this.citadelHP))}/${this.citadelMaxHP}`;
    const { width, height } = this.cameras.main;
    if (this._isMobileView(width, height)) {
      return `INTEGRITY ${hp}`;
    }
    return `CITADEL INTEGRITY: ${hp}`;
  }

  _buildShop(width, height) {
    const shopY = height - Math.max(64, height * 0.09);
    const btnH = Math.max(48, height * 0.07);
    const gap = 8;
    const btnW = (width - gap * 4) / 3;
    const positions = [
      gap + btnW / 2,
      gap * 2 + btnW + btnW / 2,
      gap * 3 + btnW * 2 + btnW / 2,
    ];
    const fontSize = Math.max(9, Math.round(btnW * 0.042));

    this.shopButtons = [
      {
        key: 'weapon',
        label: () => (this.weaponLevel >= 3
          ? 'Weapon Maxed'
          : `Upgrade Weapon\nCost: ${this.clickCost}`),
        color: 0x1a3a1a,
        stroke: 0x4ade80,
        textColor: '#bbf7d0',
        x: positions[0],
        action: () => this.purchaseWeaponUpgrade(),
      },
      {
        key: 'guard',
        label: () => `Deploy Guard\nCost: ${this.guardCost}`,
        color: 0x1a2540,
        stroke: 0x60a5fa,
        textColor: '#bfdbfe',
        x: positions[1],
        action: () => this.purchaseGuard(),
      },
      {
        key: 'hp',
        label: () => `Reinforce Citadel\nCost: ${this.hpUpgradeCost}`,
        color: 0x3a2418,
        stroke: 0xfbbf24,
        textColor: '#fde68a',
        x: positions[2],
        action: () => this.purchaseCitadelReinforcement(),
      },
    ];

    this.shopButtons.forEach((btn) => {
      btn.bg = this.add.rectangle(btn.x, shopY, btnW, btnH, btn.color, 0.92)
        .setStrokeStyle(2, btn.stroke)
        .setScrollFactor(0)
        .setDepth(90)
        .setInteractive({ useHandCursor: true });

      btn.text = this.add.text(btn.x, shopY, btn.label(), {
        fontFamily: 'Consolas, monospace',
        fontSize: `${fontSize}px`,
        color: btn.textColor,
        align: 'center',
        lineSpacing: 2,
        wordWrap: { width: btnW - 14, useAdvancedWrap: true },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(91);

      btn.bg.on('pointerdown', (pointer, localX, localY, event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        btn.action();
      });
    });

    this.shopY = shopY;
    this.shopBtnW = btnW;
    this.shopBtnH = btnH;
    this.shopPositions = positions;
    this.shopFontSize = fontSize;

    this.refreshShopAffordability();
  }

  _initPhysicsPools() {
    this.enemies = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 80,
      runChildUpdate: false,
    });

    this.projectiles = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 120,
      runChildUpdate: false,
    });

    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      this.handleProjectileHitEnemy,
      null,
      this
    );
  }

  _bindInput() {
    this.input.on('pointerdown', (pointer) => {
      if (this.gameOver) return;
      if (this._isPointerOverShop(pointer)) return;
      this.fireSalvo(pointer.x, pointer.y);
    });
  }

  _isPointerOverShop(pointer) {
    return this.shopButtons.some((btn) => {
      const bounds = btn.bg.getBounds();
      return bounds.contains(pointer.x, pointer.y);
    });
  }

  _startLoops() {
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      loop: true,
      callback: () => this.spawnEnemy(),
    });

    this.escalationTimer = this.time.addEvent({
      delay: 15000,
      loop: true,
      callback: () => this.escalateDifficulty(),
    });

    this.guardTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.fireGuardMatrix(),
    });
  }

  escalateDifficulty() {
    if (this.gameOver) return;

    this.waveNumber += 1;
    this.enemyBaseSpeed *= 1.15;
    this.spawnDelay = Math.max(900, Math.round(this.spawnDelay * 0.9));

    if (this.spawnTimer) {
      this.spawnTimer.remove(false);
      this.spawnTimer = this.time.addEvent({
        delay: this.spawnDelay,
        loop: true,
        callback: () => this.spawnEnemy(),
      });
    }

    this.waveText.setText(`WAVE: ${this.waveNumber}`);
  }

  _getWeaponTierConfig() {
    const tiers = [
      { damage: 1, bulletScale: 0.55, hitsToKill: 4 },
      { damage: 1, bulletScale: 0.72, hitsToKill: 3 },
      { damage: 2, bulletScale: 0.88, hitsToKill: 2 },
      { damage: 1, bulletScale: 1.05, hitsToKill: 1 },
    ];
    return tiers[Math.min(this.weaponLevel, 3)];
  }

  _getEnemyMaxHealth() {
    const waveBonus = Math.floor((this.waveNumber - 1) / 3);
    const { damage, hitsToKill } = this._getWeaponTierConfig();
    return hitsToKill * damage + waveBonus;
  }

  getRandomOffscreenPosition() {
    const { width, height } = this.cameras.main;
    const margin = 80;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const halfDiag = Math.sqrt(width * width + height * height) / 2 + margin;
    return {
      x: this.centerX + Math.cos(angle) * halfDiag,
      y: this.centerY + Math.sin(angle) * halfDiag,
    };
  }

  spawnEnemy(speedOverride) {
    if (this.gameOver) return;

    const pos = this.getRandomOffscreenPosition();
    let enemy = this.enemies.get(pos.x, pos.y, 'enemy_unit');

    if (!enemy) {
      enemy = this.physics.add.sprite(pos.x, pos.y, 'enemy_unit');
      this.enemies.add(enemy);
    } else {
      enemy.setActive(true).setVisible(true);
      enemy.body.reset(pos.x, pos.y);
    }

    const scale = Math.max(0.45, Math.min(this.cameras.main.width, this.cameras.main.height) / 520);
    enemy.setScale(scale);
    enemy.maxHealth = this._getEnemyMaxHealth();
    enemy.health = enemy.maxHealth;
    enemy.speed = speedOverride != null
      ? speedOverride
      : this.enemyBaseSpeed * Phaser.Math.FloatBetween(0.95, 1.05);

    this.physics.moveToObject(enemy, { x: this.centerX, y: this.centerY }, enemy.speed);
  }

  _getLivingEnemiesSortedByDistance() {
    return this.enemies.getChildren()
      .filter((e) => e.active)
      .sort((a, b) => {
        const distA = Phaser.Math.Distance.Between(this.centerX, this.centerY, a.x, a.y);
        const distB = Phaser.Math.Distance.Between(this.centerX, this.centerY, b.x, b.y);
        return distA - distB;
      });
  }

  _getSalvoSize() {
    return 1 + this.guardCount;
  }

  _getTargetsForSalvo(shotCount, focusX, focusY) {
    const living = this._getLivingEnemiesSortedByDistance();
    if (living.length === 0) return [];

    const targets = [];
    const used = new Set();

    const primary = this.findNearestEnemyTo(focusX, focusY);
    if (primary) {
      targets.push(primary);
      used.add(primary);
    }

    for (let slot = targets.length; slot < shotCount; slot++) {
      const sectorAngle = (slot / shotCount) * Math.PI * 2 - Math.PI / 2;
      const unused = living.filter((enemy) => !used.has(enemy));
      const searchPool = unused.length > 0 ? unused : living;

      let best = searchPool[0];
      let bestDiff = Infinity;

      searchPool.forEach((enemy) => {
        const angle = Phaser.Math.Angle.Between(this.centerX, this.centerY, enemy.x, enemy.y);
        const diff = Math.abs(Phaser.Math.Angle.Wrap(angle - sectorAngle));
        if (diff < bestDiff) {
          bestDiff = diff;
          best = enemy;
        }
      });

      targets.push(best);
      if (unused.length > 0) used.add(best);
    }

    return targets;
  }

  findNearestEnemyTo(worldX, worldY) {
    const living = this.enemies.getChildren().filter((e) => e.active);
    if (living.length === 0) return null;

    let nearest = null;
    let nearestDist = Infinity;

    living.forEach((enemy) => {
      const dist = Phaser.Math.Distance.Between(worldX, worldY, enemy.x, enemy.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    });

    return nearest;
  }

  fireSalvo(focusX, focusY) {
    if (this.gameOver) return;

    const targets = this._getTargetsForSalvo(this._getSalvoSize(), focusX, focusY);
    if (targets.length === 0) return;

    targets.forEach((target) => {
      this.spawnProjectile(target);
    });

    if (this.guardCount > 0) {
      this.triggerCitadelRecoil();
    }
  }

  fireGuardMatrix() {
    if (this.gameOver || this.guardCount <= 0) return;
    this.fireSalvo(this.centerX, this.centerY);
  }

  triggerCitadelRecoil() {
    const baseScale = this.citadel.scale;

    this.tweens.add({
      targets: this.citadel,
      scale: baseScale * 0.92,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    this.citadelFlash.setAlpha(0.55);
    this.tweens.add({
      targets: this.citadelFlash,
      alpha: 0,
      duration: 120,
      ease: 'Quad.easeOut',
    });
  }

  spawnProjectile(target) {
    let projectile = this.projectiles.get(this.centerX, this.centerY, 'bullet');

    if (!projectile) {
      projectile = this.physics.add.sprite(this.centerX, this.centerY, 'bullet');
      this.projectiles.add(projectile);
    } else {
      projectile.setActive(true).setVisible(true);
      projectile.body.reset(this.centerX, this.centerY);
    }

    const weaponConfig = this._getWeaponTierConfig();

    projectile.setScale(weaponConfig.bulletScale);
    projectile.damage = weaponConfig.damage;
    projectile.rotation = Phaser.Math.Angle.Between(
      this.centerX,
      this.centerY,
      target.x,
      target.y
    );

    this.physics.moveToObject(projectile, target, 460);

    this.time.delayedCall(2400, () => {
      if (projectile && projectile.active) {
        this.recycleProjectile(projectile);
      }
    });
  }

  recycleProjectile(projectile) {
    projectile.setActive(false).setVisible(false);
    if (projectile.body) projectile.body.stop();
  }

  recycleEnemy(enemy) {
    enemy.setActive(false).setVisible(false);
    if (enemy.body) enemy.body.stop();
  }

  handleProjectileHitEnemy(projectile, enemy) {
    if (!projectile.active || !enemy.active || this.gameOver) return;

    enemy.health -= projectile.damage || 1;
    this.recycleProjectile(projectile);

    if (enemy.health <= 0) {
      this.rewardGold(1, enemy.x, enemy.y);
      this.recycleEnemy(enemy);
    }
  }

  rewardGold(amount, x, y) {
    this.gold += amount;
    this.sessionGoldEarned += amount;
    this.syncGoldDisplay();
    this.refreshShopAffordability();

    const floatText = this.add.text(x, y - 10, `+${amount} Gold`, {
      fontFamily: 'Consolas, monospace',
      fontSize: `${Math.max(12, Math.round(this.cameras.main.width * 0.018))}px`,
      color: '#fde047',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: floatText,
      y: y - 48,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => floatText.destroy(),
    });
  }

  handleEnemyHitFence(enemy) {
    if (!enemy.active || this.gameOver) return;

    this.spawnExplosion(enemy.x, enemy.y);
    this.recycleEnemy(enemy);

    this.citadelHP = Math.max(0, this.citadelHP - 5);
    this.updateHealthDisplay();

    if (this.citadelHP <= 0) {
      this.triggerGameOver();
    }
  }

  spawnExplosion(x, y) {
    const burst = this.add.graphics().setDepth(40);
    burst.fillStyle(0xff6b35, 0.85);
    burst.fillCircle(x, y, 10);
    burst.lineStyle(3, 0xfbbf24, 1);
    burst.strokeCircle(x, y, 16);

    this.tweens.add({
      targets: burst,
      alpha: 0,
      duration: 320,
      onComplete: () => burst.destroy(),
    });
  }

  purchaseWeaponUpgrade() {
    if (this.gameOver || this.weaponLevel >= 3 || this.gold < this.clickCost) return;

    this.gold -= this.clickCost;
    this.weaponLevel += 1;
    this.clickCost += 5;
    this.syncGoldDisplay();
    this.refreshShopAffordability();
  }

  purchaseGuard() {
    if (this.gameOver || this.gold < this.guardCost) return;

    this.gold -= this.guardCost;
    this.guardCount += 1;
    this.guardCost += 15;
    this.guardText.setText(`GUARDS: ${this.guardCount}`);
    this.syncGoldDisplay();
    this.refreshShopAffordability();
  }

  purchaseCitadelReinforcement() {
    if (this.gameOver || this.gold < this.hpUpgradeCost) return;

    this.gold -= this.hpUpgradeCost;
    this.citadelMaxHP += 25;
    this.citadelHP = this.citadelMaxHP;
    this.hpUpgradeCost += 30;
    this.updateHealthDisplay();
    this.syncGoldDisplay();
    this.refreshShopAffordability();

    this.tweens.add({
      targets: [this.citadel, this.fenceSprite],
      alpha: { from: 1, to: 0.55 },
      duration: 120,
      yoyo: true,
    });
  }

  refreshShopAffordability() {
    const costs = {
      weapon: this.clickCost,
      guard: this.guardCost,
      hp: this.hpUpgradeCost,
    };

    this.shopButtons.forEach((btn) => {
      if (btn.key === 'weapon' && this.weaponLevel >= 3) {
        btn.bg.setFillStyle(0x1a1a1a, 0.5);
        btn.bg.setStrokeStyle(2, 0x4ade80, 0.25);
        btn.bg.disableInteractive();
        btn.text.setText('Weapon Maxed');
        btn.text.setColor('#475569');
        return;
      }

      if (btn.key === 'weapon') {
        btn.bg.setInteractive({ useHandCursor: true });
      }

      const affordable = this.gold >= costs[btn.key];
      btn.bg.setFillStyle(btn.color, affordable ? 0.92 : 0.45);
      btn.bg.setStrokeStyle(2, btn.stroke, affordable ? 1 : 0.35);
      btn.text.setColor(affordable ? btn.textColor : '#64748b');
      btn.text.setText(btn.label());
    });
  }

  syncGoldDisplay() {
    this.goldText.setText(`GOLD: ${this.gold}`);
    this._persistProgress();
  }

  updateHealthDisplay() {
    this.hpText.setText(this._hpLabel());
    const ratio = this.citadelHP / this.citadelMaxHP;
    if (ratio > 0.6) this.hpText.setColor('#86efac');
    else if (ratio > 0.25) this.hpText.setColor('#fcd34d');
    else this.hpText.setColor('#f87171');
  }

  triggerGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;

    if (this.spawnTimer) this.spawnTimer.remove(false);
    if (this.escalationTimer) this.escalationTimer.remove(false);
    if (this.guardTimer) this.guardTimer.remove(false);

    if (this.waveNumber > this.bestWave) {
      this.bestWave = this.waveNumber;
    }
    const elapsed = Math.floor(this.elapsedTime);
    if (elapsed > this.bestTime) {
      this.bestTime = elapsed;
    }
    this._persistProgress();

    this.enemies.getChildren().forEach((enemy) => {
      if (enemy.active) this.recycleEnemy(enemy);
    });
    this.projectiles.getChildren().forEach((projectile) => {
      if (projectile.active) this.recycleProjectile(projectile);
    });

    this.scene.start('GameOverScene', {
      finalGold: this.gold,
      sessionGoldEarned: this.sessionGoldEarned,
      finalWave: this.waveNumber,
      elapsedTime: Math.floor(this.elapsedTime),
      guardsDeployed: this.guardCount,
      bestWave: this.bestWave,
      bestTime: this.bestTime,
    });
  }

  update(time, delta) {
    if (this.gameOver) return;

    this.elapsedTime += delta / 1000;
    if (Math.floor(this.elapsedTime) !== this._lastTimeShown) {
      this._lastTimeShown = Math.floor(this.elapsedTime);
      this.timeText.setText(`TIME: ${this._lastTimeShown}s`);
    }

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;

      const dist = Phaser.Math.Distance.Between(
        this.centerX,
        this.centerY,
        enemy.x,
        enemy.y
      );

      if (dist <= this.FENCE_RADIUS + enemy.displayWidth * 0.25) {
        this.handleEnemyHitFence(enemy);
      }
    });
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.centerX = width / 2;
    this.centerY = height / 2;
    this.FENCE_RADIUS = this._getFenceRadius(width, height);

    this.cityBg.setSize(width, height);
    this.battleTint.setPosition(width / 2, height / 2).setSize(width, height);

    const scale = this._getDefenseScale(width, height);
    this.citadel.setPosition(this.centerX, this.centerY).setScale(scale);
    this.citadelFlash.setPosition(this.centerX, this.centerY).setScale(scale);
    this.fenceSprite
      .setPosition(this.centerX, this.centerY)
      .setScale((this.FENCE_RADIUS * 2) / 128);
    this._drawFenceRing();

    this._layoutHUD(width, height);
    this._layoutRewardedAdButton(width, height);

    const shopY = height - Math.max(64, height * 0.09);
    const btnH = Math.max(48, height * 0.07);
    const gap = 8;
    const btnW = (width - gap * 4) / 3;
    const positions = [
      gap + btnW / 2,
      gap * 2 + btnW + btnW / 2,
      gap * 3 + btnW * 2 + btnW / 2,
    ];
    const fontSize = Math.max(9, Math.round(btnW * 0.042));

    this.shopY = shopY;
    this.shopBtnW = btnW;
    this.shopBtnH = btnH;
    this.shopPositions = positions;
    this.shopFontSize = fontSize;

    this.shopButtons.forEach((btn, index) => {
      btn.x = positions[index];
      btn.bg.setPosition(positions[index], shopY).setSize(btnW, btnH);
      btn.text.setPosition(positions[index], shopY);
      btn.text.setFontSize(fontSize);
      btn.text.setWordWrapWidth(btnW - 14, true);
    });

    this.refreshShopAffordability();
  }

  _shutdown() {
    this.scale.off('resize', this.handleResize, this);
    if (this.spawnTimer) this.spawnTimer.remove(false);
    if (this.escalationTimer) this.escalationTimer.remove(false);
    if (this.guardTimer) this.guardTimer.remove(false);
  }
}
