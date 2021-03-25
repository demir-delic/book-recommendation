#!/usr/bin/env node

import { config } from "dotenv";
import * as utils from "./utils.js";
import * as fs from "fs";
import terminalImage from "terminal-image";
import terminalLink from "terminal-link";
import axios from "axios";
import got from "got";
import chalk from "chalk";
import inquirer from "inquirer";

var argv = require("yargs/yargs")(process.argv.slice(2))
  .usage("Usage: yarn start [options]")
  .options({
    d: {
      alias: "debug",
      description: "Display detailed errors and debugging information",
      type: "boolean",
    },
    l: {
      alias: "local",
      description: "Use local word list file instead of random words API",
      type: "boolean",
    },
    n: {
      alias: "nodetail",
      description: "Don't require a recommended book to include a description and download link",
      type: "boolean",
    },
    q: {
      alias: "query",
      description:
        "Specify a word to search for instead having a word picked from a list at random",
      type: "string",
      nargs: 1,
    },
    r: {
      alias: "retry",
      description: "Automatically retry search until a match is found",
      type: "boolean",
    },
  })
  .help("h")
  .alias("h", "help").argv;

const userSuppliedWord = argv.query;
const isVolumeDetailOptional = argv.nodetail ? true : false;
const isAutomaticRetryEnabled = argv.retry ? true : false;
const isDebugModeEnabled = argv.debug ? true : false;
const isWordsApiDisabled = argv.local ? true : false;
let hasRetryStarted = false;
const MAX_API_CALLS = 10;
let countApiCalls = 0;

const main = () => {
  ++countApiCalls;
  if (countApiCalls >= MAX_API_CALLS) {
    console.log("Sorry, a match could not be found.");
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
        if (isAutomaticRetryEnabled) {
          if (!hasRetryStarted) {
            process.stdout.write("Searching");
            hasRetryStarted = true;
          }
          process.stdout.write(".");
          main();
        } else {
          inquirer
            .prompt([
              {
                type: "input",
                message: "\nNo matches were found. Search again? (y/n)",
                name: "search_again",
              },
            ])
            .then((answer) => {
              if (answer.search_again === "n" || answer === "no") {
                return 1;
              } else {
                console.log("Searching...");
                main();
              }
            })
            .catch((error) => {
              if (error.isTtyError) {
                // prompt couldn't be rendered in the current environment
                console.error("Inquirer Prompt TTY Error", error);
              } else {
                // something else went wrong
                console.error("Inquirer Prompt Error", error);
              }
            });
        }
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
  } else if (isWordsApiDisabled) {
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
    // filter: "full",
    printType: "books",
    projection: "lite",
    langRestrict: "en",
    maxResults: 40,
    q: chosenWord, // full-text query string
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
