const Game = require('../db').model('game')
const initializedBoardData = require('./initializedBoard')

module.exports = io => {
  let userLobby = {}
  let activeGames = {'Default Game': {}}
  let gameDecks = {}
  let chatHistory = {Lobby: [], 'Default Game': []}
  const numPlayers = 2

  class User {
    constructor(data, socketId) {
      this.id = data.id
      this.email = data.email
      this.username = data.username || data.email.split('@')[0]
      this.socketId = socketId
      this.activeGame = 'Default Game'
      this.activeRoom = 'Lobby'
    }
  }

  //Fisher-Yates Shuffle
  function shuffle(array) {
    var currentIndex = array.length,
      temporaryValue,
      randomIndex

    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex -= 1

      temporaryValue = array[currentIndex]
      array[currentIndex] = array[randomIndex]
      array[randomIndex] = temporaryValue
    }

    return array
  }

  function generateDeck() {
    console.log('generate deck')
    const cards = ['monopoly', 'monopoly', 'road', 'road', 'plenty', 'plenty']
    for (let i = 0; i < 14; i++) {
      cards.push('knight')
    }
    for (let i = 0; i < 5; i++) {
      cards.push('vp')
    }
    shuffle(cards)
    gameDecks.defaultGame = cards
  }

  function getRandomCard(gameId) {
    return gameDecks[gameId].pop()
  }

  generateDeck()

  /**
   * THESE ARE VARS USED BY RYAN - TO INTEGRATE
   */
  let colors = {
    1: 'red',
    2: 'green',
    3: 'blue',
    4: 'orange'
  }

  function log(msg) {
    console.log('[ server socket ]', msg)
  }

  function resetAllGames() {
    activeGames = {'Default Game': {}}
  }

  function updateLobby() {
    io.sockets
      .in('lobby')
      .emit('update-lobby', userLobby, activeGames, chatHistory.Lobby)
  }

  function leaveAllRooms(socket) {
    for (let roomId in socket.rooms) {
      if (socket.rooms.hasOwnProperty(roomId)) {
        socket.emit('log-server-message', `leaving room ${roomId}`)
        socket.leave(socket.rooms[roomId])
      }
    }
  }

  io.on('connection', socket => {
    /*******************************************
     * GAME LISTENERS
     *******************************************/
    socket.on('get-dev-card', gameId => {
      let card = getRandomCard(gameId)
      socket.emit('send-card-to-user', card)
    })

    /*******************************************
     * LOBBY LISTENERS
     *******************************************/

    console.log(`A socket connection to the server has been made: ${socket.id}`)

    socket.on('join-lobby', user => {
      let gameUser = new User(user, socket.id)
      userLobby[socket.id] = gameUser
      leaveAllRooms(socket)
      socket.join('lobby')
      socket.emit('connectToRoom', 'Lobby')
      updateLobby()
    })

    socket.on('switch-room', room => {
      leaveAllRooms(socket)
      socket.join(room)

      console.log('User Rooms: ', socket.rooms)

      io.sockets.in('lobby').emit('log-server-message', 'message to lobby')
      updateLobby()
      io.sockets.in(room).emit('log-server-message', `message to ${room}`)
      socket.emit('connectToRoom', room)
    })

    socket.on('join-game', async gameId => {
      console.log('join-game gameId', gameId)
      activeGames[gameId][socket.id] = userLobby[socket.id]
      updateLobby()
      const userKeys = Object.keys(activeGames[gameId])
      /**
       * START NEW GAME
       */

      if (userKeys.length === numPlayers) {
        const board = await Game.create({
          board_data: JSON.stringify(initializedBoardData)
        })

        let gameUsers = []
        let playerNumber = 0
        userKeys.forEach(socketId => {
          delete activeGames[gameId][socketId]
          let user = userLobby[socketId]
          playerNumber++
          user.playerNumber = playerNumber
          gameUsers.push(user)
          delete userLobby[socketId]

          socket.leave('lobby')
          socket.join('gameroom')

          io.to(socketId).emit('start-game', board.board_data, {
            number: playerNumber,
            color: colors[playerNumber],
            userProfile: user
          })
        })
        io.sockets.in('gameroom').emit('set-game-users', gameUsers)
        updateLobby()
      }
    })

    socket.on('reset-all-games', () => {
      log('reset-all-games')
      resetAllGames()
      updateLobby()
    })

    socket.on('disconnect', () => {
      console.log(`Connection ${socket.id} has left the building`)
      delete userLobby[socket.id]
      delete activeGames['Default Game'][socket.id]
      updateLobby()
    })

    socket.on('delete-user-from-game', (email, gameId) => {
      console.log('delete-user-from-game', email, gameId)

      let game = activeGames[gameId]
      for (let key in game) {
        if (game[key].email === email) {
          log('deleting user from game', game[key])
          delete game[key]
        }
      }
    })

    socket.on('leave-game', gameId => {
      console.log('leave-game', gameId, socket.id)
      if (gameId) {
        delete activeGames[gameId][socket.id]
        updateLobby()
      }
    })

    socket.on('send-message', (message, room) => {
      console.log('send-message', room, message)
      if (!room) room = 'Lobby'

      chatHistory[room].push({username: userLobby[socket.id].username, message})
      io.sockets.in('lobby').emit('update-chat', chatHistory[room])
    })

    /**
     * THESE ARE NEW FUNCTIONS FROM RYAN TO INTEGRATE
     */

    socket.on('dispatch', value => {
      console.log('dispatch - this is an opportunity to update state on server')
      console.log(value)
      socket.broadcast.emit('dispatch', value)
    })
    socket.on('dispatchThunk', action => {
      console.log(
        'dispatchThunk - this is an opportunity to update state on server'
      )
      console.log(action)
      socket.broadcast.emit('dispatchThunk', action)
    })

    socket.on('startGame', () => {
      io.sockets.emit('dispatch', {
        type: 'START_GAME',
        modle: false,
        playerTurn: 1
      })
    })
  })
}
