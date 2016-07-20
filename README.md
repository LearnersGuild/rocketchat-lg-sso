# DEPRECATED: this repo has been merged into [echo-chat][echo-chat]

# learnersguild:rocketchat-lg-sso

Log in to Rocket.Chat using Learners Guild SSO.

This simple package listens for the creation of the `loginLayout` template in Rocket.Chat, and initiates a cookie-based login process based on Learners Guild's SSO / Identity Management (IDM) service.

**NOTE:** This package will likely not be useful for anyone outside of [Learners Guild][learnersguild].

## Getting Started (Dev)

Be sure you've read the [instructions for contributing](./CONTRIBUTING.md).

1. Get your local [IDM][IDM] up and running.

2. Get your local [Rocket.Chat][Rocket.Chat] up and running.

3. Clone this repository.

4. From your local Rocket.Chat repository's `packages` folder, add a symlink to this repo, then add the package:

        $ ln -s ../rocketchat-lg-sso .
        $ meteor add learnersguild:rocketchat-lg-sso

5. Start the server.

        $ learners-guild/start.sh

## License

See the [LICENSE](./LICENSE) file.


[IDM]: https://github.com/LearnersGuild/idm
[echo-chat]: https://github.com/LearnersGuild/echo-chat
[Rocket.Chat]: https://github.com/LearnersGuild/Rocket.Chat
[learnersguild]: https://learnersguild.org/
