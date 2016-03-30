const cookies = new Cookies()

Meteor.loginUsingLearnersGuildJWT = function(lgJWT, userCallback) {
  const methodArguments = [{lgSSO: true, lgJWT }]

  Accounts.callLoginMethod({methodArguments, userCallback})
}

// This is a weird hack. We'll wait until the loginLayout is created, and once
// it has been created, we'll look for our cookie (set on the server-side
// middleware). If we find it, we'll use it to sign-in. Otherwise, we'll
// redirect to IDM to make sure we get a valid cookie.
Template.loginLayout.created = function() {
  const lgJWT = cookies.get('rc_lgJWT')
  if (lgJWT) {
    return Meteor.loginUsingLearnersGuildJWT(lgJWT)
  }
  // differentiate between dev and prod
  const idmURL = window.location.href.match(/localhost\:3000/) ? 'http://localhost:8081' : 'https://idm.learnersguild.org'
  const redirect = encodeURIComponent(window.location.href)
  window.location.href = `${idmURL}/sign-in?redirect=${redirect}`
}
