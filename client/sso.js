Meteor.loginUsingLearnersGuildJWT = function(lgJWT, userCallback) {
  const methodArguments = [{lgSSO: true, lgJWT }]

  Accounts.callLoginMethod({methodArguments, userCallback})
}

function parseUrl(url) {
  const urlParser = document.createElement('a')
  urlParser.href = window.location.href
  const attrs = urlParser.search.slice(1).split('&')
  const query = attrs.reduce((last, attr) => {
    if (attr) {
      const [k, v] = attr.split('=')
      return Object.assign({}, last, {[k]: v})
    }
    return last
  }, {})
  return {
    protocol: urlParser.protocol,
    host: urlParser.host,
    pathname: urlParser.pathname,
    hash: urlParser.hash,
    query: query,
  }
}

function formatUrl(urlObject) {
  const query = Object.keys(urlObject.query).map(key => {
    return `${key}=${urlObject.query[key]}`
  }).join('&')
  const search = query ? `?${query}` : ''
  const url = `${urlObject.protocol}//${urlObject.host}${urlObject.pathname}${search}${urlObject.hash}`
  return url
}

// This is a weird hack. We'll wait until the loginLayout is created, and once
// it has been created, we'll look for our token (which may have been passed
// back to us from the IDM service if we're being redirected back because we
// pass 'responseType=token' to IDM). If we find it, we'll use it to sign-in.
// Otherwise, we'll redirect to IDM passing 'responseType=token'.
Template.loginLayout.created = function() {
  const urlObject = parseUrl(window.location.href)
  const {lgJWT} = urlObject.query
  if (lgJWT) {
    console.log('[LG SSO] lgJWT token found in query string, logging in')
    if (history && typeof history.pushState === 'function') {
      const newQuery = Object.assign({}, urlObject.query)
      delete newQuery.lgJWT
      urlObject.query = newQuery
      history.pushState({}, '', formatUrl(urlObject))
    }
    return Meteor.loginUsingLearnersGuildJWT(lgJWT)
  }
  console.log('[LG SSO] no lgJWT token found in query string, redirecting to IDM')
  // differentiate between dev and prod
  const idmURL = window.location.href.match(/localhost/) ? 'http://localhost:8081' : 'https://idm.learnersguild.org'
  const redirect = encodeURIComponent(window.location.href)
  console.log('[LG SSO] idmURL:', idmURL, 'redirect:', redirect)
  window.location.href = `${idmURL}/sign-in?redirect=${redirect}&responseType=token`
}
