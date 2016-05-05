let lastUserActivityAt = 0
function updateLastUserActivityAt() {
  lastUserActivityAt = Date.now()
}

let lastFetchAndUpdateAt = 0
function fetchJWTAndUpdateUserInfo() {
  // we don't want to fetch and update if no one is signed in
  if (!Meteor.user()) {
    return
  }

  // we don't want to fetch and update if the user is not active or if
  // we fetched and updated recently
  const now = Date.now()
  const millisSinceUserActivity = now - lastUserActivityAt
  const millisSinceLastUpdate = now - lastFetchAndUpdateAt
  if (millisSinceUserActivity > (1000 * 60 * 5)) { // 5 mins
    return
  }
  if (millisSinceLastUpdate < (1000 * 60 * 10)) { // 10 mins
    return
  }

  console.log('[LG SSO] fetching new JWT token and updating user info')
  const baseURL = window.location.href.match(/learnersguild\.dev/) ? 'http://idm.learnersguild.dev' : 'https://idm.learnersguild.org'
  const {lgUser, lgJWT} = Meteor.user().services.lgSSO
  const query = {
    query: `
query($id: ID!) {
  getUserById(id: $id) {
    id
  }
}
    `,
    variables: {id: lgUser.id},
  }

  lastFetchAndUpdateAt = now
  return rawGraphQLFetcher(lgJWT, baseURL)(query)
    .then(function(response) {
      const lgJWT = response.headers['learnersguild-jwt']
      if (lgJWT) {
        Meteor.call('createOrUpdateUserFromJWT', lgJWT)
      }
    })
    .catch(function(error) { console.error(error.stack) })
}

// Set up some callbacks to detect when users are active.
RocketChat.callbacks.add('beforeSaveMessage', message => {
  updateLastUserActivityAt()
  return message
}, RocketChat.callbacks.priority.LOW)
RocketChat.callbacks.add('beforeCreateChannel', (user, room) => {
  updateLastUserActivityAt()
  return room
}, RocketChat.callbacks.priority.LOW)
RocketChat.callbacks.add('beforeJoinRoom', (user, room) => {
  updateLastUserActivityAt()
  return room
}, RocketChat.callbacks.priority.LOW)
RocketChat.callbacks.add('beforeLeaveRoom', (user, room) => {
  updateLastUserActivityAt()
  return room
}, RocketChat.callbacks.priority.LOW)

// Every minute, we'll wake up to see if the user is active but has dated
// user information (including JWT token). If so, we'll fetch a new JWT
// token and update our user information in the Rocket.Chat database.
Meteor.setInterval(fetchJWTAndUpdateUserInfo, 1000 * 60)