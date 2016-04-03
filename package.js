Package.describe({
  name: 'learnersguild:rocketchat-lg-sso',
  version: '0.2.0',
  summary: 'Accounts login handler for Learners Guild SSO.',
  git: 'https://github.com/LearnersGuild/rocketchat-lg-sso'
})

Package.onUse(function(api) {
  api.versionsFrom('1.2.1')

  api.use([
    'ecmascript'
  ])
  api.use([
    'templating'
  ], 'client')
  api.use([
    'accounts-base',
    'webapp',
  ], 'server')

  api.addFiles('client/sso.js', 'client')
  api.addFiles('server/sso.js', 'server')

  api.export('userFromJWT', 'server')
})

Npm.depends({
  '@learnersguild/idm-jwt-auth': '0.1.3'
})
