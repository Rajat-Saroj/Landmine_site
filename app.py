from flask import Flask, render_template, jsonify, request, session
import random
import os
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'landmine-game-secret-key'
app.config['SESSION_TYPE'] = 'filesystem'

@app.route('/')
def index():
    # Initialize session data if not present
    if 'balance' not in session:
        session['balance'] = 1000
        session['stats'] = {
            'games_played': 0,
            'wins': 0,
            'losses': 0,
            'highest_profit': 0
        }
        session['history'] = []
    
    return render_template('index.html', 
                           balance=session['balance'],
                           stats=session['stats'],
                           history=session['history'])

@app.route('/start_game', methods=['POST'])
def start_game():
    data = request.json
    num_mines = int(data.get('num_mines', 3))
    bet_amount = int(data.get('bet_amount', 100))
    auto_cashout = data.get('auto_cashout', 0)
    
    # Validate game parameters
    if bet_amount > session['balance'] or bet_amount <= 0:
        return jsonify({'success': False, 'message': 'Invalid bet amount'})
    
    grid_size = 5
    total_cells = grid_size * grid_size
    
    if num_mines < 1 or num_mines >= total_cells - 1:
        return jsonify({'success': False, 'message': 'Invalid number of mines'})
    
    # Update session data
    session['balance'] -= bet_amount
    session['current_game'] = {
        'num_mines': num_mines,
        'bet_amount': bet_amount,
        'mine_positions': random.sample(range(total_cells), num_mines),
        'revealed_cells': [],
        'profit': 0,
        'multiplier': 1.0,
        'start_time': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'auto_cashout': float(auto_cashout) if auto_cashout else 0
    }
    session['stats']['games_played'] += 1
    session.modified = True
    
    return jsonify({
        'success': True,
        'balance': session['balance'],
        'multiplier': session['current_game']['multiplier']
    })

@app.route('/reveal_cell', methods=['POST'])
def reveal_cell():
    if 'current_game' not in session:
        return jsonify({'success': False, 'message': 'No active game'})
    
    cell_index = int(request.json.get('cell_index'))
    current_game = session['current_game']
    
    if cell_index in current_game['revealed_cells']:
        return jsonify({'success': False, 'message': 'Cell already revealed'})
    
    current_game['revealed_cells'].append(cell_index)
    
    if cell_index in current_game['mine_positions']:
        # Hit a mine - game over
        session['stats']['losses'] += 1
        session['history'].append({
            'date': current_game['start_time'],
            'bet': current_game['bet_amount'],
            'mines': current_game['num_mines'],
            'profit': -current_game['bet_amount'],
            'result': 'Loss'
        })
        session.modified = True
        
        return jsonify({
            'success': True,
            'hit_mine': True,
            'mine_positions': current_game['mine_positions'],
            'message': 'You hit a landmine! You lost!'
        })
    else:
        # Safe cell
        grid_size = 5
        total_cells = grid_size * grid_size
        safe_cells = total_cells - current_game['num_mines']
        revealed_safe = len(current_game['revealed_cells'])
        
        # Calculate new multiplier - increases with each safe tile
        # Formula based on risk (more mines = higher multiplier growth)
        risk_factor = current_game['num_mines'] / (total_cells - 1)
        base_multiplier = 1 + (risk_factor * revealed_safe * 0.5)
        current_game['multiplier'] = round(base_multiplier, 2)
        
        current_game['profit'] = int(current_game['bet_amount'] * (current_game['multiplier'] - 1))
        
        session.modified = True
        
        # Check for auto cash out
        should_auto_cashout = False
        if current_game['auto_cashout'] > 0 and current_game['multiplier'] >= current_game['auto_cashout']:
            should_auto_cashout = True
            
        return jsonify({
            'success': True,
            'hit_mine': False,
            'profit': current_game['profit'],
            'multiplier': current_game['multiplier'],
            'revealed_count': revealed_safe,
            'total_safe': safe_cells,
            'auto_cashout': should_auto_cashout
        })

@app.route('/cash_out', methods=['POST'])
def cash_out():
    if 'current_game' not in session:
        return jsonify({'success': False, 'message': 'No active game'})
    
    current_game = session['current_game']
    win_amount = current_game['bet_amount'] + current_game['profit']
    
    session['balance'] += win_amount
    
    # Update stats
    session['stats']['wins'] += 1
    if current_game['profit'] > session['stats']['highest_profit']:
        session['stats']['highest_profit'] = current_game['profit']
    
    # Add to history
    session['history'].append({
        'date': current_game['start_time'],
        'bet': current_game['bet_amount'],
        'mines': current_game['num_mines'],
        'profit': current_game['profit'],
        'result': 'Win'
    })
    
    # Keep history limited to last 10 games
    if len(session['history']) > 10:
        session['history'] = session['history'][-10:]
    
    del session['current_game']
    session.modified = True
    
    return jsonify({
        'success': True,
        'balance': session['balance'],
        'message': 'Successfully cashed out!'
    })

@app.route('/reset_stats', methods=['POST'])
def reset_stats():
    session['stats'] = {
        'games_played': 0,
        'wins': 0,
        'losses': 0,
        'highest_profit': 0
    }
    session['history'] = []
    session.modified = True
    
    return jsonify({
        'success': True,
        'message': 'Statistics reset successfully'
    })

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
