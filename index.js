// index.js - Roguelike Game Implementation with wrap-around edges
// Tile legend:
//   TILE_EMPTY (0) : floor (tile-.png)
//   TILE_WALL  (1) : wall (tile-W.png)
//   TILE_SWORD (2) : sword (tile-SW.png)
//   TILE_POTION(3) : health potion (tile-HP.png)

// Configuration constants
const TILE_EMPTY = 0;
const TILE_WALL = 1;
const TILE_SWORD = 2;
const TILE_POTION = 3;

const MAP_WIDTH = 40;
const MAP_HEIGHT = 24;
const TILE_SIZE = 50;

// Sword and potion counts
const SWORD_COUNT = 1;
const POTION_COUNT = 2;

// Room generation
const ROOM_MIN = 3;
const ROOM_MAX = 8;
const ROOM_COUNT_MIN = 5;
const ROOM_COUNT_MAX = 10;

// Corridor generation
const CORRIDOR_MIN = 3; // per direction
const CORRIDOR_MAX = 5;

// Enemy config
const ENEMY_COUNT = 10;
const ENEMY_HP = 5;
const ENEMY_ATTACK = 1;

// Hero config
const HERO_HP = 10;
const HERO_ATTACK = 1;

// Runtime counters for HUD
let potionsCarried = 0;
let killed = 0;

// Game state
let map = [];
let hero = { x: 0, y: 0, hp: HERO_HP, maxHp: HERO_HP, attack: HERO_ATTACK };
let enemies = [];
let rooms = [];

class Game {
  init() {
    // reset runtime counters
    potionsCarried = 0;
    killed = 0;

    this._gameOver = false;
    this._win = false;

    this.generateMap();
    this.placeRooms();
    this.carveCorridors();
    this.placeHero();
    this.placeItems();
    this.placeEnemies();
    this.resizeField();
    this.draw();
    this.bindInput();
    this.updateHUD();
  }

  resizeField() {
    const field = document.querySelector('.field');
    field.style.width = `${MAP_WIDTH * TILE_SIZE}px`;
    field.style.height = `${MAP_HEIGHT * TILE_SIZE}px`;
  }

  generateMap() {
    map = Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => TILE_WALL)
    );
  }

  placeRooms() {
    rooms = [];
    const count = this.randomInt(ROOM_COUNT_MIN, ROOM_COUNT_MAX);
    for (let i = 0; i < count; i++) {
      const w = this.randomInt(ROOM_MIN, ROOM_MAX);
      const h = this.randomInt(ROOM_MIN, ROOM_MAX);
      const x = this.randomInt(1, MAP_WIDTH - w - 2);
      const y = this.randomInt(1, MAP_HEIGHT - h - 2);
      const room = { x, y, w, h };
      rooms.push(room);
      for (let ry = y; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
          map[ry][rx] = TILE_EMPTY;
        }
      }
    }
  }

  carveCorridors() {
    for (let i = 1; i < rooms.length; i++) {
      const r1 = rooms[i - 1];
      const r2 = rooms[i];
      const x1 = Math.floor(r1.x + r1.w / 2);
      const y1 = Math.floor(r1.y + r1.h / 2);
      const x2 = Math.floor(r2.x + r2.w / 2);
      const y2 = Math.floor(r2.y + r2.h / 2);
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) map[y1][x] = TILE_EMPTY;
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) map[y][x2] = TILE_EMPTY;
    }

    const hCount = this.randomInt(CORRIDOR_MIN, CORRIDOR_MAX);
    const vCount = this.randomInt(CORRIDOR_MIN, CORRIDOR_MAX);

    for (let i = 0; i < hCount; i++) {
      const y = this.randomInt(1, MAP_HEIGHT - 2);
      for (let x = 0; x < MAP_WIDTH; x++) map[y][x] = TILE_EMPTY;
    }

    for (let i = 0; i < vCount; i++) {
      const x = this.randomInt(1, MAP_WIDTH - 2);
      for (let y = 0; y < MAP_HEIGHT; y++) map[y][x] = TILE_EMPTY;
    }
  }

  placeItems() {
    let placed = 0;
    while (placed < 2) {
      const x = this.randomInt(0, MAP_WIDTH - 1);
      const y = this.randomInt(0, MAP_HEIGHT - 1);
      if (map[y][x] === TILE_EMPTY && !(x === hero.x && y === hero.y)) { map[y][x] = TILE_SWORD; placed++; }
    }
    placed = 0;
    while (placed < 10) {
      const x = this.randomInt(0, MAP_WIDTH - 1);
      const y = this.randomInt(0, MAP_HEIGHT - 1);
      if (map[y][x] === TILE_EMPTY && !(x === hero.x && y === hero.y)) { map[y][x] = TILE_POTION; placed++; }
    }
  }

  placeHero() {
    // reset hero stats to defaults on new game
    hero = { x: 0, y: 0, hp: HERO_HP, maxHp: HERO_HP, attack: HERO_ATTACK };

    while (true) {
      const x = this.randomInt(0, MAP_WIDTH - 1);
      const y = this.randomInt(0, MAP_HEIGHT - 1);
      if (map[y][x] === TILE_EMPTY) { hero.x = x; hero.y = y; break; }
    }
  }

  placeEnemies() {
    enemies = [];
    let count = 0;
    while (count < ENEMY_COUNT) {
      const x = this.randomInt(0, MAP_WIDTH - 1);
      const y = this.randomInt(0, MAP_HEIGHT - 1);
      if (map[y][x] === TILE_EMPTY && (x !== hero.x || y !== hero.y) && !enemies.some(e => e.x === x && e.y === y)) {
        enemies.push({ x, y, hp: ENEMY_HP, maxHp: ENEMY_HP, attack: ENEMY_ATTACK, _justRetaliated: false });
        count++;
      }
    }
  }

  bindInput() {
    // Keep a reference to the bound handler so we can avoid adding multiple listeners
    // If a previous listener exists, remove it first (prevents double-processing on restart)
    if (this._boundHandle) {
      window.removeEventListener('keydown', this._boundHandle);
    }
    this._boundHandle = this.handleInput.bind(this);
    window.addEventListener('keydown', this._boundHandle);
  }

  handleInput(e) {
    if (this._gameOver) return;
    if (e.key === ' ') e.preventDefault();

    const keyMap = {
      'w': [0, -1], 'W': [0, -1], 'ArrowUp': [0, -1], 'ц': [0, -1], 'Ц': [0, -1],
      'a': [-1, 0], 'A': [-1, 0], 'ArrowLeft': [-1, 0], 'ф': [-1, 0], 'Ф': [-1, 0],
      's': [0, 1], 'S': [0, 1], 'ArrowDown': [0, 1], 'ы': [0, 1], 'Ы': [0, 1],
      'd': [1, 0], 'D': [1, 0], 'ArrowRight': [1, 0], 'в': [1, 0], 'В': [1, 0]
    };

    let acted = false;
    if (e.key in keyMap) {
      const [dx, dy] = keyMap[e.key];
      this.attemptMove(dx, dy);
      acted = true;
    } else if (e.key === ' ') {
      this.heroAttack();
      acted = true;
    }

    if (acted) {
      this.updateEnemies();
      this.draw();
      this.updateHUD();
    }
  }

  draw() {
    const field = document.querySelector('.field');
    field.innerHTML = '';
    if (this._gameOver) {
      if (this._win) this.showYouWin(); else this.showGameOver();
      return;
    }
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const el = document.createElement('div');
        el.classList.add('tile');
        switch (map[y][x]) {
          case TILE_WALL: el.classList.add('tileW'); break;
          case TILE_SWORD: el.classList.add('tileSW'); break;
          case TILE_POTION: el.classList.add('tileHP'); break;
        }
        if (hero.x === x && hero.y === y) {
          el.classList.add('tileP');
          this.drawHealth(el, hero.hp, hero.maxHp);
        }
        const enemy = enemies.find(e => e.x === x && e.y === y);
        if (enemy) {
          el.classList.add('tileE');
          this.drawHealth(el, enemy.hp, enemy.maxHp);
        }
        el.style.left = `${x * TILE_SIZE}px`;
        el.style.top = `${y * TILE_SIZE}px`;
        field.appendChild(el);
      }
    }
    this.updateHUD();
  }

  drawHealth(el, hp, maxHp) {
    const bar = document.createElement('div');
    bar.classList.add('health');
    bar.style.width = `${(hp / maxHp) * TILE_SIZE}px`;
    el.appendChild(bar);
  }

  attemptMove(dx, dy) {
    let nx = hero.x + dx;
    let ny = hero.y + dy;

    // wrap-around logic
    if (nx < 0) nx = MAP_WIDTH - 1;
    if (nx >= MAP_WIDTH) nx = 0;
    if (ny < 0) ny = MAP_HEIGHT - 1;
    if (ny >= MAP_HEIGHT) ny = 0;

    // Block walls and enemies
    if (map[ny][nx] === TILE_WALL) return;
    if (enemies.some(e => e.x === nx && e.y === ny)) return;

    hero.x = nx;
    hero.y = ny;
    this.checkPickup();
    this.adjacentEnemyDamage();
  }

  checkPickup() {
    const t = map[hero.y][hero.x];
    if (t === TILE_POTION) {
      potionsCarried += 1;
      hero.hp = Math.min(hero.maxHp, hero.hp + POTION_COUNT);
      map[hero.y][hero.x] = TILE_EMPTY;
    } else if (t === TILE_SWORD) {
      hero.attack += SWORD_COUNT;
      map[hero.y][hero.x] = TILE_EMPTY;
    }
  }

  adjacentEnemyDamage() {
    const dirs = [{dx:-1,dy:0},{dx:1,dy:0},{dx:0,dy:-1},{dx:0,dy:1}];
    dirs.forEach(({dx,dy}) => {
      const tx = hero.x + dx;
      const ty = hero.y + dy;
      const en = enemies.find(e => e.x === tx && e.y === ty);
      if (en) {
        hero.hp -= en.attack;
      }
    });
    if (hero.hp <= 0) this.endGame();
  }

  heroAttack() {
    // Damage all adjacent enemies; surviving enemies retaliate once (flagged)
    const dirs = [{dx:-1,dy:0},{dx:1,dy:0},{dx:0,dy:-1},{dx:0,dy:1}];
    dirs.forEach(({dx,dy}) => {
      const tx = hero.x+dx, ty = hero.y+dy;
      const idx = enemies.findIndex(e=> e.x===tx && e.y===ty);
      if (idx!==-1) {
        const en = enemies[idx];
        en.hp -= hero.attack;
        if (en.hp>0) {
          // enemy retaliates immediately, but mark it so updateEnemies won't double-attack
          hero.hp -= en.attack;
          en._justRetaliated = true;
        } else {
          enemies.splice(idx,1);
          killed += 1;
        }
      }
    });
    // after processing all adjacent enemies check victory
    if (enemies.length === 0 || killed >= ENEMY_COUNT) {
      this.win();
      return;
    }
    if (hero.hp<=0) this.endGame();
  }

  endGame() {
    hero.hp = 0;
    this._gameOver = true;
    this._win = false;
    this.draw();
  }

  showGameOver() {
    const field = document.querySelector('.field');
    field.innerHTML = '';

    const container = document.createElement('div');
    container.style.textAlign = 'center';
    container.style.marginTop = '20px';

    const msg = document.createElement('div');
    msg.style.color = 'red';
    msg.style.fontSize = '32px';
    msg.style.fontWeight = 'bold';
    msg.textContent = 'GAME OVER';

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Restart';
    restartBtn.style.marginTop = '15px';
    restartBtn.style.padding = '10px 20px';
    restartBtn.style.fontSize = '18px';
    restartBtn.addEventListener('click', () => {
      potionsCarried = 0;
      killed = 0;
      this.init();
    });

    container.appendChild(msg);
    container.appendChild(restartBtn);
    field.appendChild(container);
  }

  showYouWin() {
    const field = document.querySelector('.field');
    field.innerHTML = '';

    const container = document.createElement('div');
    container.style.textAlign = 'center';
    container.style.marginTop = '20px';

    const msg = document.createElement('div');
    msg.style.color = 'lime';
    msg.style.fontSize = '32px';
    msg.style.fontWeight = 'bold';
    msg.textContent = 'YOU WIN!';

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Restart';
    restartBtn.style.marginTop = '15px';
    restartBtn.style.padding = '10px 20px';
    restartBtn.style.fontSize = '18px';
    restartBtn.addEventListener('click', () => {
      potionsCarried = 0;
      killed = 0;
      this.init();
    });

    container.appendChild(msg);
    container.appendChild(restartBtn);
    field.appendChild(container);
  }

  win() {
    this._gameOver = true;
    this._win = true;
    this.draw();
  }

  updateEnemies() {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const dx = Math.abs(e.x - hero.x);
      const dy = Math.abs(e.y - hero.y);
      // if this enemy just retaliated during heroAttack, skip its attack this enemy-turn
      if (e._justRetaliated) { e._justRetaliated = false; continue; }

      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        hero.hp -= e.attack;
        if (hero.hp <= 0) { this.endGame(); return; }
        continue;
      }
      const moves = [{dx:0,dy:0},{dx:-1,dy:0},{dx:1,dy:0},{dx:0,dy:-1},{dx:0,dy:1}];
      const mv = moves[this.randomInt(0, moves.length-1)];
      let nx = e.x + mv.dx, ny = e.y + mv.dy;
      if (nx < 0) nx = MAP_WIDTH - 1;
      if (nx >= MAP_WIDTH) nx = 0;
      if (ny < 0) ny = MAP_HEIGHT - 1;
      if (ny >= MAP_HEIGHT) ny = 0;
      if (mv.dx !==0 || mv.dy !==0) {
        if (map[ny][nx] === TILE_EMPTY && !(nx===hero.x && ny===hero.y) && !enemies.some((oth,idx)=> idx!==i && oth.x===nx && oth.y===ny)) {
          e.x = nx; e.y = ny;
        }
      }
    }
    // Note: do NOT call adjacentEnemyDamage here — enemy attacks are handled above per-turn
  }

  updateHUD() {
    const elHp = document.getElementById('hero-hp');
    const elAtk = document.getElementById('hero-atk');
    const elPot = document.getElementById('potions-carried');
    const elKill = document.getElementById('killed');
    if (elHp) elHp.textContent = hero.hp.toString();
    if (elAtk) elAtk.textContent = hero.attack.toString();
    if (elPot) elPot.textContent = potionsCarried.toString();
    if (elKill) elKill.textContent = killed.toString();
  }

  randomInt(min,max) { return Math.floor(Math.random()*(max-min+1))+min; }
}

window.Game = Game;