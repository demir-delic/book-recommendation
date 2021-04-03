#!/usr/bin/env node

require("dotenv").config();
const utils = require("./utils");
const fs = require("fs");
const terminalImage = require("terminal-image");
const terminalLink = require("terminal-link");
const axios = require("axios").default;
const got = require("got");
const chalk = require("chalk");

var argv = require("yargs/yargs")(process.argv.slice(2))
  .usage("Usage: yarn start [options]")
  .options({
    d: {
      alias: "debug",
      description: "Display detailed errors and debugging information.",
      type: "boolean",
    },
    e: {
      alias: "expanded",
      description: "Use expanded word bank from API instead of local word bank.",
      type: "boolean",
    },
    l: {
      alias: "lowdetail",
      description:
        "Don't require a recommended book to include a description and download link. Included by default when --query is used.",
      type: "boolean",
    },
    q: {
      alias: "query",
      description:
        "Specify a word to search for instead having a word picked from a list at random. Includes --lowdetail by default.",
      type: "string",
      nargs: 1,
    },
  })
  .help("h")
  .alias("h", "help").argv;

const userSuppliedWord = argv.query;
const isVolumeDetailOptional = argv.lowdetail ? true : false;
const isDebugModeEnabled = argv.debug ? true : false;
const isWordsApiEnabled = argv.expanded ? true : false;
let hasRetryStarted = false;
const MAX_API_CALLS = 10;
let countApiCalls = 0;

const main = () => {
  ++countApiCalls;
  if (countApiCalls >= MAX_API_CALLS) {
    console.log("\nSorry, a match could not be found.");
    return 1;
  }
  getWord().then((word) => {
    // console.log(word);
    getBookResults(word).then((response) => {
      let volumes = [];

      // extract properties used by application
      response.data.items.forEach((volume) => {
        if (
          isVolumeDetailOptional ||
          userSuppliedWord ||
          (volume.volumeInfo.description &&
            (volume.accessInfo.epub.downloadLink || volume.accessInfo.pdf.downloadLink))
        ) {
          volumes.push({
            title: volume.volumeInfo.title,
            subtitle: volume.volumeInfo?.subtitle,
            description: volume.volumeInfo?.description,
            image: volume.volumeInfo.imageLinks?.thumbnail,
            epubLink: volume.accessInfo.epub?.downloadLink,
            pdfLink: volume.accessInfo.pdf?.downloadLink,
          });
        }
      });

      if (!volumes?.length) {
        if (!hasRetryStarted) {
          process.stdout.write("Searching");
          hasRetryStarted = true;
        }
        process.stdout.write(".");
        main();
      } else {
        utils.removeEmptyProps(volumes);
        const chosenVolume = utils.randomArrayElement(volumes);
        printOutput(chosenVolume);
      }
    });
  });
};

const getRandomWordFromApi = async () => {
  // https://rapidapi.com/dpventures/api/wordsapi
  const RAPIDAPI_WORDS_API_KEY = process.env.RAPIDAPI_WORDS_API_KEY;
  const url = "https://wordsapiv1.p.rapidapi.com/words/";

  let options = {
    params: { random: "true" },
    headers: {
      "x-rapidapi-key": RAPIDAPI_WORDS_API_KEY,
      "x-rapidapi-host": "wordsapiv1.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.get(url, options);
    return response.data.word;
  } catch (error) {
    utils.logAxiosError(error, isDebugModeEnabled);
  }
};

const getWord = async () => {
  if (userSuppliedWord) {
    return userSuppliedWord;
  } else if (!isWordsApiEnabled) {
    var randomWordFromFile = utils.randomArrayElement(
      fs.readFileSync("10000-common-english-words.txt", "utf8").toString().split("\n")
    );
    return randomWordFromFile;
  } else {
    return getRandomWordFromApi();
  }
};

const getBookResults = async (word) => {
  const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
  const BASE_URL = "https://www.googleapis.com/books/v1/volumes";
  const chosenWord = argv.query || word;

  const queryParams = {
    download: "epub",
    langRestrict: "en",
    maxResults: 40,
    printType: "books",
    projection: "lite",
    q: encodeURI(chosenWord), // full-text query string
  };

  let query = "";

  // assumes that there is at least one query parameter
  for (const [queryParam, value] of Object.entries(queryParams)) {
    query += `${queryParam}=${value}&`;
  }

  const url = `${BASE_URL}?${query}key=${GOOGLE_BOOKS_API_KEY}`;

  try {
    const response = await axios.get(url);
    return response;
  } catch (error) {
    utils.logAxiosError(error, isDebugModeEnabled);
  }
};

const printOutput = (volume) => {
  console.log(
    `\n\n${chalk.bold.underline(volume.title + (volume.subtitle ? `: ${volume.subtitle}` : ""))}`,
    `${volume.description ? `\n\n${volume.description}` : ""}`,
    `${
      volume.epubLink || volume.pdfLink
        ? `\n\nDownload:
  ${volume.pdfLink ? `- ${terminalLink("PDF", volume.pdfLink)}` : ""}
  ${volume.epubLink ? `- ${terminalLink("ePUB", volume.epubLink)}` : ""}`
        : ""
    }
`
  );
  (async () => {
    const body = await got(volume.image).buffer();
    console.log(await terminalImage.buffer(body, { width: "30%", height: "30%" }));
  })();
};

main();
