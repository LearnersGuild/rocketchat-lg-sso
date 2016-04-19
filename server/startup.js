function ensureAdminUserExists() {
  let user = Meteor.users.findOne({username: '__lgadmin__'})
  if (!user) {
    const adminUserDoc = {
      name: 'Learners Guild Admin',
      username: '__lgadmin__',
      emails: [{
        address: 'admin@learnersguild.org',
        verified: true,
      }],
      roles: ['admin'],
      active: true,
      avatarOrigin: 'gravatar',
    }
    const userId = Accounts.insertUserDoc({}, adminUserDoc)
    user = Meteor.users.findOne(userId)
    console.log('[LG SSO] created LG admin user')
  } else {
    console.log('[LG SSO] found existing LG admin user')
  }

  return user
}

function ensureWelcomChannelExists(adminUser) {
  let welcomeRoom = RocketChat.models.Rooms.findOneByName('welcome')
  if (welcomeRoom) {
    console.log('[LG SSO] found existing welcome room')
    return
  }
  Meteor.runAsUser(adminUser._id, () => {
    const channel = Meteor.call('createChannel', 'welcome', [])
    welcomeRoom = RocketChat.models.Rooms.findOne({_id: channel.rid})
    console.log('[LG SSO] created welcome room')
  })
}

Meteor.startup(() => {
  if (!process.env.JWT_PUBLIC_KEY) {
    throw new Error('JWT_PUBLIC_KEY must be set in environment!')
  }

  // create admin user (if it doesn't exist -- for Meteor.runAsUser() purposes)
  const adminUser = ensureAdminUserExists()

  // create welcome channel if it doesn't exist
  ensureWelcomChannelExists(adminUser)

  // ensure that the admin user doesn't belong to any rooms
  RocketChat.models.Rooms.removeUsernameFromAll('__lgadmin__')
})
