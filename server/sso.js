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
      name
      channelName
      timezone
      goalRepositoryURL
    }
  }
}
    `,
    variables: {id: lgUser.id},
  }
  return graphQLFetcher(lgJWT, baseURL)(query)
    .then(graphQLResponse => {
      if (graphQLResponse.errors) {
        const messages = graphQLResponse.errors.map(e => e.message)
        throw new Error(messages.join('\n'))
      }
      return graphQLResponse.data.getPlayerById
    })
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

function joinRoom(rcUser, roomName) {
  Meteor.runAsUser(rcUser._id, () => {
    const room = RocketChat.models.Rooms.findOneByName(roomName)
    Meteor.call('joinRoom', room._id)
  })
}

function lgUserSetup(rcUser, lgJWT, lgUser, userIsNew) {
  // save our token
  Meteor.users.update(rcUser, {
    $set: {
      'services.lgSSO': {
        userInfo: lgUser,
        lgJWT,
      },
    },
  })

  if (userIsNew) {
    joinRoom(rcUser, 'general')
  }
  if (lgUser.roles.indexOf('player') >= 0) {
    fetchPlayer(lgJWT, lgUser)
      .then(player => {
        // save our player info
        Meteor.users.update(rcUser, {
          $set: {
            'services.lgSSO.playerInfo': player,
          }
        })

        if (userIsNew) {
          joinRoom(rcUser, 'welcome')
          const chapterRoom = findOrCreateChapterRoom(player.chapter.channelName)
          joinRoom(rcUser, chapterRoom.name)
        }
      })
      .catch(error => {
        // TODO: log to sentry
        console.error('[LG SSO] ERROR getting player info', error.stack)
      })
  }
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

    // Learners Guild specific setup
    lgUserSetup(user, lgJWT, userInfo, false)
  } else {
    console.log('[LG SSO] no such user, creating new Rocket.chat user')
    const userId = Accounts.insertUserDoc({}, newUser)
    user = Meteor.users.findOne(userId)

    // Learners Guild specific setup
    lgUserSetup(user, lgJWT, userInfo, true)
  }

  // update the login token
  user = Meteor.users.findOne(user._id)  // re-fetch in case lgUserSetup updated
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

// make sure our lgSSO service data is returned with user object
Meteor.publish('lgUserData', function () {
  if (this.userId) {
    return Meteor.users.find(
      {_id: this.userId},
      {fields: {'services.lgSSO': 1}}
    )
  } else {
    this.ready()
  }
})
