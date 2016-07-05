/* global userFromJWT:true */
/* exported userFromJWT */
userFromJWT = Npm.require('@learnersguild/idm-jwt-auth/lib/utils').userFromJWT
const Future = Npm.require('fibers/future')

function fetchPlayer(lgJWT, lgUser) {
  const fut = new Future()

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
  /* global graphQLFetcher */
  graphQLFetcher(lgJWT, baseURL)(query)
    .then(data => fut.return(data.getPlayerById))
    .catch(err => {
      console.error('[LG SSO] ERROR getting player info', err.stack)
      RavenLogger.log(err)
      fut.throw(err)
    })

  return fut.wait()
}

function findOrCreateChapterRoom(rcUser, chapterChannelName) {
  let channelRoom = RocketChat.models.Rooms.findOneByName(chapterChannelName)
  if (!channelRoom) {
    Meteor.runAsUser(rcUser._id, () => {
      const channel = Meteor.call('createChannel', chapterChannelName, [])
      channelRoom = RocketChat.models.Rooms.findOne({_id: channel.rid})
      console.log(`[LG SSO] created '${chapterChannelName}' chapter room`)
    })
  }
  return channelRoom
}

function joinRoom(rcUser, roomName) {
  Meteor.runAsUser(rcUser._id, () => {
    const room = RocketChat.models.Rooms.findOneByName(roomName)
    Meteor.call('joinRoom', room._id)
  })
}

function joinRooms(rcUser) {
  joinRoom(rcUser, 'general')

  const {lgPlayer} = rcUser.services.lgSSO
  if (lgPlayer) {
    joinRoom(rcUser, 'welcome')
    const chapterRoom = findOrCreateChapterRoom(rcUser, lgPlayer.chapter.channelName)
    joinRoom(rcUser, chapterRoom.name)
  }
}

function setAvatarFromGitHubAvatar(rcUser, lgUser) {
  Meteor.runAsUser(rcUser._id, () => {
    console.log('[LG SSO] setting avatar from GitHub avatar')
    const url = `https://github.com/${lgUser.handle}.png?s=200`
    Meteor.call('setAvatarFromService', url, null, 'url')
  })
}

function createOrUpdateUserFromJWT(lgJWT) {
  // console.log('[LG SSO] public key:', process.env.JWT_PUBLIC_KEY)
  const lgUser = userFromJWT(lgJWT)
  // console.log('[LG SSO] lgUser:', lgUser)

  let rcUser = Meteor.users.findOne({
    'emails.address': {
      $in: lgUser.emails
    }
  })
  const roles = ['user']
  if (lgUser.roles.indexOf('backoffice') >= 0) {
    roles.push('admin')
  }
  const newUser = {
    name: lgUser.name,
    username: lgUser.handle,
    emails: lgUser.emails.map(email => {
      return {address: email, verified: true}
    }),
    roles,
    type: 'user',
    active: true,
  }

  if (rcUser) {
    console.log('[LG SSO] found user, updating Rocket.Chat user info')
    // don't kill any previous resume tokens when updating user info
    const mergedUser = Object.assign({}, newUser, {services: rcUser.services})
    Meteor.users.update(rcUser, mergedUser)
    rcUser = Meteor.users.findOne(rcUser._id)
  } else {
    console.log('[LG SSO] no such user, creating new Rocket.chat user')
    const userId = Accounts.insertUserDoc({}, newUser)
    rcUser = Meteor.users.findOne(userId)
  }

  // update user avatar using GitHub avatar
  try {
    setAvatarFromGitHubAvatar(rcUser, lgUser)
  } catch (err) {
    RavenLogger.log(err)
    console.warn('[LG SSO] could not set avatar from GitHub avatar', err.stack)
  }

  // create or update the lgJWT, user info, and player info
  const lgSSO = {
    lgUser,
    lgJWT,
  }
  if (lgUser.roles.indexOf('player') >= 0) {
    lgSSO.lgPlayer = fetchPlayer(lgJWT, lgUser)
  }
  const services = Object.assign({}, rcUser.services, {lgSSO})
  Meteor.users.update(rcUser, {
    $set: {services}
  })
  rcUser = Meteor.users.findOne(rcUser._id)

  return rcUser
}

// allow the client to update our user record
Meteor.methods({createOrUpdateUserFromJWT})

Accounts.registerLoginHandler(loginRequest => {
  // console.log('[LG SSO] loginRequest:', loginRequest)
  const {lgSSO, lgJWT} = loginRequest
  if (!lgSSO || !lgJWT) {
    return undefined
  }

  try {
    const rcUser = createOrUpdateUserFromJWT(lgJWT)

    try {
      joinRooms(rcUser)
    } catch (err) {
      RavenLogger.log(err)
      console.warn('[LG SSO] could not join default rooms', err.stack)
    }

    // create or update the login token
    const stampedToken = Accounts._generateStampedLoginToken()
    Meteor.users.update(rcUser, {
      $push: {
        'services.resume.loginTokens': stampedToken
      }
    })

    // console.log('userId:', user._id, 'token:', stampedToken.token)
    return {userId: rcUser._id, token: stampedToken.token}
  } catch (err) {
    RavenLogger.log(err)
    console.error('[LG SSO] error signing-in using SSO on idm service', err.stack)
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
  }
  this.ready()
})
