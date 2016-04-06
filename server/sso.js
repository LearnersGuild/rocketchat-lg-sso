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
