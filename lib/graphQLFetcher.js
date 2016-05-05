apiHeaders = lgJWT => {
  const headers = {
    'Authorization': `Bearer ${lgJWT}`,
    'Content-Type': 'application/json',
    'LearnersGuild-Skip-Update-User-Middleware': 1,
  }
  if (typeof process !== 'undefined') {
    // server-side -- set origin
    if (!process.env.APP_BASEURL) {
      throw new Error('APP_BASEURL must be set in environment!')
    }
    headers['Origin'] = process.env.APP_BASEURL
  }

  return headers
}

rawGraphQLFetcher = (lgJWT, baseURL) => {
  return graphQLParams => {
    const options = {
      headers: apiHeaders(lgJWT),
      data: graphQLParams,
    }

    return new Promise((resolve, reject) => {
      HTTP.post(`${baseURL}/graphql`, options, (error, response) => {
        if (error) {
          return reject(error)
        }
        return resolve(response)
      })
    })
  }
}

graphQLFetcher = (lgJWT, baseURL) => {
  return graphQLParams => {
    return rawGraphQLFetcher(lgJWT, baseURL)(graphQLParams)
      .then(response => response.data)
      .then(graphQLResponse => {
        if (graphQLResponse.errors) {
          const messages = graphQLResponse.errors.map(e => e.message)
          throw new Error(messages.join('\n'))
        }
        return graphQLResponse.data
      })
  }
}
