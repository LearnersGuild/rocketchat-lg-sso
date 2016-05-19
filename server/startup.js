const BOT_USERNAME = 'lg-bot'
function ensureLGBotUserExists() {
  let user = Meteor.users.findOne({username: BOT_USERNAME})
  if (!user) {
    const botUserDoc = {
      name: 'Learners Guild Bot',
      username: BOT_USERNAME,
      emails: [{
        address: 'bot@learnersguild.org',
        verified: true,
      }],
      // make sure we have access to do whatever we want in Rocket.Chat
      // see: https://rocket.chat/docs/developer-guides/rest-api/
      roles: ['admin', 'bulk-register-user', 'bulk-create-c'],
      active: true,
      avatarOrigin: 'gravatar',
    }
    const userId = Accounts.insertUserDoc({}, botUserDoc)
    user = Meteor.users.findOne(userId)
    console.log('[LG SSO] created lg-bot user')
  } else {
    console.log('[LG SSO] found existing lg-bot user')
  }

  Accounts.setPassword(user.id, process.env.CHAT_API_USER_SECRET, {logout: false})
  return user
}

function ensureWelcomChannelExists(botUser) {
  let welcomeRoom = RocketChat.models.Rooms.findOneByName('welcome')
  if (welcomeRoom) {
    console.log('[LG SSO] found existing welcome room')
    return
  }
  Meteor.runAsUser(botUser._id, () => {
    const channel = Meteor.call('createChannel', 'welcome', [])
    welcomeRoom = RocketChat.models.Rooms.findOne({_id: channel.rid})
    console.log('[LG SSO] created welcome room')
  })
}

function ensureEnvironment() {
  [
    'JWT_PUBLIC_KEY',
    'CHAT_API_USER_SECRET',
  ].forEach(envVar => {
    if (!process.env[envVar]) {
      const msg = `${envVar} must be set in environment!`
      RavenLogger.log(msg)
      throw new Error(msg)
    }
  })
}

Meteor.startup(() => {
  ensureEnvironment()

  // create admin user (if it doesn't exist -- for Meteor.runAsUser() purposes)
  const botUser = ensureLGBotUserExists()

  // create welcome channel if it doesn't exist
  ensureWelcomChannelExists(botUser)
})
