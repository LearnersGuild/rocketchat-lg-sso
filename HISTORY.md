# History

#### 0.7.1
- Store phone number from IDM so that it shows up in profile panel (Fixes #34)
- Store only the primary IDM email address to avoid confusion (Fixes #35)

#### 0.7.0
- Don't store `lgPlayer` or create chapter rooms

#### 0.6.1
- New users must be of type 'bot' or type 'user' (Fixes #29.)

#### 0.6.0
- Use GitHub avatar rather than gravatar (Fixes #26.)
- Better error handling when authentication fails (Fixes #27.)

#### 0.5.8
- Be more defensive when trying to set avatar from gravatar. (Fixes #24.)

#### 0.5.7
- Be more defensive when reading the Meteor user record and handle errors gracefully. (Fixes #16, #21, and #22.)

#### 0.5.5
- Make echo (the bot) have the `bot` role

#### 0.5.4
- Update user avatar from gravatar on sign-in

#### 0.5.3
- Added a quick 'n' dirty :echo: --> :elephant: mapper

#### 0.5.2
- Rename `lg-bot` to `echo`
- Use ROOT_URL rather than APP_BASEURL

#### 0.5.1
- Upgrade @learnersguild/idm-jwt-auth

#### 0.5.0
- Allow `inviteCode=XXX` to redirect to sign-up rather than sign-in page

#### 0.4.7
- Removing bulk-* permissions from roles list for bot.

#### 0.4.5
- updating README

#### 0.4.4
- rename `__lgadmin__` to `lg-bot`
- ensure that the bot user has all of the API permissions needed
