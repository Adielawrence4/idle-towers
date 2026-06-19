/**
 * gameOverScene.js
 * --------------------------------------------------------------------------
 * Terminal screen for "Idle Tower: Merchant Guard".
 *
 * Displays run metrics in a structured panel, preserves the cumulative
 * localStorage wallet, and offers a REDEPLOY DEFENSES restart.
 */
class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.finalGold = (data && typeof data.finalGold === 'number') ? data.finalGold : 0;
    this.sessionGoldEarned = (data && typeof data.sessionGoldEarned === 'number') ? data.sessionGoldEarned : 0;
    this.finalWave = (data && typeof data.finalWave === 'number') ? data.finalWave : 1;
    this.elapsedTime = (data && typeof data.elapsedTime === 'number') ? data.elapsedTime : 0;
    this.guardsDeployed = (data && typeof data.guardsDeployed === 'number') ? data.guardsDeployed : 0;
  }

  create() {
    const { width, height } = this.cameras.main;

    this.cameras.main.setBackgroundColor('#0a0f18');
    this.add.rectangle(width / 2, height / 2, width, height, 0x06080c, 0.92);

    this.panelBg = this.add.rectangle(0, 0, 100, 100, 0x111827, 0.95)
      .setStrokeStyle(2, 0x334155);

    this.headline = this.add.text(0, 0, 'CITADEL BREACHED', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'bold',
      color: '#ff6b6b',
      stroke: '#3b0d0d',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5, 0);

    this.dividerTop = this.add.rectangle(0, 0, 100, 1, 0x334155);
    this.dividerMid = this.add.rectangle(0, 0, 100, 1, 0x334155);

    this.statRows = [
      this._createStatRow('Total Gold', `${this.finalGold}`, '#ffd700'),
      this._createStatRow('Gold This Run', `+${this.sessionGoldEarned}`, '#fde68a'),
      this._createStatRow('Waves Held', `${this.finalWave}`, '#7dd3fc'),
      this._createStatRow('Survival Time', `${this.elapsedTime}s`, '#e2e8f0'),
    ];

    this.recordLine = this.add.text(0, 0, 'PERSONAL BEST', {
      fontFamily: 'Consolas, monospace',
      color: '#64748b',
      letterSpacing: 2,
    }).setOrigin(0.5, 0);

    this.bestWaveText = this.add.text(0, 0, 'Best Wave', {
      fontFamily: 'Consolas, monospace',
      color: '#94a3b8',
    });

    this.bestWaveValue = this.add.text(0, 0, '0', {
      fontFamily: 'Consolas, monospace',
      color: '#cbd5e1',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    this.bestTimeText = this.add.text(0, 0, 'Best Time', {
      fontFamily: 'Consolas, monospace',
      color: '#94a3b8',
    });

    this.bestTimeValue = this.add.text(0, 0, '0s', {
      fontFamily: 'Consolas, monospace',
      color: '#cbd5e1',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    this.redeployBg = this.add.rectangle(0, 0, 100, 52, 0x1a2f1a, 0.95)
      .setStrokeStyle(3, 0x4ade80, 1)
      .setInteractive({ useHandCursor: true });

    this.redeployText = this.add.text(0, 0, 'REDEPLOY DEFENSES', {
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      color: '#bbf7d0',
    }).setOrigin(0.5);

    this.redeployBg.on('pointerover', () => this.redeployBg.setFillStyle(0x254a2a, 0.95));
    this.redeployBg.on('pointerout', () => this.redeployBg.setFillStyle(0x1a2f1a, 0.95));
    this.redeployBg.on('pointerdown', () => this.redeployBg.setScale(0.96));
    this.redeployBg.on('pointerup', () => {
      this.redeployBg.setScale(1);
      this.handleRedeploy();
    });

    this.menuBg = this.add.rectangle(0, 0, 100, 42, 0x1f2937, 0.9)
      .setStrokeStyle(2, 0x64748b)
      .setInteractive({ useHandCursor: true });

    this.menuText = this.add.text(0, 0, 'RETURN TO MENU', {
      fontFamily: 'Consolas, monospace',
      color: '#e2e8f0',
    }).setOrigin(0.5);

    this.menuBg.on('pointerup', () => {
      this.scene.start('MenuScene');
    });

    this._applyLayout(width, height);

    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  _createStatRow(label, value, valueColor) {
    const labelText = this.add.text(0, 0, label, {
      fontFamily: 'Consolas, monospace',
      color: '#94a3b8',
    });

    const valueText = this.add.text(0, 0, value, {
      fontFamily: 'Consolas, monospace',
      color: valueColor,
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    return { labelText, valueText };
  }

  _fitHeadlineFontSize(panelW) {
    const maxWidth = panelW - 48;
    let size = Math.max(18, Math.round(panelW * 0.078));
    const minSize = 13;

    this.headline.setFontSize(size);
    while (this.headline.displayWidth > maxWidth && size > minSize) {
      size -= 1;
      this.headline.setFontSize(size);
    }

    this.headline.setStroke('#3b0d0d', Math.max(2, Math.round(size * 0.11)));
    return size;
  }

  _applyLayout(width, height) {
    const panelW = Math.min(400, width * 0.88);
    const padX = 28;
    const labelSize = Math.max(12, Math.round(Math.min(width, height) * 0.02));
    const valueSize = Math.max(13, Math.round(Math.min(width, height) * 0.021));
    const recordSize = Math.max(10, Math.round(labelSize * 0.88));
    let rowGap = Math.max(22, labelSize + 10);
    const recordRowGap = Math.max(20, labelSize + 8);

    const btnWidth = Math.min(340, panelW);
    const btnHeight = Math.max(46, Math.min(56, height * 0.065));
    const menuBtnH = 40;
    const stackGap = Math.max(16, height * 0.02);

    this.headline.setFontSize(24);
    this._fitHeadlineFontSize(panelW);

    const headlineH = this.headline.displayHeight;
    const recordsH = recordSize + 10 + recordRowGap * 2;
    const statsH = rowGap * 4;

    let panelH = 18 + headlineH + 14 + statsH + 16 + recordsH + 22;

    const buttonsH = btnHeight + stackGap + menuBtnH;
    const maxPanelH = height - buttonsH - stackGap * 2 - 24;

    if (panelH > maxPanelH) {
      rowGap = Math.max(18, (maxPanelH - 18 - headlineH - 14 - 16 - recordsH - 22) / 4);
      panelH = 18 + headlineH + 14 + rowGap * 4 + 16 + recordsH + 22;
    }

    const totalStackH = panelH + stackGap + buttonsH;
    const stackTop = Math.max(16, (height - totalStackH) / 2);
    const panelX = width / 2;
    const panelY = stackTop + panelH / 2;
    const panelTop = stackTop;
    const panelBottom = stackTop + panelH;
    const labelX = panelX - panelW / 2 + padX;
    const valueX = panelX + panelW / 2 - padX;

    this.panelBg.setPosition(panelX, panelY).setSize(panelW, panelH);

    let y = panelTop + 18;
    this.headline.setPosition(panelX, y);
    y += headlineH + 12;

    this.dividerTop.setPosition(panelX, y).setSize(panelW - padX * 2, 1);
    y += 14;

    const rowValues = [
      `${this.finalGold}`,
      `+${this.sessionGoldEarned}`,
      `${this.finalWave}`,
      `${this.elapsedTime}s`,
    ];

    this.statRows.forEach((row, index) => {
      row.labelText.setFontSize(labelSize).setPosition(labelX, y + rowGap * index);
      row.valueText.setFontSize(valueSize).setPosition(valueX, y + rowGap * index).setText(rowValues[index]);
    });

    y += rowGap * 4 + 10;
    this.dividerMid.setPosition(panelX, y).setSize(panelW - padX * 2, 1);
    y += 14;

    const bestWave = parseInt(localStorage.getItem('guard_city_best_wave'), 10) || 0;
    const bestTime = parseInt(localStorage.getItem('guard_city_best_time'), 10) || 0;

    this.recordLine.setFontSize(recordSize).setPosition(panelX, y);
    y += recordSize + 10;

    this.bestWaveText.setFontSize(labelSize).setPosition(labelX, y);
    this.bestWaveValue.setFontSize(valueSize).setPosition(valueX, y).setText(`${bestWave}`);
    y += recordRowGap;

    this.bestTimeText.setFontSize(labelSize).setPosition(labelX, y);
    this.bestTimeValue.setFontSize(valueSize).setPosition(valueX, y).setText(`${bestTime}s`);

    const redeployY = panelBottom + stackGap + btnHeight / 2;
    this.redeployBg.setPosition(panelX, redeployY).setSize(btnWidth, btnHeight);
    this.redeployText.setFontSize(Math.max(14, Math.round(btnWidth * 0.052))).setPosition(panelX, redeployY);

    const menuY = redeployY + btnHeight / 2 + stackGap + menuBtnH / 2;
    this.menuBg.setPosition(panelX, menuY).setSize(Math.min(260, panelW * 0.72), menuBtnH);
    this.menuText.setFontSize(Math.max(11, Math.round(btnWidth * 0.048))).setPosition(panelX, menuY);
  }

  handleRedeploy() {
    this.scene.stop('GameplayScene');
    this.scene.start('GameplayScene');
  }

  handleResize(gameSize) {
    this._applyLayout(gameSize.width, gameSize.height);
  }
}
