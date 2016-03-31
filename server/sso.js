userFromJWT = Npm.require('@learnersguild/idm-jwt-auth/lib/utils').userFromJWT

function createOrUpdateUserFromJWT(lgJWT) {
  // console.log('[LG SSO] public key:', process.env.JWT_PUBLIC_KEY)
  const userInfo = userFromJWT(lgJWT)
  // console.log('[LG SSO] userInfo:', userInfo)

  let user = Meteor.users.findOne({
    'emails.address': {
      $in: userInfo.emails
    }
  })
  const globalRoles = ['user']
  if (userInfo.roles.indexOf('staff') >= 0) {
    globalRoles.push('admin')
  }
  const newUser = {
    name: userInfo.name,
    username: userInfo.handle,
    emails: userInfo.emails.map(email => {
      return {address: email, verified: true}
    }),
    globalRoles,
    active: true,
    avatarOrigin: 'gravatar'
  }

  if (user) {
    console.log('[LG SSO] found user, updating Rocket.Chat user info')
    Meteor.users.update(user, newUser)
    user = Meteor.users.findOne(user._id)
  } else {
    console.log('[LG SSO] no such user, creating new user')
    const userId = Accounts.insertUserDoc({}, newUser)
    user = Meteor.users.findOne(userId)
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
  const cookies = new Cookies()
  const {lgSSO, lgJWT} = loginRequest
  if(!lgSSO || !lgJWT) {
    return undefined
  }

  try {
    const {userId, token} = createOrUpdateUserFromJWT(lgJWT)
    // console.log('userId:', userId, 'token:', token)
    return {userId, token}
  } catch (err) {
    console.error('[LG SSO] invalid or expired lgJWT token cookie', err.stack)
    cookies.remove('rc_lgJWT')
  }

  return undefined
})

// set-up middleware to pull token info from our server-only cookie and cram
// it into a client-side Meteor cookie with a similar name to handle sign-in
// from the cookie
const cookie = new Cookies({
  auto: true,
  handler: cookies => {
    const lgJWT = cookies.get('lgJWT')
    if (lgJWT) {
      // if the token is valid, set the Rocket.Chat JWT cookie
      try {
        const userInfo = userFromJWT(lgJWT)
        const secure = (process.env.NODE_ENV === 'production')
        cookies.set('rc_lgJWT', lgJWT, {secure})
      } catch (err) {
        console.error('[LG SSO] invalid or expired lgJWT token cookie', err.stack)
      }
    } else {
      console.log('[LG SSO] no lgJWT cookie. Available cookies:', cookies.keys())
    }
  }
})
WebApp.connectHandlers.use(cookie.middleware())
