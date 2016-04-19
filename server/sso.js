userFromJWT = Npm.require('@learnersguild/idm-jwt-auth/lib/utils').userFromJWT

function graphQLFetcher(lgJWT, baseURL) {
  return graphQLParams => {
    if (!process.env.APP_BASEURL) {
      throw new Error('APP_BASEURL must be set in environment')
    }
    const options = {
      headers: {
        'Authorization': `Bearer ${lgJWT}`,
        'Origin': process.env.APP_BASEURL,
        'Content-Type': 'application/json',
        'LearnersGuild-Skip-Update-User-Middleware': 1,
      },
      data: graphQLParams,
    }

    return new Promise((resolve, reject) => {
      HTTP.post(`${baseURL}/graphql`, options, (error, response) => {
        if (error) {
          return reject(error)
        }
        return resolve(response.data)
      })
    })
  }
}

function fetchPlayer(lgJWT, lgUser) {
  const baseURL = process.env.NODE_ENV === 'development' ? 'http://game.learnersguild.dev' : 'https://game.learnersguild.org'
  const query = {
    query: `
query($id: ID!) {
  getPlayerById(id: $id) {
    id
    chapter {
      channelName
    }
  }
}
    `,
    variables: {id: lgUser.id},
  }
  return graphQLFetcher(lgJWT, baseURL)(query)
    .then(graphQLResponse => graphQLResponse.data.getPlayerById)
}

function findOrCreateChapterRoom(chapterChannelName) {
  let channelRoom = RocketChat.models.Rooms.findOneByName(chapterChannelName)
  if (!channelRoom) {
    const channel = Meteor.call('createChannel', chapterChannelName, [])
    channelRoom = RocketChat.models.Rooms.findOne({_id: channel.rid})
    console.log(`[LG SSO] created '${chapterChannelName}' chapter room`)
  }
  return channelRoom
}

function joinRooms(rcUser, lgJWT, lgUser) {
  Meteor.runAsUser(rcUser._id, () => {
    // join general room
    const generalRoom = RocketChat.models.Rooms.findOneByName('general')
    Meteor.call('joinRoom', generalRoom._id)

    if (lgUser.roles.indexOf('player') >= 0) {
      // join welcome room
      const welcomeRoom = RocketChat.models.Rooms.findOneByName('welcome')
      Meteor.call('joinRoom', welcomeRoom._id)

      // join chapter room (after fetching player from game service)
      fetchPlayer(lgJWT, lgUser)
        .then(player => {
          const channelRoom = findOrCreateChapterRoom(player.chapter.channelName)
          Meteor.call('joinRoom', channelRoom._id)
        })
        .catch(error => {
          // TODO: log to sentry
          console.error('[LG SSO] ERROR getting player info', error.stack)
        })
    }
  })
}

function createOrUpdateUserFromJWT(lgJWT) {
  // console.log('[LG SSO] public key:', process.env.JWT_PUBLIC_KEY)
  const userInfo = userFromJWT(lgJWT)
  // console.log('[LG SSO] userInfo:', userInfo)

  let user = Meteor.users.findOne({
    'emails.address': {
      $in: userInfo.emails
    }
  })
  const roles = ['user']
  if (userInfo.roles.indexOf('backoffice') >= 0) {
    roles.push('admin')
  }
  const newUser = {
    name: userInfo.name,
    username: userInfo.handle,
    emails: userInfo.emails.map(email => {
      return {address: email, verified: true}
    }),
    roles,
    active: true,
    avatarOrigin: 'gravatar'
  }

  if (user) {
    console.log('[LG SSO] found user, updating Rocket.Chat user info')
    Meteor.users.update(user, newUser)
    user = Meteor.users.findOne(user._id)
  } else {
    console.log('[LG SSO] no such user, creating new Rocket.chat user')
    const userId = Accounts.insertUserDoc({}, newUser)
    user = Meteor.users.findOne(userId)

    // join any rooms as necessary
    joinRooms(user, lgJWT, userInfo)
  }

  // update the login token
  const stampedToken = Accounts._generateStampedLoginToken()
  Meteor.users.update(user, {
    $push: {
      'services.resume.loginTokens': stampedToken
    }
  })

  return {userId: user._id, token: stampedToken.token}
}

Accounts.registerLoginHandler(loginRequest => {
  // console.log('[LG SSO] loginRequest:', loginRequest)
  const {lgSSO, lgJWT} = loginRequest
  if(!lgSSO || !lgJWT) {
    return undefined
  }

  try {
    const {userId, token} = createOrUpdateUserFromJWT(lgJWT)
    // console.log('userId:', userId, 'token:', token)
    return {userId, token}
  } catch (err) {
    console.error('[LG SSO] invalid or expired lgJWT token', err.stack)
  }

  return undefined
})
