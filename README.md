# Confused Librarian

Get random book recommendations from the comfort of your terminal. If you like a book's description, a full eBook download is just a click away.

<img src="./example.png" width="600"/>

## Installation and Use

<a name="installation"></a>

**Prerequisites:**

- A free Google Books API key. Refer to the following documentation to obtain a key: https://developers.google.com/books/docs/v1/using#APIKey. The process takes less than 5 minutes with an existing Google account.
- [Node.js](https://nodejs.org) (v12 or above), [Yarn 2](https://yarnpkg.com/getting-started), and a terminal emulator such as [iTerm2](https://iterm2.com).

---

After preparing the prerequisites, clone this repository. Next, create a `.env` file at the project root and add your API key in the following format: `GOOGLE_BOOKS_API_KEY=YOUR_KEY`

Now you're ready to run the script. Thanks to [zero-installs](https://yarnpkg.com/features/zero-installs), there's no need for an installation step.

```shell
# run with all defaults enabled
yarn start
# retry API requests until a matching book is found or too many requests are made
yarn start -retry
# find a random book that contains a query that you specify
yarn start -query myquery
# learn about other options
yarn start -help
```

If you plan to contribute to the repository, you may find it helpful to read about [Yarn 2's editor SDKs](https://yarnpkg.com/getting-started/editor-sdks).

## Motivation

I made this for fun to practice using Node.js and a few of its commonly used dependencies.
