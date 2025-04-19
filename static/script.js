document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const balanceEl = document.getElementById('balance');
  const profitEl = document.getElementById('profit');
  const multiplierEl = document.getElementById('multiplier');
  const numMinesEl = document.getElementById('numMines');
  const betAmountEl = document.getElementById('betAmount');
  const autoCashoutEl = document.getElementById('autoCashout');
  const startGameBtn = document.getElementById('startGame');
  const cashOutBtn = document.getElementById('cashOut');
  const gameBoardEl = document.getElementById('gameBoard');
  const messageEl = document.getElementById('message');
  const progressFill = document.querySelector('.progress-fill');
  const progressText = document.getElementById('progress-text');
  const resetStatsBtn = document.getElementById('resetStats');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Number input handlers
  const numberInputs = document.querySelectorAll('.number-input');
  numberInputs.forEach(container => {
      const input = container.querySelector('input');
      const decreaseBtn = container.querySelector('.decrease');
      const increaseBtn = container.querySelector('.increase');
      
      decreaseBtn.addEventListener('click', () => {
          const currentValue = parseFloat(input.value) || 0;
          const step = parseFloat(input.step) || 1;
          const min = parseFloat(input.min) || 0;
          input.value = Math.max(min, currentValue - step);
      });
      
      increaseBtn.addEventListener('click', () => {
          const currentValue = parseFloat(input.value) || 0;
          const step = parseFloat(input.step) || 1;
          const max = parseFloat(input.max) || 999999;
          input.value = Math.min(max, currentValue + step);
      });
  });
  
  // Audio elements
  const clickSound = document.getElementById('click-sound');
  const winSound = document.getElementById('win-sound');
  const loseSound = document.getElementById('lose-sound');
  
  const GRID_SIZE = 5;
  let gameActive = false;
  let revealedCount = 0;
  let totalSafeCells = 0;
  
  // Tab switching
  tabButtons.forEach(button => {
      button.addEventListener('click', () => {
          tabButtons.forEach(btn => btn.classList.remove('active'));
          tabContents.forEach(content => content.classList.remove('active'));
          
          button.classList.add('active');
          document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');
      });
  });
  
  // Create the game board
  function createBoard() {
      gameBoardEl.innerHTML = '';
      for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.index = i;
          cell.addEventListener('click', () => revealCell(i));
          gameBoardEl.appendChild(cell);
      }
  }
  
  // Update the progress bar
  function updateProgress() {
      if (totalSafeCells === 0) return;
      const percentage = (revealedCount / totalSafeCells) * 100;
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `${revealedCount}/${totalSafeCells}`;
  }
  
  // Show a message
  function showMessage(text, type = '') {
      messageEl.textContent = text;
      messageEl.className = 'message visible';
      if (type) messageEl.classList.add(type);
      
      setTimeout(() => {
          messageEl.classList.remove('visible');
      }, 5000);
  }
  
  // Start a new game
  async function startGame() {
      const numMines = parseInt(numMinesEl.value);
      const betAmount = parseInt(betAmountEl.value);
      const autoCashout = parseFloat(autoCashoutEl.value);
      
      try {
          const response = await fetch('/start_game', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ 
                  num_mines: numMines, 
                  bet_amount: betAmount,
                  auto_cashout: autoCashout
              })
          });
          
          const data = await response.json();
          
          if (data.success) {
              gameActive = true;
              revealedCount = 0;
              totalSafeCells = GRID_SIZE * GRID_SIZE - numMines;
              
              balanceEl.textContent = data.balance;
              profitEl.textContent = '0';
              multiplierEl.textContent = data.multiplier.toFixed(2);
              
              createBoard();
              updateProgress();
              
              startGameBtn.disabled = true;
              cashOutBtn.disabled = false;
              messageEl.textContent = '';
              messageEl.className = 'message';
              
              // Animate the board
              const cells = document.querySelectorAll('.cell');
              cells.forEach((cell, index) => {
                  cell.style.animationDelay = `${index * 20}ms`;
                  cell.classList.add('animate-in');
                  setTimeout(() => cell.classList.remove('animate-in'), 500);
              });
          } else {
              showMessage(data.message, 'error');
          }
      } catch (error) {
          console.error('Error starting game:', error);
          showMessage('Error starting game. Please try again.', 'error');
      }
  }
  
  // Reveal a cell
  async function revealCell(index) {
      if (!gameActive) return;
      
      const cell = gameBoardEl.querySelector(`[data-index="${index}"]`);
      if (cell.classList.contains('revealed-safe') || cell.classList.contains('revealed-mine')) {
          return;
      }
      
      // Play click sound
      clickSound.currentTime = 0;
      clickSound.play();
      
      try {
          const response = await fetch('/reveal_cell', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ cell_index: index })
          });
          
          const data = await response.json();
          
          if (data.success) {
              if (data.hit_mine) {
                  // Hit a mine - game over
                  cell.classList.add('revealed-mine');
                  
                  // Play lose sound
                  loseSound.currentTime = 0;
                  loseSound.play();
                  
                  // Animate explosion
                  cell.classList.add('explode');
                  
                  // Reveal all mines with delay
                  data.mine_positions.forEach((mineIndex, i) => {
                      setTimeout(() => {
                          const mineCell = gameBoardEl.querySelector(`[data-index="${mineIndex}"]`);
                          if (mineCell && !mineCell.classList.contains('revealed-mine')) {
                              mineCell.classList.add('revealed-mine');
                          }
                      }, i * 200);
                  });
                  
                  gameActive = false;
                  startGameBtn.disabled = false;
                  cashOutBtn.disabled = true;
                  showMessage(data.message, 'error');
                  
                  // Shake the board
                  gameBoardEl.classList.add('shake');
                  setTimeout(() => gameBoardEl.classList.remove('shake'), 1000);
              } else {
                  // Safe cell
                  cell.classList.add('revealed-safe');
                  revealedCount = data.revealed_count;
                  totalSafeCells = data.total_safe;
                  
                  profitEl.textContent = data.profit;
                  multiplierEl.textContent = data.multiplier.toFixed(2);
                  
                  // Pulse the multiplier
                  multiplierEl.classList.add('pulse');
                  setTimeout(() => multiplierEl.classList.remove('pulse'), 500);
                  
                  updateProgress();
                  
                  // Check for auto cash out
                  if (data.auto_cashout) {
                      setTimeout(() => {
                          cashOut();
                          showMessage('Auto cash out triggered!', 'success');
                      }, 500);
                  }
              }
          }
      } catch (error) {
          console.error('Error revealing cell:', error);
      }
  }
  
  // Cash out
  async function cashOut() {
      if (!gameActive) return;
      
      try {
          const response = await fetch('/cash_out', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({})
          });
          
          const data = await response.json();
          
          if (data.success) {
              // Play win sound
              winSound.currentTime = 0;
              winSound.play();
              
              gameActive = false;
              balanceEl.textContent = data.balance;
              startGameBtn.disabled = false;
              cashOutBtn.disabled = true;
              showMessage(data.message, 'success');
              
              // Celebrate!
              const cells = document.querySelectorAll('.cell:not(.revealed-safe):not(.revealed-mine)');
              cells.forEach(cell => {
                  cell.classList.add('revealed-safe');
              });
              
              // Update stats tab without reloading
              setTimeout(() => {
                  const statsTab = document.querySelector('[data-tab="stats"]');
                  if (statsTab) {
                      statsTab.click();
                      setTimeout(() => {
                          document.querySelector('[data-tab="game"]').click();
                      }, 1500);
                  }
              }, 1000);
          }
      } catch (error) {
          console.error('Error cashing out:', error);
      }
  }
  
  // Reset statistics
  async function resetStats() {
      if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
          try {
              const response = await fetch('/reset_stats', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({})
              });
              
              const data = await response.json();
              
              if (data.success) {
                  showMessage(data.message, 'success');
                  // Reload the page to refresh stats
                  setTimeout(() => {
                      window.location.reload();
                  }, 1000);
              }
          } catch (error) {
              console.error('Error resetting stats:', error);
          }
      }
  }
  
  // Event listeners
  startGameBtn.addEventListener('click', startGame);
  cashOutBtn.addEventListener('click', cashOut);
  resetStatsBtn.addEventListener('click', resetStats);
  
  // Initialize the board on load
  createBoard();
});
