if (!Meteor.server.method_handlers.getSentryClientDSN) {
  Meteor.methods({
    getSentryClientDSN: function() {
      return process.env.SENTRY_CLIENT_DSN || null
    },
  })
}

Meteor.startup(function() {
  if (process.env.SENTRY_SERVER_DSN) {
    RavenLogger.initialize({
      server: process.env.SENTRY_SERVER_DSN,
    })
  }
})
